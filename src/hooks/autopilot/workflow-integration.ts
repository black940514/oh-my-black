/**
 * Workflow Integration for Autopilot
 *
 * Integrates WorkflowExecutor with autopilot execution phase.
 *
 * ## Integration Paths
 *
 * ### Basic Workflow (no B-V cycles):
 * ```
 * createAutopilotWorkflow() → executeAutopilotWorkflow()
 * ```
 *
 * ### Enhanced Workflow (with B-V cycles):
 * ```
 * runOhmyblackAutopilot() → executeOhmyblackAutopilot() → executeWithBVCycle()
 * ```
 *
 * For ohmyblack mode, prefer using the enhanced path via runOhmyblackAutopilot()
 * which provides full Builder-Validator cycle integration.
 */

import {
  createExecutionContext,
  runWorkflow,
  pauseWorkflow,
  resumeWorkflow,
  cancelWorkflow,
  createBVTaskExecutor,
  type ExecutionContext,
  type ExecutionCallbacks
} from '../../features/team/executor.js';

// Re-export ExecutionCallbacks for use in other modules
export type { ExecutionCallbacks };
import {
  createWorkflow,
  type WorkflowState,
  type WorkflowConfig
} from '../../features/team/workflow.js';
import type { TeamDefinition } from '../../features/team/types.js';
import type { AutopilotConfig } from './types.js';
import type { DecompositionResult } from '../../features/task-decomposer/types.js';

/**
 * Check if workflow execution should be used
 */
export function shouldUseWorkflowExecution(config: AutopilotConfig): boolean {
  // Check if ohmyblack is enabled in config
  // Note: This would need to be added to AutopilotConfig type
  return (config as any).ohmyblack?.enabled === true;
}

/**
 * Create workflow from autopilot state
 */
export function createAutopilotWorkflow(
  workflowId: string,
  team: TeamDefinition,
  decomposition: DecompositionResult,
  config?: AutopilotConfig
): WorkflowState {
  const workflowConfig: Partial<WorkflowConfig> = {
    maxParallelTasks: config?.parallelExecutors || 3,
    taskTimeout: 120000,
    autoAssign: true,
    continueOnFailure: false,
    maxRetries: 2
  };

  return createWorkflow(workflowId, team, decomposition, workflowConfig);
}

/**
 * Execute autopilot workflow with B-V cycle integration
 *
 * @param workflow - Workflow state to execute
 * @param callbacks - Optional progress callbacks
 * @param useRealBVCycle - Whether to use real B-V cycle execution (default: true)
 * @returns Final workflow state
 */
export async function executeAutopilotWorkflow(
  workflow: WorkflowState,
  callbacks?: ExecutionCallbacks,
  useRealBVCycle: boolean = true
): Promise<WorkflowState> {
  // Use real B-V executor when enabled, otherwise use simulation
  const executor = useRealBVCycle
    ? createBVTaskExecutor(workflow.team)
    : undefined; // undefined means use defaultTaskExecutor

  return runWorkflow(workflow, callbacks, executor);
}

/**
 * Pause workflow execution
 */
export function pauseAutopilotWorkflow(context: ExecutionContext): ExecutionContext {
  return pauseWorkflow(context);
}

/**
 * Resume workflow execution
 */
export async function resumeAutopilotWorkflow(
  context: ExecutionContext,
  callbacks?: ExecutionCallbacks
): Promise<WorkflowState> {
  return resumeWorkflow(context, callbacks);
}

/**
 * Cancel workflow execution
 */
export function cancelAutopilotWorkflow(context: ExecutionContext): ExecutionContext {
  return cancelWorkflow(context);
}

/**
 * Get workflow progress for HUD display
 */
export function getWorkflowProgress(context: ExecutionContext): {
  completed: number;
  total: number;
  inProgress: number;
  failed: number;
} {
  const tasks = context.workflow.tasks;
  return {
    completed: tasks.filter(t => t.status === 'completed').length,
    total: tasks.length,
    inProgress: tasks.filter(t => t.status === 'running' || t.status === 'validating' || t.status === 'assigned').length,
    failed: tasks.filter(t => t.status === 'failed').length
  };
}

/**
 * Create execution context from workflow
 */
export function createAutopilotExecutionContext(workflow: WorkflowState): ExecutionContext {
  return createExecutionContext(workflow);
}

// ============================================================================
// Ohmyblack Integration Documentation
// ============================================================================

/**
 * For enhanced B-V cycle support, use the ohmyblack integration functions
 * located in `skills/autopilot/ohmyblack-integration.ts`.
 *
 * ## Available Functions (import directly from skills):
 *
 * - `initializeOhmyblackAutopilot()` - Initialize ohmyblack autopilot state
 * - `runOhmyblackAutopilot()` - Main entry point for B-V cycle execution
 * - `executeOhmyblackAutopilot()` - Execute autopilot with B-V cycles
 * - `autoComposeTeamForTask()` - Auto-compose team based on task complexity
 * - `createBVWorkflow()` - Create workflow with B-V cycle configuration
 * - `handleBVCycle()` - Handle builder-validator cycle coordination
 * - `shouldEnableOhmyblackMode()` - Check if ohmyblack mode should be enabled
 * - `determineValidationType()` - Determine validation level for task
 * - `generateAutopilotReport()` - Generate execution report
 * - `formatAutopilotReportMarkdown()` - Format report as markdown
 *
 * ## Types:
 *
 * - `OhmyblackAutopilotConfig` - Configuration for ohmyblack autopilot
 * - `OhmyblackAutopilotState` - State tracking for ohmyblack execution
 * - `OhmyblackAutopilotCallbacks` - Callbacks for progress tracking
 * - `OhmyblackAutopilotReport` - Execution report structure
 *
 * ## Usage Example:
 *
 * ```typescript
 * import { runOhmyblackAutopilot } from '../../../skills/autopilot/ohmyblack-integration.js';
 *
 * const result = await runOhmyblackAutopilot({
 *   objective: "Build authentication system",
 *   ohmyblack: { enabled: true, validationLevel: 'validator' }
 * });
 * ```
 *
 * Note: Direct import from skills is required due to TypeScript rootDir constraints.
 * The skills directory imports from src, so src cannot import from skills to avoid
 * circular dependencies.
 */
