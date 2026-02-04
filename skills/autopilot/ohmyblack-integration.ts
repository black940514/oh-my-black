/**
 * Ohmyblack Integration for Autopilot
 *
 * Integrates Team Auto-Composer, B-V cycles, and Meta-prompt generation
 * into the autopilot workflow for enhanced reliability and consistency.
 *
 * @module ohmyblack-integration
 */

import type {
	TeamDefinition,
	TeamMember,
	TeamTemplate,
	TeamConfig,
} from '../../src/features/team/types.js';
import type {
	DecompositionResult,
	TaskAnalysis,
	Subtask,
} from '../../src/features/task-decomposer/types.js';
import type {
	WorkflowState,
	WorkflowTask,
	WorkflowConfig,
} from '../../src/features/team/workflow.js';
import type {
	BVOrchestrationResult,
	BVTaskConfig,
	BVValidationType,
	BVOrchestrationState,
} from '../../src/features/verification/bv-integration.js';
import type {
	GeneratedPrompt,
	GeneratorConfig,
} from '../../src/features/meta-prompt/generator.js';

import {
	TeamAutoComposer,
	type CompositionRequest,
	type CompositionResult,
	type CompositionConstraints,
} from '../../src/features/team/auto-composer.js';
import {
	createWorkflow,
	getAvailableTasks,
	autoAssignTasks,
	startTask,
	completeTask,
	failTask,
	isWorkflowComplete,
	getWorkflowProgress,
	generateExecutionPlan,
	DEFAULT_WORKFLOW_CONFIG,
} from '../../src/features/team/workflow.js';
import {
	executeWithBVCycle,
	createBVOrchestrationState,
	updateOrchestrationState,
	generateBVReport,
	formatBVReportMarkdown,
	type BVReportSummary,
} from '../../src/features/verification/bv-integration.js';
import { MetaPromptGenerator } from '../../src/features/meta-prompt/generator.js';
import {
	detectQualityKeywords,
	detectSpeedKeywords,
	detectArchitectKeywords
} from '../../src/features/intent-detection/keywords.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Ohmyblack-enhanced autopilot configuration
 *
 * Controls which features of the ohmyblack system are enabled
 * and how they should behave during autopilot execution.
 */
export interface OhmyblackAutopilotConfig {
	/** Enable team auto-composition based on task analysis */
	autoComposeTeam: boolean;
	/** Enable B-V validation cycles for each task */
	enableBVCycles: boolean;
	/** Enable meta-prompt generation for consistent agent prompts */
	useMetaPrompts: boolean;
	/** Validation type for tasks */
	validationType: BVValidationType;
	/** Maximum parallel workers */
	maxParallelWorkers: number;
	/** Team template preference (undefined = auto-select based on task) */
	teamTemplate?: TeamTemplate;
	/** Complexity threshold to auto-enable ohmyblack mode */
	complexityThreshold: number;
	/** Maximum retry attempts per task */
	maxRetries: number;
	/** Task timeout in milliseconds */
	taskTimeout: number;
	/** Continue workflow on task failure */
	continueOnFailure: boolean;
}

/**
 * Ohmyblack autopilot session state
 *
 * Tracks the complete state of an ohmyblack-enhanced autopilot session
 * including team composition, workflow state, and B-V cycle results.
 */
export interface OhmyblackAutopilotState {
	/** Session identifier */
	sessionId: string;
	/** Original task description */
	task: string;
	/** Session status */
	status: 'initializing' | 'composing' | 'executing' | 'validating' | 'completed' | 'failed';
	/** Auto-composed team */
	team?: TeamDefinition;
	/** Team composition result with reasoning */
	compositionResult?: CompositionResult;
	/** Active workflow */
	workflow?: WorkflowState;
	/** B-V orchestration state */
	bvState: BVOrchestrationState;
	/** B-V cycle results for all tasks */
	bvResults: BVOrchestrationResult[];
	/** Generated prompts for team members and tasks */
	generatedPrompts: Map<string, GeneratedPrompt>;
	/** Ohmyblack configuration */
	config: OhmyblackAutopilotConfig;
	/** Session start timestamp */
	startedAt: number;
	/** Session completion timestamp */
	completedAt?: number;
	/** Error message if failed */
	error?: string;
}

/**
 * Callbacks for autopilot execution events
 */
export interface OhmyblackAutopilotCallbacks {
	/** Called when team composition is complete */
	onTeamComposed?: (team: TeamDefinition, result: CompositionResult) => void;
	/** Called when workflow is created */
	onWorkflowCreated?: (workflow: WorkflowState) => void;
	/** Called when a task starts */
	onTaskStarted?: (taskId: string, task: WorkflowTask) => void;
	/** Called when a task completes */
	onTaskCompleted?: (taskId: string, result: BVOrchestrationResult) => void;
	/** Called when a task fails */
	onTaskFailed?: (taskId: string, error: string) => void;
	/** Called on progress updates */
	onProgress?: (progress: {
		completed: number;
		total: number;
		current?: string;
		phase: string;
	}) => void;
	/** Called when B-V cycle completes for a task */
	onBVCycleComplete?: (taskId: string, result: BVOrchestrationResult) => void;
}

/**
 * Final autopilot report
 */
export interface OhmyblackAutopilotReport {
	/** Overall success status */
	success: boolean;
	/** Summary description */
	summary: string;
	/** Number of tasks completed */
	tasksCompleted: number;
	/** Number of tasks failed */
	tasksFailed: number;
	/** Total retry attempts across all tasks */
	totalRetries: number;
	/** Team template that was used */
	teamUsed: string;
	/** Team composition reasoning */
	teamReasoning: string;
	/** B-V cycles summary */
	bvCyclesSummary: {
		total: number;
		passed: number;
		failed: number;
		escalated: number;
	};
	/** Total duration in milliseconds */
	totalDuration: number;
	/** Execution phases */
	phases: number;
	/** Critical path tasks */
	criticalPath: string[];
	/** Warnings encountered */
	warnings: string[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default ohmyblack configuration
 */
export const DEFAULT_OHMYBLACK_CONFIG: OhmyblackAutopilotConfig = {
	autoComposeTeam: true,
	enableBVCycles: true,
	useMetaPrompts: true,
	validationType: 'validator',
	maxParallelWorkers: 3,
	teamTemplate: undefined, // Auto-select based on task
	complexityThreshold: 0.5,
	maxRetries: 3,
	taskTimeout: 300000, // 5 minutes
	continueOnFailure: false,
};

/**
 * Complexity thresholds for feature enabling
 */
const COMPLEXITY_THRESHOLDS = {
	/** Below this, use minimal validation */
	LOW: 0.3,
	/** Above this, enable full B-V cycles */
	MEDIUM: 0.5,
	/** Above this, require architect validation */
	HIGH: 0.7,
};

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize ohmyblack-enhanced autopilot
 *
 * Creates a new autopilot session state with the given task and configuration.
 * Does not perform team composition or workflow creation - use subsequent
 * functions for that.
 *
 * @param task - Task description
 * @param config - Optional configuration overrides
 * @returns Initial autopilot state
 */
export function initializeOhmyblackAutopilot(
	task: string,
	config?: Partial<OhmyblackAutopilotConfig>
): OhmyblackAutopilotState {
	const mergedConfig: OhmyblackAutopilotConfig = {
		...DEFAULT_OHMYBLACK_CONFIG,
		...config,
	};

	const sessionId = `ohmyblack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

	return {
		sessionId,
		task,
		status: 'initializing',
		bvState: createBVOrchestrationState(mergedConfig.validationType),
		bvResults: [],
		generatedPrompts: new Map(),
		config: mergedConfig,
		startedAt: Date.now(),
	};
}

/**
 * Check if ohmyblack mode should be enabled based on task complexity
 *
 * @param analysis - Task analysis result
 * @param config - Current configuration
 * @param userInput - Optional user input for keyword detection
 * @returns Whether ohmyblack mode should be enabled
 */
export function shouldEnableOhmyblackMode(
	analysis: TaskAnalysis,
	config: OhmyblackAutopilotConfig,
	userInput?: string
): boolean {
	// Keyword-based activation (quality keywords trigger ohmyblack)
	if (userInput && detectQualityKeywords(userInput)) {
		return true;
	}
	// Complexity-based activation
	return analysis.complexity >= config.complexityThreshold;
}

/**
 * Determine validation type based on complexity
 *
 * @param complexity - Task complexity score (0-1)
 * @param userInput - Optional user input for keyword detection
 * @returns Appropriate validation type
 */
export function determineValidationType(
	complexity: number,
	userInput?: string
): BVValidationType {
	// Keyword priority - check keywords first
	if (userInput) {
		if (detectArchitectKeywords(userInput)) {
			return 'architect';
		}
		if (detectSpeedKeywords(userInput)) {
			return 'self-only';
		}
	}
	// Complexity fallback
	if (complexity >= COMPLEXITY_THRESHOLDS.HIGH) {
		return 'architect';
	}
	if (complexity >= COMPLEXITY_THRESHOLDS.MEDIUM) {
		return 'validator';
	}
	return 'self-only';
}

// ============================================================================
// Team Composition
// ============================================================================

/**
 * Auto-compose team for autopilot task
 *
 * Uses the task analysis and decomposition to automatically compose
 * an optimal team for executing the task.
 *
 * @param analysis - Task analysis result
 * @param decomposition - Task decomposition result
 * @param config - Ohmyblack configuration
 * @param generator - Optional meta-prompt generator
 * @returns Composed team definition
 */
export function autoComposeTeamForTask(
	analysis: TaskAnalysis,
	decomposition: DecompositionResult,
	config: OhmyblackAutopilotConfig,
	generator?: MetaPromptGenerator
): CompositionResult {
	const composer = new TeamAutoComposer(generator);

	// Build composition request
	const request: CompositionRequest = {
		analysis,
		decomposition,
		preferredTemplate: config.teamTemplate,
		constraints: buildCompositionConstraints(config),
	};

	// Compose the team
	const result = composer.composeTeam(request);

	return result;
}

/**
 * Build composition constraints from config
 */
function buildCompositionConstraints(
	config: OhmyblackAutopilotConfig
): CompositionConstraints {
	return {
		maxMembers: config.maxParallelWorkers + 2, // workers + validators
		validationType: config.validationType,
	};
}

// ============================================================================
// Workflow Creation
// ============================================================================

/**
 * Create workflow from decomposition with B-V integration
 *
 * Creates a workflow that integrates B-V cycles for each task.
 * The workflow respects the decomposition's execution order and
 * applies the ohmyblack configuration.
 *
 * @param team - Team definition
 * @param decomposition - Task decomposition result
 * @param config - Ohmyblack configuration
 * @returns Initialized workflow state
 */
export function createBVWorkflow(
	team: TeamDefinition,
	decomposition: DecompositionResult,
	config: OhmyblackAutopilotConfig
): WorkflowState {
	const workflowId = `workflow-${Date.now()}`;

	const workflowConfig: Partial<WorkflowConfig> = {
		parallelExecution: config.maxParallelWorkers > 1,
		maxParallelTasks: config.maxParallelWorkers,
		defaultValidationType: config.validationType,
		autoAssign: true,
		continueOnFailure: config.continueOnFailure,
		maxRetries: config.maxRetries,
		taskTimeout: config.taskTimeout,
	};

	return createWorkflow(workflowId, team, decomposition, workflowConfig);
}

// ============================================================================
// Prompt Generation
// ============================================================================

/**
 * Generate task prompts using meta-prompt generator
 *
 * Creates consistent, template-based prompts for all tasks in the workflow.
 *
 * @param workflow - Workflow state
 * @param team - Team definition
 * @param generator - Meta-prompt generator
 * @returns Map of task ID to generated prompt
 */
export function generateTaskPrompts(
	workflow: WorkflowState,
	team: TeamDefinition,
	generator: MetaPromptGenerator
): Map<string, GeneratedPrompt> {
	const prompts = new Map<string, GeneratedPrompt>();

	for (const task of workflow.tasks) {
		// Find assigned agent or use subtask's recommended agent
		const assignedAgent = task.assignment?.memberId || task.subtask.agentType;

		// Generate task prompt
		const prompt = generator.generateTaskPrompt(
			task.subtask,
			assignedAgent,
			{
				includeOutputSchema: true,
				includeVerificationSteps: true,
			}
		);

		prompts.set(task.id, prompt);
	}

	return prompts;
}

/**
 * Create meta-prompt generator with default config
 *
 * @param templatesDir - Path to templates directory
 * @returns Configured generator
 */
export function createMetaPromptGenerator(
	templatesDir: string = './templates'
): MetaPromptGenerator {
	const config: GeneratorConfig = {
		templatesDir,
		includeMetadata: false,
	};

	return new MetaPromptGenerator(config);
}

// ============================================================================
// Execution
// ============================================================================

/**
 * Execute autopilot with ohmyblack enhancements
 *
 * Runs the complete autopilot workflow with team auto-composition,
 * B-V cycles, and meta-prompt generation.
 *
 * @param state - Current autopilot state
 * @param callbacks - Optional event callbacks
 * @returns Updated autopilot state
 */
export async function executeOhmyblackAutopilot(
	state: OhmyblackAutopilotState,
	callbacks?: OhmyblackAutopilotCallbacks
): Promise<OhmyblackAutopilotState> {
	let currentState = { ...state };

	try {
		// Validate state has required components
		if (!currentState.workflow || !currentState.team) {
			throw new Error('Workflow and team must be initialized before execution');
		}

		currentState.status = 'executing';

		// Report initial progress
		callbacks?.onProgress?.({
			completed: 0,
			total: currentState.workflow.tasks.length,
			phase: 'starting',
		});

		// Execute workflow with B-V cycles
		currentState = await executeWorkflowWithBV(currentState, callbacks);

		// Check final status
		if (isWorkflowComplete(currentState.workflow!)) {
			const failedCount = currentState.workflow!.tasks.filter(
				(t) => t.status === 'failed'
			).length;

			currentState.status = failedCount === 0 ? 'completed' : 'failed';
			currentState.completedAt = Date.now();
		}
	} catch (error) {
		currentState.status = 'failed';
		currentState.error = error instanceof Error ? error.message : String(error);
		currentState.completedAt = Date.now();
	}

	return currentState;
}

/**
 * Execute workflow with B-V cycles
 */
async function executeWorkflowWithBV(
	state: OhmyblackAutopilotState,
	callbacks?: OhmyblackAutopilotCallbacks
): Promise<OhmyblackAutopilotState> {
	let currentState = { ...state };
	let workflow = currentState.workflow!;

	while (!isWorkflowComplete(workflow)) {
		// Auto-assign available tasks
		workflow = autoAssignTasks(workflow);

		// Get tasks ready to run
		const availableTasks = getAvailableTasks(workflow);

		if (availableTasks.length === 0) {
			// Check if we have running tasks
			const runningTasks = workflow.tasks.filter(
				(t) => t.status === 'running' || t.status === 'validating'
			);

			if (runningTasks.length === 0) {
				// No tasks available and none running - might be blocked or error
				const blockedTasks = workflow.tasks.filter((t) => t.status === 'blocked');
				if (blockedTasks.length > 0) {
					// Still have blocked tasks but no way to unblock them
					throw new Error(`Workflow stuck: ${blockedTasks.length} blocked tasks with no resolution`);
				}
				break;
			}

			// Wait for running tasks to complete before checking again
			// Small delay to prevent busy-waiting
			await new Promise((resolve) => setTimeout(resolve, 100));
			continue;
		}

		// Execute available tasks (potentially in parallel)
		const taskPromises = availableTasks.map(async (task) => {
			return executeTaskWithBV(task, currentState, callbacks);
		});

		const results = await Promise.all(taskPromises);

		// Update state with results
		for (const result of results) {
			currentState.bvResults.push(result.bvResult);
			currentState.bvState = updateOrchestrationState(currentState.bvState, result.bvResult);

			if (result.bvResult.success) {
				workflow = completeTask(workflow, result.taskId, result.bvResult);
			} else {
				workflow = failTask(workflow, result.taskId, 'B-V cycle failed');
			}
		}

		// Update workflow in state
		currentState.workflow = workflow;

		// Report progress
		const progress = getWorkflowProgress(workflow);
		callbacks?.onProgress?.({
			completed: progress.completed,
			total: progress.total,
			phase: 'executing',
		});
	}

	currentState.workflow = workflow;
	return currentState;
}

/**
 * Execute single task with B-V cycle
 */
async function executeTaskWithBV(
	task: WorkflowTask,
	state: OhmyblackAutopilotState,
	callbacks?: OhmyblackAutopilotCallbacks
): Promise<{ taskId: string; bvResult: BVOrchestrationResult }> {
	// Notify task started
	callbacks?.onTaskStarted?.(task.id, task);

	// Get B-V config for task
	const bvConfig: BVTaskConfig = task.bvConfig || {
		taskId: task.id,
		taskDescription: task.subtask.prompt,
		requirements: task.subtask.acceptanceCriteria,
		acceptanceCriteria: task.subtask.verification,
		validationType: state.config.validationType,
		builderAgent: task.subtask.agentType,
		maxRetries: state.config.maxRetries,
		timeout: state.config.taskTimeout,
	};

	// Execute with B-V cycle
	const bvResult = await executeWithBVCycle(bvConfig, state.team);

	// Notify completion
	if (bvResult.success) {
		callbacks?.onTaskCompleted?.(task.id, bvResult);
	} else {
		callbacks?.onTaskFailed?.(task.id, bvResult.failureReport?.summary || 'Unknown error');
	}

	callbacks?.onBVCycleComplete?.(task.id, bvResult);

	return { taskId: task.id, bvResult };
}

/**
 * Handle B-V cycle for a task
 *
 * Runs the builder-validator cycle for a specific task.
 *
 * @param taskId - Task identifier
 * @param state - Current autopilot state
 * @returns B-V orchestration result
 */
export async function handleBVCycle(
	taskId: string,
	state: OhmyblackAutopilotState
): Promise<BVOrchestrationResult> {
	if (!state.workflow) {
		throw new Error('Workflow not initialized');
	}

	const task = state.workflow.tasks.find((t) => t.id === taskId);
	if (!task) {
		throw new Error(`Task not found: ${taskId}`);
	}

	const bvConfig: BVTaskConfig = task.bvConfig || {
		taskId: task.id,
		taskDescription: task.subtask.prompt,
		requirements: task.subtask.acceptanceCriteria,
		acceptanceCriteria: task.subtask.verification,
		validationType: state.config.validationType,
		builderAgent: task.subtask.agentType,
		maxRetries: state.config.maxRetries,
		timeout: state.config.taskTimeout,
	};

	return executeWithBVCycle(bvConfig, state.team);
}

// ============================================================================
// Status Checking
// ============================================================================

/**
 * Check if autopilot should continue
 *
 * Returns true if there are still tasks to execute and no fatal errors.
 *
 * @param state - Current autopilot state
 * @returns Whether to continue execution
 */
export function shouldContinue(state: OhmyblackAutopilotState): boolean {
	// Check status
	if (state.status === 'completed' || state.status === 'failed') {
		return false;
	}

	// Check workflow
	if (!state.workflow) {
		return false;
	}

	// Check if workflow is complete
	if (isWorkflowComplete(state.workflow)) {
		return false;
	}

	// Check for stuck condition (no available and no running tasks)
	const availableTasks = getAvailableTasks(state.workflow);
	const runningTasks = state.workflow.tasks.filter(
		(t) => t.status === 'running' || t.status === 'validating' || t.status === 'assigned'
	);

	if (availableTasks.length === 0 && runningTasks.length === 0) {
		const pendingTasks = state.workflow.tasks.filter(
			(t) => t.status === 'pending' || t.status === 'blocked'
		);
		// If we have pending/blocked tasks but nothing running, we're stuck
		return pendingTasks.length === 0;
	}

	return true;
}

// ============================================================================
// Reporting
// ============================================================================

/**
 * Generate final autopilot report
 *
 * Creates a comprehensive report of the autopilot session including
 * team composition, B-V cycles, and execution metrics.
 *
 * @param state - Final autopilot state
 * @returns Detailed report
 */
export function generateAutopilotReport(
	state: OhmyblackAutopilotState
): OhmyblackAutopilotReport {
	const workflow = state.workflow;
	const bvReport = generateBVReport(state.bvResults);

	// Calculate metrics
	const tasksCompleted = workflow?.metrics.completedTasks || 0;
	const tasksFailed = workflow?.metrics.failedTasks || 0;
	const totalRetries = workflow?.metrics.totalRetries || 0;

	// Get execution plan for phases and critical path
	const plan = workflow ? generateExecutionPlan(workflow) : { phases: [], criticalPath: [], estimatedPhases: 0 };

	// Collect warnings
	const warnings: string[] = [];
	if (state.compositionResult?.warnings) {
		warnings.push(...state.compositionResult.warnings);
	}
	if (workflow?.tasks.some((t) => t.status === 'failed')) {
		warnings.push(`${tasksFailed} task(s) failed during execution`);
	}

	// Build summary
	let summary: string;
	if (state.status === 'completed' && tasksFailed === 0) {
		summary = `Successfully completed ${tasksCompleted} tasks with ${totalRetries} retries`;
	} else if (state.status === 'completed') {
		summary = `Completed with ${tasksCompleted} successful and ${tasksFailed} failed tasks`;
	} else if (state.status === 'failed') {
		summary = `Failed: ${state.error || 'Unknown error'}`;
	} else {
		summary = `In progress: ${tasksCompleted}/${(workflow?.tasks.length || 0)} tasks completed`;
	}

	return {
		success: state.status === 'completed' && tasksFailed === 0,
		summary,
		tasksCompleted,
		tasksFailed,
		totalRetries,
		teamUsed: state.compositionResult?.templateUsed || 'unknown',
		teamReasoning: state.compositionResult?.reasoning || 'N/A',
		bvCyclesSummary: {
			total: bvReport.totalTasks,
			passed: bvReport.successful,
			failed: bvReport.failed,
			escalated: bvReport.escalated,
		},
		totalDuration: (state.completedAt || Date.now()) - state.startedAt,
		phases: plan.estimatedPhases,
		criticalPath: plan.criticalPath,
		warnings,
	};
}

/**
 * Format autopilot report as markdown
 *
 * @param report - Autopilot report
 * @returns Formatted markdown string
 */
export function formatAutopilotReportMarkdown(report: OhmyblackAutopilotReport): string {
	const lines: string[] = [];

	lines.push('# Ohmyblack Autopilot Report');
	lines.push('');
	lines.push(`**Status:** ${report.success ? 'SUCCESS' : 'FAILED'}`);
	lines.push('');
	lines.push('## Summary');
	lines.push(report.summary);
	lines.push('');

	lines.push('## Execution Metrics');
	lines.push('');
	lines.push(`- **Tasks Completed:** ${report.tasksCompleted}`);
	lines.push(`- **Tasks Failed:** ${report.tasksFailed}`);
	lines.push(`- **Total Retries:** ${report.totalRetries}`);
	lines.push(`- **Total Duration:** ${Math.round(report.totalDuration / 1000)}s`);
	lines.push(`- **Execution Phases:** ${report.phases}`);
	lines.push('');

	lines.push('## Team Composition');
	lines.push('');
	lines.push(`- **Template:** ${report.teamUsed}`);
	lines.push(`- **Reasoning:** ${report.teamReasoning}`);
	lines.push('');

	lines.push('## Builder-Validator Cycles');
	lines.push('');
	lines.push(`- **Total Cycles:** ${report.bvCyclesSummary.total}`);
	lines.push(`- **Passed:** ${report.bvCyclesSummary.passed}`);
	lines.push(`- **Failed:** ${report.bvCyclesSummary.failed}`);
	lines.push(`- **Escalated:** ${report.bvCyclesSummary.escalated}`);
	lines.push('');

	if (report.criticalPath.length > 0) {
		lines.push('## Critical Path');
		lines.push('');
		lines.push(report.criticalPath.map((id, i) => `${i + 1}. ${id}`).join('\n'));
		lines.push('');
	}

	if (report.warnings.length > 0) {
		lines.push('## Warnings');
		lines.push('');
		report.warnings.forEach((w) => lines.push(`- ${w}`));
		lines.push('');
	}

	return lines.join('\n');
}

// ============================================================================
// State Serialization
// ============================================================================

/**
 * Serialize ohmyblack state for persistence
 *
 * @param state - State to serialize
 * @returns JSON-compatible object
 */
export function serializeOhmyblackState(
	state: OhmyblackAutopilotState
): Record<string, unknown> {
	return {
		sessionId: state.sessionId,
		task: state.task,
		status: state.status,
		team: state.team,
		compositionResult: state.compositionResult
			? {
					...state.compositionResult,
					memberPrompts: Object.fromEntries(state.compositionResult.memberPrompts),
				}
			: undefined,
		workflow: state.workflow,
		bvState: state.bvState,
		bvResults: state.bvResults,
		generatedPrompts: Object.fromEntries(state.generatedPrompts),
		config: state.config,
		startedAt: state.startedAt,
		completedAt: state.completedAt,
		error: state.error,
	};
}

/**
 * Deserialize ohmyblack state from persistence
 *
 * @param data - Serialized state data
 * @returns Reconstructed state
 */
export function deserializeOhmyblackState(
	data: Record<string, unknown>
): OhmyblackAutopilotState {
	const generatedPrompts = new Map<string, GeneratedPrompt>();
	if (data.generatedPrompts && typeof data.generatedPrompts === 'object') {
		for (const [key, value] of Object.entries(data.generatedPrompts)) {
			generatedPrompts.set(key, value as GeneratedPrompt);
		}
	}

	return {
		sessionId: data.sessionId as string,
		task: data.task as string,
		status: data.status as OhmyblackAutopilotState['status'],
		team: data.team as TeamDefinition | undefined,
		compositionResult: data.compositionResult as CompositionResult | undefined,
		workflow: data.workflow as WorkflowState | undefined,
		bvState: data.bvState as BVOrchestrationState,
		bvResults: data.bvResults as BVOrchestrationResult[],
		generatedPrompts,
		config: data.config as OhmyblackAutopilotConfig,
		startedAt: data.startedAt as number,
		completedAt: data.completedAt as number | undefined,
		error: data.error as string | undefined,
	};
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Run complete ohmyblack-enhanced autopilot from task
 *
 * High-level function that runs the complete pipeline:
 * 1. Initialize state
 * 2. Analyze and decompose task
 * 3. Compose team
 * 4. Create workflow
 * 5. Execute with B-V cycles
 * 6. Generate report
 *
 * @param task - Task description
 * @param analysis - Pre-computed task analysis
 * @param decomposition - Pre-computed task decomposition
 * @param config - Optional configuration overrides
 * @param callbacks - Optional event callbacks
 * @returns Final state and report
 */
export async function runOhmyblackAutopilot(
	task: string,
	analysis: TaskAnalysis,
	decomposition: DecompositionResult,
	config?: Partial<OhmyblackAutopilotConfig>,
	callbacks?: OhmyblackAutopilotCallbacks
): Promise<{
	state: OhmyblackAutopilotState;
	report: OhmyblackAutopilotReport;
}> {
	// Initialize
	let state = initializeOhmyblackAutopilot(task, config);

	// Determine validation type from complexity
	if (!config?.validationType) {
		state.config.validationType = determineValidationType(analysis.complexity);
	}

	// Create generator if using meta-prompts
	const generator = state.config.useMetaPrompts
		? createMetaPromptGenerator()
		: undefined;

	// Compose team
	state.status = 'composing';
	const compositionResult = autoComposeTeamForTask(
		analysis,
		decomposition,
		state.config,
		generator
	);
	state.team = compositionResult.team;
	state.compositionResult = compositionResult;
	callbacks?.onTeamComposed?.(compositionResult.team, compositionResult);

	// Create workflow
	state.workflow = createBVWorkflow(
		state.team,
		decomposition,
		state.config
	);
	callbacks?.onWorkflowCreated?.(state.workflow);

	// Generate prompts
	if (generator && state.config.useMetaPrompts) {
		state.generatedPrompts = generateTaskPrompts(
			state.workflow,
			state.team,
			generator
		);
	}

	// Execute
	state = await executeOhmyblackAutopilot(state, callbacks);

	// Generate report
	const report = generateAutopilotReport(state);

	return { state, report };
}

// ============================================================================
// Exports
// ============================================================================

export {
	// Re-export commonly used types from dependencies
	type TeamDefinition,
	type TeamTemplate,
	type WorkflowState,
	type BVOrchestrationResult,
	type BVValidationType,
	type GeneratedPrompt,
	type TaskAnalysis,
	type DecompositionResult,
	// Re-export commonly used functions from dependencies
	createWorkflow,
	getWorkflowProgress,
	generateExecutionPlan,
	generateBVReport,
	formatBVReportMarkdown,
};
