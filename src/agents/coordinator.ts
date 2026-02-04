/**
 * Coordinator Agent - Builder-Validator Cycle Management
 *
 * Orchestrates Builder-Validator (B-V) cycles for the ohmyblack system.
 * Manages task delegation, retry logic, and escalation.
 *
 * Responsibilities:
 * - Manage B-V cycle execution
 * - Coordinate between builder and validator agents
 * - Handle retry logic and escalation
 * - Track cycle state and history
 * - Communicate task status via Task tools
 */

import type { AgentConfig, AgentPromptMetadata } from './types.js';
import { loadAgentPrompt } from './utils.js';

export const COORDINATOR_PROMPT_METADATA: AgentPromptMetadata = {
  category: 'orchestration',
  cost: 'CHEAP',
  promptAlias: 'coordinator',
  triggers: [
    { domain: 'B-V Cycles', trigger: 'Builder-Validator coordination and management' },
    { domain: 'Orchestration', trigger: 'Multi-agent task coordination' },
    { domain: 'Retry', trigger: 'Failed task retry and escalation handling' },
  ],
  useWhen: [
    'Managing Builder-Validator cycles',
    'Coordinating retry logic for failed validations',
    'Handling escalation when retries exhausted',
    'Tracking B-V cycle state and history',
  ],
  avoidWhen: [
    'Simple single-agent tasks',
    'Direct execution without validation',
    'Tasks that dont require B-V pattern',
  ],
};

/**
 * Coordinator state for tracking B-V cycles
 */
export interface CoordinatorState {
  coordinatorId: string;
  taskId: string;
  status: 'pending' | 'in_progress' | 'success' | 'failed' | 'escalated';
  currentAttempt: number;
  maxAttempts: number;
  builderAgent: string;
  validatorAgent: string;
  history: CycleAttempt[];
  startedAt: string;
  completedAt?: string;
}

/**
 * Single B-V cycle attempt record
 */
export interface CycleAttempt {
  attempt: number;
  builderStatus: 'pending' | 'success' | 'failed';
  validatorStatus: 'pending' | 'approved' | 'rejected' | 'needs_review';
  issues: string[];
  timestamp: string;
  duration?: number;
}

/**
 * Create initial coordinator state
 */
export function createCoordinatorState(
  taskId: string,
  builderAgent: string,
  validatorAgent: string,
  maxAttempts = 3
): CoordinatorState {
  return {
    coordinatorId: `coord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    taskId,
    status: 'pending',
    currentAttempt: 0,
    maxAttempts,
    builderAgent,
    validatorAgent,
    history: [],
    startedAt: new Date().toISOString()
  };
}

/**
 * Record a cycle attempt
 */
export function recordCycleAttempt(
  state: CoordinatorState,
  builderStatus: CycleAttempt['builderStatus'],
  validatorStatus: CycleAttempt['validatorStatus'],
  issues: string[] = []
): CoordinatorState {
  const attempt: CycleAttempt = {
    attempt: state.currentAttempt + 1,
    builderStatus,
    validatorStatus,
    issues,
    timestamp: new Date().toISOString()
  };

  return {
    ...state,
    currentAttempt: state.currentAttempt + 1,
    history: [...state.history, attempt]
  };
}

export const coordinatorAgent: AgentConfig = {
  name: 'coordinator',
  description: 'Builder-Validator cycle coordinator (Sonnet). Manages B-V cycles, retry logic, escalation, and task communication. Central orchestrator for ohmyblack verification workflows.',
  prompt: loadAgentPrompt('coordinator'),
  tools: [
    'Read',
    'Write',
    'Glob',
    'Grep',
    'Task',
    'TaskCreate',
    'TaskUpdate',
    'TaskList',
    'TaskGet',
    'TodoWrite'
  ],
  model: 'sonnet',
  defaultModel: 'sonnet',
  metadata: COORDINATOR_PROMPT_METADATA
};
