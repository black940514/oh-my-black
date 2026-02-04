/**
 * Team Workflow Execution
 *
 * Manages team-based task execution with B-V cycles.
 * Provides state management, dependency tracking, and parallel execution support.
 */

import type { TeamDefinition, TeamMember, TaskAssignment } from './types.js';
import type {
  BVTaskConfig,
  BVOrchestrationResult,
  BVValidationType
} from '../verification/bv-integration.js';
import type { Subtask, DecompositionResult } from '../task-decomposer/types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Workflow execution state
 */
export interface WorkflowState {
  /** Unique workflow identifier */
  workflowId: string;
  /** Team executing this workflow */
  team: TeamDefinition;
  /** Tasks in this workflow */
  tasks: WorkflowTask[];
  /** Current workflow status */
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  /** Workflow start timestamp */
  startedAt?: number;
  /** Workflow completion timestamp */
  completedAt?: number;
  /** Workflow configuration */
  config: WorkflowConfig;
  /** Workflow metrics */
  metrics: WorkflowMetrics;
}

/**
 * Individual workflow task
 */
export interface WorkflowTask {
  /** Unique task identifier */
  id: string;
  /** Associated subtask from decomposition */
  subtask: Subtask;
  /** Task assignment (if assigned) */
  assignment?: TaskAssignment;
  /** B-V cycle configuration */
  bvConfig?: BVTaskConfig;
  /** Current task status */
  status:
    | 'pending'
    | 'assigned'
    | 'running'
    | 'validating'
    | 'completed'
    | 'failed'
    | 'blocked';
  /** B-V cycle result */
  result?: BVOrchestrationResult;
  /** Task IDs that block this task */
  blockedBy: string[];
  /** Task IDs that this task blocks */
  blocks: string[];
  /** Task start timestamp */
  startedAt?: number;
  /** Task completion timestamp */
  completedAt?: number;
  /** Retry count for this task */
  retryCount: number;
}

/**
 * Workflow configuration
 */
export interface WorkflowConfig {
  /** Enable parallel task execution */
  parallelExecution: boolean;
  /** Maximum concurrent tasks */
  maxParallelTasks: number;
  /** Default validation type for tasks */
  defaultValidationType: BVValidationType;
  /** Automatically assign tasks to available members */
  autoAssign: boolean;
  /** Continue workflow on task failure */
  continueOnFailure: boolean;
  /** Maximum retries per task */
  maxRetries: number;
  /** Task timeout in milliseconds */
  taskTimeout: number;
}

/**
 * Workflow execution metrics
 */
export interface WorkflowMetrics {
  /** Total number of tasks */
  totalTasks: number;
  /** Successfully completed tasks */
  completedTasks: number;
  /** Failed tasks */
  failedTasks: number;
  /** Total retry attempts across all tasks */
  totalRetries: number;
  /** Total workflow duration in milliseconds */
  totalDuration: number;
  /** Average task duration in milliseconds */
  averageTaskDuration: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default workflow configuration
 */
export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  parallelExecution: true,
  maxParallelTasks: 3,
  defaultValidationType: 'validator',
  autoAssign: true,
  continueOnFailure: false,
  maxRetries: 3,
  taskTimeout: 300000 // 5 minutes
};

// ============================================================================
// Workflow Creation
// ============================================================================

/**
 * Create a new workflow from decomposition result
 *
 * Initializes workflow state with tasks derived from decomposition subtasks.
 * Sets up dependency graph based on subtask blockedBy relationships.
 *
 * @param workflowId - Unique workflow identifier
 * @param team - Team executing this workflow
 * @param decomposition - Task decomposition result
 * @param config - Optional workflow configuration overrides
 * @returns Initialized workflow state
 */
export function createWorkflow(
  workflowId: string,
  team: TeamDefinition,
  decomposition: DecompositionResult,
  config?: Partial<WorkflowConfig>
): WorkflowState {
  const mergedConfig: WorkflowConfig = {
    ...DEFAULT_WORKFLOW_CONFIG,
    ...config,
    // Use team's default validation type if not explicitly set
    defaultValidationType:
      config?.defaultValidationType || team.defaultValidationType
  };

  // Create workflow tasks from subtasks
  const tasks: WorkflowTask[] = decomposition.subtasks.map(subtask => {
    // Determine which tasks this blocks (reverse dependency lookup)
    const blocks = decomposition.subtasks
      .filter(s => s.blockedBy.includes(subtask.id))
      .map(s => s.id);

    // Create B-V config for the task
    const bvConfig: BVTaskConfig = {
      taskId: subtask.id,
      taskDescription: subtask.prompt,
      requirements: subtask.acceptanceCriteria,
      acceptanceCriteria: subtask.verification,
      validationType:
        subtask.validation?.validationType || mergedConfig.defaultValidationType,
      builderAgent: subtask.agentType,
      validatorAgents: subtask.validation?.validatorAgent
        ? [subtask.validation.validatorAgent]
        : undefined,
      maxRetries: subtask.validation?.maxRetries || mergedConfig.maxRetries,
      timeout: mergedConfig.taskTimeout,
      complexity: subtask.modelTier === 'high' ? 'high' : subtask.modelTier === 'low' ? 'low' : 'medium'
    };

    // Initial status: blocked if has dependencies, pending otherwise
    const initialStatus: WorkflowTask['status'] =
      subtask.blockedBy.length > 0 ? 'blocked' : 'pending';

    return {
      id: subtask.id,
      subtask,
      bvConfig,
      status: initialStatus,
      blockedBy: [...subtask.blockedBy],
      blocks,
      retryCount: 0
    };
  });

  return {
    workflowId,
    team,
    tasks,
    status: 'pending',
    config: mergedConfig,
    metrics: {
      totalTasks: tasks.length,
      completedTasks: 0,
      failedTasks: 0,
      totalRetries: 0,
      totalDuration: 0,
      averageTaskDuration: 0
    }
  };
}

// ============================================================================
// Task Availability
// ============================================================================

/**
 * Get next available tasks (not blocked, not assigned, not running)
 *
 * Returns tasks that are ready to be assigned and executed.
 * Respects parallel execution limits from configuration.
 *
 * @param workflow - Current workflow state
 * @returns Array of available workflow tasks
 */
export function getAvailableTasks(workflow: WorkflowState): WorkflowTask[] {
  // Count currently running tasks
  const runningCount = workflow.tasks.filter(
    t => t.status === 'running' || t.status === 'validating'
  ).length;

  // Calculate available slots
  const availableSlots = workflow.config.parallelExecution
    ? workflow.config.maxParallelTasks - runningCount
    : runningCount === 0
      ? 1
      : 0;

  if (availableSlots <= 0) {
    return [];
  }

  // Find pending tasks (not blocked, not assigned)
  const pendingTasks = workflow.tasks.filter(t => t.status === 'pending');

  // Return up to availableSlots tasks
  return pendingTasks.slice(0, availableSlots);
}

// ============================================================================
// Task Assignment
// ============================================================================

/**
 * Assign task to team member
 *
 * Updates task status to assigned and records assignment details.
 *
 * @param workflow - Current workflow state
 * @param taskId - Task to assign
 * @param memberId - Team member to assign to
 * @returns Updated workflow state
 */
export function assignTask(
  workflow: WorkflowState,
  taskId: string,
  memberId: string
): WorkflowState {
  const taskIndex = workflow.tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) {
    return workflow;
  }

  const task = workflow.tasks[taskIndex];
  if (task.status !== 'pending') {
    return workflow;
  }

  const assignment: TaskAssignment = {
    taskId,
    memberId,
    assignedAt: Date.now(),
    status: 'pending'
  };

  const updatedTasks = [...workflow.tasks];
  updatedTasks[taskIndex] = {
    ...task,
    status: 'assigned',
    assignment
  };

  // Also update workflow status to running if first task
  const newWorkflowStatus =
    workflow.status === 'pending' ? 'running' : workflow.status;

  return {
    ...workflow,
    status: newWorkflowStatus,
    startedAt: workflow.startedAt || Date.now(),
    tasks: updatedTasks
  };
}

/**
 * Auto-assign tasks to available members
 *
 * Automatically assigns available tasks to idle team members with
 * matching capabilities. Respects team member concurrent task limits.
 *
 * @param workflow - Current workflow state
 * @returns Updated workflow state with auto-assigned tasks
 */
export function autoAssignTasks(workflow: WorkflowState): WorkflowState {
  if (!workflow.config.autoAssign) {
    return workflow;
  }

  const availableTasks = getAvailableTasks(workflow);
  if (availableTasks.length === 0) {
    return workflow;
  }

  let currentWorkflow = workflow;

  for (const task of availableTasks) {
    // Find available member with matching capabilities
    const availableMember = findAvailableMemberForTask(currentWorkflow, task);
    if (availableMember) {
      currentWorkflow = assignTask(
        currentWorkflow,
        task.id,
        availableMember.id
      );
    }
  }

  return currentWorkflow;
}

/**
 * Find available team member for a task
 */
function findAvailableMemberForTask(
  workflow: WorkflowState,
  task: WorkflowTask
): TeamMember | null {
  // Count current assignments per member
  const assignmentCounts = new Map<string, number>();
  for (const t of workflow.tasks) {
    if (
      t.assignment &&
      (t.status === 'assigned' || t.status === 'running' || t.status === 'validating')
    ) {
      const count = assignmentCounts.get(t.assignment.memberId) || 0;
      assignmentCounts.set(t.assignment.memberId, count + 1);
    }
  }

  // Find members that can handle this task
  const candidates = workflow.team.members.filter(member => {
    // Must be a builder
    if (member.role !== 'builder' && member.role !== 'specialist') {
      return false;
    }

    // Must not be at capacity
    const currentAssignments = assignmentCounts.get(member.id) || 0;
    if (currentAssignments >= member.maxConcurrentTasks) {
      return false;
    }

    // Must have required capabilities (basic check)
    // More sophisticated matching could check against task requirements
    return member.status === 'idle' || member.status === 'busy';
  });

  // Sort by current load (prefer less busy members)
  candidates.sort((a, b) => {
    const aCount = assignmentCounts.get(a.id) || 0;
    const bCount = assignmentCounts.get(b.id) || 0;
    return aCount - bCount;
  });

  return candidates[0] || null;
}

// ============================================================================
// Task State Transitions
// ============================================================================

/**
 * Start task execution (mark as running)
 *
 * @param workflow - Current workflow state
 * @param taskId - Task to start
 * @returns Updated workflow state
 */
export function startTask(
  workflow: WorkflowState,
  taskId: string
): WorkflowState {
  const taskIndex = workflow.tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) {
    return workflow;
  }

  const task = workflow.tasks[taskIndex];
  if (task.status !== 'assigned') {
    return workflow;
  }

  const updatedTasks = [...workflow.tasks];
  updatedTasks[taskIndex] = {
    ...task,
    status: 'running',
    startedAt: Date.now(),
    assignment: task.assignment
      ? { ...task.assignment, status: 'in_progress' }
      : undefined
  };

  return {
    ...workflow,
    status: 'running',
    tasks: updatedTasks
  };
}

/**
 * Complete task with result
 *
 * Marks task as completed and updates metrics.
 * Triggers dependency resolution for blocked tasks.
 *
 * @param workflow - Current workflow state
 * @param taskId - Task to complete
 * @param result - B-V cycle result
 * @returns Updated workflow state
 */
export function completeTask(
  workflow: WorkflowState,
  taskId: string,
  result: BVOrchestrationResult
): WorkflowState {
  const taskIndex = workflow.tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) {
    return workflow;
  }

  const task = workflow.tasks[taskIndex];
  const now = Date.now();

  const updatedTasks = [...workflow.tasks];
  updatedTasks[taskIndex] = {
    ...task,
    status: 'completed',
    result,
    completedAt: now,
    assignment: task.assignment
      ? { ...task.assignment, status: 'completed', result }
      : undefined
  };

  // Update metrics
  const taskDuration = task.startedAt ? now - task.startedAt : 0;
  const updatedMetrics: WorkflowMetrics = {
    ...workflow.metrics,
    completedTasks: workflow.metrics.completedTasks + 1,
    totalRetries: workflow.metrics.totalRetries + (result.retryState?.currentAttempt || 0)
  };

  // Recalculate average duration
  if (updatedMetrics.completedTasks > 0) {
    const totalCompletedDuration =
      workflow.metrics.averageTaskDuration * workflow.metrics.completedTasks +
      taskDuration;
    updatedMetrics.averageTaskDuration =
      totalCompletedDuration / updatedMetrics.completedTasks;
  }

  let updatedWorkflow: WorkflowState = {
    ...workflow,
    tasks: updatedTasks,
    metrics: updatedMetrics
  };

  // Update dependencies
  updatedWorkflow = updateDependencies(updatedWorkflow);

  // Check if workflow is complete
  if (isWorkflowComplete(updatedWorkflow)) {
    updatedWorkflow = {
      ...updatedWorkflow,
      status: 'completed',
      completedAt: now,
      metrics: {
        ...updatedWorkflow.metrics,
        totalDuration: now - (updatedWorkflow.startedAt || now)
      }
    };
  }

  return updatedWorkflow;
}

/**
 * Fail task
 *
 * Marks task as failed. May trigger retry or workflow failure based on config.
 *
 * @param workflow - Current workflow state
 * @param taskId - Task that failed
 * @param reason - Failure reason
 * @returns Updated workflow state
 */
export function failTask(
  workflow: WorkflowState,
  taskId: string,
  reason: string
): WorkflowState {
  const taskIndex = workflow.tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) {
    return workflow;
  }

  const task = workflow.tasks[taskIndex];
  const now = Date.now();

  // Check if can retry
  if (task.retryCount < workflow.config.maxRetries) {
    // Mark for retry - reset to pending with incremented retry count
    const updatedTasks = [...workflow.tasks];
    updatedTasks[taskIndex] = {
      ...task,
      status: 'pending',
      retryCount: task.retryCount + 1,
      assignment: undefined // Clear assignment for re-assignment
    };

    return {
      ...workflow,
      tasks: updatedTasks,
      metrics: {
        ...workflow.metrics,
        totalRetries: workflow.metrics.totalRetries + 1
      }
    };
  }

  // Max retries exceeded - mark as failed
  const updatedTasks = [...workflow.tasks];
  updatedTasks[taskIndex] = {
    ...task,
    status: 'failed',
    completedAt: now,
    assignment: task.assignment
      ? { ...task.assignment, status: 'failed' }
      : undefined
  };

  const updatedMetrics: WorkflowMetrics = {
    ...workflow.metrics,
    failedTasks: workflow.metrics.failedTasks + 1
  };

  let newStatus: WorkflowState['status'] = workflow.status;

  // If continueOnFailure is false, fail the workflow
  if (!workflow.config.continueOnFailure) {
    newStatus = 'failed';
  }

  // Also fail dependent tasks if not continuing
  if (!workflow.config.continueOnFailure) {
    for (let i = 0; i < updatedTasks.length; i++) {
      const t = updatedTasks[i];
      if (t.blockedBy.includes(taskId) && t.status !== 'completed') {
        updatedTasks[i] = {
          ...t,
          status: 'failed'
        };
        updatedMetrics.failedTasks++;
      }
    }
  }

  return {
    ...workflow,
    status: newStatus,
    completedAt: newStatus === 'failed' ? now : undefined,
    tasks: updatedTasks,
    metrics: updatedMetrics
  };
}

// ============================================================================
// Dependency Management
// ============================================================================

/**
 * Update task dependencies (unblock dependent tasks)
 *
 * Checks completed tasks and unblocks tasks that were waiting on them.
 *
 * @param workflow - Current workflow state
 * @returns Updated workflow state with unblocked tasks
 */
export function updateDependencies(workflow: WorkflowState): WorkflowState {
  // Get IDs of completed tasks
  const completedIds = new Set(
    workflow.tasks.filter(t => t.status === 'completed').map(t => t.id)
  );

  const updatedTasks = workflow.tasks.map(task => {
    if (task.status !== 'blocked') {
      return task;
    }

    // Check if all blocking tasks are completed
    const remainingBlockers = task.blockedBy.filter(id => !completedIds.has(id));

    if (remainingBlockers.length === 0) {
      // Unblock the task
      return {
        ...task,
        status: 'pending' as const,
        blockedBy: []
      };
    }

    // Update blocker list (remove completed ones for tracking)
    if (remainingBlockers.length < task.blockedBy.length) {
      return {
        ...task,
        blockedBy: remainingBlockers
      };
    }

    return task;
  });

  return {
    ...workflow,
    tasks: updatedTasks
  };
}

// ============================================================================
// Workflow Status
// ============================================================================

/**
 * Check if workflow is complete
 *
 * A workflow is complete when all tasks are either completed or failed.
 *
 * @param workflow - Current workflow state
 * @returns True if workflow is complete
 */
export function isWorkflowComplete(workflow: WorkflowState): boolean {
  return workflow.tasks.every(
    t => t.status === 'completed' || t.status === 'failed'
  );
}

/**
 * Get workflow progress summary
 *
 * @param workflow - Current workflow state
 * @returns Progress summary with counts and percentage
 */
export function getWorkflowProgress(workflow: WorkflowState): {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  blocked: number;
  percentComplete: number;
} {
  const counts = {
    completed: 0,
    failed: 0,
    running: 0,
    pending: 0,
    blocked: 0,
    assigned: 0,
    validating: 0
  };

  for (const task of workflow.tasks) {
    counts[task.status]++;
  }

  const total = workflow.tasks.length;
  const percentComplete =
    total > 0 ? Math.round(((counts.completed + counts.failed) / total) * 100) : 0;

  return {
    total,
    completed: counts.completed,
    failed: counts.failed,
    running: counts.running + counts.validating + counts.assigned,
    pending: counts.pending,
    blocked: counts.blocked,
    percentComplete
  };
}

/**
 * Calculate workflow metrics
 *
 * @param workflow - Current workflow state
 * @returns Updated workflow metrics
 */
export function calculateMetrics(workflow: WorkflowState): WorkflowMetrics {
  const completedTasks = workflow.tasks.filter(t => t.status === 'completed');
  const failedTasks = workflow.tasks.filter(t => t.status === 'failed');

  let totalDuration = 0;
  let totalRetries = 0;
  let taskDurations: number[] = [];

  for (const task of completedTasks) {
    if (task.startedAt && task.completedAt) {
      const duration = task.completedAt - task.startedAt;
      taskDurations.push(duration);
      totalDuration += duration;
    }
    totalRetries += task.retryCount;
  }

  // Add failed task retries
  for (const task of failedTasks) {
    totalRetries += task.retryCount;
  }

  const averageTaskDuration =
    taskDurations.length > 0
      ? taskDurations.reduce((a, b) => a + b, 0) / taskDurations.length
      : 0;

  // Total workflow duration
  if (workflow.startedAt) {
    totalDuration = (workflow.completedAt || Date.now()) - workflow.startedAt;
  }

  return {
    totalTasks: workflow.tasks.length,
    completedTasks: completedTasks.length,
    failedTasks: failedTasks.length,
    totalRetries,
    totalDuration,
    averageTaskDuration
  };
}

// ============================================================================
// Execution Planning
// ============================================================================

/**
 * Execution phase in the plan
 */
export interface ExecutionPhase {
  phaseNumber: number;
  tasks: string[];
  canParallelize: boolean;
}

/**
 * Generate workflow execution plan
 *
 * Creates a phased execution plan based on task dependencies.
 * Also identifies the critical path (longest chain of dependencies).
 *
 * @param workflow - Current workflow state
 * @returns Execution plan with phases and critical path
 */
export function generateExecutionPlan(workflow: WorkflowState): {
  phases: ExecutionPhase[];
  criticalPath: string[];
  estimatedPhases: number;
} {
  const phases: ExecutionPhase[] = [];
  const processed = new Set<string>();
  const remaining = new Set(workflow.tasks.map(t => t.id));

  // Build dependency map
  const dependencies = new Map<string, Set<string>>();
  for (const task of workflow.tasks) {
    dependencies.set(task.id, new Set(task.blockedBy));
  }

  let phaseNumber = 1;

  while (remaining.size > 0) {
    // Find tasks with all dependencies satisfied
    const readyTasks: string[] = [];

    for (const taskId of remaining) {
      const deps = dependencies.get(taskId)!;
      const unmetDeps = [...deps].filter(d => !processed.has(d));
      if (unmetDeps.length === 0) {
        readyTasks.push(taskId);
      }
    }

    if (readyTasks.length === 0) {
      // Circular dependency or error - break to avoid infinite loop
      // Add remaining tasks as final phase (forced)
      phases.push({
        phaseNumber,
        tasks: [...remaining],
        canParallelize: false
      });
      break;
    }

    // Add phase
    phases.push({
      phaseNumber,
      tasks: readyTasks,
      canParallelize: readyTasks.length > 1
    });

    // Mark as processed
    for (const taskId of readyTasks) {
      processed.add(taskId);
      remaining.delete(taskId);
    }

    phaseNumber++;
  }

  // Calculate critical path (longest dependency chain)
  const criticalPath = findCriticalPath(workflow);

  return {
    phases,
    criticalPath,
    estimatedPhases: phases.length
  };
}

/**
 * Find the critical path through the workflow
 */
function findCriticalPath(workflow: WorkflowState): string[] {
  // Build adjacency list (reverse - task -> tasks it blocks)
  const blocksMap = new Map<string, string[]>();
  for (const task of workflow.tasks) {
    blocksMap.set(task.id, [...task.blocks]);
  }

  // Find tasks with no dependencies (start nodes)
  const startNodes = workflow.tasks
    .filter(t => t.blockedBy.length === 0)
    .map(t => t.id);

  // DFS to find longest path
  let longestPath: string[] = [];

  function dfs(node: string, currentPath: string[]): void {
    currentPath.push(node);

    const children = blocksMap.get(node) || [];
    if (children.length === 0) {
      // End node - check if longest
      if (currentPath.length > longestPath.length) {
        longestPath = [...currentPath];
      }
    } else {
      for (const child of children) {
        dfs(child, currentPath);
      }
    }

    currentPath.pop();
  }

  for (const startNode of startNodes) {
    dfs(startNode, []);
  }

  // If no path found (all tasks independent), return first task
  if (longestPath.length === 0 && workflow.tasks.length > 0) {
    longestPath = [workflow.tasks[0].id];
  }

  return longestPath;
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize workflow state for persistence
 *
 * @param workflow - Workflow state to serialize
 * @returns JSON string representation
 */
export function serializeWorkflow(workflow: WorkflowState): string {
  return JSON.stringify(workflow, null, 2);
}

/**
 * Parse workflow state from JSON
 *
 * @param json - JSON string to parse
 * @returns Parsed workflow state or null if invalid
 */
export function parseWorkflow(json: string): WorkflowState | null {
  try {
    const parsed = JSON.parse(json);

    // Basic validation
    if (
      !parsed.workflowId ||
      !parsed.team ||
      !parsed.tasks ||
      !Array.isArray(parsed.tasks)
    ) {
      return null;
    }

    return parsed as WorkflowState;
  } catch {
    return null;
  }
}
