/**
 * Team Auto-Composer
 *
 * Automatically composes teams based on task analysis and templates.
 * Uses task complexity, type, and required capabilities to select
 * the optimal team configuration.
 */

import type {
	TeamDefinition,
	TeamMember,
	TeamTemplate,
	TeamConfig,
	TeamRole,
	AgentCapability,
} from './types.js';
import type {
	TaskAnalysis,
	DecompositionResult,
	Subtask,
} from '../task-decomposer/types.js';
import type { MetaPromptGenerator, GeneratedPrompt } from '../meta-prompt/generator.js';
import {
	createTeamFromTemplate,
	createTeam,
	createTeamMember,
	getDefaultCapabilities,
	getRecommendedModelTier,
	DEFAULT_TEAM_CONFIG,
} from './index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Team composition request
 */
export interface CompositionRequest {
	/** Task analysis from decomposer */
	analysis: TaskAnalysis;
	/** Decomposition result (optional, for detailed composition) */
	decomposition?: DecompositionResult;
	/** Preferred template (optional) */
	preferredTemplate?: TeamTemplate;
	/** Custom constraints */
	constraints?: CompositionConstraints;
}

/**
 * Composition constraints
 */
export interface CompositionConstraints {
	/** Maximum team size */
	maxMembers?: number;
	/** Minimum team size */
	minMembers?: number;
	/** Required capabilities */
	requiredCapabilities?: AgentCapability[];
	/** Required roles */
	requiredRoles?: TeamRole[];
	/** Excluded agent types */
	excludedAgents?: string[];
	/** Validation type override */
	validationType?: 'self-only' | 'validator' | 'architect';
	/** Model tier limit (max tier allowed) */
	maxModelTier?: 'low' | 'medium' | 'high';
}

/**
 * Composition result
 */
export interface CompositionResult {
	/** Generated team */
	team: TeamDefinition;
	/** Template used */
	templateUsed: TeamTemplate;
	/** Why this composition was chosen */
	reasoning: string;
	/** Generated prompts for team members */
	memberPrompts: Map<string, GeneratedPrompt>;
	/** Warnings or recommendations */
	warnings?: string[];
	/** Composition score (0-1, how well it matches requirements) */
	score: number;
}

/**
 * Requirements analysis result
 */
export interface RequirementsAnalysis {
	needsDesigner: boolean;
	needsSecurityReview: boolean;
	needsArchitect: boolean;
	needsDocumentation: boolean;
	estimatedTeamSize: number;
	recommendedValidation: 'self-only' | 'validator' | 'architect';
}

/**
 * Agent mapping result
 */
export interface AgentMapping {
	agentType: string;
	modelTier: 'low' | 'medium' | 'high';
	role: TeamRole;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Keywords that indicate need for designer
 */
const DESIGNER_KEYWORDS = [
	'ui',
	'ux',
	'frontend',
	'component',
	'design',
	'style',
	'css',
	'layout',
	'responsive',
	'visual',
	'interface',
	'react',
	'vue',
	'svelte',
	'angular',
];

/**
 * Keywords that indicate need for security review
 */
const SECURITY_KEYWORDS = [
	'security',
	'auth',
	'authentication',
	'authorization',
	'encrypt',
	'password',
	'token',
	'jwt',
	'oauth',
	'permission',
	'access control',
	'vulnerability',
	'sanitize',
	'xss',
	'csrf',
	'sql injection',
];

/**
 * Keywords that indicate need for architect
 */
const ARCHITECT_KEYWORDS = [
	'architecture',
	'refactor',
	'restructure',
	'redesign',
	'migrate',
	'scalab',
	'performance',
	'optimize',
	'system design',
	'infrastructure',
	'microservice',
	'monolith',
	'pattern',
];

/**
 * Keywords that indicate need for documentation
 */
const DOCUMENTATION_KEYWORDS = [
	'document',
	'readme',
	'api docs',
	'jsdoc',
	'tsdoc',
	'comment',
	'wiki',
	'guide',
	'tutorial',
	'specification',
];

/**
 * Task type to template mapping
 */
const TASK_TYPE_TEMPLATE_MAP: Record<string, TeamTemplate> = {
	'fullstack-app': 'fullstack',
	'bug-fix': 'standard',
	optimization: 'standard',
	refactoring: 'robust',
	migration: 'robust',
	feature: 'standard', // Will be adjusted by complexity
	testing: 'standard',
	documentation: 'minimal',
	infrastructure: 'secure',
	unknown: 'standard',
};

/**
 * Model tier hierarchy for comparison
 */
const TIER_ORDER: Record<'low' | 'medium' | 'high', number> = {
	low: 1,
	medium: 2,
	high: 3,
};

// ============================================================================
// Team Auto-Composer Class
// ============================================================================

/**
 * Team Auto-Composer class
 *
 * Automatically composes teams based on task analysis and templates.
 */
export class TeamAutoComposer {
	private generator?: MetaPromptGenerator;

	constructor(generator?: MetaPromptGenerator) {
		this.generator = generator;
	}

	/**
	 * Set the meta-prompt generator
	 */
	setGenerator(generator: MetaPromptGenerator): void {
		this.generator = generator;
	}

	/**
	 * Compose team from task analysis
	 */
	composeTeam(request: CompositionRequest): CompositionResult {
		const warnings: string[] = [];

		// Step 1: Recommend best template
		const templateRecommendation = this.recommendTemplate(request.analysis);
		let template = request.preferredTemplate ?? templateRecommendation.template;

		// Step 2: Create base team from template
		const teamId = `team-${Date.now()}`;
		const teamName = `Auto-composed team for ${request.analysis.type}`;
		let team = createTeamFromTemplate(template, teamId, teamName);

		// Step 3: Analyze requirements for specialists
		const requirements = analyzeRequirements(request.analysis);

		// Step 4: Add specialists based on analysis
		team = addSpecialists(team, request.analysis);

		// Step 5: Apply constraints
		if (request.constraints) {
			const validationResult = this.validateComposition(team, request.constraints);

			if (!validationResult.valid) {
				// Try to balance team to meet constraints
				team = balanceTeam(team, request.constraints);
				warnings.push(...validationResult.violations);
			}

			// Apply validation type override
			if (request.constraints.validationType) {
				team = {
					...team,
					defaultValidationType: request.constraints.validationType,
				};
			}

			// Apply model tier limit
			if (request.constraints.maxModelTier) {
				team = this.applyModelTierLimit(team, request.constraints.maxModelTier);
			}
		}

		// Step 6: Optimize team for task
		team = this.optimizeTeam(team, request.analysis);

		// Step 7: Generate member prompts
		const memberPrompts = this.generateMemberPrompts(team);

		// Step 8: Calculate fitness score
		const score = this.calculateFitnessScore(team, request.analysis);

		// Build reasoning
		const reasoning = this.buildReasoning(
			template,
			templateRecommendation,
			requirements,
			request.constraints
		);

		return {
			team,
			templateUsed: template,
			reasoning,
			memberPrompts,
			warnings: warnings.length > 0 ? warnings : undefined,
			score,
		};
	}

	/**
	 * Recommend best template for task
	 */
	recommendTemplate(analysis: TaskAnalysis): {
		template: TeamTemplate;
		score: number;
		reasoning: string;
	} {
		// First, try by task type
		const typeTemplate = selectTemplateByTaskType(analysis.type);

		// Then, adjust by complexity
		const complexityTemplate = selectTemplateByComplexity(analysis.complexity);

		// Extract required capabilities
		const requiredCapabilities = extractRequiredCapabilities(analysis);
		const capabilityTemplate = selectTemplateByCapabilities(requiredCapabilities);

		// Weighted decision
		// For feature tasks, complexity matters more
		// For specific types like fullstack-app, type matters more
		let finalTemplate: TeamTemplate;
		let reasoning: string;

		if (analysis.type === 'fullstack-app') {
			finalTemplate = 'fullstack';
			reasoning = 'Task type fullstack-app requires fullstack team';
		} else if (analysis.type === 'documentation') {
			finalTemplate = 'minimal';
			reasoning = 'Documentation tasks require minimal team';
		} else if (analysis.complexity >= 0.9) {
			finalTemplate = 'fullstack';
			reasoning = `Very high complexity (${analysis.complexity.toFixed(2)}) requires fullstack team`;
		} else if (analysis.complexity >= 0.7) {
			finalTemplate = capabilityTemplate === 'secure' ? 'secure' : 'robust';
			reasoning = `High complexity (${analysis.complexity.toFixed(2)}) with ${requiredCapabilities.length} capabilities`;
		} else if (analysis.complexity >= 0.5) {
			finalTemplate = 'robust';
			reasoning = `Medium complexity (${analysis.complexity.toFixed(2)}) benefits from dual validation`;
		} else if (analysis.complexity >= 0.3) {
			finalTemplate = 'standard';
			reasoning = `Low-medium complexity (${analysis.complexity.toFixed(2)}) suitable for standard team`;
		} else {
			finalTemplate = 'minimal';
			reasoning = `Low complexity (${analysis.complexity.toFixed(2)}) suitable for minimal team`;
		}

		// Calculate match score
		const score = this.calculateTemplateScore(finalTemplate, analysis);

		return {
			template: finalTemplate,
			score,
			reasoning,
		};
	}

	/**
	 * Generate member prompts for team
	 */
	generateMemberPrompts(team: TeamDefinition): Map<string, GeneratedPrompt> {
		const prompts = new Map<string, GeneratedPrompt>();

		if (!this.generator) {
			// Return empty map if no generator
			return prompts;
		}

		for (const member of team.members) {
			const prompt = this.generator.generateAgentPrompt(
				member.agentType,
				member.role,
				member.capabilities,
				{
					includeWorkflow: true,
					includeExamples: true,
				}
			);
			prompts.set(member.id, prompt);
		}

		return prompts;
	}

	/**
	 * Validate composed team against constraints
	 */
	validateComposition(
		team: TeamDefinition,
		constraints?: CompositionConstraints
	): {
		valid: boolean;
		violations: string[];
		suggestions: string[];
	} {
		const violations: string[] = [];
		const suggestions: string[] = [];

		if (!constraints) {
			return { valid: true, violations, suggestions };
		}

		// Check team size
		if (constraints.maxMembers && team.members.length > constraints.maxMembers) {
			violations.push(
				`Team has ${team.members.length} members, exceeds max of ${constraints.maxMembers}`
			);
			suggestions.push('Consider using a simpler template or removing specialists');
		}

		if (constraints.minMembers && team.members.length < constraints.minMembers) {
			violations.push(
				`Team has ${team.members.length} members, below min of ${constraints.minMembers}`
			);
			suggestions.push('Consider adding more builders or validators');
		}

		// Check required capabilities
		if (constraints.requiredCapabilities) {
			const teamCapabilities = new Set<AgentCapability>();
			for (const member of team.members) {
				for (const cap of member.capabilities) {
					teamCapabilities.add(cap);
				}
			}

			for (const required of constraints.requiredCapabilities) {
				if (!teamCapabilities.has(required)) {
					violations.push(`Missing required capability: ${required}`);
					suggestions.push(`Add an agent with ${required} capability`);
				}
			}
		}

		// Check required roles
		if (constraints.requiredRoles) {
			const teamRoles = new Set(team.members.map((m) => m.role));

			for (const required of constraints.requiredRoles) {
				if (!teamRoles.has(required)) {
					violations.push(`Missing required role: ${required}`);
					suggestions.push(`Add a team member with ${required} role`);
				}
			}
		}

		// Check excluded agents
		if (constraints.excludedAgents) {
			for (const member of team.members) {
				if (constraints.excludedAgents.includes(member.agentType)) {
					violations.push(`Team contains excluded agent type: ${member.agentType}`);
					suggestions.push(`Replace ${member.agentType} with an alternative`);
				}
			}
		}

		return {
			valid: violations.length === 0,
			violations,
			suggestions,
		};
	}

	/**
	 * Optimize team for task
	 */
	optimizeTeam(team: TeamDefinition, analysis: TaskAnalysis): TeamDefinition {
		let optimized = { ...team, members: [...team.members] };

		// Optimization 1: Remove duplicate capabilities if over-provisioned
		if (optimized.members.length > 5) {
			optimized = this.deduplicateCapabilities(optimized);
		}

		// Optimization 2: Adjust model tiers based on complexity
		if (analysis.complexity < 0.3) {
			// Downgrade non-essential members for simple tasks
			optimized = {
				...optimized,
				members: optimized.members.map((member) => {
					if (member.role === 'validator' && member.modelTier === 'high') {
						return { ...member, modelTier: 'medium' as const };
					}
					return member;
				}),
			};
		}

		// Optimization 3: Ensure parallel task capacity matches subtask count
		if (analysis.estimatedComponents > 1 && !optimized.config.parallelExecution) {
			optimized = {
				...optimized,
				config: {
					...optimized.config,
					parallelExecution: true,
					maxParallelTasks: Math.min(analysis.estimatedComponents, 5),
				},
			};
		}

		return optimized;
	}

	/**
	 * Calculate team fitness score
	 */
	calculateFitnessScore(team: TeamDefinition, analysis: TaskAnalysis): number {
		let score = 1.0;
		const penalties: number[] = [];
		const bonuses: number[] = [];

		// Check capability coverage
		const requiredCapabilities = extractRequiredCapabilities(analysis);
		const teamCapabilities = new Set<AgentCapability>();
		for (const member of team.members) {
			for (const cap of member.capabilities) {
				teamCapabilities.add(cap);
			}
		}

		const coveredCapabilities = requiredCapabilities.filter((cap) =>
			teamCapabilities.has(cap)
		);
		const capabilityCoverage = requiredCapabilities.length > 0
			? coveredCapabilities.length / requiredCapabilities.length
			: 1.0;

		if (capabilityCoverage < 1.0) {
			penalties.push(0.2 * (1 - capabilityCoverage)); // Up to 20% penalty
		}

		// Check validation level appropriateness
		const recommendedValidation = analyzeRequirements(analysis).recommendedValidation;
		if (team.defaultValidationType !== recommendedValidation) {
			// Minor penalty if validation type differs
			if (
				team.defaultValidationType === 'self-only' &&
				recommendedValidation !== 'self-only'
			) {
				penalties.push(0.15); // Under-validated
			} else if (
				team.defaultValidationType === 'architect' &&
				recommendedValidation === 'self-only'
			) {
				penalties.push(0.05); // Over-validated (minor)
			}
		}

		// Check team size appropriateness
		const requirements = analyzeRequirements(analysis);
		const sizeRatio = team.members.length / requirements.estimatedTeamSize;

		if (sizeRatio < 0.5) {
			penalties.push(0.15); // Significantly under-staffed
		} else if (sizeRatio > 2.0) {
			penalties.push(0.1); // Significantly over-staffed
		}

		// Bonuses for good matches
		if (capabilityCoverage === 1.0) {
			bonuses.push(0.05); // Full capability coverage bonus
		}

		if (team.config.parallelExecution && analysis.isParallelizable) {
			bonuses.push(0.03); // Parallel execution match
		}

		// Apply penalties and bonuses
		for (const penalty of penalties) {
			score -= penalty;
		}
		for (const bonus of bonuses) {
			score += bonus;
		}

		// Clamp to [0, 1]
		return Math.max(0, Math.min(1, score));
	}

	// === Private Methods ===

	private calculateTemplateScore(
		template: TeamTemplate,
		analysis: TaskAnalysis
	): number {
		// Base score starts at 0.5
		let score = 0.5;

		// Adjust based on complexity match
		const expectedComplexity = {
			minimal: 0.2,
			standard: 0.4,
			robust: 0.6,
			secure: 0.8,
			fullstack: 0.9,
		}[template];

		const complexityDiff = Math.abs(analysis.complexity - expectedComplexity);
		score += 0.3 * (1 - complexityDiff); // Up to 0.3 for complexity match

		// Adjust based on task type match
		const typeTemplate = TASK_TYPE_TEMPLATE_MAP[analysis.type] || 'standard';
		if (typeTemplate === template) {
			score += 0.2; // Type match bonus
		}

		return Math.min(1, score);
	}

	private applyModelTierLimit(
		team: TeamDefinition,
		maxTier: 'low' | 'medium' | 'high'
	): TeamDefinition {
		const maxTierOrder = TIER_ORDER[maxTier];

		return {
			...team,
			members: team.members.map((member) => {
				const memberTierOrder = TIER_ORDER[member.modelTier];
				if (memberTierOrder > maxTierOrder) {
					return { ...member, modelTier: maxTier };
				}
				return member;
			}),
		};
	}

	private deduplicateCapabilities(team: TeamDefinition): TeamDefinition {
		// Track which capabilities are covered
		const coveredCapabilities = new Set<AgentCapability>();
		const essentialMembers: TeamMember[] = [];
		const optionalMembers: TeamMember[] = [];

		// First pass: identify essential members (builders, first validator)
		let hasValidator = false;
		for (const member of team.members) {
			if (member.role === 'builder') {
				essentialMembers.push(member);
				for (const cap of member.capabilities) {
					coveredCapabilities.add(cap);
				}
			} else if (member.role === 'validator' && !hasValidator) {
				essentialMembers.push(member);
				hasValidator = true;
				for (const cap of member.capabilities) {
					coveredCapabilities.add(cap);
				}
			} else {
				optionalMembers.push(member);
			}
		}

		// Second pass: add optional members only if they provide new capabilities
		for (const member of optionalMembers) {
			const newCapabilities = member.capabilities.filter(
				(cap) => !coveredCapabilities.has(cap)
			);
			if (newCapabilities.length > 0 || essentialMembers.length < 3) {
				essentialMembers.push(member);
				for (const cap of member.capabilities) {
					coveredCapabilities.add(cap);
				}
			}
		}

		return {
			...team,
			members: essentialMembers,
		};
	}

	private buildReasoning(
		template: TeamTemplate,
		recommendation: { template: TeamTemplate; reasoning: string },
		requirements: RequirementsAnalysis,
		constraints?: CompositionConstraints
	): string {
		const parts: string[] = [];

		parts.push(`Selected template: ${template}`);
		parts.push(recommendation.reasoning);

		if (requirements.needsDesigner) {
			parts.push('Added designer for UI/frontend work');
		}
		if (requirements.needsSecurityReview) {
			parts.push('Added security reviewer for security-sensitive code');
		}
		if (requirements.needsArchitect) {
			parts.push('Architect review recommended for complex changes');
		}
		if (requirements.needsDocumentation) {
			parts.push('Writer included for documentation tasks');
		}

		if (constraints) {
			const constraintParts: string[] = [];
			if (constraints.maxMembers) {
				constraintParts.push(`max ${constraints.maxMembers} members`);
			}
			if (constraints.validationType) {
				constraintParts.push(`${constraints.validationType} validation`);
			}
			if (constraintParts.length > 0) {
				parts.push(`Constraints applied: ${constraintParts.join(', ')}`);
			}
		}

		return parts.join('. ') + '.';
	}
}

// ============================================================================
// Template Selection Functions
// ============================================================================

/**
 * Select template based on task complexity
 */
export function selectTemplateByComplexity(complexity: number): TeamTemplate {
	if (complexity < 0.3) {
		return 'minimal';
	} else if (complexity < 0.5) {
		return 'standard';
	} else if (complexity < 0.7) {
		return 'robust';
	} else if (complexity < 0.9) {
		return 'secure';
	} else {
		return 'fullstack';
	}
}

/**
 * Select template based on task type
 */
export function selectTemplateByTaskType(taskType: string): TeamTemplate {
	return TASK_TYPE_TEMPLATE_MAP[taskType] || 'standard';
}

/**
 * Select template based on required capabilities
 */
export function selectTemplateByCapabilities(
	requiredCapabilities: AgentCapability[]
): TeamTemplate {
	// Check for security requirement
	if (requiredCapabilities.includes('security_analysis')) {
		return 'secure';
	}

	// Check for design requirement
	if (requiredCapabilities.includes('design')) {
		return 'fullstack';
	}

	// Check capability count
	if (requiredCapabilities.length >= 5) {
		return 'fullstack';
	} else if (requiredCapabilities.length >= 3) {
		return 'robust';
	} else if (requiredCapabilities.length >= 2) {
		return 'standard';
	} else {
		return 'minimal';
	}
}

// ============================================================================
// Team Composition Helpers
// ============================================================================

/**
 * Determine required builders for subtasks
 */
export function determineBuilders(subtasks: Subtask[]): TeamMember[] {
	const builders: TeamMember[] = [];
	const agentTypes = new Set<string>();

	// Collect unique agent types from subtasks
	for (const subtask of subtasks) {
		agentTypes.add(subtask.agentType);
	}

	// Create a builder for each unique agent type
	let builderId = 1;
	for (const agentType of agentTypes) {
		// Find the highest model tier needed for this agent type
		const relevantSubtasks = subtasks.filter((s) => s.agentType === agentType);
		const highestTier = relevantSubtasks.reduce((max, s) => {
			return TIER_ORDER[s.modelTier] > TIER_ORDER[max] ? s.modelTier : max;
		}, 'low' as 'low' | 'medium' | 'high');

		builders.push(
			createTeamMember(`builder-${builderId}`, agentType, 'builder', {
				modelTier: highestTier,
				maxConcurrentTasks: relevantSubtasks.length > 1 ? 2 : 1,
			})
		);
		builderId++;
	}

	return builders;
}

/**
 * Determine required validators for validation type
 */
export function determineValidators(
	validationType: 'self-only' | 'validator' | 'architect'
): TeamMember[] {
	const validators: TeamMember[] = [];

	switch (validationType) {
		case 'self-only':
			// No separate validators needed
			break;

		case 'validator':
			validators.push(
				createTeamMember('validator-1', 'validator-syntax', 'validator'),
				createTeamMember('validator-2', 'validator-logic', 'validator')
			);
			break;

		case 'architect':
			validators.push(
				createTeamMember('validator-1', 'validator-syntax', 'validator'),
				createTeamMember('validator-2', 'validator-logic', 'validator'),
				createTeamMember('architect-1', 'architect', 'validator', {
					modelTier: 'high',
				})
			);
			break;
	}

	return validators;
}

/**
 * Add specialist members based on task analysis
 */
export function addSpecialists(
	team: TeamDefinition,
	analysis: TaskAnalysis
): TeamDefinition {
	const requirements = analyzeRequirements(analysis);
	const newMembers: TeamMember[] = [];

	// Check if team already has these specialists
	const hasDesigner = team.members.some(
		(m) => m.agentType.includes('designer') || m.capabilities.includes('design')
	);
	const hasSecurityReviewer = team.members.some(
		(m) =>
			m.agentType.includes('security') ||
			m.capabilities.includes('security_analysis')
	);
	const hasWriter = team.members.some(
		(m) =>
			m.agentType.includes('writer') ||
			m.capabilities.includes('documentation')
	);

	// Add missing specialists
	if (requirements.needsDesigner && !hasDesigner) {
		newMembers.push(
			createTeamMember(
				`designer-${team.members.length + 1}`,
				'designer',
				'specialist'
			)
		);
	}

	if (requirements.needsSecurityReview && !hasSecurityReviewer) {
		newMembers.push(
			createTeamMember(
				`security-${team.members.length + newMembers.length + 1}`,
				'security-reviewer',
				'specialist'
			)
		);
	}

	if (requirements.needsDocumentation && !hasWriter) {
		newMembers.push(
			createTeamMember(
				`writer-${team.members.length + newMembers.length + 1}`,
				'writer',
				'specialist'
			)
		);
	}

	// Update validation type if architect is needed
	let validationType = team.defaultValidationType;
	if (
		requirements.needsArchitect &&
		validationType !== 'architect'
	) {
		validationType = 'architect';
	}

	if (newMembers.length === 0 && validationType === team.defaultValidationType) {
		return team;
	}

	return {
		...team,
		members: [...team.members, ...newMembers],
		defaultValidationType: validationType,
	};
}

/**
 * Balance team based on constraints
 */
export function balanceTeam(
	team: TeamDefinition,
	constraints: CompositionConstraints
): TeamDefinition {
	let balanced = { ...team, members: [...team.members] };

	// Handle max members constraint
	if (constraints.maxMembers && balanced.members.length > constraints.maxMembers) {
		// Priority: builders > validators > specialists
		const builders = balanced.members.filter((m) => m.role === 'builder');
		const validators = balanced.members.filter((m) => m.role === 'validator');
		const specialists = balanced.members.filter((m) => m.role === 'specialist');

		const newMembers: TeamMember[] = [];

		// Always keep at least one builder
		newMembers.push(...builders.slice(0, Math.max(1, constraints.maxMembers - 1)));

		// Add validators up to limit
		const remaining = constraints.maxMembers - newMembers.length;
		if (remaining > 0) {
			newMembers.push(...validators.slice(0, remaining));
		}

		// Add specialists if still room
		const stillRemaining = constraints.maxMembers - newMembers.length;
		if (stillRemaining > 0) {
			newMembers.push(...specialists.slice(0, stillRemaining));
		}

		balanced.members = newMembers;
	}

	// Handle min members constraint
	if (constraints.minMembers && balanced.members.length < constraints.minMembers) {
		const toAdd = constraints.minMembers - balanced.members.length;

		for (let i = 0; i < toAdd; i++) {
			// Add validators to meet minimum
			balanced.members.push(
				createTeamMember(
					`validator-extra-${i + 1}`,
					'validator-syntax',
					'validator'
				)
			);
		}
	}

	// Handle excluded agents
	if (constraints.excludedAgents && constraints.excludedAgents.length > 0) {
		balanced.members = balanced.members.filter(
			(m) => !constraints.excludedAgents!.includes(m.agentType)
		);
	}

	return balanced;
}

// ============================================================================
// Analysis Helpers
// ============================================================================

/**
 * Analyze task requirements for team composition
 */
export function analyzeRequirements(analysis: TaskAnalysis): RequirementsAnalysis {
	const taskLower = analysis.task.toLowerCase();
	const areasLower = analysis.areas.map((a) => a.toLowerCase());
	const techLower = analysis.technologies.map((t) => t.toLowerCase());

	// Check for designer needs
	const needsDesigner =
		DESIGNER_KEYWORDS.some((kw) => taskLower.includes(kw)) ||
		areasLower.some((area) =>
			DESIGNER_KEYWORDS.some((kw) => area.includes(kw))
		) ||
		techLower.some((tech) =>
			['react', 'vue', 'svelte', 'angular', 'css', 'tailwind'].includes(tech)
		);

	// Check for security needs
	const needsSecurityReview =
		SECURITY_KEYWORDS.some((kw) => taskLower.includes(kw)) ||
		areasLower.some((area) =>
			SECURITY_KEYWORDS.some((kw) => area.includes(kw))
		);

	// Check for architect needs
	const needsArchitect =
		analysis.complexity >= 0.7 ||
		ARCHITECT_KEYWORDS.some((kw) => taskLower.includes(kw)) ||
		analysis.type === 'refactoring' ||
		analysis.type === 'migration';

	// Check for documentation needs
	const needsDocumentation =
		analysis.type === 'documentation' ||
		DOCUMENTATION_KEYWORDS.some((kw) => taskLower.includes(kw));

	// Estimate team size
	let estimatedTeamSize = 1; // Base builder
	if (analysis.complexity >= 0.3) estimatedTeamSize++; // Add validator
	if (analysis.complexity >= 0.6) estimatedTeamSize++; // Add second validator
	if (needsDesigner) estimatedTeamSize++;
	if (needsSecurityReview) estimatedTeamSize++;
	if (needsArchitect) estimatedTeamSize++;
	if (needsDocumentation) estimatedTeamSize++;

	// Determine recommended validation
	let recommendedValidation: 'self-only' | 'validator' | 'architect' = 'self-only';
	if (analysis.complexity >= 0.7 || needsArchitect || needsSecurityReview) {
		recommendedValidation = 'architect';
	} else if (analysis.complexity >= 0.3) {
		recommendedValidation = 'validator';
	}

	return {
		needsDesigner,
		needsSecurityReview,
		needsArchitect,
		needsDocumentation,
		estimatedTeamSize,
		recommendedValidation,
	};
}

/**
 * Extract required capabilities from task analysis
 */
export function extractRequiredCapabilities(
	analysis: TaskAnalysis
): AgentCapability[] {
	const capabilities = new Set<AgentCapability>();

	// All tasks need code modification
	capabilities.add('code_modification');

	const taskLower = analysis.task.toLowerCase();
	const areasLower = analysis.areas.map((a) => a.toLowerCase()).join(' ');

	// Check for various capability needs
	if (
		DESIGNER_KEYWORDS.some(
			(kw) => taskLower.includes(kw) || areasLower.includes(kw)
		)
	) {
		capabilities.add('design');
	}

	if (
		SECURITY_KEYWORDS.some(
			(kw) => taskLower.includes(kw) || areasLower.includes(kw)
		)
	) {
		capabilities.add('security_analysis');
	}

	if (
		DOCUMENTATION_KEYWORDS.some(
			(kw) => taskLower.includes(kw) || areasLower.includes(kw)
		)
	) {
		capabilities.add('documentation');
	}

	if (
		analysis.type === 'testing' ||
		taskLower.includes('test') ||
		areasLower.includes('test')
	) {
		capabilities.add('testing');
	}

	if (analysis.complexity >= 0.5) {
		capabilities.add('code_review');
	}

	if (analysis.complexity >= 0.7 || analysis.type === 'refactoring') {
		capabilities.add('planning');
		capabilities.add('exploration');
	}

	return Array.from(capabilities);
}

/**
 * Map subtask to best agent type
 */
export function mapSubtaskToAgent(subtask: Subtask): AgentMapping {
	const componentRole = subtask.component.role;
	const promptLower = subtask.prompt.toLowerCase();

	// Determine agent type based on component role and task
	let agentType: string;
	let modelTier: 'low' | 'medium' | 'high' = subtask.modelTier;
	let role: TeamRole = 'builder';

	switch (componentRole) {
		case 'frontend':
		case 'ui':
			if (promptLower.includes('style') || promptLower.includes('css')) {
				agentType = 'designer';
				role = 'specialist';
			} else {
				agentType = 'executor';
			}
			break;

		case 'backend':
		case 'api':
			agentType = 'executor';
			if (promptLower.includes('security') || promptLower.includes('auth')) {
				modelTier = 'high';
			}
			break;

		case 'database':
			agentType = 'executor';
			modelTier = modelTier === 'low' ? 'medium' : modelTier;
			break;

		case 'testing':
			agentType = 'qa-tester';
			role = 'validator';
			break;

		case 'docs':
			agentType = 'writer';
			role = 'specialist';
			modelTier = 'low';
			break;

		case 'config':
			agentType = 'executor-low';
			modelTier = 'low';
			break;

		default:
			agentType = subtask.agentType || 'executor';
	}

	return {
		agentType,
		modelTier,
		role,
	};
}
