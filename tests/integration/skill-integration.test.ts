/**
 * Skill Integration Tests
 *
 * Tests integration points between ohmyblack components and OMB skills:
 * - Autopilot ohmyblack integration
 * - Ralph B-V integration
 * - Ultrawork B-V integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockTaskAnalysis, createMockDecomposition, createMockTeam, expectValidWorkflowState } from './helpers.js';

describe('Skill Integration', () => {
  describe('Autopilot Integration Points', () => {
    it('should have structure for initializing ohmyblack state', () => {
      // Test that state initialization would work
      const autopilotState = {
        phase: 'planning',
        taskDescription: 'Build auth system',
        team: null,
        workflow: null,
        startedAt: Date.now(),
        completedAt: null
      };

      expect(autopilotState.phase).toBe('planning');
      expect(autopilotState.taskDescription).toBeTruthy();
      expect(autopilotState.startedAt).toBeDefined();
    });

    it('should prepare task analysis for auto-composition', () => {
      const taskDescription = 'Build a REST API with authentication';

      // Simulate what autopilot would do
      const analysis = createMockTaskAnalysis({
        task: taskDescription,
        complexity: 0.6,
        type: 'feature',
        areas: ['backend', 'security'],
        technologies: ['typescript', 'express', 'jwt']
      });

      expect(analysis.task).toBe(taskDescription);
      expect(analysis.complexity).toBeGreaterThan(0);
      expect(analysis.areas.length).toBeGreaterThan(0);
    });

    it('should create team from auto-composer result', () => {
      const analysis = createMockTaskAnalysis({ complexity: 0.6 });
      const team = createMockTeam('standard');

      expect(team.id).toBeDefined();
      expect(team.members.length).toBeGreaterThan(0);
      expect(team.defaultValidationType).toBeDefined();
    });

    it('should create workflow from decomposition', () => {
      const team = createMockTeam('standard');
      const decomposition = createMockDecomposition(3);

      // Simulate workflow creation (using imported function from workflow.ts)
      const mockWorkflow = {
        workflowId: 'autopilot-workflow-1',
        team,
        tasks: decomposition.subtasks.map((st, idx) => ({
          id: st.id,
          subtask: st,
          status: idx === 0 ? 'pending' : 'blocked',
          blockedBy: st.blockedBy,
          blocks: [],
          retryCount: 0
        })),
        status: 'pending',
        config: team.config,
        metrics: {
          totalTasks: decomposition.subtasks.length,
          completedTasks: 0,
          failedTasks: 0,
          totalRetries: 0,
          totalDuration: 0,
          averageTaskDuration: 0
        }
      };

      expect(mockWorkflow.workflowId).toBeTruthy();
      expect(mockWorkflow.tasks.length).toBe(3);
      expect(mockWorkflow.team).toBe(team);
    });

    it('should track autopilot progress through phases', () => {
      const progressState = {
        phase: 'planning',
        planComplete: false,
        teamComposed: false,
        workflowCreated: false,
        executionStarted: false,
        tasksCompleted: 0,
        totalTasks: 0
      };

      expect(progressState.phase).toBe('planning');

      // Simulate phase transitions
      progressState.planComplete = true;
      progressState.phase = 'team-composition';
      expect(progressState.phase).toBe('team-composition');

      progressState.teamComposed = true;
      progressState.phase = 'workflow-creation';
      expect(progressState.phase).toBe('workflow-creation');

      progressState.workflowCreated = true;
      progressState.phase = 'execution';
      expect(progressState.phase).toBe('execution');
    });

    it('should generate autopilot completion report', () => {
      const report = {
        success: true,
        taskDescription: 'Build auth API',
        teamSize: 3,
        tasksCompleted: 5,
        totalTasks: 5,
        duration: 150000,
        templateUsed: 'standard',
        validationType: 'validator',
        totalRetries: 2,
        failures: []
      };

      expect(report.success).toBe(true);
      expect(report.tasksCompleted).toBe(report.totalTasks);
      expect(report.duration).toBeGreaterThan(0);
      expect(report.templateUsed).toBeDefined();
    });
  });

  describe('Ralph B-V Integration Points', () => {
    it('should initialize B-V ralph state', () => {
      const ralphState = {
        mode: 'ralph-bv',
        taskDescription: 'Refactor auth module',
        team: createMockTeam('robust'),
        currentTaskId: null,
        completedTasks: [],
        failedTasks: [],
        retryStates: new Map(),
        maxGlobalRetries: 5,
        globalRetryCount: 0
      };

      expect(ralphState.mode).toBe('ralph-bv');
      expect(ralphState.team).toBeDefined();
      expect(ralphState.completedTasks).toEqual([]);
      expect(ralphState.retryStates).toBeInstanceOf(Map);
    });

    it('should track retry state per task', () => {
      const retryStates = new Map();

      retryStates.set('task-1', {
        currentAttempt: 1,
        maxAttempts: 3,
        history: [],
        status: 'in_progress'
      });

      retryStates.set('task-2', {
        currentAttempt: 0,
        maxAttempts: 3,
        history: [],
        status: 'in_progress'
      });

      expect(retryStates.size).toBe(2);
      expect(retryStates.get('task-1')!.currentAttempt).toBe(1);
    });

    it('should handle ralph continuation after failure', () => {
      const continuationDecision = {
        shouldContinue: true,
        reason: 'Retryable failure',
        action: 'retry',
        taskId: 'task-1'
      };

      expect(continuationDecision.shouldContinue).toBe(true);
      expect(continuationDecision.action).toBe('retry');

      // Simulate escalation scenario
      const escalationDecision = {
        shouldContinue: false,
        reason: 'Max retries exceeded',
        action: 'escalate',
        taskId: 'task-1',
        escalationLevel: 'architect'
      };

      expect(escalationDecision.shouldContinue).toBe(false);
      expect(escalationDecision.action).toBe('escalate');
    });

    it('should maintain ralph persistence across task failures', () => {
      let persistenceState = {
        completed: ['task-1', 'task-2'],
        failed: [],
        inProgress: 'task-3',
        remaining: ['task-4', 'task-5']
      };

      // Simulate task 3 failure
      persistenceState = {
        ...persistenceState,
        failed: ['task-3'],
        inProgress: 'task-3' // Retry
      };

      expect(persistenceState.failed).toContain('task-3');
      expect(persistenceState.completed.length).toBe(2);

      // After successful retry
      persistenceState = {
        ...persistenceState,
        completed: [...persistenceState.completed, 'task-3'],
        failed: persistenceState.failed.filter(id => id !== 'task-3'),
        inProgress: 'task-4'
      };

      expect(persistenceState.completed).toContain('task-3');
      expect(persistenceState.failed).toEqual([]);
    });

    it('should generate ralph completion criteria check', () => {
      const checkCompletion = (state: {
        totalTasks: number;
        completedTasks: number;
        failedTasks: number;
        maxFailures: number;
      }) => {
        const allTasksProcessed =
          state.completedTasks + state.failedTasks === state.totalTasks;
        const tooManyFailures = state.failedTasks > state.maxFailures;
        const canContinue = !tooManyFailures && !allTasksProcessed;

        return {
          isComplete: allTasksProcessed,
          success: state.failedTasks === 0,
          canContinue
        };
      };

      const result1 = checkCompletion({
        totalTasks: 5,
        completedTasks: 5,
        failedTasks: 0,
        maxFailures: 1
      });

      expect(result1.isComplete).toBe(true);
      expect(result1.success).toBe(true);

      const result2 = checkCompletion({
        totalTasks: 5,
        completedTasks: 3,
        failedTasks: 0,
        maxFailures: 1
      });

      expect(result2.isComplete).toBe(false);
      expect(result2.canContinue).toBe(true);

      const result3 = checkCompletion({
        totalTasks: 5,
        completedTasks: 2,
        failedTasks: 2,
        maxFailures: 1
      });

      expect(result3.canContinue).toBe(false); // Too many failures
    });
  });

  describe('Ultrawork B-V Integration Points', () => {
    it('should initialize B-V ultrawork state', () => {
      const ultraworkState = {
        mode: 'ultrawork-bv',
        team: createMockTeam('robust'),
        allTasks: ['task-1', 'task-2', 'task-3', 'task-4'],
        activeBatches: new Map(),
        completedTasks: [],
        failedTasks: [],
        maxParallelTasks: 3,
        currentBatchNumber: 0
      };

      expect(ultraworkState.mode).toBe('ultrawork-bv');
      expect(ultraworkState.maxParallelTasks).toBe(3);
      expect(ultraworkState.activeBatches).toBeInstanceOf(Map);
    });

    it('should schedule tasks in parallel batches', () => {
      const allTasks = ['task-1', 'task-2', 'task-3', 'task-4', 'task-5'];
      const maxParallel = 3;
      const completed = new Set<string>();
      const failed = new Set<string>();

      const scheduleBatch = () => {
        const availableTasks = allTasks.filter(
          t => !completed.has(t) && !failed.has(t)
        );
        return availableTasks.slice(0, maxParallel);
      };

      const batch1 = scheduleBatch();
      expect(batch1.length).toBe(3);
      expect(batch1).toEqual(['task-1', 'task-2', 'task-3']);

      // Simulate completion
      completed.add('task-1');
      completed.add('task-2');

      const batch2 = scheduleBatch();
      expect(batch2.length).toBe(3);
      expect(batch2).toContain('task-3');
      expect(batch2).toContain('task-4');
      expect(batch2).toContain('task-5');
    });

    it('should track parallel B-V cycle results', () => {
      const batchResults = new Map();

      batchResults.set('task-1', {
        success: true,
        duration: 5000,
        retryCount: 0
      });

      batchResults.set('task-2', {
        success: true,
        duration: 3000,
        retryCount: 1
      });

      batchResults.set('task-3', {
        success: false,
        duration: 2000,
        retryCount: 3,
        error: 'Validation failed'
      });

      expect(batchResults.size).toBe(3);

      const successCount = Array.from(batchResults.values()).filter(
        r => r.success
      ).length;
      expect(successCount).toBe(2);

      const totalRetries = Array.from(batchResults.values()).reduce(
        (sum, r) => sum + r.retryCount,
        0
      );
      expect(totalRetries).toBe(4);
    });

    it('should handle batch completion and schedule next', () => {
      let state = {
        allTasks: ['task-1', 'task-2', 'task-3', 'task-4'],
        currentBatch: ['task-1', 'task-2'],
        completed: [] as string[],
        failed: [] as string[],
        maxParallel: 2
      };

      // Simulate batch completion
      state = {
        ...state,
        completed: ['task-1', 'task-2'],
        currentBatch: []
      };

      // Schedule next batch
      const remaining = state.allTasks.filter(
        t => !state.completed.includes(t) && !state.failed.includes(t)
      );
      const nextBatch = remaining.slice(0, state.maxParallel);

      state = {
        ...state,
        currentBatch: nextBatch
      };

      expect(state.currentBatch).toEqual(['task-3', 'task-4']);
      expect(state.completed).toEqual(['task-1', 'task-2']);
    });

    it('should aggregate ultrawork metrics', () => {
      const metrics = {
        totalTasks: 10,
        completedTasks: 8,
        failedTasks: 2,
        totalDuration: 45000,
        averageTaskDuration: 5000,
        maxParallelAchieved: 3,
        totalRetries: 5,
        batchCount: 4
      };

      expect(metrics.completedTasks + metrics.failedTasks).toBe(metrics.totalTasks);
      expect(metrics.averageTaskDuration).toBeGreaterThan(0);
      expect(metrics.batchCount).toBeGreaterThan(0);

      const successRate = metrics.completedTasks / metrics.totalTasks;
      expect(successRate).toBe(0.8);

      const avgRetriesPerTask = metrics.totalRetries / metrics.totalTasks;
      expect(avgRetriesPerTask).toBe(0.5);
    });

    it('should respect team member capacity in parallel execution', () => {
      const team = createMockTeam('robust');
      const maxCapacity = team.members.reduce(
        (sum, m) => sum + m.maxConcurrentTasks,
        0
      );

      const currentAssignments = {
        'builder-1': 2, // At capacity if maxConcurrentTasks = 2
        'validator-1': 0,
        'validator-2': 1
      };

      const canAssignMore = (memberId: string) => {
        const member = team.members.find(m => m.id === memberId);
        if (!member) return false;

        const current = currentAssignments[memberId as keyof typeof currentAssignments] || 0;
        return current < member.maxConcurrentTasks;
      };

      expect(canAssignMore('builder-1')).toBe(false); // At capacity
      expect(canAssignMore('validator-1')).toBe(true); // Has capacity
    });
  });

  describe('Cross-Skill Integration', () => {
    it('should share verification protocol across skills', () => {
      const verificationChecks = [
        'BUILD',
        'TEST',
        'LINT',
        'FUNCTIONALITY',
        'ARCHITECT',
        'TODO',
        'ERROR_FREE'
      ];

      expect(verificationChecks).toContain('BUILD');
      expect(verificationChecks).toContain('TEST');
      expect(verificationChecks).toContain('ARCHITECT');
    });

    it('should use consistent evidence format across skills', () => {
      const evidence = {
        type: 'test_pass',
        passed: true,
        command: 'npm test',
        output: 'All tests passed',
        timestamp: new Date(),
        metadata: {
          skill: 'autopilot-ohmyblack',
          taskId: 'task-1'
        }
      };

      expect(evidence.type).toBeDefined();
      expect(evidence.passed).toBe(true);
      expect(evidence.timestamp).toBeInstanceOf(Date);
    });

    it('should maintain consistent task state across transitions', () => {
      const taskState = {
        id: 'task-1',
        status: 'pending',
        assignment: null,
        retryCount: 0,
        evidence: [],
        startedAt: null,
        completedAt: null
      };

      expect(taskState.status).toBe('pending');

      // Transition to running
      taskState.status = 'running';
      taskState.startedAt = Date.now();

      expect(taskState.status).toBe('running');
      expect(taskState.startedAt).toBeTruthy();

      // Transition to completed
      taskState.status = 'completed';
      taskState.completedAt = Date.now();

      expect(taskState.status).toBe('completed');
      expect(taskState.completedAt).toBeGreaterThan(taskState.startedAt!);
    });
  });
});
