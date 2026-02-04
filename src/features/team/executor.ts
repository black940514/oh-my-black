/**
 * Team Workflow Executor
 *
 * High-level executor that runs the entire workflow.
 * Manages task execution lifecycle, event logging, and progress tracking.
 *
 * Note: This module provides the execution infrastructure. Actual agent
 * spawning is delegated to the orchestrator - this module handles state
 * management, coordination, and simulated execution for testing.
 */

import type {
  WorkflowState,
  WorkflowTask,
  WorkflowConfig,
  WorkflowMetrics
} from './workflow.js';
import type { TeamDefinition } from './types.js';
import type { BVOrchestrationResult } from '../verification/bv-integration.js';
import {
  getAvailableTasks,
  autoAssignTasks,
  assignTask,
  startTask,
  completeTask,
  failTask,
  isWorkflowComplete,
  getWorkflowProgress,
  calculateMetrics
} from './workflow.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Execution context for workflow
 */
export interface ExecutionContext {
  /** Current workflow state */
  workflow: WorkflowState;
  /** Active task executions (task ID -> promise) */
  activeExecutions: Map<string, Promise<BVOrchestrationResult>>;
  /** Event log for tracking execution history */
  eventLog: ExecutionEvent[];
  /** Execution start timestamp */
  startTime: number;
  /** Whether execution is paused */
  isPaused: boolean;
  /** Cancellation flag */
  isCancelled: boolean;
}

/**
 * Execution event for logging and tracking
 */
export interface ExecutionEvent {
  /** Event timestamp */
  timestamp: number;
  /** Event type */
  type:
    | 'workflow_started'
    | 'task_assigned'
    | 'task_started'
    | 'task_completed'
    | 'task_failed'
    | 'task_retried'
    | 'workflow_paused'
    | 'workflow_resumed'
    | 'workflow_completed'
    | 'workflow_failed'
    | 'workflow_cancelled';
  /** Associated task ID (if applicable) */
  taskId?: string;
  /** Associated member ID (if applicable) */
  memberId?: string;
  /** Additional event details */
  details?: unknown;
}

/**
 * Execution callbacks for progress tracking
 */
export interface ExecutionCallbacks {
  /** Called when a task is assigned to a member */
  onTaskAssigned?: (task: WorkflowTask, member: string) => void;
  /** Called when a task starts executing */
  onTaskStarted?: (task: WorkflowTask) => void;
  /** Called when a task completes successfully */
  onTaskCompleted?: (task: WorkflowTask, result: BVOrchestrationResult) => void;
  /** Called when a task fails */
  onTaskFailed?: (task: WorkflowTask, error: string) => void;
  /** Called when a task is retried */
  onTaskRetried?: (task: WorkflowTask, attempt: number) => void;
  /** Called periodically with workflow progress */
  onWorkflowProgress?: (progress: { completed: number; total: number }) => void;
  /** Called when workflow completes */
  onWorkflowCompleted?: (workflow: WorkflowState) => void;
  /** Called when workflow fails */
  onWorkflowFailed?: (workflow: WorkflowState, reason: string) => void;
}

/**
 * Task execution function type
 *
 * Implementations can provide custom execution logic.
 * Default implementation is a simulation for testing.
 */
export type TaskExecutor = (
  task: WorkflowTask,
  context: ExecutionContext
) => Promise<BVOrchestrationResult>;

/**
 * Execution report summary
 */
export interface ExecutionReport {
  /** Workflow identifier */
  workflowId: string;
  /** Final workflow status */
  status: string;
  /** Total execution duration in milliseconds */
  duration: number;
  /** Number of tasks completed */
  tasksCompleted: number;
  /** Number of tasks failed */
  tasksFailed: number;
  /** Total retry attempts */
  totalRetries: number;
  /** Full event log */
  eventLog: ExecutionEvent[];
  /** Human-readable summary */
  summary: string;
  /** Final metrics */
  metrics: WorkflowMetrics;
}

// ============================================================================
// Context Management
// ============================================================================

/**
 * Create execution context
 *
 * Initializes the execution context for a workflow run.
 *
 * @param workflow - Workflow to execute
 * @returns Initialized execution context
 */
export function createExecutionContext(workflow: WorkflowState): ExecutionContext {
  return {
    workflow,
    activeExecutions: new Map(),
    eventLog: [],
    startTime: Date.now(),
    isPaused: false,
    isCancelled: false
  };
}

/**
 * Log an event to the execution context
 */
function logEvent(
  context: ExecutionContext,
  type: ExecutionEvent['type'],
  taskId?: string,
  memberId?: string,
  details?: unknown
): void {
  context.eventLog.push({
    timestamp: Date.now(),
    type,
    taskId,
    memberId,
    details
  });
}

// ============================================================================
// Task Execution
// ============================================================================

/**
 * Default task executor (simulation)
 *
 * This is a simulation for testing purposes. In production, the orchestrator
 * would provide a real executor that spawns agents.
 *
 * @param task - Task to execute
 * @param _context - Execution context (unused in simulation)
 * @returns Simulated B-V orchestration result
 */
export async function defaultTaskExecutor(
  task: WorkflowTask,
  _context: ExecutionContext
): Promise<BVOrchestrationResult> {
  // Simulate execution time (100-500ms)
  const executionTime = 100 + Math.random() * 400;
  await new Promise(resolve => setTimeout(resolve, executionTime));

  // Simulate success (90% success rate)
  const success = Math.random() > 0.1;

  return {
    taskId: task.id,
    success,
    cycleResult: {
      success,
      builderPassed: success,
      validatorPassed: success,
      retryCount: 0,
      evidence: [
        {
          type: 'build_success',
          passed: success,
          output: success
            ? `Task ${task.id} completed successfully`
            : `Task ${task.id} failed`,
          timestamp: new Date()
        }
      ],
      issues: success ? [] : ['Simulated failure']
    },
    retryState: {
      maxAttempts: task.bvConfig?.maxRetries || 3,
      currentAttempt: 0,
      status: success ? 'success' : 'failed',
      history: []
    },
    totalDuration: executionTime,
    evidence: []
  };
}

/**
 * Execute a single task with B-V cycle
 *
 * This function coordinates task execution including assignment, status
 * transitions, and result handling. The actual execution is delegated to
 * the provided executor or a simulated one.
 *
 * @param context - Execution context
 * @param task - Task to execute
 * @param executor - Optional custom executor (defaults to simulation)
 * @returns B-V orchestration result
 */
export async function executeTask(
  context: ExecutionContext,
  task: WorkflowTask,
  executor: TaskExecutor = defaultTaskExecutor
): Promise<BVOrchestrationResult> {
  // Start task
  logEvent(context, 'task_started', task.id, task.assignment?.memberId);
  context.workflow = startTask(context.workflow, task.id);

  try {
    // Execute the task
    const result = await executor(task, context);

    // Handle result
    if (result.success) {
      logEvent(context, 'task_completed', task.id, task.assignment?.memberId, {
        duration: result.totalDuration
      });
      context.workflow = completeTask(context.workflow, task.id, result);
    } else {
      logEvent(context, 'task_failed', task.id, task.assignment?.memberId, {
        issues: result.cycleResult.issues
      });
      context.workflow = failTask(
        context.workflow,
        task.id,
        result.cycleResult.issues.join(', ')
      );

      // Check if task was retried (status back to pending)
      const updatedTask = context.workflow.tasks.find(t => t.id === task.id);
      if (updatedTask?.status === 'pending') {
        logEvent(context, 'task_retried', task.id, undefined, {
          attempt: updatedTask.retryCount
        });
      }
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logEvent(context, 'task_failed', task.id, task.assignment?.memberId, {
      error: errorMessage
    });
    context.workflow = failTask(context.workflow, task.id, errorMessage);

    return {
      taskId: task.id,
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
        maxAttempts: task.bvConfig?.maxRetries || 3,
        currentAttempt: 0,
        status: 'failed',
        history: []
      },
      totalDuration: Date.now() - (task.startedAt || Date.now()),
      evidence: []
    };
  }
}

// ============================================================================
// Batch Execution
// ============================================================================

/**
 * Run next batch of available tasks
 *
 * Executes available tasks in parallel (up to configured limit).
 *
 * @param context - Execution context
 * @param callbacks - Optional progress callbacks
 * @param executor - Optional custom task executor
 * @returns Updated execution context
 */
export async function runNextBatch(
  context: ExecutionContext,
  callbacks?: ExecutionCallbacks,
  executor: TaskExecutor = defaultTaskExecutor
): Promise<ExecutionContext> {
  if (context.isPaused || context.isCancelled) {
    return context;
  }

  // Auto-assign tasks
  context.workflow = autoAssignTasks(context.workflow);

  // Get assigned tasks that are ready to run
  const assignedTasks = context.workflow.tasks.filter(
    t => t.status === 'assigned'
  );

  if (assignedTasks.length === 0) {
    return context;
  }

  // Notify callbacks of assignments
  for (const task of assignedTasks) {
    if (task.assignment && callbacks?.onTaskAssigned) {
      callbacks.onTaskAssigned(task, task.assignment.memberId);
    }
    logEvent(context, 'task_assigned', task.id, task.assignment?.memberId);
  }

  // Execute tasks in parallel
  const executions = assignedTasks.map(async task => {
    if (callbacks?.onTaskStarted) {
      callbacks.onTaskStarted(task);
    }

    const result = await executeTask(context, task, executor);

    // Notify callbacks
    if (result.success && callbacks?.onTaskCompleted) {
      const updatedTask = context.workflow.tasks.find(t => t.id === task.id);
      if (updatedTask) {
        callbacks.onTaskCompleted(updatedTask, result);
      }
    } else if (!result.success && callbacks?.onTaskFailed) {
      const updatedTask = context.workflow.tasks.find(t => t.id === task.id);
      if (updatedTask) {
        callbacks.onTaskFailed(updatedTask, result.cycleResult.issues.join(', '));
      }
    }

    // Report progress
    if (callbacks?.onWorkflowProgress) {
      const progress = getWorkflowProgress(context.workflow);
      callbacks.onWorkflowProgress({
        completed: progress.completed,
        total: progress.total
      });
    }

    return result;
  });

  // Wait for all tasks in batch to complete
  await Promise.all(executions);

  return context;
}

// ============================================================================
// Full Workflow Execution
// ============================================================================

/**
 * Run workflow to completion
 *
 * Executes the entire workflow, running batches of tasks until all are
 * complete or the workflow fails.
 *
 * @param workflow - Workflow to execute
 * @param callbacks - Optional progress callbacks
 * @param executor - Optional custom task executor
 * @returns Final workflow state
 */
export async function runWorkflow(
  workflow: WorkflowState,
  callbacks?: ExecutionCallbacks,
  executor: TaskExecutor = defaultTaskExecutor
): Promise<WorkflowState> {
  const context = createExecutionContext(workflow);

  // Log workflow start
  logEvent(context, 'workflow_started');
  context.workflow = {
    ...context.workflow,
    status: 'running',
    startedAt: Date.now()
  };

  // Run batches until complete
  while (
    !isWorkflowComplete(context.workflow) &&
    !context.isPaused &&
    !context.isCancelled
  ) {
    const availableTasks = getAvailableTasks(context.workflow);
    const pendingTasks = context.workflow.tasks.filter(
      t => t.status === 'pending'
    );

    // Check for deadlock (no available tasks but workflow not complete)
    if (availableTasks.length === 0 && pendingTasks.length === 0) {
      // No more tasks can run - check if blocked
      const blockedTasks = context.workflow.tasks.filter(
        t => t.status === 'blocked'
      );
      if (blockedTasks.length > 0) {
        // Deadlock or circular dependency
        logEvent(context, 'workflow_failed', undefined, undefined, {
          reason: 'Deadlock detected - blocked tasks cannot proceed'
        });
        context.workflow = {
          ...context.workflow,
          status: 'failed',
          completedAt: Date.now()
        };
        break;
      }
      // All tasks either complete or running - wait for running to finish
      break;
    }

    // Run next batch
    await runNextBatch(context, callbacks, executor);

    // Check if workflow failed
    if (context.workflow.status === 'failed') {
      break;
    }
  }

  // Finalize workflow
  const finalMetrics = calculateMetrics(context.workflow);
  context.workflow = {
    ...context.workflow,
    metrics: finalMetrics
  };

  if (context.isCancelled) {
    logEvent(context, 'workflow_cancelled');
    context.workflow = {
      ...context.workflow,
      status: 'failed',
      completedAt: Date.now()
    };
    if (callbacks?.onWorkflowFailed) {
      callbacks.onWorkflowFailed(context.workflow, 'Workflow cancelled');
    }
  } else if (context.workflow.status === 'failed') {
    logEvent(context, 'workflow_failed');
    if (callbacks?.onWorkflowFailed) {
      callbacks.onWorkflowFailed(context.workflow, 'Task failures exceeded tolerance');
    }
  } else if (isWorkflowComplete(context.workflow)) {
    logEvent(context, 'workflow_completed');
    context.workflow = {
      ...context.workflow,
      status: 'completed',
      completedAt: Date.now()
    };
    if (callbacks?.onWorkflowCompleted) {
      callbacks.onWorkflowCompleted(context.workflow);
    }
  }

  return context.workflow;
}

// ============================================================================
// Workflow Control
// ============================================================================

/**
 * Pause workflow execution
 *
 * Sets the paused flag. Currently running tasks will complete, but no new
 * tasks will be started.
 *
 * @param context - Execution context
 * @returns Updated execution context
 */
export function pauseWorkflow(context: ExecutionContext): ExecutionContext {
  logEvent(context, 'workflow_paused');

  context.isPaused = true;
  context.workflow = {
    ...context.workflow,
    status: 'paused'
  };

  return context;
}

/**
 * Resume workflow execution
 *
 * Clears the paused flag and continues execution.
 *
 * @param context - Execution context
 * @param callbacks - Optional progress callbacks
 * @param executor - Optional custom task executor
 * @returns Final workflow state
 */
export async function resumeWorkflow(
  context: ExecutionContext,
  callbacks?: ExecutionCallbacks,
  executor: TaskExecutor = defaultTaskExecutor
): Promise<WorkflowState> {
  logEvent(context, 'workflow_resumed');

  context.isPaused = false;
  context.workflow = {
    ...context.workflow,
    status: 'running'
  };

  // Continue execution
  while (
    !isWorkflowComplete(context.workflow) &&
    !context.isPaused &&
    !context.isCancelled
  ) {
    await runNextBatch(context, callbacks, executor);
  }

  // Finalize
  if (isWorkflowComplete(context.workflow)) {
    logEvent(context, 'workflow_completed');
    context.workflow = {
      ...context.workflow,
      status: 'completed',
      completedAt: Date.now(),
      metrics: calculateMetrics(context.workflow)
    };
    if (callbacks?.onWorkflowCompleted) {
      callbacks.onWorkflowCompleted(context.workflow);
    }
  }

  return context.workflow;
}

/**
 * Cancel workflow execution
 *
 * @param context - Execution context
 * @returns Updated execution context
 */
export function cancelWorkflow(context: ExecutionContext): ExecutionContext {
  context.isCancelled = true;
  logEvent(context, 'workflow_cancelled');

  context.workflow = {
    ...context.workflow,
    status: 'failed',
    completedAt: Date.now()
  };

  return context;
}

// ============================================================================
// Reporting
// ============================================================================

/**
 * Generate execution report
 *
 * Creates a comprehensive report of the workflow execution including
 * statistics, event log, and human-readable summary.
 *
 * @param context - Execution context
 * @returns Execution report
 */
export function generateExecutionReport(context: ExecutionContext): ExecutionReport {
  const metrics = calculateMetrics(context.workflow);
  const duration = Date.now() - context.startTime;

  // Generate summary
  const summaryParts: string[] = [];

  summaryParts.push(`Workflow ${context.workflow.workflowId}`);
  summaryParts.push(`Status: ${context.workflow.status.toUpperCase()}`);
  summaryParts.push(`Duration: ${formatDuration(duration)}`);
  summaryParts.push(
    `Tasks: ${metrics.completedTasks}/${metrics.totalTasks} completed`
  );

  if (metrics.failedTasks > 0) {
    summaryParts.push(`Failed: ${metrics.failedTasks}`);
  }

  if (metrics.totalRetries > 0) {
    summaryParts.push(`Retries: ${metrics.totalRetries}`);
  }

  return {
    workflowId: context.workflow.workflowId,
    status: context.workflow.status,
    duration,
    tasksCompleted: metrics.completedTasks,
    tasksFailed: metrics.failedTasks,
    totalRetries: metrics.totalRetries,
    eventLog: context.eventLog,
    summary: summaryParts.join(' | '),
    metrics
  };
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format execution report as markdown
 *
 * @param report - Execution report
 * @returns Formatted markdown string
 */
export function formatExecutionReportMarkdown(report: ExecutionReport): string {
  const lines: string[] = [];

  lines.push('# Workflow Execution Report');
  lines.push('');
  lines.push(`**Workflow ID:** ${report.workflowId}`);
  lines.push(`**Status:** ${report.status}`);
  lines.push(`**Duration:** ${formatDuration(report.duration)}`);
  lines.push('');

  // Metrics
  lines.push('## Metrics');
  lines.push('');
  lines.push(`- **Total Tasks:** ${report.metrics.totalTasks}`);
  lines.push(`- **Completed:** ${report.tasksCompleted}`);
  lines.push(`- **Failed:** ${report.tasksFailed}`);
  lines.push(`- **Total Retries:** ${report.totalRetries}`);
  lines.push(
    `- **Average Task Duration:** ${formatDuration(report.metrics.averageTaskDuration)}`
  );
  lines.push('');

  // Success rate
  if (report.metrics.totalTasks > 0) {
    const successRate = (
      (report.tasksCompleted / report.metrics.totalTasks) *
      100
    ).toFixed(1);
    lines.push(`**Success Rate:** ${successRate}%`);
    lines.push('');
  }

  // Event log (condensed)
  lines.push('## Event Timeline');
  lines.push('');

  const significantEvents = report.eventLog.filter(e =>
    [
      'workflow_started',
      'task_completed',
      'task_failed',
      'workflow_completed',
      'workflow_failed'
    ].includes(e.type)
  );

  for (const event of significantEvents) {
    const time = new Date(event.timestamp).toISOString();
    const eventDesc = event.taskId
      ? `${event.type} (${event.taskId})`
      : event.type;
    lines.push(`- \`${time}\` ${eventDesc}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*${report.summary}*`);

  return lines.join('\n');
}
