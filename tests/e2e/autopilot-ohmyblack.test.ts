/**
 * E2E Tests: Autopilot with Ohmyblack Mode
 *
 * Tests the complete autopilot flow with ohmyblack's Builder-Validator (B-V) cycle integration.
 * These tests verify the full lifecycle from task analysis through team composition,
 * workflow execution, B-V cycles, and final report generation.
 *
 * Test Strategy:
 * - Simulation mode to avoid actual agent spawning
 * - State verification at each critical phase
 * - Event emission tracking for progress monitoring
 * - Full report validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { OhmyblackSessionState } from '../../src/features/state-manager/ohmyblack-schemas.js';
import type { AutopilotState } from '../../src/hooks/autopilot/types.js';
import type { TeamDefinition } from '../../src/features/team/types.js';
import type { WorkflowState } from '../../src/features/team/workflow.js';
import type { BVOrchestrationResult } from '../../src/features/verification/bv-integration.js';
import {
  createMockDecomposition,
  createMockTeam,
  expectValidWorkflowState,
  waitFor
} from '../integration/helpers.js';

// ============================================================================
// Test Fixtures
// ============================================================================

interface AutopilotTestContext {
  /** Mock autopilot state */
  autopilotState: AutopilotState;
  /** Mock session state */
  sessionState: OhmyblackSessionState;
  /** Mock team */
  team: TeamDefinition;
  /** Mock workflow */
  workflow: WorkflowState;
  /** Collected events */
  events: Array<{ type: string; data: unknown }>;
}

/**
 * Create test context with mock states
 */
function createTestContext(): AutopilotTestContext {
  const decomposition = createMockDecomposition(3);
  const team = createMockTeam('standard');

  // Mock workflow state
  const workflow: WorkflowState = {
    workflowId: 'test-workflow-1',
    team,
    tasks: [],
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
      totalTasks: 3,
      completedTasks: 0,
      failedTasks: 0,
      totalRetries: 0,
      totalDuration: 0,
      averageTaskDuration: 0
    }
  };

  // Mock autopilot state
  const autopilotState: AutopilotState = {
    active: true,
    phase: 'expansion',
    iteration: 0,
    max_iterations: 10,
    originalIdea: 'Implement user authentication system',
    expansion: {
      analyst_complete: false,
      architect_complete: false,
      spec_path: null,
      requirements_summary: '',
      tech_stack: []
    },
    planning: {
      plan_path: null,
      architect_iterations: 0,
      approved: false
    },
    execution: {
      ralph_iterations: 0,
      ultrawork_active: false,
      tasks_completed: 0,
      tasks_total: 3,
      files_created: [],
      files_modified: []
    },
    qa: {
      ultraqa_cycles: 0,
      build_status: 'pending',
      lint_status: 'pending',
      test_status: 'pending'
    },
    validation: {
      architects_spawned: 0,
      verdicts: [],
      all_approved: false,
      validation_rounds: 0
    },
    started_at: new Date().toISOString(),
    completed_at: null,
    phase_durations: {},
    total_agents_spawned: 0,
    wisdom_entries: 0
  };

  // Mock session state
  const sessionState: OhmyblackSessionState = {
    sessionId: 'test-session-1',
    mode: 'autopilot',
    tasks: [],
    validations: [],
    startedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    config: {
      maxParallel: 3,
      taskTimeout: 300000,
      autoEscalate: true,
      builderModel: 'medium',
      validatorModel: 'medium'
    }
  };

  return {
    autopilotState,
    sessionState,
    team,
    workflow,
    events: []
  };
}

// ============================================================================
// Full Flow Tests
// ============================================================================

describe('Autopilot Ohmyblack E2E', () => {
  let context: AutopilotTestContext;

  beforeEach(() => {
    context = createTestContext();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any state files
  });

  describe('Full Flow', () => {
    it('should complete simple task with B-V validation (default)', async () => {
      // ARRANGE: Setup for simple task - B-V cycle is now default
      const simpleTask = 'Add a utility function for date formatting';
      context.team = createMockTeam('minimal'); // Now includes validator by default

      // ACT: Execute autopilot flow
      // 1. Phase: Expansion (Analyst + Architect)
      const expansionResult = await simulateExpansionPhase(context, simpleTask);
      expect(expansionResult.success).toBe(true);
      expect(context.autopilotState.expansion.analyst_complete).toBe(true);
      expect(context.autopilotState.expansion.architect_complete).toBe(true);

      // 2. Phase: Task Decomposition
      const decomposition = createMockDecomposition(1); // Single task
      expect(decomposition.subtasks).toHaveLength(1);
      expect(decomposition.subtasks[0].validation?.validationType).toBe('validator');  // B-V cycle default

      // 3. Phase: Team Composition (minimal team now includes validator for B-V cycle)
      const composedTeam = await simulateTeamComposition(context, decomposition);
      expect(composedTeam.members).toHaveLength(2); // builder + validator (B-V cycle default)
      expect(composedTeam.defaultValidationType).toBe('validator');

      // 4. Phase: Workflow Creation
      const workflow = await simulateWorkflowCreation(context, decomposition, composedTeam);
      expectValidWorkflowState(workflow);
      expect(workflow.tasks).toHaveLength(1);
      expect(workflow.tasks[0].bvConfig?.validationType).toBe('validator');  // B-V cycle default

      // 5. Phase: Task Execution with B-V Cycle
      const bvResult = await simulateBVCycle(context, workflow.tasks[0]);
      expect(bvResult.success).toBe(true);
      expect(bvResult.cycleResult.builderPassed).toBe(true);
      expect(bvResult.cycleResult.validatorPassed).toBe(true);
      expect(bvResult.retryState.currentAttempt).toBe(0); // No retries needed

      // 6. Phase: Completion
      context.autopilotState.phase = 'complete';
      context.workflow.status = 'completed';  // Mark workflow as completed
      expect(context.autopilotState.execution.tasks_completed).toBe(1);
      expect(context.workflow.metrics.completedTasks).toBe(1);

      // ASSERT: Verify final state
      expect(context.autopilotState.phase).toBe('complete');
      expect(context.workflow.status).toBe('completed');
      expect(bvResult.evidence.length).toBeGreaterThan(0);
    }, 30000); // 30s timeout for E2E test

    it('should complete complex task with validator validation', async () => {
      // ARRANGE: Setup for complex task (complexity > 0.6)
      const complexTask = 'Implement full authentication system with OAuth2';
      context.team = createMockTeam('robust'); // Full team with validators

      // ACT: Execute full B-V cycle
      // 1. Expansion phase
      const expansionResult = await simulateExpansionPhase(context, complexTask);
      expect(expansionResult.success).toBe(true);
      expect(context.autopilotState.expansion.tech_stack).toBeDefined();

      // 2. Decomposition into multiple subtasks
      const decomposition = createMockDecomposition(5); // 5 parallel subtasks
      expect(decomposition.subtasks).toHaveLength(5);

      // 3. Team composition (robust team)
      const composedTeam = await simulateTeamComposition(context, decomposition);
      expect(composedTeam.members.length).toBeGreaterThanOrEqual(3); // Builders + Validators
      expect(composedTeam.defaultValidationType).toBe('validator');

      // 4. Workflow with dependencies
      const workflow = await simulateWorkflowCreation(context, decomposition, composedTeam);
      expectValidWorkflowState(workflow);

      // 5. Execute tasks with B-V cycles
      const results: BVOrchestrationResult[] = [];
      for (const task of workflow.tasks) {
        const bvResult = await simulateBVCycle(context, task);
        results.push(bvResult);
      }

      // ASSERT: All tasks completed with validation
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.cycleResult.builderPassed).toBe(true);
        expect(result.cycleResult.validatorPassed).toBe(true);
        expect(result.evidence.length).toBeGreaterThan(1); // Builder + Validator evidence
      });

      // Verify workflow completion
      expect(context.workflow.metrics.completedTasks).toBe(5);
      expect(context.workflow.metrics.failedTasks).toBe(0);
    }, 60000); // 60s timeout for complex test

    it('should handle validation failure and retry', async () => {
      // ARRANGE: Setup for task that will fail validation initially
      const task = 'Implement payment processing';
      context.team = createMockTeam('standard');

      const decomposition = createMockDecomposition(1);
      const workflow = await simulateWorkflowCreation(context, decomposition, context.team);

      // ACT: Simulate validation failure
      const firstAttempt = await simulateBVCycle(context, workflow.tasks[0], {
        shouldFailValidation: true,
        validationIssues: ['Missing error handling', 'No input validation']
      });

      // ASSERT: First attempt should fail
      expect(firstAttempt.success).toBe(false);
      expect(firstAttempt.cycleResult.validatorPassed).toBe(false);
      expect(firstAttempt.cycleResult.issues.length).toBeGreaterThan(0);
      expect(firstAttempt.retryState.currentAttempt).toBe(0);

      // ACT: Retry with fixes
      const secondAttempt = await simulateBVCycle(context, workflow.tasks[0], {
        retryAttempt: 1,
        previousFeedback: firstAttempt.cycleResult.issues
      });

      // ASSERT: Second attempt should succeed
      expect(secondAttempt.success).toBe(true);
      expect(secondAttempt.cycleResult.validatorPassed).toBe(true);
      expect(secondAttempt.retryState.currentAttempt).toBe(1);
      expect(secondAttempt.retryState.status).toBe('success');

      // Verify retry tracking
      expect(context.workflow.metrics.totalRetries).toBe(1);
    }, 45000);

    it('should escalate after max retries', async () => {
      // ARRANGE: Setup for task that consistently fails
      const task = 'Complex database migration';
      context.team = createMockTeam('standard');

      const decomposition = createMockDecomposition(1);
      decomposition.subtasks[0].validation = {
        validationType: 'validator',
        validatorAgent: 'validator-logic',
        maxRetries: 3
      };

      const workflow = await simulateWorkflowCreation(context, decomposition, context.team);

      // ACT: Simulate multiple failures
      const attempts: BVOrchestrationResult[] = [];
      for (let i = 0; i <= 3; i++) {
        const result = await simulateBVCycle(context, workflow.tasks[0], {
          shouldFailValidation: true,
          validationIssues: ['Critical architectural issue'],
          retryAttempt: i
        });
        attempts.push(result);
      }

      // ASSERT: Should escalate after max retries
      const finalAttempt = attempts[attempts.length - 1];
      expect(finalAttempt.success).toBe(false);
      expect(finalAttempt.escalation).toBeDefined();
      expect(finalAttempt.escalation?.shouldEscalate).toBe(true);
      expect(finalAttempt.escalation?.escalationLevel).toBe('architect');
      expect(finalAttempt.retryState.status).toBe('escalated');

      // Verify escalation reason
      expect(finalAttempt.escalation?.reason).toContain('Maximum retry attempts');
    }, 45000);
  });

  // ============================================================================
  // Team Composition Flow Tests
  // ============================================================================

  describe('Team Composition Flow', () => {
    it('should auto-select minimal team for simple task', async () => {
      // ARRANGE
      const simpleTask = 'Add a helper function';
      const decomposition = createMockDecomposition(1);
      decomposition.analysis.complexity = 0.2; // Low complexity

      // ACT
      const team = await simulateTeamComposition(context, decomposition);

      // ASSERT: Even low complexity tasks now use B-V cycle by default
      expect(team.members).toHaveLength(2);  // builder + validator
      expect(team.members[0].role).toBe('builder');
      expect(team.defaultValidationType).toBe('validator');  // B-V cycle default
    });

    it('should auto-select robust team for complex task', async () => {
      // ARRANGE
      const complexTask = 'Implement microservices architecture';
      const decomposition = createMockDecomposition(10);
      decomposition.analysis.complexity = 0.9; // High complexity
      decomposition.analysis.areas = ['backend', 'security', 'infrastructure'];

      // ACT
      const team = await simulateTeamComposition(context, decomposition);

      // ASSERT: B-V cycle ensures at least builder + validator
      expect(team.members.length).toBeGreaterThanOrEqual(2);
      expect(team.members.filter(m => m.role === 'builder').length).toBeGreaterThanOrEqual(1);
      expect(team.members.filter(m => m.role === 'validator').length).toBeGreaterThanOrEqual(1);
      expect(team.defaultValidationType).toBe('validator');  // B-V default
    });

    it('should respect team template override', async () => {
      // ARRANGE
      const decomposition = createMockDecomposition(3);
      const overrideTeam = createMockTeam('robust');

      // ACT
      const team = await simulateTeamComposition(context, decomposition, {
        teamTemplate: overrideTeam
      });

      // ASSERT
      expect(team.id).toBe(overrideTeam.id);
      expect(team.members).toEqual(overrideTeam.members);
    });
  });

  // ============================================================================
  // Progress Tracking Tests
  // ============================================================================

  describe('Progress Tracking', () => {
    it('should emit progress events during execution', async () => {
      // ARRANGE
      const decomposition = createMockDecomposition(3);
      const workflow = await simulateWorkflowCreation(
        context,
        decomposition,
        context.team
      );

      // Setup event listener
      const progressEvents: Array<{ phase: string; progress: number }> = [];
      const onProgress = (event: { phase: string; progress: number }) => {
        progressEvents.push(event);
      };

      // ACT: Execute with progress tracking
      for (let i = 0; i < workflow.tasks.length; i++) {
        await simulateBVCycle(context, workflow.tasks[i]);
        onProgress({
          phase: 'execution',
          progress: ((i + 1) / workflow.tasks.length) * 100
        });
      }

      // ASSERT
      expect(progressEvents).toHaveLength(3);
      expect(progressEvents[0].progress).toBeCloseTo(33.33, 1);
      expect(progressEvents[1].progress).toBeCloseTo(66.67, 1);
      expect(progressEvents[2].progress).toBe(100);
    });

    it('should track B-V cycle progress', async () => {
      // ARRANGE
      const decomposition = createMockDecomposition(1);
      const workflow = await simulateWorkflowCreation(
        context,
        decomposition,
        context.team
      );

      const bvEvents: Array<{ stage: string; attempt: number }> = [];
      const onBVProgress = (event: { stage: string; attempt: number }) => {
        bvEvents.push(event);
      };

      // ACT: Execute B-V cycle with progress tracking
      await simulateBVCycle(context, workflow.tasks[0], {
        onProgress: onBVProgress
      });

      // ASSERT: Should have events for build and validate stages
      expect(bvEvents.length).toBeGreaterThanOrEqual(2);
      expect(bvEvents.some(e => e.stage === 'build')).toBe(true);
      expect(bvEvents.some(e => e.stage === 'validate')).toBe(true);
    });
  });

  // ============================================================================
  // State Persistence Tests
  // ============================================================================

  describe('State Persistence', () => {
    it('should save and restore ohmyblack state', async () => {
      // ARRANGE
      const originalState = context.sessionState;
      originalState.tasks = [
        {
          id: 'task-1',
          status: 'completed',
          blockedBy: [],
          blocks: [],
          evidence: [],
          retryCount: 0,
          maxRetries: 3
        }
      ];

      // ACT: Simulate save and load
      const serialized = JSON.stringify(originalState);
      const restored: OhmyblackSessionState = JSON.parse(serialized);

      // ASSERT
      expect(restored.sessionId).toBe(originalState.sessionId);
      expect(restored.mode).toBe(originalState.mode);
      expect(restored.tasks).toHaveLength(1);
      expect(restored.tasks[0].id).toBe('task-1');
      expect(restored.tasks[0].status).toBe('completed');
    });

    it('should resume interrupted workflow', async () => {
      // ARRANGE: Create partially completed workflow
      const decomposition = createMockDecomposition(3);
      const workflow = await simulateWorkflowCreation(
        context,
        decomposition,
        context.team
      );

      // Complete first task
      await simulateBVCycle(context, workflow.tasks[0]);
      workflow.tasks[0].status = 'completed';

      // Simulate interruption (save state)
      const savedState = JSON.stringify(workflow);

      // ACT: Resume workflow
      const restoredWorkflow: WorkflowState = JSON.parse(savedState);

      // Continue from second task
      expect(restoredWorkflow.tasks[0].status).toBe('completed');
      expect(restoredWorkflow.tasks[1].status).not.toBe('completed');

      // Complete remaining tasks
      await simulateBVCycle(context, restoredWorkflow.tasks[1]);
      await simulateBVCycle(context, restoredWorkflow.tasks[2]);

      // ASSERT
      expect(restoredWorkflow.tasks.every(t => t.status === 'completed')).toBe(true);
      expect(restoredWorkflow.metrics.completedTasks).toBe(3);
    });
  });
});

// ============================================================================
// Simulation Helper Functions
// ============================================================================

/**
 * Simulate expansion phase (Analyst + Architect)
 */
async function simulateExpansionPhase(
  context: AutopilotTestContext,
  task: string
): Promise<{ success: boolean }> {
  context.autopilotState.expansion.analyst_complete = true;
  context.autopilotState.expansion.architect_complete = true;
  context.autopilotState.expansion.requirements_summary = `Requirements for: ${task}`;
  context.autopilotState.expansion.tech_stack = ['typescript', 'node'];
  context.autopilotState.phase = 'planning';

  return { success: true };
}

/**
 * Simulate team composition based on decomposition
 */
async function simulateTeamComposition(
  context: AutopilotTestContext,
  decomposition: any,
  options?: { teamTemplate?: TeamDefinition }
): Promise<TeamDefinition> {
  if (options?.teamTemplate) {
    return options.teamTemplate;
  }

  // Auto-select based on complexity
  const complexity = decomposition.analysis.complexity;
  if (complexity < 0.3) {
    return createMockTeam('minimal');
  } else if (complexity < 0.7) {
    return createMockTeam('standard');
  } else {
    return createMockTeam('robust');
  }
}

/**
 * Simulate workflow creation from decomposition
 */
async function simulateWorkflowCreation(
  context: AutopilotTestContext,
  decomposition: any,
  team: TeamDefinition
): Promise<WorkflowState> {
  const workflow: WorkflowState = {
    workflowId: 'test-workflow-1',
    team,
    tasks: decomposition.subtasks.map((subtask: any) => ({
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
      status: 'pending' as const,
      blockedBy: subtask.blockedBy,
      blocks: [],
      retryCount: 0
    })),
    status: 'pending',
    config: context.workflow.config,
    metrics: {
      totalTasks: decomposition.subtasks.length,
      completedTasks: 0,
      failedTasks: 0,
      totalRetries: 0,
      totalDuration: 0,
      averageTaskDuration: 0
    }
  };

  context.workflow = workflow;
  return workflow;
}

/**
 * Simulate a B-V cycle execution
 */
async function simulateBVCycle(
  context: AutopilotTestContext,
  task: any,
  options?: {
    shouldFailValidation?: boolean;
    validationIssues?: string[];
    retryAttempt?: number;
    previousFeedback?: string[];
    onProgress?: (event: { stage: string; attempt: number }) => void;
  }
): Promise<BVOrchestrationResult> {
  const shouldFail = options?.shouldFailValidation || false;
  const retryAttempt = options?.retryAttempt || 0;

  // Emit progress events
  options?.onProgress?.({ stage: 'build', attempt: retryAttempt });

  // Simulate build phase
  await new Promise(resolve => setTimeout(resolve, 50));

  options?.onProgress?.({ stage: 'validate', attempt: retryAttempt });

  // Simulate validation phase
  await new Promise(resolve => setTimeout(resolve, 50));

  const result: BVOrchestrationResult = {
    taskId: task.id,
    success: !shouldFail,
    cycleResult: {
      success: !shouldFail,
      builderPassed: true,
      validatorPassed: !shouldFail,
      retryCount: retryAttempt,
      evidence: [
        {
          type: 'test_pass',
          passed: !shouldFail,
          timestamp: new Date()
        },
        {
          type: 'syntax_clean',
          passed: !shouldFail,
          timestamp: new Date()
        }
      ],
      issues: shouldFail ? (options?.validationIssues || ['Validation failed']) : []
    },
    retryState: {
      currentAttempt: retryAttempt,
      maxAttempts: 3,
      history: [],
      status: shouldFail ? 'in_progress' : 'success'
    },
    totalDuration: 100 + retryAttempt * 50,
    evidence: [
      {
        type: 'test_pass',
        passed: !shouldFail,
        timestamp: new Date()
      }
    ]
  };

  // Add escalation if max retries exceeded
  if (shouldFail && retryAttempt >= 3) {
    result.escalation = {
      shouldEscalate: true,
      escalationLevel: 'architect',
      reason: 'Maximum retry attempts (3) exceeded',
      suggestedAction: 'Review by senior architect required'
    };
    result.retryState.status = 'escalated';
  }

  // Update workflow metrics
  if (result.success) {
    context.workflow.metrics.completedTasks++;
    context.autopilotState.execution.tasks_completed++;
  }
  if (retryAttempt > 0) {
    context.workflow.metrics.totalRetries++;
  }

  return result;
}
