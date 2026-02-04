/**
 * Builder-Validator Enhanced Ralph
 *
 * Integrates B-V cycles into ralph's persistence model.
 * This module extends ralph's "don't stop until done" behavior with
 * structured Builder-Validator verification at each task execution.
 */

import type {
  BVOrchestrationResult,
  BVTaskConfig,
  BVValidationType
} from '../../src/features/verification/bv-integration.js';
import type {
  RetryState,
  EscalationDecision,
  FailureReport
} from '../../src/features/verification/retry-logic.js';
import type { ValidationCycleResult } from '../../src/features/verification/types.js';
import type { TeamDefinition } from '../../src/features/team/types.js';
import type { WorkflowState } from '../../src/features/team/workflow.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Ralph with B-V configuration
 */
export interface BVRalphConfig {
  /** Enable B-V cycles for each task */
  enableBVCycles: boolean;
  /** Validation type: self-only, validator, or architect */
  validationType: BVValidationType;
  /** Max retries per task */
  maxRetries: number;
  /** Continue ralph loop on validation failure */
  continueOnFailure: boolean;
  /** How to handle escalations */
  escalationMode: 'pause' | 'skip' | 'force-continue';
  /** Optional team for validation */
  team?: TeamDefinition;
  /** Task timeout in milliseconds */
  taskTimeout: number;
}

/**
 * Ralph B-V state
 */
export interface BVRalphState {
  /** Current iteration number */
  iteration: number;
  /** Maximum iterations */
  maxIterations: number;
  /** Original task/prompt */
  originalTask: string;
  /** B-V configuration */
  config: BVRalphConfig;
  /** Current task B-V state */
  currentBVCycle?: {
    taskId: string;
    retryState: RetryState;
    cycleResult?: ValidationCycleResult;
    startedAt: number;
  };
  /** Completed B-V results */
  completedBVResults: BVOrchestrationResult[];
  /** Escalation queue (tasks that need human/architect review) */
  escalationQueue: EscalationDecision[];
  /** Overall ralph status */
  status: 'running' | 'paused' | 'completed' | 'failed';
  /** Optional workflow integration */
  workflow?: WorkflowState;
  /** Timestamp when ralph started */
  startedAt: number;
  /** Timestamp when ralph completed */
  completedAt?: number;
}

/**
 * Ralph B-V continuation decision
 */
export interface RalphContinuationDecision {
  shouldContinue: boolean;
  nextAction: 'proceed' | 'retry' | 'escalate' | 'stop';
  reason: string;
  nextTaskId?: string;
}

/**
 * Ralph B-V completion report
 */
export interface BVRalphReport {
  tasksAttempted: number;
  tasksCompleted: number;
  tasksFailed: number;
  totalBVCycles: number;
  totalRetries: number;
  escalations: number;
  overallSuccess: boolean;
  totalDuration: number;
  averageCycleTime: number;
  details: Array<{
    taskId: string;
    status: 'success' | 'failed' | 'escalated';
    attempts: number;
    duration: number;
  }>;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default B-V ralph config
 */
export const DEFAULT_BV_RALPH_CONFIG: BVRalphConfig = {
  enableBVCycles: true,
  validationType: 'validator',
  maxRetries: 3,
  continueOnFailure: false,
  escalationMode: 'pause',
  taskTimeout: 300000 // 5 minutes
};

// ============================================================================
// State Initialization
// ============================================================================

/**
 * Initialize B-V enhanced ralph
 *
 * Creates initial state for a ralph session with B-V cycle support.
 *
 * @param task - Original task/prompt for ralph to complete
 * @param maxIterations - Maximum ralph iterations (default 10)
 * @param config - Optional B-V configuration overrides
 * @returns Initialized B-V ralph state
 */
export function initializeBVRalph(
  task: string,
  maxIterations: number = 10,
  config?: Partial<BVRalphConfig>
): BVRalphState {
  const mergedConfig: BVRalphConfig = {
    ...DEFAULT_BV_RALPH_CONFIG,
    ...config
  };

  return {
    iteration: 0,
    maxIterations,
    originalTask: task,
    config: mergedConfig,
    completedBVResults: [],
    escalationQueue: [],
    status: 'running',
    startedAt: Date.now()
  };
}

/**
 * Check if B-V mode is enabled
 *
 * @param state - Current ralph state
 * @returns True if B-V cycles are enabled
 */
export function isBVModeEnabled(state: BVRalphState): boolean {
  return state.config.enableBVCycles;
}

// ============================================================================
// B-V Cycle Management
// ============================================================================

/**
 * Start a B-V cycle for current task
 *
 * Initializes a new B-V cycle for the current ralph iteration.
 *
 * @param state - Current ralph state
 * @param taskId - Unique ID for this task
 * @param taskDescription - Description of the task
 * @returns Updated state with active B-V cycle
 */
export function startBVCycle(
  state: BVRalphState,
  taskId: string,
  taskDescription: string
): BVRalphState {
  const retryState: RetryState = {
    currentAttempt: 0,
    maxAttempts: state.config.maxRetries,
    history: [],
    status: 'in_progress'
  };

  return {
    ...state,
    currentBVCycle: {
      taskId,
      retryState,
      startedAt: Date.now()
    }
  };
}

/**
 * Create B-V task config from ralph state
 *
 * Generates a BVTaskConfig for executing the current task.
 *
 * @param state - Current ralph state
 * @param taskId - Task identifier
 * @param taskDescription - Task description
 * @param requirements - Task requirements
 * @param acceptanceCriteria - Acceptance criteria
 * @param builderAgent - Agent to use for building (default: executor)
 * @returns B-V task configuration
 */
export function createBVTaskConfig(
  state: BVRalphState,
  taskId: string,
  taskDescription: string,
  requirements: string[],
  acceptanceCriteria: string[],
  builderAgent: string = 'executor'
): BVTaskConfig {
  return {
    taskId,
    taskDescription,
    requirements,
    acceptanceCriteria,
    validationType: state.config.validationType,
    builderAgent,
    maxRetries: state.config.maxRetries,
    timeout: state.config.taskTimeout,
    complexity: 'medium'
  };
}

/**
 * Execute ralph task with B-V cycle
 *
 * This is the main entry point for executing a task within ralph's persistence model.
 * It integrates with the B-V cycle to ensure proper validation before proceeding.
 *
 * Note: Actual execution is delegated to the orchestrator. This function
 * manages state transitions and returns the updated state.
 *
 * @param state - Current ralph state
 * @param taskConfig - B-V task configuration
 * @param executeTask - Function to execute the actual task (provided by orchestrator)
 * @returns Updated state and B-V result
 */
export async function executeRalphTaskWithBV(
  state: BVRalphState,
  taskConfig: BVTaskConfig,
  executeTask: (config: BVTaskConfig) => Promise<BVOrchestrationResult>
): Promise<{
  state: BVRalphState;
  result: BVOrchestrationResult;
}> {
  // Start B-V cycle
  let currentState = startBVCycle(state, taskConfig.taskId, taskConfig.taskDescription);

  // Execute the task
  const result = await executeTask(taskConfig);

  // Update current B-V cycle with result
  if (currentState.currentBVCycle) {
    currentState = {
      ...currentState,
      currentBVCycle: {
        ...currentState.currentBVCycle,
        retryState: result.retryState,
        cycleResult: result.cycleResult
      }
    };
  }

  // Record completed B-V result
  currentState = {
    ...currentState,
    completedBVResults: [...currentState.completedBVResults, result]
  };

  // Handle escalation if present
  if (result.escalation?.shouldEscalate) {
    currentState = {
      ...currentState,
      escalationQueue: [...currentState.escalationQueue, result.escalation]
    };
  }

  // Clear current B-V cycle
  currentState = {
    ...currentState,
    currentBVCycle: undefined
  };

  return { state: currentState, result };
}

// ============================================================================
// Continuation Logic
// ============================================================================

/**
 * Handle ralph continuation after B-V cycle
 *
 * Determines whether ralph should continue, retry, escalate, or stop
 * based on the B-V cycle result and current state.
 *
 * @param state - Current ralph state
 * @param bvResult - Result from B-V cycle execution
 * @returns Continuation decision
 */
export function handleRalphContinuation(
  state: BVRalphState,
  bvResult: BVOrchestrationResult
): RalphContinuationDecision {
  // Success - proceed to next task
  if (bvResult.success) {
    return {
      shouldContinue: true,
      nextAction: 'proceed',
      reason: 'Task completed successfully with validation'
    };
  }

  // Escalation needed
  if (bvResult.escalation?.shouldEscalate) {
    switch (state.config.escalationMode) {
      case 'pause':
        return {
          shouldContinue: false,
          nextAction: 'escalate',
          reason: `Escalation required: ${bvResult.escalation.reason}`
        };

      case 'skip':
        return {
          shouldContinue: true,
          nextAction: 'proceed',
          reason: `Skipping escalation: ${bvResult.escalation.reason}`
        };

      case 'force-continue':
        return {
          shouldContinue: true,
          nextAction: 'proceed',
          reason: `Forcing continue despite escalation: ${bvResult.escalation.reason}`
        };
    }
  }

  // Check if retry is possible
  if (bvResult.retryState.currentAttempt < bvResult.retryState.maxAttempts) {
    return {
      shouldContinue: true,
      nextAction: 'retry',
      reason: `Retrying task (attempt ${bvResult.retryState.currentAttempt + 1}/${bvResult.retryState.maxAttempts})`
    };
  }

  // Max retries exceeded
  if (state.config.continueOnFailure) {
    return {
      shouldContinue: true,
      nextAction: 'proceed',
      reason: 'Max retries exceeded, continuing per configuration'
    };
  }

  return {
    shouldContinue: false,
    nextAction: 'stop',
    reason: 'Max retries exceeded, stopping ralph loop'
  };
}

/**
 * Increment ralph iteration
 *
 * @param state - Current state
 * @returns Updated state with incremented iteration
 */
export function incrementIteration(state: BVRalphState): BVRalphState {
  return {
    ...state,
    iteration: state.iteration + 1
  };
}

/**
 * Check if ralph should continue
 *
 * @param state - Current state
 * @returns True if ralph can continue
 */
export function canContinue(state: BVRalphState): boolean {
  return (
    state.status === 'running' &&
    state.iteration < state.maxIterations &&
    state.escalationQueue.length === 0 ||
    state.config.escalationMode !== 'pause'
  );
}

// ============================================================================
// Escalation Handling
// ============================================================================

/**
 * Process escalation queue
 *
 * Handles pending escalations based on configuration.
 * Returns updated state with processed escalations.
 *
 * @param state - Current ralph state
 * @returns Updated state with processed escalations
 */
export function processEscalations(state: BVRalphState): BVRalphState {
  if (state.escalationQueue.length === 0) {
    return state;
  }

  // In pause mode, just return - escalations block continuation
  if (state.config.escalationMode === 'pause') {
    return {
      ...state,
      status: 'paused'
    };
  }

  // In skip or force-continue mode, clear the queue
  return {
    ...state,
    escalationQueue: []
  };
}

/**
 * Clear escalation queue (after human/architect review)
 *
 * @param state - Current state
 * @returns Updated state with cleared escalations
 */
export function clearEscalations(state: BVRalphState): BVRalphState {
  return {
    ...state,
    escalationQueue: [],
    status: state.status === 'paused' ? 'running' : state.status
  };
}

/**
 * Get pending escalations
 *
 * @param state - Current state
 * @returns Array of pending escalations
 */
export function getPendingEscalations(state: BVRalphState): EscalationDecision[] {
  return [...state.escalationQueue];
}

// ============================================================================
// Completion
// ============================================================================

/**
 * Mark ralph as completed
 *
 * @param state - Current state
 * @param success - Whether ralph completed successfully
 * @returns Updated state marked as completed
 */
export function completeRalph(
  state: BVRalphState,
  success: boolean
): BVRalphState {
  return {
    ...state,
    status: success ? 'completed' : 'failed',
    completedAt: Date.now()
  };
}

/**
 * Check if ralph is complete
 *
 * @param state - Current state
 * @returns True if ralph is in a terminal state
 */
export function isRalphComplete(state: BVRalphState): boolean {
  return state.status === 'completed' || state.status === 'failed';
}

// ============================================================================
// Reporting
// ============================================================================

/**
 * Generate B-V ralph completion report
 *
 * Creates a comprehensive summary of the ralph session including
 * all B-V cycles, retries, and escalations.
 *
 * @param state - Final ralph state
 * @returns Completion report
 */
export function generateBVRalphReport(state: BVRalphState): BVRalphReport {
  const results = state.completedBVResults;

  const tasksAttempted = results.length;
  const tasksCompleted = results.filter(r => r.success).length;
  const tasksFailed = results.filter(r => !r.success && !r.escalation?.shouldEscalate).length;
  const escalations = results.filter(r => r.escalation?.shouldEscalate).length;

  const totalRetries = results.reduce(
    (sum, r) => sum + r.retryState.currentAttempt,
    0
  );

  const totalBVCycles = results.reduce(
    (sum, r) => sum + r.cycleResult.retryCount + 1,
    0
  );

  const totalDuration = state.completedAt
    ? state.completedAt - state.startedAt
    : Date.now() - state.startedAt;

  const totalCycleTime = results.reduce((sum, r) => sum + r.totalDuration, 0);
  const averageCycleTime = results.length > 0 ? totalCycleTime / results.length : 0;

  const details = results.map(r => {
    let status: 'success' | 'failed' | 'escalated';
    if (r.success) {
      status = 'success';
    } else if (r.escalation?.shouldEscalate) {
      status = 'escalated';
    } else {
      status = 'failed';
    }

    return {
      taskId: r.taskId,
      status,
      attempts: r.retryState.currentAttempt + 1,
      duration: r.totalDuration
    };
  });

  return {
    tasksAttempted,
    tasksCompleted,
    tasksFailed,
    totalBVCycles,
    totalRetries,
    escalations,
    overallSuccess: state.status === 'completed' && tasksFailed === 0,
    totalDuration,
    averageCycleTime,
    details
  };
}

/**
 * Format B-V ralph report as markdown
 *
 * @param report - Report to format
 * @returns Formatted markdown string
 */
export function formatBVRalphReportMarkdown(report: BVRalphReport): string {
  const lines: string[] = [];

  lines.push('# Ralph B-V Execution Report');
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Overall Success:** ${report.overallSuccess ? 'Yes' : 'No'}`);
  lines.push(`- **Total Duration:** ${Math.round(report.totalDuration / 1000)}s`);
  lines.push(`- **Tasks Attempted:** ${report.tasksAttempted}`);
  lines.push(`- **Tasks Completed:** ${report.tasksCompleted}`);
  lines.push(`- **Tasks Failed:** ${report.tasksFailed}`);
  lines.push(`- **Escalations:** ${report.escalations}`);
  lines.push('');

  // B-V Cycle Stats
  lines.push('## B-V Cycle Statistics');
  lines.push('');
  lines.push(`- **Total B-V Cycles:** ${report.totalBVCycles}`);
  lines.push(`- **Total Retries:** ${report.totalRetries}`);
  lines.push(`- **Average Cycle Time:** ${Math.round(report.averageCycleTime)}ms`);
  lines.push('');

  // Success Rate
  if (report.tasksAttempted > 0) {
    const successRate = ((report.tasksCompleted / report.tasksAttempted) * 100).toFixed(1);
    lines.push(`**Success Rate:** ${successRate}%`);
    lines.push('');
  }

  // Task Details
  if (report.details.length > 0) {
    lines.push('## Task Details');
    lines.push('');
    lines.push('| Task ID | Status | Attempts | Duration |');
    lines.push('|---------|--------|----------|----------|');

    for (const detail of report.details) {
      const statusEmoji =
        detail.status === 'success' ? 'pass' :
        detail.status === 'escalated' ? 'escalated' : 'fail';
      lines.push(
        `| ${detail.taskId} | ${statusEmoji} | ${detail.attempts} | ${detail.duration}ms |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// State Serialization
// ============================================================================

/**
 * Serialize ralph state for persistence
 *
 * @param state - State to serialize
 * @returns JSON string
 */
export function serializeBVRalphState(state: BVRalphState): string {
  return JSON.stringify(state, null, 2);
}

/**
 * Parse ralph state from JSON
 *
 * @param json - JSON string to parse
 * @returns Parsed state or null if invalid
 */
export function parseBVRalphState(json: string): BVRalphState | null {
  try {
    const parsed = JSON.parse(json);

    // Basic validation
    if (
      typeof parsed.iteration !== 'number' ||
      typeof parsed.originalTask !== 'string' ||
      !parsed.config
    ) {
      return null;
    }

    return parsed as BVRalphState;
  } catch {
    return null;
  }
}
