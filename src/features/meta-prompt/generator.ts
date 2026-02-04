/**
 * Meta-prompt Generator
 *
 * Generates prompts for teams, plans, tasks, and agents using templates.
 * Supports loading templates from filesystem and converting domain objects
 * to template contexts.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import type { TemplateContext, Template } from './types.js';
import type { TeamDefinition, TeamMember } from '../team/types.js';
import type { DecompositionResult, Subtask, Component } from '../task-decomposer/types.js';
import { TemplateEngine } from './index.js';

/**
 * Generator configuration
 */
export interface GeneratorConfig {
	/** Path to templates directory */
	templatesDir: string;
	/** Default values for template context */
	defaults?: TemplateContext;
	/** Whether to include metadata comments in output */
	includeMetadata?: boolean;
}

/**
 * Generated prompt with metadata
 */
export interface GeneratedPrompt {
	/** Generated prompt content */
	content: string;
	/** Template used */
	templateName: string;
	/** Context used for generation */
	context: TemplateContext;
	/** Generation timestamp */
	generatedAt: number;
	/** Any warnings during generation */
	warnings?: string[];
}

/**
 * Team prompt generation options
 */
export interface TeamPromptOptions {
	includeEscalation?: boolean;
	includeNotes?: boolean;
	validationTypeOverride?: 'self-only' | 'validator' | 'architect';
}

/**
 * Plan prompt generation options
 */
export interface PlanPromptOptions {
	includeRisks?: boolean;
	includeExecutionOrder?: boolean;
	detailLevel?: 'summary' | 'detailed' | 'full';
}

/**
 * Task prompt generation options
 */
export interface TaskPromptOptions {
	includeOutputSchema?: boolean;
	includeVerificationSteps?: boolean;
	contextFromPlan?: string;
}

/**
 * Agent prompt generation options
 */
export interface AgentPromptOptions {
	includeExamples?: boolean;
	includeWorkflow?: boolean;
	customConstraints?: string[];
}

/**
 * Convert TeamDefinition to template context
 */
export function teamToContext(
	team: TeamDefinition,
	options?: TeamPromptOptions
): TemplateContext {
	const members = team.members.map((m) => ({
		id: m.id,
		agentType: m.agentType,
		role: m.role,
		modelTier: m.modelTier,
		capabilities: m.capabilities,
		maxConcurrentTasks: m.maxConcurrentTasks,
		status: m.status,
	}));

	const context: TemplateContext = {
		teamId: team.id,
		teamName: team.name,
		teamDescription: team.description,
		members,
		memberCount: members.length,
		defaultValidationType:
			options?.validationTypeOverride ?? team.defaultValidationType,
		config: {
			maxRetries: team.config.maxRetries,
			taskTimeout: team.config.taskTimeout,
			parallelExecution: team.config.parallelExecution,
			maxParallelTasks: team.config.maxParallelTasks,
		},
	};

	if (options?.includeEscalation) {
		context.escalationPolicy = {
			coordinatorThreshold: team.config.escalationPolicy.coordinatorThreshold,
			architectThreshold: team.config.escalationPolicy.architectThreshold,
			humanThreshold: team.config.escalationPolicy.humanThreshold,
			autoEscalateOnSecurity:
				team.config.escalationPolicy.autoEscalateOnSecurity,
		};
	}

	return context;
}

/**
 * Convert DecompositionResult to plan context
 */
export function decompositionToPlanContext(
	planName: string,
	decomposition: DecompositionResult,
	options?: PlanPromptOptions
): TemplateContext {
	const context: TemplateContext = {
		planName,
		taskDescription: decomposition.analysis.task,
		taskType: decomposition.analysis.type,
		complexity: decomposition.analysis.complexity,
		isParallelizable: decomposition.analysis.isParallelizable,
		strategy: decomposition.strategy,
		componentCount: decomposition.components.length,
		subtaskCount: decomposition.subtasks.length,
		technologies: decomposition.analysis.technologies,
		areas: decomposition.analysis.areas,
	};

	// Add components
	context.components = decomposition.components.map((c) => ({
		id: c.id,
		name: c.name,
		role: c.role,
		description: c.description,
		canParallelize: c.canParallelize,
		dependencies: c.dependencies,
		effort: c.effort,
	}));

	// Add subtasks (summary level by default)
	const detailLevel = options?.detailLevel ?? 'summary';
	context.subtasks = decomposition.subtasks.map((s) => {
		const base: TemplateContext = {
			id: s.id,
			name: s.name,
			agentType: s.agentType,
			modelTier: s.modelTier,
			blockedBy: s.blockedBy,
		};

		if (detailLevel === 'detailed' || detailLevel === 'full') {
			base.acceptanceCriteria = s.acceptanceCriteria;
			base.componentRole = s.component.role;
		}

		if (detailLevel === 'full') {
			base.prompt = s.prompt;
			base.verification = s.verification;
			base.ownership = {
				patterns: s.ownership.patterns,
				files: s.ownership.files,
			};
		}

		return base;
	});

	// Include execution order if requested
	if (options?.includeExecutionOrder) {
		context.executionOrder = decomposition.executionOrder;
		context.executionPhases = decomposition.executionOrder.map(
			(phase, index) => ({
				phase: index + 1,
				tasks: phase,
				canParallelize: phase.length > 1,
			})
		);
	}

	// Include risks/warnings if requested
	if (options?.includeRisks && decomposition.warnings.length > 0) {
		context.warnings = decomposition.warnings;
		context.hasWarnings = true;
	}

	// Include shared files info
	if (decomposition.sharedFiles.length > 0) {
		context.sharedFiles = decomposition.sharedFiles.map((sf) => ({
			pattern: sf.pattern,
			reason: sf.reason,
			sharedBy: sf.sharedBy,
			requiresOrchestration: sf.requiresOrchestration,
		}));
		context.hasSharedFiles = true;
	}

	return context;
}

/**
 * Convert Subtask to task context
 */
export function subtaskToTaskContext(
	subtask: Subtask,
	assignedAgent: string,
	options?: TaskPromptOptions
): TemplateContext {
	const context: TemplateContext = {
		taskId: subtask.id,
		taskName: subtask.name,
		assignedAgent,
		agentType: subtask.agentType,
		modelTier: subtask.modelTier,
		prompt: subtask.prompt,
		acceptanceCriteria: subtask.acceptanceCriteria,
		blockedBy: subtask.blockedBy,
		isBlocked: subtask.blockedBy.length > 0,
		component: {
			id: subtask.component.id,
			name: subtask.component.name,
			role: subtask.component.role,
			description: subtask.component.description,
		},
		ownership: {
			patterns: subtask.ownership.patterns,
			files: subtask.ownership.files,
			potentialConflicts: subtask.ownership.potentialConflicts,
		},
	};

	if (options?.includeVerificationSteps) {
		context.verification = subtask.verification;
		context.hasVerification = subtask.verification.length > 0;
	}

	if (options?.includeOutputSchema) {
		context.outputSchema = {
			required: ['status', 'summary', 'filesChanged'],
			format: 'AgentOutput',
		};
	}

	if (options?.contextFromPlan) {
		context.planContext = options.contextFromPlan;
	}

	// Include validation info if present
	if (subtask.validation) {
		context.validation = {
			validationType: subtask.validation.validationType,
			validatorAgent: subtask.validation.validatorAgent,
			maxRetries: subtask.validation.maxRetries,
			evidenceRequired: subtask.validation.evidenceRequired,
		};
	}

	return context;
}

/**
 * Create agent context from parameters
 */
export function createAgentContext(
	agentName: string,
	role: string,
	capabilities: string[],
	options?: AgentPromptOptions
): TemplateContext {
	const context: TemplateContext = {
		agentName,
		agentRole: role,
		capabilities,
		capabilityCount: capabilities.length,
	};

	if (options?.customConstraints && options.customConstraints.length > 0) {
		context.constraints = options.customConstraints;
		context.hasConstraints = true;
	}

	if (options?.includeWorkflow) {
		context.includeWorkflow = true;
	}

	if (options?.includeExamples) {
		context.includeExamples = true;
	}

	return context;
}

/**
 * Load template file from disk
 */
export async function loadTemplateFile(filePath: string): Promise<string> {
	try {
		const content = await readFile(filePath, 'utf-8');
		return content;
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to load template file ${filePath}: ${errorMessage}`);
	}
}

/**
 * Load all templates from directory
 */
export async function loadAllTemplates(
	templatesDir: string
): Promise<Map<string, string>> {
	const templates = new Map<string, string>();

	try {
		const files = await readdir(templatesDir);
		const templateFiles = files.filter(
			(f) => extname(f) === '.tpl' || extname(f) === '.template'
		);

		for (const file of templateFiles) {
			const filePath = join(templatesDir, file);
			const content = await loadTemplateFile(filePath);
			const name = basename(file, extname(file));
			templates.set(name, content);
		}
	} catch (error) {
		// Directory doesn't exist or can't be read - return empty map
		// Caller should handle this case appropriately
	}

	return templates;
}

/**
 * Meta-prompt Generator class
 */
export class MetaPromptGenerator {
	private engine: TemplateEngine;
	private config: GeneratorConfig;
	private templatesLoaded: boolean = false;
	private loadWarnings: string[] = [];

	constructor(config: GeneratorConfig) {
		this.config = config;
		this.engine = new TemplateEngine();
	}

	/**
	 * Load templates from directory
	 */
	async loadTemplates(): Promise<void> {
		this.loadWarnings = [];

		const templates = await loadAllTemplates(this.config.templatesDir);

		if (templates.size === 0) {
			this.loadWarnings.push(
				`No templates found in ${this.config.templatesDir}`
			);
		}

		for (const [name, source] of templates) {
			this.engine.register(name, source);
		}

		// Register built-in templates if not overridden
		this.registerBuiltinTemplates();

		this.templatesLoaded = true;
	}

	/**
	 * Register built-in templates for common use cases
	 */
	private registerBuiltinTemplates(): void {
		// Team template
		if (!this.engine.has('team')) {
			this.engine.register(
				'team',
				`# Team: {{teamName}}

{{teamDescription}}

## Configuration
- Validation Type: {{defaultValidationType}}
- Parallel Execution: {{config.parallelExecution}}
- Max Parallel Tasks: {{config.maxParallelTasks}}
- Task Timeout: {{config.taskTimeout}}ms

## Members ({{memberCount}})
{{#each members as member}}
### {{member.id}}
- Agent Type: {{member.agentType}}
- Role: {{member.role}}
- Model Tier: {{member.modelTier}}
- Capabilities: {{member.capabilities | join ", "}}
{{/each}}
{{#if escalationPolicy}}

## Escalation Policy
- Coordinator Threshold: {{escalationPolicy.coordinatorThreshold}} retries
- Architect Threshold: {{escalationPolicy.architectThreshold}} retries
- Human Threshold: {{escalationPolicy.humanThreshold}} retries
- Auto-escalate on Security: {{escalationPolicy.autoEscalateOnSecurity}}
{{/if}}`,
				'Team definition prompt template'
			);
		}

		// Plan template
		if (!this.engine.has('plan')) {
			this.engine.register(
				'plan',
				`# Work Plan: {{planName}}

## Task Overview
{{taskDescription}}

- Type: {{taskType}}
- Complexity: {{complexity}}
- Parallelizable: {{isParallelizable}}

## Strategy
{{strategy}}

## Components ({{componentCount}})
{{#each components as comp}}
### {{comp.name}} ({{comp.role}})
{{comp.description}}
- Effort: {{comp.effort}}
- Can Parallelize: {{comp.canParallelize}}
{{#if comp.dependencies}}- Dependencies: {{comp.dependencies | join ", "}}{{/if}}
{{/each}}

## Subtasks ({{subtaskCount}})
{{#each subtasks as task}}
### {{task.name}}
- ID: {{task.id}}
- Agent: {{task.agentType}} ({{task.modelTier}})
{{#if task.blockedBy}}- Blocked By: {{task.blockedBy | join ", "}}{{/if}}
{{/each}}
{{#if executionOrder}}

## Execution Order
{{#each executionPhases as phase}}
### Phase {{phase.phase}}{{#if phase.canParallelize}} (parallel){{/if}}
{{#each phase.tasks as taskId}}
- {{taskId}}
{{/each}}
{{/each}}
{{/if}}
{{#if hasWarnings}}

## Warnings
{{#each warnings as warning}}
- {{warning}}
{{/each}}
{{/if}}
{{#if hasSharedFiles}}

## Shared Files (Require Orchestration)
{{#each sharedFiles as sf}}
- {{sf.pattern}}: {{sf.reason}}
{{/each}}
{{/if}}`,
				'Work plan prompt template'
			);
		}

		// Task template
		if (!this.engine.has('task')) {
			this.engine.register(
				'task',
				`# Task Assignment: {{taskName}}

## Details
- Task ID: {{taskId}}
- Assigned To: {{assignedAgent}}
- Agent Type: {{agentType}}
- Model Tier: {{modelTier}}
{{#if isBlocked}}
- BLOCKED BY: {{blockedBy | join ", "}}
{{/if}}

## Component
- Name: {{component.name}}
- Role: {{component.role}}
- Description: {{component.description}}

## Instructions
{{prompt}}

## File Ownership
{{#if ownership.patterns}}
### Patterns
{{#each ownership.patterns as pattern}}
- {{pattern}}
{{/each}}
{{/if}}
{{#if ownership.files}}
### Specific Files
{{#each ownership.files as file}}
- {{file}}
{{/each}}
{{/if}}
{{#if ownership.potentialConflicts}}
### Potential Conflicts
{{#each ownership.potentialConflicts as conflict}}
- {{conflict}}
{{/each}}
{{/if}}

## Acceptance Criteria
{{#each acceptanceCriteria as criterion}}
- [ ] {{criterion}}
{{/each}}
{{#if hasVerification}}

## Verification Steps
{{#each verification as step}}
{{@index}}. {{step}}
{{/each}}
{{/if}}
{{#if validation}}

## Validation Requirements
- Type: {{validation.validationType}}
{{#if validation.validatorAgent}}- Validator: {{validation.validatorAgent}}{{/if}}
- Max Retries: {{validation.maxRetries}}
- Evidence Required: {{validation.evidenceRequired | join ", "}}
{{/if}}
{{#if planContext}}

## Plan Context
{{planContext}}
{{/if}}`,
				'Task assignment prompt template'
			);
		}

		// Agent template
		if (!this.engine.has('agent')) {
			this.engine.register(
				'agent',
				`# Agent: {{agentName}}

## Role
{{agentRole}}

## Capabilities
{{#each capabilities as cap}}
- {{cap}}
{{/each}}
{{#if hasConstraints}}

## Constraints
{{#each constraints as constraint}}
- {{constraint}}
{{/each}}
{{/if}}
{{#if includeWorkflow}}

## Workflow
1. Receive task assignment
2. Analyze requirements
3. Execute implementation
4. Self-validate results
5. Report completion with evidence
{{/if}}
{{#if includeExamples}}

## Example Output Format
\`\`\`json
{
  "status": "completed",
  "summary": "Description of work done",
  "filesChanged": ["path/to/file.ts"],
  "evidence": { "type": "test_pass", "details": "..." }
}
\`\`\`
{{/if}}`,
				'Agent definition prompt template'
			);
		}

		// Validation cycle template
		if (!this.engine.has('validation-cycle')) {
			this.engine.register(
				'validation-cycle',
				`# Validation Cycle: {{cycleId}}

## Task: {{taskId}}
Validation Type: {{validationType}}

{{#if builderResult}}
## Builder Result
{{builderResult | json}}
{{/if}}

{{#if validatorResults}}
## Validator Results
{{#each validatorResults as result}}
### Validator {{@index}}
{{result | json}}
{{/each}}
{{/if}}

## Instructions
Review the builder's work and validator feedback. Determine if the task meets requirements.`,
				'Validation cycle prompt template'
			);
		}

		// Coordinator report template
		if (!this.engine.has('coordinator-report')) {
			this.engine.register(
				'coordinator-report',
				`# Coordinator Report: {{workflowId}}

## Results Summary
Total Tasks: {{totalTasks}}
Completed: {{completedTasks}}
Failed: {{failedTasks}}

{{#each results as result}}
### Task {{@index}}
{{result | json}}
{{/each}}`,
				'Coordinator report prompt template'
			);
		}

		// Workflow progress template
		if (!this.engine.has('workflow-progress')) {
			this.engine.register(
				'workflow-progress',
				`# Workflow Progress: {{workflowId}}

## Status
- Total: {{progress.total}}
- Completed: {{progress.completed}}
- Failed: {{progress.failed}}
- Running: {{progress.running}}
- Remaining: {{remaining}}

## Completion
{{completionPercent}}%

{{#if tasks}}
## Task Details
{{#each tasks as task}}
- {{task.name}}: {{task.status}}
{{/each}}
{{/if}}`,
				'Workflow progress prompt template'
			);
		}
	}

	/**
	 * Ensure templates are loaded
	 */
	private ensureLoaded(): void {
		if (!this.templatesLoaded) {
			// Register builtin templates synchronously if not loaded
			this.registerBuiltinTemplates();
			this.templatesLoaded = true;
		}
	}

	/**
	 * Create GeneratedPrompt from rendered content
	 */
	private createGeneratedPrompt(
		content: string,
		templateName: string,
		context: TemplateContext,
		additionalWarnings?: string[]
	): GeneratedPrompt {
		const warnings = [...this.loadWarnings, ...(additionalWarnings ?? [])];

		let finalContent = content;

		if (this.config.includeMetadata) {
			const metadataComment = `<!-- Generated by MetaPromptGenerator
Template: ${templateName}
Generated: ${new Date().toISOString()}
-->

`;
			finalContent = metadataComment + content;
		}

		return {
			content: finalContent,
			templateName,
			context,
			generatedAt: Date.now(),
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	}

	/**
	 * Merge defaults with context
	 */
	private mergeWithDefaults(context: TemplateContext): TemplateContext {
		if (!this.config.defaults) {
			return context;
		}
		return { ...this.config.defaults, ...context };
	}

	/**
	 * Generate team definition prompt
	 */
	generateTeamPrompt(
		team: TeamDefinition,
		options?: TeamPromptOptions
	): GeneratedPrompt {
		this.ensureLoaded();

		const context = this.mergeWithDefaults(teamToContext(team, options));

		const content = this.engine.render('team', context);

		return this.createGeneratedPrompt(content, 'team', context);
	}

	/**
	 * Generate work plan prompt
	 */
	generatePlanPrompt(
		planName: string,
		decomposition: DecompositionResult,
		options?: PlanPromptOptions
	): GeneratedPrompt {
		this.ensureLoaded();

		const context = this.mergeWithDefaults(
			decompositionToPlanContext(planName, decomposition, options)
		);

		const content = this.engine.render('plan', context);

		return this.createGeneratedPrompt(content, 'plan', context);
	}

	/**
	 * Generate task assignment prompt
	 */
	generateTaskPrompt(
		subtask: Subtask,
		assignedAgent: string,
		options?: TaskPromptOptions
	): GeneratedPrompt {
		this.ensureLoaded();

		const context = this.mergeWithDefaults(
			subtaskToTaskContext(subtask, assignedAgent, options)
		);

		const content = this.engine.render('task', context);

		return this.createGeneratedPrompt(content, 'task', context);
	}

	/**
	 * Generate agent prompt
	 */
	generateAgentPrompt(
		agentName: string,
		role: string,
		capabilities: string[],
		options?: AgentPromptOptions
	): GeneratedPrompt {
		this.ensureLoaded();

		const context = this.mergeWithDefaults(
			createAgentContext(agentName, role, capabilities, options)
		);

		const content = this.engine.render('agent', context);

		return this.createGeneratedPrompt(content, 'agent', context);
	}

	/**
	 * Generate validation cycle prompt
	 */
	generateValidationCyclePrompt(
		cycleId: string,
		taskId: string,
		validationType: string,
		builderResult?: unknown,
		validatorResults?: unknown[]
	): GeneratedPrompt {
		this.ensureLoaded();

		const context = this.mergeWithDefaults({
			cycleId,
			taskId,
			validationType,
			builderResult,
			validatorResults,
		});

		const content = this.engine.render('validation-cycle', context);

		return this.createGeneratedPrompt(content, 'validation-cycle', context);
	}

	/**
	 * Generate coordinator report prompt
	 */
	generateCoordinatorReportPrompt(
		workflowId: string,
		results: unknown[]
	): GeneratedPrompt {
		this.ensureLoaded();

		const totalTasks = results.length;
		const completedTasks = results.filter(
			(r) =>
				r &&
				typeof r === 'object' &&
				'status' in r &&
				(r as { status: string }).status === 'completed'
		).length;
		const failedTasks = results.filter(
			(r) =>
				r &&
				typeof r === 'object' &&
				'status' in r &&
				(r as { status: string }).status === 'failed'
		).length;

		const context = this.mergeWithDefaults({
			workflowId,
			results,
			totalTasks,
			completedTasks,
			failedTasks,
		});

		const content = this.engine.render('coordinator-report', context);

		return this.createGeneratedPrompt(content, 'coordinator-report', context);
	}

	/**
	 * Generate workflow progress prompt
	 */
	generateWorkflowProgressPrompt(
		workflowId: string,
		progress: {
			total: number;
			completed: number;
			failed: number;
			running: number;
		},
		tasks: unknown[]
	): GeneratedPrompt {
		this.ensureLoaded();

		const remaining = progress.total - progress.completed - progress.failed;
		const completionPercent =
			progress.total > 0
				? Math.round((progress.completed / progress.total) * 100)
				: 0;

		const context = this.mergeWithDefaults({
			workflowId,
			progress,
			tasks,
			remaining,
			completionPercent,
		});

		const content = this.engine.render('workflow-progress', context);

		return this.createGeneratedPrompt(content, 'workflow-progress', context);
	}

	/**
	 * Generate custom prompt using any template
	 */
	generateCustomPrompt(
		templateName: string,
		context: TemplateContext
	): GeneratedPrompt {
		this.ensureLoaded();

		const warnings: string[] = [];

		if (!this.engine.has(templateName)) {
			warnings.push(`Template '${templateName}' not found, using direct render`);
			// Try to render directly if template source is in context
			if (typeof context._templateSource === 'string') {
				const content = this.engine.renderDirect(
					context._templateSource as string,
					context
				);
				return this.createGeneratedPrompt(
					content,
					templateName,
					context,
					warnings
				);
			}
			throw new Error(`Template not found: ${templateName}`);
		}

		const mergedContext = this.mergeWithDefaults(context);
		const content = this.engine.render(templateName, mergedContext);

		return this.createGeneratedPrompt(
			content,
			templateName,
			mergedContext,
			warnings
		);
	}

	/**
	 * Batch generate multiple prompts
	 */
	generateBatch(
		requests: Array<{
			type: 'team' | 'plan' | 'task' | 'agent' | 'custom';
			data: unknown;
			options?: unknown;
		}>
	): GeneratedPrompt[] {
		this.ensureLoaded();

		return requests.map((request) => {
			switch (request.type) {
				case 'team':
					return this.generateTeamPrompt(
						request.data as TeamDefinition,
						request.options as TeamPromptOptions | undefined
					);

				case 'plan': {
					const planData = request.data as {
						planName: string;
						decomposition: DecompositionResult;
					};
					return this.generatePlanPrompt(
						planData.planName,
						planData.decomposition,
						request.options as PlanPromptOptions | undefined
					);
				}

				case 'task': {
					const taskData = request.data as {
						subtask: Subtask;
						assignedAgent: string;
					};
					return this.generateTaskPrompt(
						taskData.subtask,
						taskData.assignedAgent,
						request.options as TaskPromptOptions | undefined
					);
				}

				case 'agent': {
					const agentData = request.data as {
						agentName: string;
						role: string;
						capabilities: string[];
					};
					return this.generateAgentPrompt(
						agentData.agentName,
						agentData.role,
						agentData.capabilities,
						request.options as AgentPromptOptions | undefined
					);
				}

				case 'custom': {
					const customData = request.data as {
						templateName: string;
						context: TemplateContext;
					};
					return this.generateCustomPrompt(
						customData.templateName,
						customData.context
					);
				}

				default:
					throw new Error(`Unknown request type: ${request.type}`);
			}
		});
	}

	/**
	 * Register a custom template
	 */
	registerTemplate(name: string, source: string, description?: string): void {
		this.engine.register(name, source, description);
	}

	/**
	 * Check if a template exists
	 */
	hasTemplate(name: string): boolean {
		this.ensureLoaded();
		return this.engine.has(name);
	}

	/**
	 * List available templates
	 */
	listTemplates(): string[] {
		this.ensureLoaded();
		return this.engine.list().map((m) => m.name);
	}

	/**
	 * Get the underlying template engine
	 */
	getEngine(): TemplateEngine {
		return this.engine;
	}
}
