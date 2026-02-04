/**
 * Ohmyblack State Schemas
 *
 * JSON state schemas for the ohmyblack system:
 * - Task state with dependency tracking
 * - Validation state for Builder-Validator cycles
 * - Team state for agent coordination
 * - Session state for unified tracking
 */

import type { VerificationEvidence, OhmyblackEvidenceType } from '../verification/types.js';
import type { ValidationType } from '../task-decomposer/types.js';

/**
 * Evidence for task completion verification
 */
export interface Evidence {
  /** Type of evidence */
  type: OhmyblackEvidenceType;
  /** Whether the check passed */
  passed: boolean;
  /** Timestamp when collected */
  timestamp: number;
  /** Additional details */
  details?: string;
}

/**
 * Task state with dependency tracking and retry logic
 */
export interface TaskState {
  /** Unique task identifier */
  id: string;
  /** Parent task ID (if this is a subtask) */
  parentId?: string;
  /** Current task status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  /** Agent assigned to this task */
  assignedAgent?: string;
  /** Task IDs that must complete before this task can start */
  blockedBy: string[];
  /** Task IDs that are waiting for this task to complete */
  blocks: string[];
  /** Verification evidence collected */
  evidence: Evidence[];
  /** Timestamp when task started */
  startedAt?: number;
  /** Timestamp when task completed */
  completedAt?: number;
  /** Number of retry attempts */
  retryCount: number;
  /** Maximum allowed retry attempts */
  maxRetries: number;
}

/**
 * Validation state for Builder-Validator cycles
 */
export interface ValidationState {
  /** Task ID being validated */
  taskId: string;
  /** Type of validation being performed */
  validationType: 'self-only' | 'validator' | 'architect';
  /** Whether builder phase passed */
  builderPassed: boolean;
  /** Whether validator phase passed */
  validatorPassed: boolean;
  /** Current cycle iteration number */
  currentCycle: number;
  /** Maximum allowed cycles before escalation */
  maxCycles: number;
  /** Verification evidence from validation */
  evidence: VerificationEvidence[];
  /** List of issues found during validation */
  issues: string[];
  /** Timestamp of last validation */
  lastValidatedAt?: number;
}

/**
 * Team member with role and status
 */
export interface TeamMember {
  /** Unique agent identifier */
  agentId: string;
  /** Agent's role in the team */
  role: 'builder' | 'validator' | 'orchestrator' | 'specialist';
  /** Agent's capabilities/specializations */
  capabilities: string[];
  /** Current task assigned to this agent */
  currentTask?: string;
  /** Current agent status */
  status: 'idle' | 'working' | 'blocked' | 'completed';
}

/**
 * Communication entry between agents
 */
export interface CommunicationEntry {
  /** Sender agent ID */
  from: string;
  /** Recipient agent ID */
  to: string;
  /** Type of communication */
  type: 'task_assignment' | 'validation_result' | 'escalation' | 'status_update';
  /** Communication payload data */
  payload: unknown;
  /** Timestamp of communication */
  timestamp: number;
}

/**
 * Team state for coordinated agent work
 */
export interface TeamState {
  /** Unique team identifier */
  teamId: string;
  /** Orchestrator agent ID */
  orchestratorId: string;
  /** All team members */
  members: TeamMember[];
  /** Mapping of task IDs to assigned agent IDs */
  taskAssignments: Record<string, string>;
  /** Shared context available to all team members */
  sharedContext: Record<string, unknown>;
  /** Communication log between agents */
  communicationLog: CommunicationEntry[];
}

/**
 * Session configuration
 */
export interface SessionConfig {
  /** Maximum parallel workers */
  maxParallel: number;
  /** Timeout per task (milliseconds) */
  taskTimeout: number;
  /** Whether to enable auto-escalation on failures */
  autoEscalate: boolean;
  /** Model tier to use for builders */
  builderModel: 'low' | 'medium' | 'high';
  /** Model tier to use for validators */
  validatorModel: 'low' | 'medium' | 'high';
}

/**
 * Complete session state for ohmyblack execution
 */
export interface OhmyblackSessionState {
  /** Unique session identifier */
  sessionId: string;
  /** Execution mode */
  mode: 'autopilot' | 'ultrawork' | 'ralph' | 'ultrapilot' | 'swarm' | 'pipeline';
  /** All tasks in this session */
  tasks: TaskState[];
  /** All validation states */
  validations: ValidationState[];
  /** Team state (if team-based execution) */
  team?: TeamState;
  /** Session start timestamp */
  startedAt: number;
  /** Last update timestamp */
  lastUpdatedAt: number;
  /** Session configuration */
  config: SessionConfig;
}

/**
 * Helper: Create a new task state with defaults
 */
export function createTaskState(
  id: string,
  options?: Partial<TaskState>
): TaskState {
  return {
    id,
    status: 'pending',
    blockedBy: [],
    blocks: [],
    evidence: [],
    retryCount: 0,
    maxRetries: 3,
    ...options,
  };
}

/**
 * Helper: Create a new validation state
 */
export function createValidationState(
  taskId: string,
  validationType: ValidationType
): ValidationState {
  return {
    taskId,
    validationType,
    builderPassed: false,
    validatorPassed: false,
    currentCycle: 0,
    maxCycles: 3,
    evidence: [],
    issues: [],
  };
}

/**
 * Helper: Create a new team state
 */
export function createTeamState(
  teamId: string,
  orchestratorId: string
): TeamState {
  return {
    teamId,
    orchestratorId,
    members: [],
    taskAssignments: {},
    sharedContext: {},
    communicationLog: [],
  };
}

/**
 * Helper: Create a new session state
 */
export function createSessionState(
  sessionId: string,
  mode: OhmyblackSessionState['mode']
): OhmyblackSessionState {
  return {
    sessionId,
    mode,
    tasks: [],
    validations: [],
    startedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    config: {
      maxParallel: 5,
      taskTimeout: 600000, // 10 minutes
      autoEscalate: true,
      builderModel: 'medium',
      validatorModel: 'medium',
    },
  };
}

/**
 * Validation utility: Check if a task is blocked by incomplete dependencies
 */
export function isTaskBlocked(task: TaskState, allTasks: TaskState[]): boolean {
  if (task.blockedBy.length === 0) {
    return false;
  }

  // Task is blocked if ANY of its dependencies are not completed
  return task.blockedBy.some((blockerTaskId) => {
    const blocker = allTasks.find((t) => t.id === blockerTaskId);
    return !blocker || blocker.status !== 'completed';
  });
}

/**
 * Validation utility: Get all tasks that can be executed (not blocked)
 */
export function getAvailableTasks(tasks: TaskState[]): TaskState[] {
  return tasks.filter((task) => {
    // Only pending tasks that are not blocked
    return task.status === 'pending' && !isTaskBlocked(task, tasks);
  });
}

/**
 * Validation utility: Update task dependencies when tasks complete
 * Removes completed task IDs from blockedBy arrays
 */
export function updateTaskDependencies(
  task: TaskState,
  completedTaskIds: string[]
): TaskState {
  return {
    ...task,
    blockedBy: task.blockedBy.filter((id) => !completedTaskIds.includes(id)),
  };
}

/**
 * Helper: Add evidence to a task
 */
export function addTaskEvidence(
  task: TaskState,
  evidence: Evidence
): TaskState {
  return {
    ...task,
    evidence: [...task.evidence, evidence],
  };
}

/**
 * Helper: Check if task has required evidence
 */
export function hasRequiredEvidence(
  task: TaskState,
  requiredTypes: OhmyblackEvidenceType[]
): boolean {
  const evidenceTypes = new Set(
    task.evidence.filter((e) => e.passed).map((e) => e.type)
  );
  return requiredTypes.every((type) => evidenceTypes.has(type));
}

/**
 * Helper: Get tasks blocked by a specific task
 */
export function getBlockedTasks(
  taskId: string,
  allTasks: TaskState[]
): TaskState[] {
  return allTasks.filter((task) => task.blockedBy.includes(taskId));
}

/**
 * Helper: Add team member to team state
 */
export function addTeamMember(
  team: TeamState,
  member: TeamMember
): TeamState {
  return {
    ...team,
    members: [...team.members, member],
  };
}

/**
 * Helper: Add communication entry to team
 */
export function addCommunication(
  team: TeamState,
  entry: Omit<CommunicationEntry, 'timestamp'>
): TeamState {
  return {
    ...team,
    communicationLog: [
      ...team.communicationLog,
      { ...entry, timestamp: Date.now() },
    ],
  };
}

/**
 * Helper: Assign task to agent
 */
export function assignTask(
  team: TeamState,
  taskId: string,
  agentId: string
): TeamState {
  return {
    ...team,
    taskAssignments: {
      ...team.taskAssignments,
      [taskId]: agentId,
    },
  };
}

/**
 * Helper: Update member status
 */
export function updateMemberStatus(
  team: TeamState,
  agentId: string,
  status: TeamMember['status'],
  currentTask?: string
): TeamState {
  return {
    ...team,
    members: team.members.map((member) =>
      member.agentId === agentId
        ? { ...member, status, currentTask }
        : member
    ),
  };
}

/**
 * Helper: Get available team members (idle)
 */
export function getAvailableMembers(team: TeamState): TeamMember[] {
  return team.members.filter((member) => member.status === 'idle');
}

/**
 * Helper: Increment retry count
 */
export function incrementRetry(task: TaskState): TaskState {
  return {
    ...task,
    retryCount: task.retryCount + 1,
  };
}

/**
 * Helper: Check if task exceeded max retries
 */
export function hasExceededRetries(task: TaskState): boolean {
  return task.retryCount >= task.maxRetries;
}

/**
 * Helper: Update validation cycle
 */
export function incrementValidationCycle(
  validation: ValidationState
): ValidationState {
  return {
    ...validation,
    currentCycle: validation.currentCycle + 1,
  };
}

/**
 * Helper: Check if validation exceeded max cycles
 */
export function hasExceededCycles(validation: ValidationState): boolean {
  return validation.currentCycle >= validation.maxCycles;
}

/**
 * Helper: Add validation issue
 */
export function addValidationIssue(
  validation: ValidationState,
  issue: string
): ValidationState {
  return {
    ...validation,
    issues: [...validation.issues, issue],
  };
}
