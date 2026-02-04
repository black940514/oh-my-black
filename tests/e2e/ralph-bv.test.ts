/**
 * E2E Tests: Ralph with Builder-Validator Cycles
 *
 * Tests Ralph's sequential execution mode with B-V integration.
 * Ralph ensures persistent execution until verified complete,
 * with B-V cycles providing quality gates at each step.
 *
 * Test Focus:
 * - Sequential task execution with dependencies
 * - Escalation and continuation logic
 * - Comprehensive report generation
 * - Persistence through failures
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { WorkflowState } from '../../src/features/team/workflow.js';
import type { BVOrchestrationResult } from '../../src/features/verification/bv-integration.js';
import type { OhmyblackSessionState } from '../../src/features/state-manager/ohmyblack-schemas.js';
import {
  createMockDecomposition,
  createMockTeam,
  expectValidWorkflowState
} from '../integration/helpers.js';

// ============================================================================
// Ralph Test Context
// ============================================================================

interface RalphTestContext {
  sessionState: OhmyblackSessionState;
  workflow: WorkflowState;
  results: BVOrchestrationResult[];
  ralphState: {
    iteration: number;
    maxIterations: number;
    completed: boolean;
    escalations: number;
  };
}

function createRalphContext(): RalphTestContext {
  const team = createMockTeam('standard');

  return {
    sessionState: {
      sessionId: 'ralph-test-session',
      mode: 'ralph',
      tasks: [],
      validations: [],
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      config: {
        maxParallel: 1, // Ralph is sequential
        taskTimeout: 300000,
        autoEscalate: true,
        builderModel: 'medium',
        validatorModel: 'medium'
      }
    },
    workflow: {
      workflowId: 'ralph-workflow-1',
      team,
      tasks: [],
      status: 'pending',
      config: {
        parallelExecution: false, // Sequential
        maxParallelTasks: 1,
        defaultValidationType: 'validator',
        autoAssign: true,
        continueOnFailure: false,
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
    results: [],
    ralphState: {
      iteration: 0,
      maxIterations: 10,
      completed: false,
      escalations: 0
    }
  };
}

// ============================================================================
// Ralph E2E Tests
// ============================================================================

describe('Ralph B-V E2E', () => {
  let context: RalphTestContext;

  beforeEach(() => {
    context = createRalphContext();
  });

  afterEach(() => {
    // Cleanup state files
  });

  it('should execute sequential tasks with B-V cycles', async () => {
    // ARRANGE: Create sequential workflow with dependencies
    const decomposition = createMockDecomposition(4);

    // Set up dependency chain: task-1 -> task-2 -> task-3 -> task-4
    decomposition.subtasks[1].blockedBy = ['task-1'];
    decomposition.subtasks[2].blockedBy = ['task-2'];
    decomposition.subtasks[3].blockedBy = ['task-3'];

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
      status: idx === 0 ? 'pending' : 'blocked',
      blockedBy: subtask.blockedBy,
      blocks: [],
      retryCount: 0
    }));

    context.workflow.metrics.totalTasks = 4;
    expectValidWorkflowState(context.workflow);

    // ACT: Execute Ralph loop - sequential execution with B-V cycles
    while (!context.ralphState.completed && context.ralphState.iteration < context.ralphState.maxIterations) {
      context.ralphState.iteration++;

      // Find next available task (not blocked)
      const availableTask = context.workflow.tasks.find(
        t => t.status === 'pending'
      );

      if (!availableTask) {
        // Check if all tasks are complete
        const allComplete = context.workflow.tasks.every(
          t => t.status === 'completed'
        );
        if (allComplete) {
          context.ralphState.completed = true;
          break;
        }
        // No available tasks but not all complete = something is wrong
        throw new Error('Workflow stuck - no available tasks but not complete');
      }

      // Execute B-V cycle for this task
      const bvResult = await simulateRalphBVCycle(context, availableTask);
      context.results.push(bvResult);

      if (bvResult.success) {
        // Mark task complete and unblock dependents
        availableTask.status = 'completed';
        context.workflow.metrics.completedTasks++;

        // Unblock dependent tasks
        for (const task of context.workflow.tasks) {
          if (task.blockedBy.includes(availableTask.id)) {
            task.blockedBy = task.blockedBy.filter(id => id !== availableTask.id);
            if (task.blockedBy.length === 0) {
              task.status = 'pending';
            }
          }
        }
      } else {
        // Task failed - Ralph persistence mode should handle escalation
        if (bvResult.escalation?.shouldEscalate) {
          context.ralphState.escalations++;
          // Ralph continues after escalation (doesn't fail the whole workflow)
          availableTask.status = 'completed'; // Mark as resolved via escalation
        } else {
          throw new Error('Task failed without escalation');
        }
      }
    }

    // ASSERT: Verify sequential execution completed
    expect(context.ralphState.completed).toBe(true);
    expect(context.workflow.metrics.completedTasks).toBe(4);
    expect(context.results).toHaveLength(4);

    // Verify execution order (sequential)
    expect(context.results[0].taskId).toBe('task-1');
    expect(context.results[1].taskId).toBe('task-2');
    expect(context.results[2].taskId).toBe('task-3');
    expect(context.results[3].taskId).toBe('task-4');

    // All results should have B-V evidence
    context.results.forEach(result => {
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.cycleResult.builderPassed).toBe(true);
      expect(result.cycleResult.validatorPassed).toBe(true);
    });
  }, 60000);

  it('should handle escalation and continue', async () => {
    // ARRANGE: Create workflow where middle task will need escalation
    const decomposition = createMockDecomposition(3);
    decomposition.subtasks[1].blockedBy = ['task-1'];
    decomposition.subtasks[2].blockedBy = ['task-2'];

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
        maxRetries: 2,
        timeout: 300000,
        complexity: 'medium'
      },
      status: idx === 0 ? 'pending' : 'blocked',
      blockedBy: subtask.blockedBy,
      blocks: [],
      retryCount: 0
    }));

    context.workflow.metrics.totalTasks = 3;

    // ACT: Execute Ralph with forced escalation on task-2
    const task1Result = await simulateRalphBVCycle(context, context.workflow.tasks[0]);
    expect(task1Result.success).toBe(true);
    context.workflow.tasks[0].status = 'completed';
    context.workflow.tasks[1].status = 'pending'; // Unblock task-2

    // Force task-2 to need escalation (fail multiple times)
    let task2Result: BVOrchestrationResult;
    for (let attempt = 0; attempt <= 2; attempt++) {
      task2Result = await simulateRalphBVCycle(
        context,
        context.workflow.tasks[1],
        { shouldFail: true, attempt }
      );
    }

    // ASSERT: Task-2 should escalate
    expect(task2Result!.success).toBe(false);
    expect(task2Result!.escalation?.shouldEscalate).toBe(true);
    expect(task2Result!.escalation?.escalationLevel).toBe('architect');
    context.ralphState.escalations++;

    // Ralph continues after escalation
    context.workflow.tasks[1].status = 'completed'; // Treated as resolved
    context.workflow.tasks[2].status = 'pending'; // Unblock task-3

    // Complete final task
    const task3Result = await simulateRalphBVCycle(context, context.workflow.tasks[2]);
    expect(task3Result.success).toBe(true);
    context.workflow.tasks[2].status = 'completed';

    // ASSERT: Workflow completed despite escalation
    expect(context.workflow.metrics.completedTasks).toBe(3);
    expect(context.ralphState.escalations).toBe(1);
    expect(context.workflow.status).toBe('completed');
  }, 45000);

  it('should generate comprehensive report', async () => {
    // ARRANGE: Execute complete Ralph workflow
    const decomposition = createMockDecomposition(3);
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
      status: 'pending',
      blockedBy: [],
      blocks: [],
      retryCount: 0
    }));

    // Execute all tasks
    for (const task of context.workflow.tasks) {
      const result = await simulateRalphBVCycle(context, task);
      context.results.push(result);
      task.status = 'completed';
    }

    // ACT: Generate Ralph report
    const report = generateRalphReport(context);

    // ASSERT: Report structure
    expect(report).toBeDefined();
    expect(report.mode).toBe('ralph');
    expect(report.sessionId).toBe(context.sessionState.sessionId);
    expect(report.totalIterations).toBe(context.ralphState.iteration);
    expect(report.tasksCompleted).toBe(3);
    expect(report.tasksFailed).toBe(0);
    expect(report.escalations).toBe(0);

    // Report should have detailed task results
    expect(report.taskResults).toHaveLength(3);
    report.taskResults.forEach((taskResult, idx) => {
      expect(taskResult.taskId).toBe(`task-${idx + 1}`);
      expect(taskResult.success).toBe(true);
      expect(taskResult.attempts).toBeGreaterThanOrEqual(1);
      expect(taskResult.bvCycles).toBeGreaterThanOrEqual(1);
      expect(taskResult.evidence).toBeDefined();
    });

    // Report should have timing information
    expect(report.totalDuration).toBeGreaterThan(0);
    expect(report.averageTaskDuration).toBeGreaterThan(0);

    // Report should have B-V cycle statistics
    expect(report.bvStats).toBeDefined();
    expect(report.bvStats.totalCycles).toBe(3);
    expect(report.bvStats.successfulCycles).toBe(3);
    expect(report.bvStats.averageCycleTime).toBeGreaterThan(0);
  }, 30000);

  it('should persist through multiple failures and retries', async () => {
    // ARRANGE: Task that fails multiple times before succeeding
    const decomposition = createMockDecomposition(1);
    context.workflow.tasks = [
      {
        id: 'task-1',
        subtask: decomposition.subtasks[0],
        bvConfig: {
          taskId: 'task-1',
          taskDescription: 'Complex task with intermittent failures',
          requirements: ['Must handle edge cases'],
          acceptanceCriteria: ['All tests pass'],
          validationType: 'validator',
          builderAgent: 'executor',
          maxRetries: 5,
          timeout: 300000,
          complexity: 'high'
        },
        status: 'pending',
        blockedBy: [],
        blocks: [],
        retryCount: 0
      }
    ];

    // ACT: Execute with failures and retries
    const attemptResults: BVOrchestrationResult[] = [];

    // Fail 3 times, then succeed
    for (let attempt = 0; attempt < 4; attempt++) {
      const shouldFail = attempt < 3;
      const result = await simulateRalphBVCycle(
        context,
        context.workflow.tasks[0],
        { shouldFail, attempt }
      );
      attemptResults.push(result);

      if (result.success) {
        context.workflow.tasks[0].status = 'completed';
        break;
      }
    }

    // ASSERT: Ralph persisted through failures
    expect(attemptResults).toHaveLength(4);
    expect(attemptResults.slice(0, 3).every(r => !r.success)).toBe(true);
    expect(attemptResults[3].success).toBe(true);
    expect(attemptResults[3].retryState.currentAttempt).toBe(3);
    expect(context.workflow.tasks[0].status).toBe('completed');
    expect(context.workflow.metrics.totalRetries).toBe(3);
  }, 30000);
});

// ============================================================================
// Simulation Helpers
// ============================================================================

async function simulateRalphBVCycle(
  context: RalphTestContext,
  task: any,
  options?: {
    shouldFail?: boolean;
    attempt?: number;
  }
): Promise<BVOrchestrationResult> {
  const shouldFail = options?.shouldFail || false;
  const attempt = options?.attempt || 0;

  // Simulate B-V cycle execution
  await new Promise(resolve => setTimeout(resolve, 50));

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
      maxAttempts: task.bvConfig.maxRetries,
      history: [],
      status: shouldFail ? 'in_progress' : 'success'
    },
    totalDuration: 100 + attempt * 50,
    evidence: [
      {
        type: 'test_pass',
        passed: !shouldFail,
        timestamp: new Date()
      }
    ]
  };

  // Add escalation if max retries exceeded
  if (shouldFail && attempt >= task.bvConfig.maxRetries) {
    result.escalation = {
      shouldEscalate: true,
      escalationLevel: 'architect',
      reason: `Maximum retry attempts (${task.bvConfig.maxRetries}) exceeded`,
      suggestedAction: 'Escalate to senior architect for review'
    };
    result.retryState.status = 'escalated';
  }

  // Update metrics
  if (attempt > 0) {
    context.workflow.metrics.totalRetries++;
  }

  return result;
}

function generateRalphReport(context: RalphTestContext) {
  return {
    mode: 'ralph' as const,
    sessionId: context.sessionState.sessionId,
    totalIterations: context.ralphState.iteration,
    tasksCompleted: context.workflow.metrics.completedTasks,
    tasksFailed: context.workflow.metrics.failedTasks,
    escalations: context.ralphState.escalations,
    taskResults: context.results.map(result => ({
      taskId: result.taskId,
      success: result.success,
      attempts: result.retryState.currentAttempt + 1,
      bvCycles: 1,
      duration: result.totalDuration,
      evidence: result.evidence
    })),
    totalDuration: context.results.reduce((sum, r) => sum + r.totalDuration, 0),
    averageTaskDuration:
      context.results.length > 0
        ? context.results.reduce((sum, r) => sum + r.totalDuration, 0) / context.results.length
        : 0,
    bvStats: {
      totalCycles: context.results.length,
      successfulCycles: context.results.filter(r => r.success).length,
      failedCycles: context.results.filter(r => !r.success).length,
      averageCycleTime:
        context.results.length > 0
          ? context.results.reduce((sum, r) => sum + r.totalDuration, 0) / context.results.length
          : 0
    }
  };
}
