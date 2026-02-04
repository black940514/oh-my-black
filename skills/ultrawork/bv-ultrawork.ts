/**
 * Builder-Validator Enhanced Ultrawork
 *
 * Integrates B-V cycles into ultrawork's parallel execution model.
 * This module extends ultrawork's parallel task execution with structured
 * Builder-Validator verification for each parallel task.
 */

import type {
  BVOrchestrationResult,
  BVTaskConfig,
  BVValidationType
} from '../../src/features/verification/bv-integration.js';
import type {
  WorkflowState,
  WorkflowTask,
  WorkflowConfig
} from '../../src/features/team/workflow.js';
import type { TeamDefinition } from '../../src/features/team/types.js';
import type { RetryState } from '../../src/features/verification/retry-logic.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Ultrawork with B-V configuration
 */
export interface BVUltraworkConfig {
  /** Enable B-V cycles for parallel tasks */
  enableBVCycles: boolean;
  /** Default validation type for tasks */
  validationType: BVValidationType;
  /** Maximum parallel B-V cycles */
  maxParallelBVCycles: number;
  /** Stop all tasks on first B-V failure */
  failFast: boolean;
  /** Use team workflow for coordination */
  useTeamWorkflow: boolean;
  /** Default max retries per task */
  maxRetries: number;
  /** Task timeout in milliseconds */
  taskTimeout: number;
}

/**
 * Active B-V cycle tracking
 */
export interface ActiveBVCycle {
  /** Task identifier */
  taskId: string;
  /** Timestamp when cycle started */
  startedAt: number;
  /** Current cycle status */
  status: 'running' | 'validating' | 'retrying';
  /** Current retry attempt */
  currentAttempt: number;
  /** Promise for the execution */
  execution?: Promise<BVOrchestrationResult>;
}

/**
 * Ultrawork B-V state
 */
export interface BVUltraworkState {
  /** Unique session identifier */
  sessionId: string;
  /** Original tasks to execute */
  originalTasks: string[];
  /** B-V configuration */
  config: BVUltraworkConfig;
  /** Active team (if using team workflow) */
  team?: TeamDefinition;
  /** Active workflow state */
  workflow?: WorkflowState;
  /** Active B-V cycles */
  activeBVCycles: Map<string, ActiveBVCycle>;
  /** Completed B-V results */
  completedResults: BVOrchestrationResult[];
  /** Pending task IDs (not yet started) */
  pendingTasks: string[];
  /** Overall status */
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  /** Peak parallelism achieved */
  peakParallelism: number;
  /** Timestamp when started */
  startedAt?: number;
  /** Timestamp when completed */
  completedAt?: number;
}

/**
 * Batch scheduling result
 */
export interface BatchScheduleResult {
  /** Tasks to start in this batch */
  tasksToStart: string[];
  /** Whether we're at capacity */
  atCapacity: boolean;
  /** Current parallel count */
  currentParallel: number;
}

/**
 * Ultrawork B-V completion report
 */
export interface BVUltraworkReport {
  totalTasks: number;
  parallelBatches: number;
  tasksCompleted: number;
  tasksFailed: number;
  totalBVCycles: number;
  totalRetries: number;
  averageCycleTime: number;
  peakParallelism: number;
  totalDuration: number;
  details: Array<{
    taskId: string;
    status: 'success' | 'failed';
    attempts: number;
    duration: number;
  }>;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default B-V ultrawork config
 */
export const DEFAULT_BV_ULTRAWORK_CONFIG: BVUltraworkConfig = {
  enableBVCycles: true,
  validationType: 'validator',
  maxParallelBVCycles: 3,
  failFast: false,
  useTeamWorkflow: true,
  maxRetries: 3,
  taskTimeout: 300000 // 5 minutes
};

// ============================================================================
// State Initialization
// ============================================================================

/**
 * Initialize B-V enhanced ultrawork
 *
 * Creates initial state for an ultrawork session with B-V cycle support.
 *
 * @param tasks - Array of task descriptions to execute in parallel
 * @param config - Optional B-V configuration overrides
 * @returns Initialized B-V ultrawork state
 */
export function initializeBVUltrawork(
  tasks: string[],
  config?: Partial<BVUltraworkConfig>
): BVUltraworkState {
  const mergedConfig: BVUltraworkConfig = {
    ...DEFAULT_BV_ULTRAWORK_CONFIG,
    ...config
  };

  // Generate unique session ID
  const sessionId = `ultrawork-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Generate task IDs
  const taskIds = tasks.map((_, index) => `task-${index + 1}`);

  return {
    sessionId,
    originalTasks: tasks,
    config: mergedConfig,
    activeBVCycles: new Map(),
    completedResults: [],
    pendingTasks: taskIds,
    status: 'idle',
    peakParallelism: 0
  };
}

/**
 * Initialize ultrawork with team
 *
 * Creates state with team workflow integration.
 *
 * @param tasks - Array of task descriptions
 * @param team - Team definition for task execution
 * @param config - Optional B-V configuration overrides
 * @returns Initialized state with team
 */
export function initializeBVUltraworkWithTeam(
  tasks: string[],
  team: TeamDefinition,
  config?: Partial<BVUltraworkConfig>
): BVUltraworkState {
  const state = initializeBVUltrawork(tasks, {
    ...config,
    useTeamWorkflow: true
  });

  return {
    ...state,
    team
  };
}

/**
 * Check if B-V mode is enabled
 *
 * @param state - Current ultrawork state
 * @returns True if B-V cycles are enabled
 */
export function isBVModeEnabled(state: BVUltraworkState): boolean {
  return state.config.enableBVCycles;
}

// ============================================================================
// Batch Scheduling
// ============================================================================

/**
 * Schedule next batch of B-V cycles
 *
 * Determines which tasks should be started next based on available capacity
 * and pending tasks.
 *
 * @param state - Current ultrawork state
 * @returns Batch scheduling result
 */
export function scheduleNextBatch(state: BVUltraworkState): BatchScheduleResult {
  const currentParallel = state.activeBVCycles.size;
  const availableSlots = state.config.maxParallelBVCycles - currentParallel;
  const atCapacity = availableSlots <= 0;

  if (atCapacity || state.pendingTasks.length === 0) {
    return {
      tasksToStart: [],
      atCapacity,
      currentParallel
    };
  }

  // Take tasks up to available slots
  const tasksToStart = state.pendingTasks.slice(0, availableSlots);

  return {
    tasksToStart,
    atCapacity: tasksToStart.length >= availableSlots,
    currentParallel: currentParallel + tasksToStart.length
  };
}

/**
 * Mark tasks as started
 *
 * Updates state to reflect that tasks have been started.
 *
 * @param state - Current state
 * @param taskIds - Task IDs that are starting
 * @returns Updated state
 */
export function markTasksStarted(
  state: BVUltraworkState,
  taskIds: string[]
): BVUltraworkState {
  const newActiveCycles = new Map(state.activeBVCycles);
  const now = Date.now();

  for (const taskId of taskIds) {
    newActiveCycles.set(taskId, {
      taskId,
      startedAt: now,
      status: 'running',
      currentAttempt: 0
    });
  }

  // Remove from pending
  const newPendingTasks = state.pendingTasks.filter(id => !taskIds.includes(id));

  // Update peak parallelism
  const newPeak = Math.max(state.peakParallelism, newActiveCycles.size);

  return {
    ...state,
    activeBVCycles: newActiveCycles,
    pendingTasks: newPendingTasks,
    peakParallelism: newPeak,
    status: 'running',
    startedAt: state.startedAt || now
  };
}

// ============================================================================
// B-V Task Configuration
// ============================================================================

/**
 * Create B-V task configs for parallel execution
 *
 * Generates BVTaskConfig objects for all pending tasks.
 *
 * @param state - Current ultrawork state
 * @param taskIds - Task IDs to create configs for
 * @param getTaskDescription - Function to get task description from ID
 * @param builderAgent - Default builder agent (default: executor)
 * @returns Array of B-V task configurations
 */
export function createBVTaskConfigs(
  state: BVUltraworkState,
  taskIds: string[],
  getTaskDescription: (taskId: string) => { description: string; requirements: string[]; acceptanceCriteria: string[] },
  builderAgent: string = 'executor'
): BVTaskConfig[] {
  return taskIds.map(taskId => {
    const taskInfo = getTaskDescription(taskId);

    return {
      taskId,
      taskDescription: taskInfo.description,
      requirements: taskInfo.requirements,
      acceptanceCriteria: taskInfo.acceptanceCriteria,
      validationType: state.config.validationType,
      builderAgent,
      maxRetries: state.config.maxRetries,
      timeout: state.config.taskTimeout,
      complexity: 'medium'
    };
  });
}

// ============================================================================
// Parallel Execution
// ============================================================================

/**
 * Execute parallel tasks with B-V cycles
 *
 * Main entry point for executing multiple tasks in parallel with B-V validation.
 * This function manages the parallel execution lifecycle and returns results
 * as they complete.
 *
 * Note: Actual execution is delegated to the provided executor function.
 * This function manages state and coordination.
 *
 * @param state - Current ultrawork state
 * @param taskConfigs - B-V task configurations to execute
 * @param executeTask - Function to execute individual tasks
 * @returns Updated state and results
 */
export async function executeParallelWithBV(
  state: BVUltraworkState,
  taskConfigs: BVTaskConfig[],
  executeTask: (config: BVTaskConfig) => Promise<BVOrchestrationResult>
): Promise<{
  state: BVUltraworkState;
  results: BVOrchestrationResult[];
}> {
  // Mark tasks as started
  const taskIds = taskConfigs.map(c => c.taskId);
  let currentState = markTasksStarted(state, taskIds);

  // Execute all tasks in parallel
  const executions = taskConfigs.map(async config => {
    try {
      // Update status to running
      const activeCycle = currentState.activeBVCycles.get(config.taskId);
      if (activeCycle) {
        currentState.activeBVCycles.set(config.taskId, {
          ...activeCycle,
          status: 'running'
        });
      }

      // Execute the task
      const result = await executeTask(config);

      return result;
    } catch (error) {
      // Create error result
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResult: BVOrchestrationResult = {
        taskId: config.taskId,
        success: false,
        cycleResult: {
          success: false,
          builderPassed: false,
          validatorPassed: false,
          retryCount: 0,
          evidence: [],
          issues: [errorMessage]
        },
        retryState: {
          currentAttempt: 0,
          maxAttempts: config.maxRetries,
          history: [],
          status: 'failed'
        },
        totalDuration: 0,
        evidence: []
      };

      return errorResult;
    }
  });

  // Handle fail-fast mode
  let results: BVOrchestrationResult[];

  if (currentState.config.failFast) {
    // Use Promise.race with individual completion tracking
    results = [];
    const remainingExecutions = [...executions];

    while (remainingExecutions.length > 0) {
      const result = await Promise.race(remainingExecutions);
      results.push(result);

      // Remove completed execution
      const completedIndex = remainingExecutions.findIndex(
        async e => (await e).taskId === result.taskId
      );
      if (completedIndex >= 0) {
        remainingExecutions.splice(completedIndex, 1);
      }

      // Check for failure in fail-fast mode
      if (!result.success) {
        // Cancel remaining (in real implementation)
        // For now, still wait for all to complete but mark state as failed
        currentState = {
          ...currentState,
          status: 'failed'
        };
        break;
      }
    }

    // Wait for remaining tasks to complete (they're already running)
    if (remainingExecutions.length > 0) {
      const remainingResults = await Promise.all(remainingExecutions);
      results.push(...remainingResults);
    }
  } else {
    // Wait for all tasks to complete
    results = await Promise.all(executions);
  }

  // Process results
  for (const result of results) {
    currentState = handleParallelBVCompletion(currentState, result.taskId, result);
  }

  return { state: currentState, results };
}

// ============================================================================
// Completion Handling
// ============================================================================

/**
 * Handle B-V cycle completion in parallel context
 *
 * Updates state when a single B-V cycle completes within the parallel execution.
 *
 * @param state - Current ultrawork state
 * @param taskId - Task that completed
 * @param result - B-V orchestration result
 * @returns Updated state
 */
export function handleParallelBVCompletion(
  state: BVUltraworkState,
  taskId: string,
  result: BVOrchestrationResult
): BVUltraworkState {
  // Remove from active cycles
  const newActiveCycles = new Map(state.activeBVCycles);
  newActiveCycles.delete(taskId);

  // Add to completed results
  const newCompletedResults = [...state.completedResults, result];

  // Check overall status
  let newStatus = state.status;

  // If fail-fast and this task failed, mark as failed
  if (state.config.failFast && !result.success) {
    newStatus = 'failed';
  }

  return {
    ...state,
    activeBVCycles: newActiveCycles,
    completedResults: newCompletedResults,
    status: newStatus
  };
}

/**
 * Update B-V cycle status
 *
 * @param state - Current state
 * @param taskId - Task to update
 * @param status - New status
 * @returns Updated state
 */
export function updateBVCycleStatus(
  state: BVUltraworkState,
  taskId: string,
  status: ActiveBVCycle['status']
): BVUltraworkState {
  const activeCycle = state.activeBVCycles.get(taskId);
  if (!activeCycle) {
    return state;
  }

  const newActiveCycles = new Map(state.activeBVCycles);
  newActiveCycles.set(taskId, {
    ...activeCycle,
    status
  });

  return {
    ...state,
    activeBVCycles: newActiveCycles
  };
}

// ============================================================================
// Continuation Control
// ============================================================================

/**
 * Check if ultrawork should continue
 *
 * Determines whether there are more tasks to execute or running tasks to wait for.
 *
 * @param state - Current ultrawork state
 * @returns Continuation decision
 */
export function shouldUltraworkContinue(state: BVUltraworkState): {
  shouldContinue: boolean;
  reason: string;
  remainingTasks: number;
  activeTasks: number;
} {
  // Failed state - don't continue
  if (state.status === 'failed') {
    return {
      shouldContinue: false,
      reason: 'Ultrawork marked as failed',
      remainingTasks: state.pendingTasks.length,
      activeTasks: state.activeBVCycles.size
    };
  }

  // Paused state - don't continue
  if (state.status === 'paused') {
    return {
      shouldContinue: false,
      reason: 'Ultrawork is paused',
      remainingTasks: state.pendingTasks.length,
      activeTasks: state.activeBVCycles.size
    };
  }

  // Still have pending tasks
  if (state.pendingTasks.length > 0) {
    return {
      shouldContinue: true,
      reason: `${state.pendingTasks.length} tasks pending`,
      remainingTasks: state.pendingTasks.length,
      activeTasks: state.activeBVCycles.size
    };
  }

  // Still have active tasks
  if (state.activeBVCycles.size > 0) {
    return {
      shouldContinue: true,
      reason: `${state.activeBVCycles.size} tasks still running`,
      remainingTasks: 0,
      activeTasks: state.activeBVCycles.size
    };
  }

  // All done
  return {
    shouldContinue: false,
    reason: 'All tasks completed',
    remainingTasks: 0,
    activeTasks: 0
  };
}

/**
 * Pause ultrawork execution
 *
 * @param state - Current state
 * @returns Updated state (paused)
 */
export function pauseUltrawork(state: BVUltraworkState): BVUltraworkState {
  return {
    ...state,
    status: 'paused'
  };
}

/**
 * Resume ultrawork execution
 *
 * @param state - Current state
 * @returns Updated state (running)
 */
export function resumeUltrawork(state: BVUltraworkState): BVUltraworkState {
  if (state.status !== 'paused') {
    return state;
  }

  return {
    ...state,
    status: 'running'
  };
}

/**
 * Complete ultrawork session
 *
 * @param state - Current state
 * @returns Updated state (completed or failed)
 */
export function completeUltrawork(state: BVUltraworkState): BVUltraworkState {
  const hasFailures = state.completedResults.some(r => !r.success);
  const newStatus = hasFailures && !state.config.failFast ? 'completed' :
                    hasFailures ? 'failed' : 'completed';

  return {
    ...state,
    status: newStatus,
    completedAt: Date.now()
  };
}

// ============================================================================
// Reporting
// ============================================================================

/**
 * Generate B-V ultrawork report
 *
 * Creates a comprehensive summary of the ultrawork session including
 * parallel execution statistics and B-V cycle details.
 *
 * @param state - Final ultrawork state
 * @returns Completion report
 */
export function generateBVUltraworkReport(state: BVUltraworkState): BVUltraworkReport {
  const results = state.completedResults;

  const totalTasks = state.originalTasks.length;
  const tasksCompleted = results.filter(r => r.success).length;
  const tasksFailed = results.filter(r => !r.success).length;

  const totalRetries = results.reduce(
    (sum, r) => sum + r.retryState.currentAttempt,
    0
  );

  const totalBVCycles = results.reduce(
    (sum, r) => sum + r.cycleResult.retryCount + 1,
    0
  );

  const totalDuration = state.completedAt && state.startedAt
    ? state.completedAt - state.startedAt
    : state.startedAt
      ? Date.now() - state.startedAt
      : 0;

  const totalCycleTime = results.reduce((sum, r) => sum + r.totalDuration, 0);
  const averageCycleTime = results.length > 0 ? totalCycleTime / results.length : 0;

  // Estimate parallel batches
  const parallelBatches = Math.ceil(totalTasks / state.config.maxParallelBVCycles);

  const details = results.map(r => ({
    taskId: r.taskId,
    status: r.success ? 'success' as const : 'failed' as const,
    attempts: r.retryState.currentAttempt + 1,
    duration: r.totalDuration
  }));

  return {
    totalTasks,
    parallelBatches,
    tasksCompleted,
    tasksFailed,
    totalBVCycles,
    totalRetries,
    averageCycleTime,
    peakParallelism: state.peakParallelism,
    totalDuration,
    details
  };
}

/**
 * Format B-V ultrawork report as markdown
 *
 * @param report - Report to format
 * @returns Formatted markdown string
 */
export function formatBVUltraworkReportMarkdown(report: BVUltraworkReport): string {
  const lines: string[] = [];

  lines.push('# Ultrawork B-V Execution Report');
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Tasks:** ${report.totalTasks}`);
  lines.push(`- **Tasks Completed:** ${report.tasksCompleted}`);
  lines.push(`- **Tasks Failed:** ${report.tasksFailed}`);
  lines.push(`- **Total Duration:** ${Math.round(report.totalDuration / 1000)}s`);
  lines.push('');

  // Parallel Execution Stats
  lines.push('## Parallel Execution');
  lines.push('');
  lines.push(`- **Parallel Batches:** ${report.parallelBatches}`);
  lines.push(`- **Peak Parallelism:** ${report.peakParallelism}`);
  lines.push('');

  // B-V Cycle Stats
  lines.push('## B-V Cycle Statistics');
  lines.push('');
  lines.push(`- **Total B-V Cycles:** ${report.totalBVCycles}`);
  lines.push(`- **Total Retries:** ${report.totalRetries}`);
  lines.push(`- **Average Cycle Time:** ${Math.round(report.averageCycleTime)}ms`);
  lines.push('');

  // Success Rate
  if (report.totalTasks > 0) {
    const successRate = ((report.tasksCompleted / report.totalTasks) * 100).toFixed(1);
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
      const statusText = detail.status === 'success' ? 'pass' : 'fail';
      lines.push(
        `| ${detail.taskId} | ${statusText} | ${detail.attempts} | ${detail.duration}ms |`
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
 * Serialize ultrawork state for persistence
 *
 * Note: Active B-V cycles map is converted to array for JSON serialization.
 *
 * @param state - State to serialize
 * @returns JSON string
 */
export function serializeBVUltraworkState(state: BVUltraworkState): string {
  const serializableState = {
    ...state,
    activeBVCycles: Array.from(state.activeBVCycles.entries())
  };

  return JSON.stringify(serializableState, null, 2);
}

/**
 * Parse ultrawork state from JSON
 *
 * @param json - JSON string to parse
 * @returns Parsed state or null if invalid
 */
export function parseBVUltraworkState(json: string): BVUltraworkState | null {
  try {
    const parsed = JSON.parse(json);

    // Basic validation
    if (
      !parsed.sessionId ||
      !Array.isArray(parsed.originalTasks) ||
      !parsed.config
    ) {
      return null;
    }

    // Convert activeBVCycles back to Map
    const activeBVCycles = new Map<string, ActiveBVCycle>(
      parsed.activeBVCycles || []
    );

    return {
      ...parsed,
      activeBVCycles
    } as BVUltraworkState;
  } catch {
    return null;
  }
}
