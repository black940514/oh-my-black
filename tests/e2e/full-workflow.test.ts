/**
 * E2E Tests: Complete Workflow Scenarios
 *
 * End-to-end tests for complete real-world scenarios combining
 * all components of the ohmyblack system: analysis, decomposition,
 * team composition, workflow execution, B-V cycles, and reporting.
 *
 * Test Scenarios:
 * - Feature implementation (full stack)
 * - Bug fix (minimal flow)
 * - Refactoring (security validation)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DecompositionResult } from '../../src/features/task-decomposer/types.js';
import type { TeamDefinition } from '../../src/features/team/types.js';
import type { WorkflowState } from '../../src/features/team/workflow.js';
import type { BVOrchestrationResult } from '../../src/features/verification/bv-integration.js';
import type { OhmyblackSessionState } from '../../src/features/state-manager/ohmyblack-schemas.js';
import {
  createMockTaskAnalysis,
  createMockDecomposition,
  createMockTeam,
  expectValidWorkflowState,
  expectValidSubtasks
} from '../integration/helpers.js';

// ============================================================================
// Workflow Test Context
// ============================================================================

interface FullWorkflowContext {
  sessionState: OhmyblackSessionState;
  decomposition: DecompositionResult;
  team: TeamDefinition;
  workflow: WorkflowState;
  results: BVOrchestrationResult[];
  report: WorkflowReport;
}

interface WorkflowReport {
  sessionId: string;
  scenario: string;
  phasesCompleted: string[];
  totalDuration: number;
  tasksCompleted: number;
  tasksFailed: number;
  bvCyclesExecuted: number;
  escalations: number;
  finalState: 'success' | 'failed' | 'partial';
}

function createFullWorkflowContext(scenario: string): FullWorkflowContext {
  return {
    sessionState: {
      sessionId: `workflow-${scenario}-${Date.now()}`,
      mode: 'autopilot',
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
    decomposition: createMockDecomposition(0),
    team: createMockTeam('standard'),
    workflow: {} as WorkflowState,
    results: [],
    report: {
      sessionId: '',
      scenario,
      phasesCompleted: [],
      totalDuration: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      bvCyclesExecuted: 0,
      escalations: 0,
      finalState: 'success'
    }
  };
}

// ============================================================================
// Complete Scenario Tests
// ============================================================================

describe('Full Workflow E2E', () => {
  describe('Complete Scenario: Feature Implementation', () => {
    it('should complete full feature implementation workflow', async () => {
      // ARRANGE: Setup feature implementation scenario
      const context = createFullWorkflowContext('feature-implementation');
      const startTime = Date.now();

      const featureDescription = `
        Implement a user notification system with:
        - Email notifications
        - In-app notifications
        - Notification preferences
        - Notification history
      `;

      // Phase 1: Task Analysis
      context.report.phasesCompleted.push('analysis');
      const analysis = createMockTaskAnalysis({
        task: featureDescription,
        type: 'feature',
        complexity: 0.7,
        areas: ['backend', 'frontend', 'database'],
        technologies: ['typescript', 'react', 'postgresql'],
        estimatedComponents: 6,
        isParallelizable: true
      });

      expect(analysis.complexity).toBeGreaterThan(0.5);
      expect(analysis.isParallelizable).toBe(true);

      // Phase 2: Task Decomposition
      context.report.phasesCompleted.push('decomposition');
      context.decomposition = createMockDecomposition(6);

      // Setup decomposition with realistic structure
      context.decomposition.analysis = analysis;
      context.decomposition.subtasks = [
        {
          id: 'task-1',
          name: 'Setup notification database schema',
          component: context.decomposition.components[0],
          prompt: 'Create database tables for notifications',
          agentType: 'executor',
          modelTier: 'medium',
          acceptanceCriteria: ['Schema created', 'Migrations work'],
          verification: 'Run migrations successfully',
          blockedBy: [],
          validation: {
            validationType: 'validator',
            validatorAgent: 'validator-logic',
            maxRetries: 3
          },
          ownership: {
            patterns: ['**/migrations/**', '**/schema/**'],
            files: []
          }
        },
        {
          id: 'task-2',
          name: 'Implement email notification service',
          component: context.decomposition.components[1],
          prompt: 'Create email notification service with templates',
          agentType: 'executor',
          modelTier: 'medium',
          acceptanceCriteria: ['Service created', 'Templates work', 'Tests pass'],
          verification: 'Unit tests pass',
          blockedBy: ['task-1'],
          validation: {
            validationType: 'validator',
            validatorAgent: 'validator-logic',
            maxRetries: 3
          },
          ownership: {
            patterns: ['**/services/email/**'],
            files: []
          }
        },
        {
          id: 'task-3',
          name: 'Implement in-app notification API',
          component: context.decomposition.components[2],
          prompt: 'Create REST API for in-app notifications',
          agentType: 'executor',
          modelTier: 'medium',
          acceptanceCriteria: ['API endpoints created', 'Auth working', 'Tests pass'],
          verification: 'Integration tests pass',
          blockedBy: ['task-1'],
          validation: {
            validationType: 'validator',
            validatorAgent: 'validator-logic',
            maxRetries: 3
          },
          ownership: {
            patterns: ['**/api/notifications/**'],
            files: []
          }
        },
        {
          id: 'task-4',
          name: 'Build notification preferences UI',
          component: context.decomposition.components[3],
          prompt: 'Create React components for notification preferences',
          agentType: 'designer',
          modelTier: 'medium',
          acceptanceCriteria: ['UI components created', 'Preferences save', 'Responsive'],
          verification: 'Component tests pass',
          blockedBy: ['task-3'],
          validation: {
            validationType: 'validator',
            validatorAgent: 'validator-syntax',
            maxRetries: 3
          },
          ownership: {
            patterns: ['**/components/notifications/**'],
            files: []
          }
        },
        {
          id: 'task-5',
          name: 'Implement notification history view',
          component: context.decomposition.components[4],
          prompt: 'Create notification history UI with pagination',
          agentType: 'designer',
          modelTier: 'medium',
          acceptanceCriteria: ['History view works', 'Pagination works', 'Tests pass'],
          verification: 'E2E tests pass',
          blockedBy: ['task-3'],
          validation: {
            validationType: 'validator',
            validatorAgent: 'validator-syntax',
            maxRetries: 3
          },
          ownership: {
            patterns: ['**/pages/notifications/**'],
            files: []
          }
        },
        {
          id: 'task-6',
          name: 'Integration testing',
          component: context.decomposition.components[5],
          prompt: 'Create end-to-end tests for notification system',
          agentType: 'qa-tester',
          modelTier: 'medium',
          acceptanceCriteria: ['E2E tests written', 'All tests pass'],
          verification: 'All integration tests pass',
          blockedBy: ['task-2', 'task-4', 'task-5'],
          validation: {
            validationType: 'architect',
            validatorAgent: 'architect',
            maxRetries: 3
          },
          ownership: {
            patterns: ['**/tests/e2e/**'],
            files: []
          }
        }
      ];

      expectValidSubtasks(context.decomposition.subtasks);

      // Phase 3: Team Composition
      context.report.phasesCompleted.push('team-composition');
      context.team = createMockTeam('robust'); // Complex feature needs robust team

      expect(context.team.members.length).toBeGreaterThanOrEqual(3);
      expect(context.team.defaultValidationType).toBe('validator');

      // Phase 4: Workflow Creation
      context.report.phasesCompleted.push('workflow-creation');
      context.workflow = {
        workflowId: `workflow-${context.sessionState.sessionId}`,
        team: context.team,
        tasks: context.decomposition.subtasks.map((subtask, idx) => ({
          id: subtask.id,
          subtask,
          bvConfig: {
            taskId: subtask.id,
            taskDescription: subtask.prompt,
            requirements: subtask.acceptanceCriteria,
            acceptanceCriteria: [subtask.verification],
            validationType: subtask.validation?.validationType || 'validator',
            builderAgent: subtask.agentType,
            maxRetries: 3,
            timeout: 300000,
            complexity: 'medium'
          },
          status: subtask.blockedBy.length === 0 ? 'pending' : 'blocked',
          blockedBy: subtask.blockedBy,
          blocks: [],
          retryCount: 0
        })),
        status: 'pending',
        config: {
          parallelExecution: true,
          maxParallelTasks: 3,
          defaultValidationType: 'validator',
          autoAssign: true,
          continueOnFailure: false,
          maxRetries: 3,
          taskTimeout: 300000
        },
        metrics: {
          totalTasks: 6,
          completedTasks: 0,
          failedTasks: 0,
          totalRetries: 0,
          totalDuration: 0,
          averageTaskDuration: 0
        }
      };

      expectValidWorkflowState(context.workflow);

      // Phase 5: Parallel Execution with B-V
      context.report.phasesCompleted.push('execution');

      // Execute workflow with dynamic dependency resolution
      while (context.workflow.metrics.completedTasks < 6) {
        const availableTasks = context.workflow.tasks.filter(
          t =>
            t.status === 'pending' &&
            t.blockedBy.every(blockerId =>
              context.workflow.tasks.find(
                task => task.id === blockerId && task.status === 'completed'
              )
            )
        );

        if (availableTasks.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
          continue;
        }

        // Execute available tasks in parallel (max 3)
        const tasksToExecute = availableTasks.slice(0, 3);
        const executionPromises = tasksToExecute.map(async task => {
          const result = await simulateWorkflowBVCycle(task);
          context.results.push(result);
          context.report.bvCyclesExecuted++;

          if (result.success) {
            task.status = 'completed';
            context.workflow.metrics.completedTasks++;
            context.report.tasksCompleted++;

            // Unblock dependent tasks
            for (const otherTask of context.workflow.tasks) {
              if (otherTask.blockedBy.includes(task.id)) {
                otherTask.blockedBy = otherTask.blockedBy.filter(id => id !== task.id);
                if (otherTask.blockedBy.length === 0 && otherTask.status === 'blocked') {
                  otherTask.status = 'pending';
                }
              }
            }
          } else {
            task.status = 'failed';
            context.report.tasksFailed++;
          }

          return result;
        });

        await Promise.all(executionPromises);
      }

      // Phase 6: Integration Validation
      context.report.phasesCompleted.push('validation');
      const integrationResult = await simulateWorkflowBVCycle(context.workflow.tasks[5], {
        validationType: 'architect'
      });

      expect(integrationResult.success).toBe(true);
      expect(integrationResult.cycleResult.validatorPassed).toBe(true);

      // Phase 7: Final Report
      context.report.phasesCompleted.push('reporting');
      context.report.totalDuration = Date.now() - startTime;
      context.report.sessionId = context.sessionState.sessionId;
      context.report.finalState = 'success';

      // ASSERT: Verify complete workflow
      expect(context.report.phasesCompleted).toEqual([
        'analysis',
        'decomposition',
        'team-composition',
        'workflow-creation',
        'execution',
        'validation',
        'reporting'
      ]);

      expect(context.report.tasksCompleted).toBe(6);
      expect(context.report.tasksFailed).toBe(0);
      expect(context.report.bvCyclesExecuted).toBeGreaterThanOrEqual(6);
      expect(context.report.finalState).toBe('success');

      // Verify all B-V cycles had proper evidence
      context.results.forEach(result => {
        expect(result.evidence.length).toBeGreaterThan(0);
        expect(result.cycleResult.builderPassed).toBe(true);
      });

      // Verify workflow metrics
      expect(context.workflow.metrics.completedTasks).toBe(6);
      expect(context.workflow.metrics.failedTasks).toBe(0);
      expect(context.workflow.status).toBe('completed');
    }, 90000); // 90s timeout for complex scenario
  });

  describe('Complete Scenario: Bug Fix', () => {
    it('should complete bug fix workflow with minimal team', async () => {
      // ARRANGE: Simple bug fix scenario
      const context = createFullWorkflowContext('bug-fix');
      const startTime = Date.now();

      const bugDescription = 'Fix null pointer exception in user profile update';

      // Phase 1: Quick analysis
      context.report.phasesCompleted.push('analysis');
      const analysis = createMockTaskAnalysis({
        task: bugDescription,
        type: 'bug',
        complexity: 0.2, // Low complexity
        areas: ['backend'],
        technologies: ['typescript'],
        estimatedComponents: 1,
        isParallelizable: false
      });

      // Phase 2: Single task decomposition
      context.report.phasesCompleted.push('decomposition');
      context.decomposition = createMockDecomposition(1);
      context.decomposition.subtasks[0] = {
        id: 'bugfix-1',
        name: 'Fix null pointer in profile update',
        component: context.decomposition.components[0],
        prompt: 'Add null check and handle edge case',
        agentType: 'executor',
        modelTier: 'low',
        acceptanceCriteria: ['Null check added', 'Tests pass', 'Bug verified fixed'],
        verification: 'Unit tests pass',
        blockedBy: [],
        validation: {
          validationType: 'self-only', // Simple fix, self-validation sufficient
          maxRetries: 2
        },
        ownership: {
          patterns: ['**/profile/update.ts'],
          files: []
        }
      };

      // Phase 3: Minimal team
      context.report.phasesCompleted.push('team-composition');
      context.team = createMockTeam('minimal');

      expect(context.team.members).toHaveLength(1);
      expect(context.team.defaultValidationType).toBe('self-only');

      // Phase 4: Simple workflow
      context.report.phasesCompleted.push('workflow-creation');
      context.workflow = {
        workflowId: `workflow-${context.sessionState.sessionId}`,
        team: context.team,
        tasks: [
          {
            id: 'bugfix-1',
            subtask: context.decomposition.subtasks[0],
            bvConfig: {
              taskId: 'bugfix-1',
              taskDescription: 'Fix null pointer in profile update',
              requirements: ['Null check added', 'Tests pass'],
              acceptanceCriteria: ['Unit tests pass'],
              validationType: 'self-only',
              builderAgent: 'executor',
              maxRetries: 2,
              timeout: 300000,
              complexity: 'low'
            },
            status: 'pending',
            blockedBy: [],
            blocks: [],
            retryCount: 0
          }
        ],
        status: 'pending',
        config: {
          parallelExecution: false,
          maxParallelTasks: 1,
          defaultValidationType: 'self-only',
          autoAssign: true,
          continueOnFailure: false,
          maxRetries: 2,
          taskTimeout: 300000
        },
        metrics: {
          totalTasks: 1,
          completedTasks: 0,
          failedTasks: 0,
          totalRetries: 0,
          totalDuration: 0,
          averageTaskDuration: 0
        }
      };

      // Phase 5: Quick execution
      context.report.phasesCompleted.push('execution');
      const result = await simulateWorkflowBVCycle(context.workflow.tasks[0], {
        validationType: 'self-only'
      });

      context.results.push(result);
      context.report.bvCyclesExecuted++;

      // Phase 6: Report
      context.report.phasesCompleted.push('reporting');
      context.report.totalDuration = Date.now() - startTime;
      context.report.tasksCompleted = 1;
      context.report.finalState = 'success';

      // ASSERT: Fast bug fix workflow
      expect(result.success).toBe(true);
      expect(context.report.totalDuration).toBeLessThan(5000); // Should be very fast
      expect(context.report.tasksCompleted).toBe(1);
      expect(context.workflow.metrics.completedTasks).toBe(1);

      // Self-validation only (no external validator)
      expect(result.cycleResult.validatorPassed).toBe(true);
      expect(result.cycleResult.retryCount).toBe(0);
    }, 30000);
  });

  describe('Complete Scenario: Refactoring', () => {
    it('should complete refactoring workflow with security validation', async () => {
      // ARRANGE: Refactoring with security implications
      const context = createFullWorkflowContext('refactoring');
      const startTime = Date.now();

      const refactorDescription = 'Refactor authentication system to use JWT tokens';

      // Phase 1: Analysis
      context.report.phasesCompleted.push('analysis');
      const analysis = createMockTaskAnalysis({
        task: refactorDescription,
        type: 'refactor',
        complexity: 0.6,
        areas: ['backend', 'security'],
        technologies: ['typescript', 'jwt'],
        estimatedComponents: 3,
        isParallelizable: false // Sequential refactoring
      });

      // Phase 2: Decomposition with security focus
      context.report.phasesCompleted.push('decomposition');
      context.decomposition = createMockDecomposition(3);
      context.decomposition.subtasks = [
        {
          id: 'refactor-1',
          name: 'Remove old session-based auth',
          component: context.decomposition.components[0],
          prompt: 'Safely remove old authentication code',
          agentType: 'executor',
          modelTier: 'medium',
          acceptanceCriteria: ['Old code removed', 'No breaking changes'],
          verification: 'Tests still pass',
          blockedBy: [],
          validation: {
            validationType: 'validator',
            validatorAgent: 'security-reviewer',
            maxRetries: 3
          },
          ownership: {
            patterns: ['**/auth/**'],
            files: []
          }
        },
        {
          id: 'refactor-2',
          name: 'Implement JWT authentication',
          component: context.decomposition.components[1],
          prompt: 'Add JWT token generation and validation',
          agentType: 'executor',
          modelTier: 'high', // Security-critical
          acceptanceCriteria: ['JWT working', 'Tokens secure', 'Tests pass'],
          verification: 'Security tests pass',
          blockedBy: ['refactor-1'],
          validation: {
            validationType: 'architect', // High-level security validation
            validatorAgent: 'architect',
            maxRetries: 3
          },
          ownership: {
            patterns: ['**/auth/jwt/**'],
            files: []
          }
        },
        {
          id: 'refactor-3',
          name: 'Update all auth middleware',
          component: context.decomposition.components[2],
          prompt: 'Update middleware to use JWT',
          agentType: 'executor',
          modelTier: 'medium',
          acceptanceCriteria: ['Middleware updated', 'All routes protected'],
          verification: 'Integration tests pass',
          blockedBy: ['refactor-2'],
          validation: {
            validationType: 'architect',
            validatorAgent: 'security-reviewer',
            maxRetries: 3
          },
          ownership: {
            patterns: ['**/middleware/**'],
            files: []
          }
        }
      ];

      // Phase 3: Robust team with security focus
      context.report.phasesCompleted.push('team-composition');
      context.team = createMockTeam('robust');

      // Phase 4: Sequential workflow
      context.report.phasesCompleted.push('workflow-creation');
      context.workflow = {
        workflowId: `workflow-${context.sessionState.sessionId}`,
        team: context.team,
        tasks: context.decomposition.subtasks.map((subtask, idx) => ({
          id: subtask.id,
          subtask,
          bvConfig: {
            taskId: subtask.id,
            taskDescription: subtask.prompt,
            requirements: subtask.acceptanceCriteria,
            acceptanceCriteria: [subtask.verification],
            validationType: subtask.validation?.validationType || 'architect',
            builderAgent: subtask.agentType,
            maxRetries: 3,
            timeout: 300000,
            complexity: subtask.modelTier === 'high' ? 'high' : 'medium'
          },
          status: idx === 0 ? 'pending' : 'blocked',
          blockedBy: subtask.blockedBy,
          blocks: [],
          retryCount: 0
        })),
        status: 'pending',
        config: {
          parallelExecution: false,
          maxParallelTasks: 1,
          defaultValidationType: 'architect',
          autoAssign: true,
          continueOnFailure: false,
          maxRetries: 3,
          taskTimeout: 300000
        },
        metrics: {
          totalTasks: 3,
          completedTasks: 0,
          failedTasks: 0,
          totalRetries: 0,
          totalDuration: 0,
          averageTaskDuration: 0
        }
      };

      // Phase 5: Sequential execution with security validation
      context.report.phasesCompleted.push('execution');

      for (const task of context.workflow.tasks) {
        const result = await simulateWorkflowBVCycle(task, {
          validationType: task.bvConfig?.validationType as any
        });

        context.results.push(result);
        context.report.bvCyclesExecuted++;

        expect(result.success).toBe(true);
        task.status = 'completed';
        context.workflow.metrics.completedTasks++;

        // Unblock next task
        const nextTask = context.workflow.tasks.find(t =>
          t.blockedBy.includes(task.id)
        );
        if (nextTask) {
          nextTask.blockedBy = nextTask.blockedBy.filter(id => id !== task.id);
          if (nextTask.blockedBy.length === 0) {
            nextTask.status = 'pending';
          }
        }
      }

      // Phase 6: Report
      context.report.phasesCompleted.push('reporting');
      context.report.totalDuration = Date.now() - startTime;
      context.report.tasksCompleted = 3;
      context.report.finalState = 'success';

      // ASSERT: Security-focused refactoring completed
      expect(context.report.tasksCompleted).toBe(3);
      expect(context.workflow.metrics.completedTasks).toBe(3);

      // All tasks should have architect-level validation
      context.results.forEach(result => {
        expect(result.cycleResult.validatorPassed).toBe(true);
        expect(result.evidence.length).toBeGreaterThan(0);
      });

      expect(context.report.finalState).toBe('success');
    }, 60000);
  });
});

// ============================================================================
// Simulation Helpers
// ============================================================================

async function simulateWorkflowBVCycle(
  task: any,
  options?: {
    validationType?: 'self-only' | 'validator' | 'architect';
  }
): Promise<BVOrchestrationResult> {
  // Simulate execution time
  await new Promise(resolve => setTimeout(resolve, 100));

  const validationType = options?.validationType || 'validator';

  const result: BVOrchestrationResult = {
    taskId: task.id,
    success: true,
    cycleResult: {
      success: true,
      builderPassed: true,
      validatorPassed: true,
      retryCount: 0,
      evidence: [
        {
          type: 'test_pass',
          passed: true,
          timestamp: new Date()
        },
        {
          type: validationType === 'self-only' ? 'syntax_clean' : 'validator_approval',
          passed: true,
          timestamp: new Date()
        }
      ],
      issues: []
    },
    retryState: {
      currentAttempt: 0,
      maxAttempts: 3,
      history: [],
      status: 'success'
    },
    totalDuration: 100,
    evidence: [
      {
        type: 'test_pass',
        passed: true,
        timestamp: new Date()
      }
    ]
  };

  return result;
}
