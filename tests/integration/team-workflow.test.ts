/**
 * Team Workflow Integration Tests
 *
 * Tests the complete team workflow execution including:
 * - Workflow creation from decomposition
 * - Task assignment and state transitions
 * - Dependency management
 * - Progress tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createWorkflow,
  getAvailableTasks,
  assignTask,
  autoAssignTasks,
  startTask,
  completeTask,
  failTask,
  updateDependencies,
  isWorkflowComplete,
  getWorkflowProgress,
  generateExecutionPlan,
  serializeWorkflow,
  parseWorkflow,
  type WorkflowState,
  type WorkflowTask,
  DEFAULT_WORKFLOW_CONFIG
} from '../../src/features/team/workflow.js';
import type { BVOrchestrationResult } from '../../src/features/verification/bv-integration.js';
import { createMockTeam, createMockDecomposition, expectValidWorkflowState } from './helpers.js';

describe('Team Workflow', () => {
  describe('Workflow Creation', () => {
    it('should create workflow from decomposition result', () => {
      const team = createMockTeam('standard');
      const decomposition = createMockDecomposition(3);

      const workflow = createWorkflow('workflow-1', team, decomposition);

      expect(workflow.workflowId).toBe('workflow-1');
      expect(workflow.team).toEqual(team);
      expect(workflow.tasks.length).toBe(3);
      expect(workflow.status).toBe('pending');
      expect(workflow.metrics.totalTasks).toBe(3);
      expectValidWorkflowState(workflow);
    });

    it('should correctly set up task dependencies', () => {
      const team = createMockTeam('standard');
      const decomposition = createMockDecomposition(3);

      const workflow = createWorkflow('workflow-1', team, decomposition);

      // First task should have no blockers
      const task1 = workflow.tasks[0];
      expect(task1.blockedBy).toEqual([]);
      expect(task1.status).toBe('pending');

      // Second task should be blocked by first
      const task2 = workflow.tasks[1];
      expect(task2.blockedBy).toContain('task-1');
      expect(task2.status).toBe('blocked');

      // Third task should be blocked by second
      const task3 = workflow.tasks[2];
      expect(task3.blockedBy).toContain('task-2');
      expect(task3.status).toBe('blocked');
    });

    it('should set up blocks relationships correctly', () => {
      const team = createMockTeam('standard');
      const decomposition = createMockDecomposition(3);

      const workflow = createWorkflow('workflow-1', team, decomposition);

      // First task blocks second
      const task1 = workflow.tasks[0];
      expect(task1.blocks).toContain('task-2');

      // Second task blocks third
      const task2 = workflow.tasks[1];
      expect(task2.blocks).toContain('task-3');
    });

    it('should create B-V config for each task', () => {
      const team = createMockTeam('robust');
      const decomposition = createMockDecomposition(2);

      const workflow = createWorkflow('workflow-1', team, decomposition);

      for (const task of workflow.tasks) {
        expect(task.bvConfig).toBeDefined();
        expect(task.bvConfig!.taskId).toBe(task.id);
        expect(task.bvConfig!.validationType).toBeDefined();
        expect(task.bvConfig!.builderAgent).toBeDefined();
        expect(task.bvConfig!.maxRetries).toBeGreaterThan(0);
      }
    });

    it('should generate execution plan phases', () => {
      const team = createMockTeam('standard');
      const decomposition = createMockDecomposition(3);
      const workflow = createWorkflow('workflow-1', team, decomposition);

      const plan = generateExecutionPlan(workflow);

      expect(plan.phases.length).toBeGreaterThan(0);
      expect(plan.estimatedPhases).toBe(plan.phases.length);
      expect(plan.criticalPath.length).toBeGreaterThan(0);

      // First phase should contain only unblocked tasks
      expect(plan.phases[0].tasks).toContain('task-1');
      expect(plan.phases[0].phaseNumber).toBe(1);
    });
  });

  describe('Task Assignment', () => {
    let workflow: WorkflowState;

    beforeEach(() => {
      const team = createMockTeam('standard');
      const decomposition = createMockDecomposition(3);
      workflow = createWorkflow('workflow-test', team, decomposition);
    });

    it('should find available tasks (not blocked)', () => {
      const availableTasks = getAvailableTasks(workflow);

      expect(availableTasks.length).toBeGreaterThan(0);
      // Only first task should be available (others are blocked)
      expect(availableTasks[0].id).toBe('task-1');
      expect(availableTasks[0].status).toBe('pending');
    });

    it('should assign task to team member', () => {
      const taskId = workflow.tasks[0].id;
      const memberId = workflow.team.members[0].id;

      const updated = assignTask(workflow, taskId, memberId);

      const assignedTask = updated.tasks.find(t => t.id === taskId);
      expect(assignedTask!.status).toBe('assigned');
      expect(assignedTask!.assignment).toBeDefined();
      expect(assignedTask!.assignment!.memberId).toBe(memberId);
      expect(assignedTask!.assignment!.status).toBe('pending');
    });

    it('should not assign already assigned task', () => {
      const taskId = workflow.tasks[0].id;
      const memberId = workflow.team.members[0].id;

      let updated = assignTask(workflow, taskId, memberId);
      const beforeSecondAssign = updated.tasks.find(t => t.id === taskId);

      // Try to assign again
      updated = assignTask(updated, taskId, 'other-member');
      const afterSecondAssign = updated.tasks.find(t => t.id === taskId);

      // Should not change
      expect(afterSecondAssign!.assignment!.memberId).toBe(memberId);
    });

    it('should auto-assign tasks to appropriate members', () => {
      workflow.config.autoAssign = true;
      const updated = autoAssignTasks(workflow);

      // At least one task should be auto-assigned
      const assignedTasks = updated.tasks.filter(t => t.status === 'assigned');
      expect(assignedTasks.length).toBeGreaterThan(0);
    });

    it('should respect member capacity limits', () => {
      // Set member capacity to 1
      workflow.team.members[0].maxConcurrentTasks = 1;
      workflow.config.autoAssign = true;

      // Manually assign one task
      let updated = assignTask(workflow, 'task-1', workflow.team.members[0].id);

      // Create a second available task
      updated.tasks[1].status = 'pending';
      updated.tasks[1].blockedBy = [];

      // Try to auto-assign more
      updated = autoAssignTasks(updated);

      // Should not assign more than capacity allows to same member
      const memberTasks = updated.tasks.filter(
        t => t.assignment?.memberId === workflow.team.members[0].id &&
             (t.status === 'assigned' || t.status === 'running')
      );
      expect(memberTasks.length).toBeLessThanOrEqual(1);
    });

    it('should update workflow status to running on first assignment', () => {
      expect(workflow.status).toBe('pending');

      const updated = assignTask(workflow, 'task-1', workflow.team.members[0].id);

      expect(updated.status).toBe('running');
      expect(updated.startedAt).toBeDefined();
    });
  });

  describe('Task State Transitions', () => {
    let workflow: WorkflowState;

    beforeEach(() => {
      const team = createMockTeam('standard');
      const decomposition = createMockDecomposition(3);
      workflow = createWorkflow('workflow-test', team, decomposition);
      // Assign first task
      workflow = assignTask(workflow, 'task-1', workflow.team.members[0].id);
    });

    it('should start assigned task', () => {
      const updated = startTask(workflow, 'task-1');

      const task = updated.tasks.find(t => t.id === 'task-1');
      expect(task!.status).toBe('running');
      expect(task!.startedAt).toBeDefined();
      expect(task!.assignment!.status).toBe('in_progress');
    });

    it('should complete task with result', () => {
      let updated = startTask(workflow, 'task-1');

      const mockResult: BVOrchestrationResult = {
        success: true,
        taskId: 'task-1',
        builderResult: undefined as any,
        validationResult: undefined as any,
        evidence: [],
        duration: 1000
      };

      updated = completeTask(updated, 'task-1', mockResult);

      const task = updated.tasks.find(t => t.id === 'task-1');
      expect(task!.status).toBe('completed');
      expect(task!.completedAt).toBeDefined();
      expect(task!.result).toEqual(mockResult);
      expect(updated.metrics.completedTasks).toBe(1);
    });

    it('should update metrics after task completion', () => {
      let updated = startTask(workflow, 'task-1');

      const mockResult: BVOrchestrationResult = {
        success: true,
        taskId: 'task-1',
        builderResult: undefined as any,
        validationResult: undefined as any,
        evidence: [],
        duration: 5000
      };

      updated = completeTask(updated, 'task-1', mockResult);

      expect(updated.metrics.completedTasks).toBe(1);
      expect(updated.metrics.averageTaskDuration).toBeGreaterThan(0);
    });

    it('should retry failed task within limit', () => {
      let updated = startTask(workflow, 'task-1');
      const task = updated.tasks.find(t => t.id === 'task-1');
      const initialRetryCount = task!.retryCount;

      updated = failTask(updated, 'task-1', 'Test failure');

      const retriedTask = updated.tasks.find(t => t.id === 'task-1');
      expect(retriedTask!.status).toBe('pending');
      expect(retriedTask!.retryCount).toBe(initialRetryCount + 1);
      expect(retriedTask!.assignment).toBeUndefined(); // Cleared for re-assignment
      expect(updated.metrics.totalRetries).toBe(1);
    });

    it('should mark task as failed after max retries', () => {
      let updated = startTask(workflow, 'task-1');

      // Exhaust retries
      for (let i = 0; i < workflow.config.maxRetries; i++) {
        updated = failTask(updated, 'task-1', 'Test failure');
        if (i < workflow.config.maxRetries - 1) {
          updated = assignTask(updated, 'task-1', workflow.team.members[0].id);
          updated = startTask(updated, 'task-1');
        }
      }

      const task = updated.tasks.find(t => t.id === 'task-1');
      expect(task!.status).toBe('failed');
      expect(updated.metrics.failedTasks).toBe(1);
    });
  });

  describe('Dependency Management', () => {
    let workflow: WorkflowState;

    beforeEach(() => {
      const team = createMockTeam('standard');
      const decomposition = createMockDecomposition(3);
      workflow = createWorkflow('workflow-test', team, decomposition);
    });

    it('should unblock dependent tasks when blocker completes', () => {
      // Complete first task
      workflow = assignTask(workflow, 'task-1', workflow.team.members[0].id);
      workflow = startTask(workflow, 'task-1');

      const mockResult: BVOrchestrationResult = {
        success: true,
        taskId: 'task-1',
        builderResult: undefined as any,
        validationResult: undefined as any,
        evidence: [],
        duration: 1000
      };

      workflow = completeTask(workflow, 'task-1', mockResult);

      // Second task should now be unblocked
      const task2 = workflow.tasks.find(t => t.id === 'task-2');
      expect(task2!.status).toBe('pending');
      expect(task2!.blockedBy).toEqual([]);
    });

    it('should update dependencies correctly', () => {
      // Mark first task as completed
      workflow.tasks[0].status = 'completed';

      const updated = updateDependencies(workflow);

      // Task 2 should be unblocked
      const task2 = updated.tasks.find(t => t.id === 'task-2');
      expect(task2!.status).toBe('pending');
      expect(task2!.blockedBy).toEqual([]);

      // Task 3 should still be blocked by task 2
      const task3 = updated.tasks.find(t => t.id === 'task-3');
      expect(task3!.status).toBe('blocked');
      expect(task3!.blockedBy).toContain('task-2');
    });

    it('should fail dependent tasks when continueOnFailure is false', () => {
      workflow.config.continueOnFailure = false;

      workflow = assignTask(workflow, 'task-1', workflow.team.members[0].id);
      workflow = startTask(workflow, 'task-1');

      // Exhaust retries to trigger failure
      for (let i = 0; i < workflow.config.maxRetries; i++) {
        workflow = failTask(workflow, 'task-1', 'Critical failure');
        if (i < workflow.config.maxRetries - 1) {
          workflow = assignTask(workflow, 'task-1', workflow.team.members[0].id);
          workflow = startTask(workflow, 'task-1');
        }
      }

      expect(workflow.status).toBe('failed');
      // Dependent tasks should also be failed
      const task2 = workflow.tasks.find(t => t.id === 'task-2');
      const task3 = workflow.tasks.find(t => t.id === 'task-3');
      expect(task2!.status).toBe('failed');
      expect(task3!.status).toBe('failed');
    });
  });

  describe('Workflow Status', () => {
    let workflow: WorkflowState;

    beforeEach(() => {
      const team = createMockTeam('standard');
      const decomposition = createMockDecomposition(3);
      workflow = createWorkflow('workflow-test', team, decomposition);
    });

    it('should detect workflow completion', () => {
      expect(isWorkflowComplete(workflow)).toBe(false);

      // Mark all tasks as completed
      workflow.tasks.forEach(task => {
        task.status = 'completed';
      });

      expect(isWorkflowComplete(workflow)).toBe(true);
    });

    it('should calculate correct progress', () => {
      const progress = getWorkflowProgress(workflow);

      expect(progress.total).toBe(3);
      expect(progress.completed).toBe(0);
      expect(progress.pending).toBe(1); // First task
      expect(progress.blocked).toBe(2); // Second and third tasks
      expect(progress.percentComplete).toBe(0);

      // Complete first task
      workflow.tasks[0].status = 'completed';
      const progress2 = getWorkflowProgress(workflow);

      expect(progress2.completed).toBe(1);
      expect(progress2.percentComplete).toBe(33); // 1/3 * 100 rounded
    });

    it('should mark workflow as completed when all tasks done', () => {
      const mockResult: BVOrchestrationResult = {
        success: true,
        taskId: '',
        builderResult: undefined as any,
        validationResult: undefined as any,
        evidence: [],
        duration: 1000
      };

      // Complete all tasks
      workflow = assignTask(workflow, 'task-1', workflow.team.members[0].id);
      workflow = startTask(workflow, 'task-1');
      workflow = completeTask(workflow, 'task-1', { ...mockResult, taskId: 'task-1' });

      workflow = assignTask(workflow, 'task-2', workflow.team.members[0].id);
      workflow = startTask(workflow, 'task-2');
      workflow = completeTask(workflow, 'task-2', { ...mockResult, taskId: 'task-2' });

      workflow = assignTask(workflow, 'task-3', workflow.team.members[0].id);
      workflow = startTask(workflow, 'task-3');
      workflow = completeTask(workflow, 'task-3', { ...mockResult, taskId: 'task-3' });

      expect(workflow.status).toBe('completed');
      expect(workflow.completedAt).toBeDefined();
      expect(workflow.metrics.totalDuration).toBeGreaterThan(0);
    });
  });

  describe('Serialization', () => {
    it('should serialize and parse workflow correctly', () => {
      const team = createMockTeam('standard');
      const decomposition = createMockDecomposition(2);
      const workflow = createWorkflow('workflow-1', team, decomposition);

      const serialized = serializeWorkflow(workflow);
      expect(serialized).toBeTruthy();
      expect(typeof serialized).toBe('string');

      const parsed = parseWorkflow(serialized);
      expect(parsed).not.toBeNull();
      expect(parsed!.workflowId).toBe('workflow-1');
      expect(parsed!.tasks.length).toBe(2);
      expectValidWorkflowState(parsed!);
    });

    it('should return null for invalid JSON', () => {
      expect(parseWorkflow('invalid json')).toBeNull();
      expect(parseWorkflow('{}')).toBeNull();
      expect(parseWorkflow('{"workflowId": "test"}')).toBeNull();
    });
  });
});
