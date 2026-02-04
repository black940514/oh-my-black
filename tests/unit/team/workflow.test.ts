/**
 * Unit tests for team/workflow.ts
 * Testing workflow state management, task assignment, and dependency tracking
 */

import { describe, it, expect } from 'vitest';
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
  DEFAULT_WORKFLOW_CONFIG,
  type WorkflowState,
  type WorkflowTask
} from '../../../src/features/team/workflow.js';
import type { TeamDefinition } from '../../../src/features/team/types.js';
import type { DecompositionResult, Subtask } from '../../../src/features/task-decomposer/types.js';
import type { BVOrchestrationResult } from '../../../src/features/verification/bv-integration.js';

const mockTeam: TeamDefinition = {
  id: 'team-1',
  name: 'Test Team',
  description: 'A test team',
  members: [
    {
      id: 'member-1',
      agentType: 'executor',
      role: 'builder',
      modelTier: 'medium',
      capabilities: ['code_modification'],
      maxConcurrentTasks: 2,
      status: 'idle',
      assignedTasks: []
    }
  ],
  defaultValidationType: 'validator',
  config: {
    maxRetries: 3,
    taskTimeout: 300000,
    parallelExecution: true,
    maxParallelTasks: 3,
    escalationPolicy: {
      coordinatorThreshold: 2,
      architectThreshold: 3,
      humanThreshold: 5,
      autoEscalateOnSecurity: true
    }
  }
};

const mockSubtasks: Subtask[] = [
  {
    id: 'task-1',
    prompt: 'Task 1',
    agentType: 'executor',
    modelTier: 'medium',
    acceptanceCriteria: ['Criteria 1'],
    verification: [],
    blockedBy: []
  },
  {
    id: 'task-2',
    prompt: 'Task 2',
    agentType: 'executor',
    modelTier: 'medium',
    acceptanceCriteria: ['Criteria 2'],
    verification: [],
    blockedBy: ['task-1']
  }
];

const mockDecomposition: DecompositionResult = {
  subtasks: mockSubtasks,
  totalEstimatedTime: 600,
  criticalPath: ['task-1', 'task-2'],
  parallelizationOpportunities: []
};

describe('createWorkflow', () => {
  it('should create workflow from decomposition', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    expect(workflow.workflowId).toBe('wf-1');
    expect(workflow.team).toBe(mockTeam);
    expect(workflow.tasks).toHaveLength(2);
    expect(workflow.status).toBe('pending');
  });

  it('should set up task dependencies', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    const task1 = workflow.tasks.find(t => t.id === 'task-1')!;
    const task2 = workflow.tasks.find(t => t.id === 'task-2')!;

    expect(task1.blockedBy).toEqual([]);
    expect(task1.blocks).toEqual(['task-2']);
    expect(task2.blockedBy).toEqual(['task-1']);
    expect(task2.blocks).toEqual([]);
  });

  it('should initialize task status based on dependencies', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    const task1 = workflow.tasks.find(t => t.id === 'task-1')!;
    const task2 = workflow.tasks.find(t => t.id === 'task-2')!;

    expect(task1.status).toBe('pending');
    expect(task2.status).toBe('blocked');
  });

  it('should use default config', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    expect(workflow.config.parallelExecution).toBe(true);
    expect(workflow.config.maxParallelTasks).toBe(3);
  });

  it('should allow config override', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition, {
      maxParallelTasks: 5
    });

    expect(workflow.config.maxParallelTasks).toBe(5);
  });

  it('should initialize metrics', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    expect(workflow.metrics.totalTasks).toBe(2);
    expect(workflow.metrics.completedTasks).toBe(0);
    expect(workflow.metrics.failedTasks).toBe(0);
  });

  it('should handle empty subtasks', () => {
    const emptyDecomp: DecompositionResult = {
      subtasks: [],
      totalEstimatedTime: 0,
      criticalPath: [],
      parallelizationOpportunities: []
    };

    const workflow = createWorkflow('wf-1', mockTeam, emptyDecomp);

    expect(workflow.tasks).toHaveLength(0);
    expect(workflow.metrics.totalTasks).toBe(0);
  });
});

describe('getAvailableTasks', () => {
  it('should return pending tasks when no tasks running', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    const available = getAvailableTasks(workflow);

    expect(available).toHaveLength(1);
    expect(available[0].id).toBe('task-1');
  });

  it('should respect parallel execution limits', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition, {
      maxParallelTasks: 1
    });

    // Mark task-1 as running
    workflow.tasks[0].status = 'running';

    const available = getAvailableTasks(workflow);

    expect(available).toHaveLength(0);
  });

  it('should not return blocked tasks', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    const available = getAvailableTasks(workflow);

    const hasBlockedTask = available.some(t => t.status === 'blocked');
    expect(hasBlockedTask).toBe(false);
  });

  it('should not return assigned tasks', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    workflow.tasks[0].status = 'assigned';

    const available = getAvailableTasks(workflow);

    expect(available).toHaveLength(0);
  });

  it('should allow sequential execution when parallel disabled', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition, {
      parallelExecution: false
    });

    const available = getAvailableTasks(workflow);

    expect(available).toHaveLength(1);
  });

  it('should handle empty workflow', () => {
    const emptyDecomp: DecompositionResult = {
      subtasks: [],
      totalEstimatedTime: 0,
      criticalPath: [],
      parallelizationOpportunities: []
    };

    const workflow = createWorkflow('wf-1', mockTeam, emptyDecomp);
    const available = getAvailableTasks(workflow);

    expect(available).toHaveLength(0);
  });
});

describe('assignTask', () => {
  it('should assign task to member', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    const updated = assignTask(workflow, 'task-1', 'member-1');

    const task = updated.tasks.find(t => t.id === 'task-1')!;
    expect(task.status).toBe('assigned');
    expect(task.assignment).toBeDefined();
    expect(task.assignment?.memberId).toBe('member-1');
  });

  it('should set workflow to running on first assignment', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    const updated = assignTask(workflow, 'task-1', 'member-1');

    expect(updated.status).toBe('running');
    expect(updated.startedAt).toBeDefined();
  });

  it('should not assign already assigned task', () => {
    let workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    workflow = assignTask(workflow, 'task-1', 'member-1');

    const beforeUpdate = workflow.tasks[0].assignment;
    const updated = assignTask(workflow, 'task-1', 'member-2');

    expect(updated.tasks[0].assignment).toEqual(beforeUpdate);
  });

  it('should not assign non-existent task', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    const updated = assignTask(workflow, 'non-existent', 'member-1');

    expect(updated).toEqual(workflow);
  });

  it('should not assign non-pending task', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    workflow.tasks[0].status = 'running';

    const updated = assignTask(workflow, 'task-1', 'member-1');

    expect(updated.tasks[0].status).toBe('running');
    expect(updated.tasks[0].assignment).toBeUndefined();
  });
});

describe('startTask', () => {
  it('should start assigned task', () => {
    let workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    workflow = assignTask(workflow, 'task-1', 'member-1');

    const updated = startTask(workflow, 'task-1');

    const task = updated.tasks.find(t => t.id === 'task-1')!;
    expect(task.status).toBe('running');
    expect(task.startedAt).toBeDefined();
    expect(task.assignment?.status).toBe('in_progress');
  });

  it('should not start non-assigned task', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    const updated = startTask(workflow, 'task-1');

    expect(updated.tasks[0].status).toBe('pending');
  });

  it('should not start non-existent task', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    const updated = startTask(workflow, 'non-existent');

    expect(updated).toEqual(workflow);
  });
});

describe('completeTask', () => {
  const mockResult: BVOrchestrationResult = {
    taskId: 'task-1',
    success: true,
    cycleResult: {
      success: true,
      builderPassed: true,
      validatorPassed: true,
      retryCount: 0,
      evidence: [],
      issues: []
    },
    retryState: {
      currentAttempt: 0,
      maxAttempts: 3,
      history: [],
      status: 'success'
    },
    totalDuration: 1000,
    evidence: []
  };

  it('should mark task as completed', () => {
    let workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    workflow = assignTask(workflow, 'task-1', 'member-1');
    workflow = startTask(workflow, 'task-1');

    const updated = completeTask(workflow, 'task-1', mockResult);

    const task = updated.tasks.find(t => t.id === 'task-1')!;
    expect(task.status).toBe('completed');
    expect(task.completedAt).toBeDefined();
    expect(task.result).toEqual(mockResult);
  });

  it('should update metrics', () => {
    let workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    workflow = assignTask(workflow, 'task-1', 'member-1');
    workflow = startTask(workflow, 'task-1');

    const updated = completeTask(workflow, 'task-1', mockResult);

    expect(updated.metrics.completedTasks).toBe(1);
  });

  it('should unblock dependent tasks', () => {
    let workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    workflow = assignTask(workflow, 'task-1', 'member-1');
    workflow = startTask(workflow, 'task-1');

    const updated = completeTask(workflow, 'task-1', mockResult);

    const task2 = updated.tasks.find(t => t.id === 'task-2')!;
    expect(task2.status).toBe('pending');
    expect(task2.blockedBy).toHaveLength(0);
  });

  it('should mark workflow as complete when all tasks done', () => {
    let workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    workflow = assignTask(workflow, 'task-1', 'member-1');
    workflow = startTask(workflow, 'task-1');
    workflow = completeTask(workflow, 'task-1', mockResult);

    workflow = assignTask(workflow, 'task-2', 'member-1');
    workflow = startTask(workflow, 'task-2');
    workflow = completeTask(workflow, 'task-2', { ...mockResult, taskId: 'task-2' });

    expect(workflow.status).toBe('completed');
    expect(workflow.completedAt).toBeDefined();
  });

  it('should not complete non-existent task', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    const updated = completeTask(workflow, 'non-existent', mockResult);

    expect(updated).toEqual(workflow);
  });
});

describe('failTask', () => {
  it('should fail task and allow retry', () => {
    let workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    workflow = assignTask(workflow, 'task-1', 'member-1');
    workflow = startTask(workflow, 'task-1');

    const updated = failTask(workflow, 'task-1', 'Build failed');

    const task = updated.tasks.find(t => t.id === 'task-1')!;
    expect(task.status).toBe('pending');
    expect(task.retryCount).toBe(1);
    expect(updated.metrics.totalRetries).toBe(1);
  });

  it('should mark as failed after max retries', () => {
    let workflow = createWorkflow('wf-1', mockTeam, mockDecomposition, {
      maxRetries: 1
    });

    workflow = assignTask(workflow, 'task-1', 'member-1');
    workflow = startTask(workflow, 'task-1');
    workflow = failTask(workflow, 'task-1', 'Fail 1');

    workflow = assignTask(workflow, 'task-1', 'member-1');
    workflow = startTask(workflow, 'task-1');
    workflow = failTask(workflow, 'task-1', 'Fail 2');

    const task = workflow.tasks.find(t => t.id === 'task-1')!;
    expect(task.status).toBe('failed');
  });

  it('should fail workflow when continueOnFailure is false', () => {
    let workflow = createWorkflow('wf-1', mockTeam, mockDecomposition, {
      continueOnFailure: false,
      maxRetries: 0
    });

    workflow = assignTask(workflow, 'task-1', 'member-1');
    workflow = startTask(workflow, 'task-1');
    workflow = failTask(workflow, 'task-1', 'Fatal error');

    expect(workflow.status).toBe('failed');
  });

  it('should fail dependent tasks when not continuing', () => {
    let workflow = createWorkflow('wf-1', mockTeam, mockDecomposition, {
      continueOnFailure: false,
      maxRetries: 0
    });

    workflow = assignTask(workflow, 'task-1', 'member-1');
    workflow = startTask(workflow, 'task-1');
    workflow = failTask(workflow, 'task-1', 'Fatal error');

    const task2 = workflow.tasks.find(t => t.id === 'task-2')!;
    expect(task2.status).toBe('failed');
  });

  it('should not fail non-existent task', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    const updated = failTask(workflow, 'non-existent', 'Error');

    expect(updated).toEqual(workflow);
  });
});

describe('updateDependencies', () => {
  it('should unblock tasks when dependencies complete', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    workflow.tasks[0].status = 'completed';

    const updated = updateDependencies(workflow);

    const task2 = updated.tasks.find(t => t.id === 'task-2')!;
    expect(task2.status).toBe('pending');
    expect(task2.blockedBy).toEqual([]);
  });

  it('should not unblock tasks with incomplete dependencies', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    const updated = updateDependencies(workflow);

    const task2 = updated.tasks.find(t => t.id === 'task-2')!;
    expect(task2.status).toBe('blocked');
  });

  it('should handle tasks with multiple dependencies', () => {
    const subtasks: Subtask[] = [
      {
        id: 'task-1',
        prompt: 'Task 1',
        agentType: 'executor',
        modelTier: 'medium',
        acceptanceCriteria: [],
        verification: [],
        blockedBy: []
      },
      {
        id: 'task-2',
        prompt: 'Task 2',
        agentType: 'executor',
        modelTier: 'medium',
        acceptanceCriteria: [],
        verification: [],
        blockedBy: []
      },
      {
        id: 'task-3',
        prompt: 'Task 3',
        agentType: 'executor',
        modelTier: 'medium',
        acceptanceCriteria: [],
        verification: [],
        blockedBy: ['task-1', 'task-2']
      }
    ];

    const decomp: DecompositionResult = {
      subtasks,
      totalEstimatedTime: 900,
      criticalPath: [],
      parallelizationOpportunities: []
    };

    const workflow = createWorkflow('wf-1', mockTeam, decomp);
    workflow.tasks[0].status = 'completed';

    let updated = updateDependencies(workflow);
    let task3 = updated.tasks.find(t => t.id === 'task-3')!;
    expect(task3.status).toBe('blocked');

    updated.tasks[1].status = 'completed';
    updated = updateDependencies(updated);
    task3 = updated.tasks.find(t => t.id === 'task-3')!;
    expect(task3.status).toBe('pending');
  });
});

describe('isWorkflowComplete', () => {
  it('should return false for pending workflow', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    expect(isWorkflowComplete(workflow)).toBe(false);
  });

  it('should return true when all tasks completed', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    workflow.tasks.forEach(t => t.status = 'completed');

    expect(isWorkflowComplete(workflow)).toBe(true);
  });

  it('should return true when all tasks completed or failed', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    workflow.tasks[0].status = 'completed';
    workflow.tasks[1].status = 'failed';

    expect(isWorkflowComplete(workflow)).toBe(true);
  });

  it('should return false with running tasks', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    workflow.tasks[0].status = 'running';

    expect(isWorkflowComplete(workflow)).toBe(false);
  });
});

describe('getWorkflowProgress', () => {
  it('should calculate progress correctly', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    workflow.tasks[0].status = 'completed';

    const progress = getWorkflowProgress(workflow);

    expect(progress.total).toBe(2);
    expect(progress.completed).toBe(1);
    expect(progress.percentComplete).toBe(50);
  });

  it('should count all statuses', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    workflow.tasks[0].status = 'running';
    workflow.tasks[1].status = 'blocked';

    const progress = getWorkflowProgress(workflow);

    expect(progress.running).toBe(1);
    expect(progress.blocked).toBe(1);
  });

  it('should handle empty workflow', () => {
    const emptyDecomp: DecompositionResult = {
      subtasks: [],
      totalEstimatedTime: 0,
      criticalPath: [],
      parallelizationOpportunities: []
    };

    const workflow = createWorkflow('wf-1', mockTeam, emptyDecomp);
    const progress = getWorkflowProgress(workflow);

    expect(progress.total).toBe(0);
    expect(progress.percentComplete).toBe(0);
  });
});

describe('generateExecutionPlan', () => {
  it('should generate phases based on dependencies', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    const plan = generateExecutionPlan(workflow);

    expect(plan.phases).toHaveLength(2);
    expect(plan.phases[0].tasks).toContain('task-1');
    expect(plan.phases[1].tasks).toContain('task-2');
  });

  it('should identify parallelizable phases', () => {
    const subtasks: Subtask[] = [
      {
        id: 'task-1',
        prompt: 'Task 1',
        agentType: 'executor',
        modelTier: 'medium',
        acceptanceCriteria: [],
        verification: [],
        blockedBy: []
      },
      {
        id: 'task-2',
        prompt: 'Task 2',
        agentType: 'executor',
        modelTier: 'medium',
        acceptanceCriteria: [],
        verification: [],
        blockedBy: []
      }
    ];

    const decomp: DecompositionResult = {
      subtasks,
      totalEstimatedTime: 600,
      criticalPath: [],
      parallelizationOpportunities: []
    };

    const workflow = createWorkflow('wf-1', mockTeam, decomp);
    const plan = generateExecutionPlan(workflow);

    expect(plan.phases).toHaveLength(1);
    expect(plan.phases[0].canParallelize).toBe(true);
    expect(plan.phases[0].tasks).toHaveLength(2);
  });

  it('should calculate critical path', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);

    const plan = generateExecutionPlan(workflow);

    expect(plan.criticalPath.length).toBeGreaterThan(0);
    expect(plan.criticalPath).toContain('task-1');
  });

  it('should handle circular dependencies gracefully', () => {
    const workflow = createWorkflow('wf-1', mockTeam, mockDecomposition);
    // Artificially create circular dependency
    workflow.tasks[0].blockedBy = ['task-2'];

    const plan = generateExecutionPlan(workflow);

    expect(plan.phases.length).toBeGreaterThan(0);
  });
});
