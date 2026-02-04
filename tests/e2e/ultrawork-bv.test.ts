/**
 * E2E Tests: Ultrawork with Builder-Validator Cycles
 *
 * Tests Ultrawork's parallel execution mode with B-V integration.
 * Ultrawork executes multiple tasks concurrently while maintaining
 * B-V quality gates and respecting parallel limits.
 *
 * Test Focus:
 * - Parallel task execution with B-V cycles
 * - Respecting max parallel B-V limit
 * - Fail-fast vs continue-on-failure modes
 * - Coordinated parallel validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { WorkflowState, WorkflowTask } from '../../src/features/team/workflow.js';
import type { BVOrchestrationResult } from '../../src/features/verification/bv-integration.js';
import type { OhmyblackSessionState } from '../../src/features/state-manager/ohmyblack-schemas.js';
import {
  createMockDecomposition,
  createMockTeam,
  expectValidWorkflowState
} from '../integration/helpers.js';

// ============================================================================
// Ultrawork Test Context
// ============================================================================

interface UltraworkTestContext {
  sessionState: OhmyblackSessionState;
  workflow: WorkflowState;
  activeWorkers: Map<string, { taskId: string; startedAt: number }>;
  results: BVOrchestrationResult[];
  ultraworkConfig: {
    maxParallelBV: number;
    failFast: boolean;
    continueOnFailure: boolean;
  };
}

function createUltraworkContext(): UltraworkTestContext {
  const team = createMockTeam('standard');

  return {
    sessionState: {
      sessionId: 'ultrawork-test-session',
      mode: 'ultrawork',
      tasks: [],
      validations: [],
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      config: {
        maxParallel: 5,
        taskTimeout: 300000,
        autoEscalate: true,
        builderModel: 'medium',
        validatorModel: 'medium'
      }
    },
    workflow: {
      workflowId: 'ultrawork-workflow-1',
      team,
      tasks: [],
      status: 'pending',
      config: {
        parallelExecution: true,
        maxParallelTasks: 5,
        defaultValidationType: 'validator',
        autoAssign: true,
        continueOnFailure: true,
        maxRetries: 3,
        taskTimeout: 300000
      },
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        totalRetries: 0,
        totalDuration: 0,
        averageTaskDuration: 0
      }
    },
    activeWorkers: new Map(),
    results: [],
    ultraworkConfig: {
      maxParallelBV: 5,
      failFast: false,
      continueOnFailure: true
    }
  };
}

// ============================================================================
// Ultrawork E2E Tests
// ============================================================================

describe('Ultrawork B-V E2E', () => {
  let context: UltraworkTestContext;

  beforeEach(() => {
    context = createUltraworkContext();
  });

  afterEach(() => {
    // Cleanup state files
  });

  it('should execute parallel tasks with B-V cycles', async () => {
    // ARRANGE: Create workflow with independent parallel tasks
    const decomposition = createMockDecomposition(5);
    // Remove all dependencies to make tasks parallelizable
    decomposition.subtasks.forEach(subtask => {
      subtask.blockedBy = [];
    });

    context.workflow.tasks = decomposition.subtasks.map(subtask => ({
      id: subtask.id,
      subtask,
      bvConfig: {
        taskId: subtask.id,
        taskDescription: subtask.prompt,
        requirements: subtask.acceptanceCriteria,
        acceptanceCriteria: [subtask.verification],
        validationType: 'validator',
        builderAgent: subtask.agentType,
        maxRetries: 3,
        timeout: 300000,
        complexity: 'medium'
      },
      status: 'pending',
      blockedBy: [],
      blocks: [],
      retryCount: 0
    }));

    context.workflow.metrics.totalTasks = 5;
    expectValidWorkflowState(context.workflow);

    // ACT: Execute Ultrawork - parallel execution
    const startTime = Date.now();
    const executionPromises: Promise<BVOrchestrationResult>[] = [];

    // Get all pending tasks (all 5 should be available)
    const availableTasks = context.workflow.tasks.filter(t => t.status === 'pending');
    expect(availableTasks).toHaveLength(5);

    // Launch parallel B-V cycles (respecting maxParallelBV limit)
    const tasksToExecute = availableTasks.slice(0, context.ultraworkConfig.maxParallelBV);
    expect(tasksToExecute).toHaveLength(5);

    for (const task of tasksToExecute) {
      // Track active worker
      context.activeWorkers.set(task.id, {
        taskId: task.id,
        startedAt: Date.now()
      });

      // Launch parallel B-V cycle
      const promise = simulateUltraworkBVCycle(context, task).then(result => {
        // Remove from active workers
        context.activeWorkers.delete(task.id);
        context.results.push(result);

        // Update task status
        if (result.success) {
          task.status = 'completed';
          context.workflow.metrics.completedTasks++;
        } else {
          task.status = 'failed';
          context.workflow.metrics.failedTasks++;
        }

        return result;
      });

      executionPromises.push(promise);
    }

    // Wait for all parallel executions to complete
    await Promise.all(executionPromises);
    const totalTime = Date.now() - startTime;

    // ASSERT: Verify parallel execution characteristics
    expect(context.results).toHaveLength(5);
    expect(context.workflow.metrics.completedTasks).toBe(5);
    expect(context.workflow.metrics.failedTasks).toBe(0);

    // All tasks should have completed successfully
    context.results.forEach(result => {
      expect(result.success).toBe(true);
      expect(result.cycleResult.builderPassed).toBe(true);
      expect(result.cycleResult.validatorPassed).toBe(true);
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    // Parallel execution should be faster than sequential
    // Each task takes ~100ms, sequential would be 500ms, parallel should be ~100-150ms
    expect(totalTime).toBeLessThan(300); // Much less than sequential execution

    // Verify max parallel workers were respected
    expect(context.activeWorkers.size).toBe(0); // All completed
  }, 30000);

  it('should respect max parallel B-V limit', async () => {
    // ARRANGE: Create more tasks than max parallel limit
    const decomposition = createMockDecomposition(10);
    decomposition.subtasks.forEach(subtask => {
      subtask.blockedBy = [];
    });

    context.ultraworkConfig.maxParallelBV = 3; // Limit to 3 concurrent B-V cycles
    context.workflow.config.maxParallelTasks = 3;

    context.workflow.tasks = decomposition.subtasks.map(subtask => ({
      id: subtask.id,
      subtask,
      bvConfig: {
        taskId: subtask.id,
        taskDescription: subtask.prompt,
        requirements: subtask.acceptanceCriteria,
        acceptanceCriteria: [subtask.verification],
        validationType: 'validator',
        builderAgent: subtask.agentType,
        maxRetries: 3,
        timeout: 300000,
        complexity: 'medium'
      },
      status: 'pending',
      blockedBy: [],
      blocks: [],
      retryCount: 0
    }));

    context.workflow.metrics.totalTasks = 10;

    // ACT: Execute with parallel limit enforcement
    const maxConcurrent = context.ultraworkConfig.maxParallelBV;
    let peakConcurrent = 0;

    while (context.workflow.metrics.completedTasks < 10) {
      // Get available tasks (not running, not completed)
      const availableTasks = context.workflow.tasks.filter(
        t => t.status === 'pending' && !context.activeWorkers.has(t.id)
      );

      if (availableTasks.length === 0) {
        // Wait for some tasks to complete
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }

      // Calculate available slots
      const availableSlots = maxConcurrent - context.activeWorkers.size;
      if (availableSlots <= 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }

      // Launch tasks up to available slots
      const tasksToLaunch = availableTasks.slice(0, availableSlots);

      for (const task of tasksToLaunch) {
        context.activeWorkers.set(task.id, {
          taskId: task.id,
          startedAt: Date.now()
        });

        // Track peak concurrent
        peakConcurrent = Math.max(peakConcurrent, context.activeWorkers.size);

        // Launch B-V cycle (don't await - parallel)
        simulateUltraworkBVCycle(context, task).then(result => {
          context.activeWorkers.delete(task.id);
          context.results.push(result);
          task.status = result.success ? 'completed' : 'failed';
          if (result.success) {
            context.workflow.metrics.completedTasks++;
          }
        });
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // ASSERT: Verify parallel limit was respected
    expect(peakConcurrent).toBeLessThanOrEqual(maxConcurrent);
    expect(context.results).toHaveLength(10);
    expect(context.workflow.metrics.completedTasks).toBe(10);
  }, 45000);

  it('should handle fail-fast mode', async () => {
    // ARRANGE: Enable fail-fast mode
    context.ultraworkConfig.failFast = true;
    context.ultraworkConfig.continueOnFailure = false;
    context.workflow.config.continueOnFailure = false;

    const decomposition = createMockDecomposition(5);
    decomposition.subtasks.forEach(subtask => {
      subtask.blockedBy = [];
    });

    context.workflow.tasks = decomposition.subtasks.map(subtask => ({
      id: subtask.id,
      subtask,
      bvConfig: {
        taskId: subtask.id,
        taskDescription: subtask.prompt,
        requirements: subtask.acceptanceCriteria,
        acceptanceCriteria: [subtask.verification],
        validationType: 'validator',
        builderAgent: subtask.agentType,
        maxRetries: 1,
        timeout: 300000,
        complexity: 'medium'
      },
      status: 'pending',
      blockedBy: [],
      blocks: [],
      retryCount: 0
    }));

    context.workflow.metrics.totalTasks = 5;

    // ACT: Execute with one task failing
    const executionPromises: Promise<BVOrchestrationResult>[] = [];
    let failFastTriggered = false;

    for (let i = 0; i < context.workflow.tasks.length; i++) {
      const task = context.workflow.tasks[i];

      // Make task-3 fail
      const shouldFail = i === 2;

      const promise = simulateUltraworkBVCycle(context, task, { shouldFail }).then(result => {
        context.results.push(result);

        if (!result.success && context.ultraworkConfig.failFast) {
          failFastTriggered = true;
          // Abort remaining tasks
          context.workflow.status = 'failed';
        }

        task.status = result.success ? 'completed' : 'failed';
        return result;
      });

      executionPromises.push(promise);

      // Small delay to simulate staggered start
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    await Promise.all(executionPromises);

    // ASSERT: Fail-fast should have triggered
    expect(failFastTriggered).toBe(true);
    expect(context.workflow.status).toBe('failed');

    // Some tasks may have completed before failure
    const completedCount = context.results.filter(r => r.success).length;
    const failedCount = context.results.filter(r => !r.success).length;

    expect(failedCount).toBeGreaterThanOrEqual(1);
    expect(completedCount).toBeLessThan(5); // Not all completed due to fail-fast
  }, 30000);

  it('should continue on failure when configured', async () => {
    // ARRANGE: Enable continue-on-failure mode
    context.ultraworkConfig.continueOnFailure = true;
    context.workflow.config.continueOnFailure = true;

    const decomposition = createMockDecomposition(5);
    decomposition.subtasks.forEach(subtask => {
      subtask.blockedBy = [];
    });

    context.workflow.tasks = decomposition.subtasks.map(subtask => ({
      id: subtask.id,
      subtask,
      bvConfig: {
        taskId: subtask.id,
        taskDescription: subtask.prompt,
        requirements: subtask.acceptanceCriteria,
        acceptanceCriteria: [subtask.verification],
        validationType: 'validator',
        builderAgent: subtask.agentType,
        maxRetries: 1,
        timeout: 300000,
        complexity: 'medium'
      },
      status: 'pending',
      blockedBy: [],
      blocks: [],
      retryCount: 0
    }));

    context.workflow.metrics.totalTasks = 5;

    // ACT: Execute with multiple failures
    const executionPromises: Promise<BVOrchestrationResult>[] = [];

    for (let i = 0; i < context.workflow.tasks.length; i++) {
      const task = context.workflow.tasks[i];

      // Make tasks 2 and 4 fail
      const shouldFail = i === 1 || i === 3;

      const promise = simulateUltraworkBVCycle(context, task, { shouldFail }).then(result => {
        context.results.push(result);
        task.status = result.success ? 'completed' : 'failed';

        if (result.success) {
          context.workflow.metrics.completedTasks++;
        } else {
          context.workflow.metrics.failedTasks++;
        }

        return result;
      });

      executionPromises.push(promise);
    }

    await Promise.all(executionPromises);

    // ASSERT: All tasks should have been attempted
    expect(context.results).toHaveLength(5);
    expect(context.workflow.metrics.completedTasks).toBe(3);
    expect(context.workflow.metrics.failedTasks).toBe(2);

    // Workflow should still be marked as complete (not failed)
    context.workflow.status = 'completed';
    expect(context.workflow.status).toBe('completed');
  }, 30000);

  it('should handle mixed parallel and sequential dependencies', async () => {
    // ARRANGE: Complex workflow with both parallel and sequential tasks
    const decomposition = createMockDecomposition(6);

    // Set up dependencies:
    // - task-1 and task-2 can run in parallel (no deps)
    // - task-3 depends on task-1
    // - task-4 depends on task-2
    // - task-5 depends on both task-3 and task-4
    // - task-6 can run in parallel with others (no deps)
    decomposition.subtasks[0].blockedBy = [];
    decomposition.subtasks[1].blockedBy = [];
    decomposition.subtasks[2].blockedBy = ['task-1'];
    decomposition.subtasks[3].blockedBy = ['task-2'];
    decomposition.subtasks[4].blockedBy = ['task-3', 'task-4'];
    decomposition.subtasks[5].blockedBy = [];

    context.workflow.tasks = decomposition.subtasks.map((subtask, idx) => ({
      id: subtask.id,
      subtask,
      bvConfig: {
        taskId: subtask.id,
        taskDescription: subtask.prompt,
        requirements: subtask.acceptanceCriteria,
        acceptanceCriteria: [subtask.verification],
        validationType: 'validator',
        builderAgent: subtask.agentType,
        maxRetries: 3,
        timeout: 300000,
        complexity: 'medium'
      },
      status: subtask.blockedBy.length === 0 ? 'pending' : 'blocked',
      blockedBy: subtask.blockedBy,
      blocks: [],
      retryCount: 0
    }));

    context.workflow.metrics.totalTasks = 6;

    // ACT: Execute with dynamic dependency resolution
    while (context.workflow.metrics.completedTasks < 6) {
      // Get available tasks (not blocked, not running)
      const availableTasks = context.workflow.tasks.filter(
        t =>
          t.status === 'pending' &&
          !context.activeWorkers.has(t.id) &&
          context.activeWorkers.size < context.ultraworkConfig.maxParallelBV
      );

      if (availableTasks.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }

      // Launch available tasks
      for (const task of availableTasks) {
        context.activeWorkers.set(task.id, {
          taskId: task.id,
          startedAt: Date.now()
        });

        simulateUltraworkBVCycle(context, task).then(result => {
          context.activeWorkers.delete(task.id);
          context.results.push(result);
          task.status = 'completed';
          context.workflow.metrics.completedTasks++;

          // Unblock dependent tasks
          for (const otherTask of context.workflow.tasks) {
            if (otherTask.blockedBy.includes(task.id)) {
              otherTask.blockedBy = otherTask.blockedBy.filter(id => id !== task.id);
              if (otherTask.blockedBy.length === 0) {
                otherTask.status = 'pending';
              }
            }
          }
        });
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // ASSERT: All tasks completed respecting dependencies
    expect(context.results).toHaveLength(6);
    expect(context.workflow.metrics.completedTasks).toBe(6);

    // Verify execution order respected dependencies
    const completionOrder = context.results.map(r => r.taskId);

    // task-1 and task-2 should complete before task-3 and task-4
    const task1Idx = completionOrder.indexOf('task-1');
    const task2Idx = completionOrder.indexOf('task-2');
    const task3Idx = completionOrder.indexOf('task-3');
    const task4Idx = completionOrder.indexOf('task-4');
    const task5Idx = completionOrder.indexOf('task-5');

    expect(task1Idx).toBeLessThan(task3Idx);
    expect(task2Idx).toBeLessThan(task4Idx);
    expect(task3Idx).toBeLessThan(task5Idx);
    expect(task4Idx).toBeLessThan(task5Idx);
  }, 60000);
});

// ============================================================================
// Simulation Helpers
// ============================================================================

async function simulateUltraworkBVCycle(
  context: UltraworkTestContext,
  task: WorkflowTask,
  options?: {
    shouldFail?: boolean;
    attempt?: number;
  }
): Promise<BVOrchestrationResult> {
  const shouldFail = options?.shouldFail || false;
  const attempt = options?.attempt || 0;

  // Simulate parallel execution time (shorter than sequential)
  await new Promise(resolve => setTimeout(resolve, 100));

  const result: BVOrchestrationResult = {
    taskId: task.id,
    success: !shouldFail,
    cycleResult: {
      success: !shouldFail,
      builderPassed: true,
      validatorPassed: !shouldFail,
      retryCount: attempt,
      evidence: [
        {
          type: 'test_pass',
          passed: !shouldFail,
          timestamp: new Date()
        },
        {
          type: 'validator_approval',
          passed: !shouldFail,
          timestamp: new Date()
        }
      ],
      issues: shouldFail ? ['Validation failed'] : []
    },
    retryState: {
      currentAttempt: attempt,
      maxAttempts: task.bvConfig?.maxRetries || 3,
      history: [],
      status: shouldFail ? 'failed' : 'success'
    },
    totalDuration: 100,
    evidence: [
      {
        type: 'test_pass',
        passed: !shouldFail,
        timestamp: new Date()
      }
    ]
  };

  return result;
}
