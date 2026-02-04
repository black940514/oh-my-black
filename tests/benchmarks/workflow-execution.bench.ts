import { bench, describe } from 'vitest';
import type { DecompositionResult, Subtask } from '../../src/features/task-decomposer/types.js';
import type { TeamDefinition } from '../../src/features/team/types.js';
import {
  createWorkflow,
  getAvailableTasks,
  updateDependencies,
  generateExecutionPlan,
  assignTask,
  completeTask,
  autoAssignTasks
} from '../../src/features/team/workflow.js';

// Mock data generators
function createMockSubtask(id: string, blockedBy: string[] = []): Subtask {
  return {
    id,
    prompt: `Task ${id}`,
    component: { id: `comp-${id}`, role: 'backend' },
    agentType: 'executor',
    modelTier: 'medium',
    estimatedTokens: 1000,
    blockedBy,
    acceptanceCriteria: [`Criterion for ${id}`],
    verification: `Verify ${id}`,
    validation: {
      validationType: 'validator',
      validatorAgent: 'validator-syntax',
      maxRetries: 3
    }
  };
}

function createMockTeam(memberCount: number = 3): TeamDefinition {
  const members = Array(memberCount).fill(0).map((_, i) => ({
    id: `member-${i}`,
    agentType: 'executor',
    role: 'builder' as const,
    capabilities: ['code_modification'] as const,
    modelTier: 'medium' as const,
    status: 'idle' as const,
    maxConcurrentTasks: 2
  }));

  return {
    id: 'test-team',
    name: 'Test Team',
    members,
    defaultValidationType: 'validator',
    config: {
      parallelExecution: true,
      maxParallelTasks: 3
    }
  };
}

function createMockDecomposition(taskCount: number, withDependencies = false): DecompositionResult {
  const subtasks: Subtask[] = [];

  for (let i = 0; i < taskCount; i++) {
    const blockedBy: string[] = [];

    if (withDependencies && i > 0) {
      // Each task depends on the previous one
      if (i % 3 === 0) {
        blockedBy.push(`task-${i - 1}`);
      }
    }

    subtasks.push(createMockSubtask(`task-${i}`, blockedBy));
  }

  return {
    subtasks,
    totalEstimatedTokens: taskCount * 1000,
    parallelizationScore: withDependencies ? 0.3 : 0.8,
    criticalPath: subtasks.map(s => s.id)
  };
}

function createComplexDecomposition(taskCount: number): DecompositionResult {
  const subtasks: Subtask[] = [];

  // Create a more realistic dependency graph
  // First layer: 3 independent tasks
  subtasks.push(createMockSubtask('task-0', []));
  subtasks.push(createMockSubtask('task-1', []));
  subtasks.push(createMockSubtask('task-2', []));

  // Second layer: tasks depend on first layer
  for (let i = 3; i < Math.min(8, taskCount); i++) {
    const dependsOn = i % 3;
    subtasks.push(createMockSubtask(`task-${i}`, [`task-${dependsOn}`]));
  }

  // Third layer: tasks depend on second layer
  for (let i = 8; i < taskCount; i++) {
    const dependsOn = 3 + (i % 5);
    if (dependsOn < subtasks.length) {
      subtasks.push(createMockSubtask(`task-${i}`, [`task-${dependsOn}`]));
    } else {
      subtasks.push(createMockSubtask(`task-${i}`, []));
    }
  }

  return {
    subtasks,
    totalEstimatedTokens: taskCount * 1000,
    parallelizationScore: 0.6,
    criticalPath: ['task-0', 'task-3', 'task-8']
  };
}

describe('Workflow Execution Performance', () => {
  // Workflow creation benchmarks
  bench('createWorkflow (5 tasks, no dependencies)', () => {
    const team = createMockTeam(3);
    const decomposition = createMockDecomposition(5, false);
    createWorkflow('wf-1', team, decomposition);
  });

  bench('createWorkflow (20 tasks, no dependencies)', () => {
    const team = createMockTeam(5);
    const decomposition = createMockDecomposition(20, false);
    createWorkflow('wf-1', team, decomposition);
  });

  bench('createWorkflow (50 tasks, no dependencies)', () => {
    const team = createMockTeam(8);
    const decomposition = createMockDecomposition(50, false);
    createWorkflow('wf-1', team, decomposition);
  });

  bench('createWorkflow (20 tasks, with dependencies)', () => {
    const team = createMockTeam(5);
    const decomposition = createMockDecomposition(20, true);
    createWorkflow('wf-1', team, decomposition);
  });

  bench('createWorkflow (50 tasks, complex dependencies)', () => {
    const team = createMockTeam(8);
    const decomposition = createComplexDecomposition(50);
    createWorkflow('wf-1', team, decomposition);
  });

  // Task availability checks
  bench('getAvailableTasks (20 tasks, 10 pending)', () => {
    const team = createMockTeam(5);
    const decomposition = createMockDecomposition(20, false);
    const workflow = createWorkflow('wf-1', team, decomposition);
    getAvailableTasks(workflow);
  });

  bench('getAvailableTasks (50 tasks, complex dependencies)', () => {
    const team = createMockTeam(8);
    const decomposition = createComplexDecomposition(50);
    const workflow = createWorkflow('wf-1', team, decomposition);
    getAvailableTasks(workflow);
  });

  // Dependency updates
  bench('updateDependencies (20 tasks)', () => {
    const team = createMockTeam(5);
    const decomposition = createMockDecomposition(20, true);
    const workflow = createWorkflow('wf-1', team, decomposition);
    updateDependencies(workflow);
  });

  bench('updateDependencies (50 tasks, complex graph)', () => {
    const team = createMockTeam(8);
    const decomposition = createComplexDecomposition(50);
    const workflow = createWorkflow('wf-1', team, decomposition);
    updateDependencies(workflow);
  });

  // Execution planning
  bench('generateExecutionPlan (20 tasks, linear)', () => {
    const team = createMockTeam(5);
    const decomposition = createMockDecomposition(20, true);
    const workflow = createWorkflow('wf-1', team, decomposition);
    generateExecutionPlan(workflow);
  });

  bench('generateExecutionPlan (50 tasks, complex)', () => {
    const team = createMockTeam(8);
    const decomposition = createComplexDecomposition(50);
    const workflow = createWorkflow('wf-1', team, decomposition);
    generateExecutionPlan(workflow);
  });

  // Task assignment
  bench('assignTask (single task)', () => {
    const team = createMockTeam(5);
    const decomposition = createMockDecomposition(20, false);
    let workflow = createWorkflow('wf-1', team, decomposition);
    workflow = assignTask(workflow, 'task-0', 'member-0');
  });

  bench('autoAssignTasks (20 tasks, 5 members)', () => {
    const team = createMockTeam(5);
    const decomposition = createMockDecomposition(20, false);
    let workflow = createWorkflow('wf-1', team, decomposition);
    workflow = autoAssignTasks(workflow);
  });

  // Task completion with dependency resolution
  bench('completeTask with dependency update', () => {
    const team = createMockTeam(5);
    const decomposition = createMockDecomposition(20, true);
    let workflow = createWorkflow('wf-1', team, decomposition);

    // Assign and start first task
    workflow = assignTask(workflow, 'task-0', 'member-0');
    workflow.tasks[0].status = 'running';

    // Complete it
    completeTask(workflow, 'task-0', {
      success: true,
      attempts: 1,
      finalOutput: 'Done'
    });
  });

  // Full workflow simulation
  bench('simulate full workflow (10 tasks, sequential)', () => {
    const team = createMockTeam(3);
    const decomposition = createMockDecomposition(10, true);
    let workflow = createWorkflow('wf-1', team, decomposition);

    // Process each task
    for (let i = 0; i < 10; i++) {
      const available = getAvailableTasks(workflow);
      if (available.length > 0) {
        const taskId = available[0].id;
        workflow = assignTask(workflow, taskId, `member-${i % 3}`);
        workflow.tasks.find(t => t.id === taskId)!.status = 'running';
        workflow = completeTask(workflow, taskId, {
          success: true,
          attempts: 1,
          finalOutput: 'Done'
        });
      }
    }
  });

  bench('simulate parallel workflow (20 tasks, 5 members)', () => {
    const team = createMockTeam(5);
    const decomposition = createMockDecomposition(20, false);
    let workflow = createWorkflow('wf-1', team, decomposition);

    let completed = 0;
    while (completed < 20) {
      workflow = autoAssignTasks(workflow);
      const running = workflow.tasks.filter(t => t.status === 'assigned' || t.status === 'running');

      for (const task of running) {
        if (task.status === 'assigned') {
          task.status = 'running';
        }
        workflow = completeTask(workflow, task.id, {
          success: true,
          attempts: 1,
          finalOutput: 'Done'
        });
        completed++;
      }
    }
  });
});
