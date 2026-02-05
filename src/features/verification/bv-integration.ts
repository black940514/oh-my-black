/**
 * Builder-Validator Integration for Orchestrate Skill
 *
 * Integrates B-V cycle into the orchestration workflow.
 * This module provides the interface between the orchestrate skill
 * and the underlying B-V cycle verification system.
 */

import type { AgentOutput } from '../agent-output/schema.js';
import type {
  ValidationCycleResult,
  ValidationCycleOptions,
  VerificationEvidence
} from './types.js';
import type { TeamDefinition } from '../team/types.js';
import type {
  RetryState,
  EscalationDecision,
  FailureReport
} from './retry-logic.js';
import type { ValidatorOutput } from './builder-validator.js';

import {
  createRetryState,
  recordAttempt,
  shouldRetry,
  determineEscalation,
  generateFailureReport,
  createRetryPrompt
} from './retry-logic.js';
import {
  selectValidator,
  aggregateValidatorResults,
  runBuilderValidatorCycleWithAgentOutput
} from './builder-validator.js';
import { spawnBuilderAgent } from './agent-spawner.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Validation type for B-V cycle
 */
export type BVValidationType = 'self-only' | 'validator' | 'architect';

/**
 * Task execution configuration with B-V cycle
 */
export interface BVTaskConfig {
  /** Unique identifier for this task */
  taskId: string;
  /** Human-readable task description */
  taskDescription: string;
  /** Requirements that must be met */
  requirements: string[];
  /** Criteria for acceptance */
  acceptanceCriteria: string[];
  /** Level of validation to perform */
  validationType: BVValidationType;
  /** Agent to use for building */
  builderAgent: string;
  /** Agents to use for validation (optional, auto-selected if not provided) */
  validatorAgents?: string[];
  /** Maximum retry attempts */
  maxRetries: number;
  /** Timeout in milliseconds */
  timeout: number;
  /** Task complexity level (auto-detected if not provided) */
  complexity?: 'low' | 'medium' | 'high';
}

/**
 * Result of B-V orchestrated execution
 */
export interface BVOrchestrationResult {
  /** Task identifier */
  taskId: string;
  /** Whether the task succeeded */
  success: boolean;
  /** Result from the validation cycle */
  cycleResult: ValidationCycleResult;
  /** Current retry state */
  retryState: RetryState;
  /** Escalation decision if applicable */
  escalation?: EscalationDecision;
  /** Failure report if task failed */
  failureReport?: FailureReport;
  /** Total execution duration in milliseconds */
  totalDuration: number;
  /** All evidence collected during execution */
  evidence: VerificationEvidence[];
}

/**
 * Orchestration state with B-V cycle tracking
 */
export interface BVOrchestrationState {
  /** Current tasks being processed */
  tasks: BVTaskState[];
  /** B-V cycle configuration */
  bvCycles: {
    /** Whether B-V cycles are enabled */
    enabled: boolean;
    /** Default validation type */
    defaultValidationType: BVValidationType;
    /** Completed cycle results */
    completedCycles: BVOrchestrationResult[];
    /** Currently active cycle */
    activeCycle: BVTaskState | null;
  };
}

/**
 * State of a single task in B-V execution
 */
export interface BVTaskState {
  /** Task configuration */
  config: BVTaskConfig;
  /** Current status */
  status: 'pending' | 'building' | 'validating' | 'retrying' | 'complete' | 'failed' | 'escalated';
  /** Start time */
  startedAt: number;
  /** End time */
  completedAt?: number;
  /** Current attempt number */
  currentAttempt: number;
  /** Builder result if available */
  builderResult?: AgentOutput;
  /** Validator results if available */
  validatorResults?: ValidatorOutput[];
}

/**
 * Report summary for B-V orchestration
 */
export interface BVReportSummary {
  /** Total tasks processed */
  totalTasks: number;
  /** Successfully completed tasks */
  successful: number;
  /** Failed tasks */
  failed: number;
  /** Escalated tasks */
  escalated: number;
  /** Total retry attempts across all tasks */
  totalRetries: number;
  /** Average cycle time in milliseconds */
  averageCycleTime: number;
  /** Details for each task */
  details: Array<{
    taskId: string;
    status: string;
    attempts: number;
    duration: number;
  }>;
}

// ============================================================================
// Task Execution
// ============================================================================

/**
 * Execute a task with B-V cycle
 *
 * This is the main entry point for executing tasks with Builder-Validator verification.
 * It manages the full lifecycle including building, validation, retries, and escalation.
 *
 * @param config - Task configuration
 * @param team - Optional team definition for agent selection
 * @returns B-V orchestration result
 */
export async function executeWithBVCycle(
  config: BVTaskConfig,
  team?: TeamDefinition
): Promise<BVOrchestrationResult> {
  const startTime = Date.now();

  // Initialize retry state
  const retryState = createRetryState(config.maxRetries);

  // Initialize result
  const result: BVOrchestrationResult = {
    taskId: config.taskId,
    success: false,
    cycleResult: {
      success: false,
      builderPassed: false,
      validatorPassed: false,
      retryCount: 0,
      evidence: [],
      issues: []
    },
    retryState,
    totalDuration: 0,
    evidence: []
  };

  // Determine validation options
  const validationOptions: ValidationCycleOptions = {
    maxRetries: config.maxRetries,
    validatorAgent: selectValidatorAgent(config, team),
    timeout: config.timeout
  };

  // Select validators if not specified
  const validators =
    config.validatorAgents ||
    selectValidator(config.validationType, config.complexity || 'medium');

  try {
    // Execute B-V cycle with retries
    let currentRetryState = retryState;
    let builderResult: AgentOutput | undefined;
    let validatorResult: ValidatorOutput | undefined;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      // Build phase - In real implementation, this would spawn builder agent
      // For now, we simulate by creating a placeholder result
      builderResult = await executeBuilder(config, attempt, validatorResult);

      if (!builderResult) {
        currentRetryState = recordAttempt(
          currentRetryState,
          undefined,
          undefined,
          'fail'
        );
        result.cycleResult.issues.push(
          `Builder failed on attempt ${attempt + 1}`
        );
        break;
      }

      // Run validation cycle
      const cycleResult = await runBuilderValidatorCycleWithAgentOutput(
        builderResult,
        config.validationType,
        validationOptions
      );

      result.cycleResult = cycleResult;
      result.evidence.push(...cycleResult.evidence);

      // Check if validation passed
      if (cycleResult.success) {
        currentRetryState = recordAttempt(
          currentRetryState,
          builderResult,
          undefined,
          'success'
        );
        result.success = true;
        break;
      }

      // Determine if we should retry
      if (validators.length > 0 && cycleResult.issues.length > 0) {
        // Create a simulated validator output for retry decision
        validatorResult = {
          validatorType: validators[0],
          taskId: config.taskId,
          status: cycleResult.validatorPassed ? 'APPROVED' : 'REJECTED',
          checks: [],
          issues: cycleResult.issues,
          recommendations: []
        };

        const retryDecision = shouldRetry(currentRetryState, validatorResult);

        if (!retryDecision.shouldRetry) {
          // Check for escalation
          if (retryDecision.action === 'escalate') {
            const escalation = determineEscalation(
              currentRetryState,
              validatorResult
            );
            result.escalation = escalation;

            // Generate failure report for escalation context
            const failureReport = generateFailureReport(
              config.taskId,
              currentRetryState,
              validatorResult
            );

            // Execute escalation - spawn architect agent
            const architectResult = await executeEscalation(
              escalation,
              config,
              currentRetryState,
              failureReport
            );

            if (architectResult && architectResult.status === 'success') {
              // Architect fixed it, re-run validation
              const architectCycleResult = await runBuilderValidatorCycleWithAgentOutput(
                architectResult,
                config.validationType,
                validationOptions
              );

              result.cycleResult = architectCycleResult;
              result.evidence.push(...architectCycleResult.evidence);

              if (architectCycleResult.success) {
                // Architect's fix passed validation
                currentRetryState = recordAttempt(
                  currentRetryState,
                  architectResult,
                  undefined,
                  'success'
                );
                result.success = true;
                break;
              }
            }

            // Escalation didn't resolve or architect output failed validation
            currentRetryState = recordAttempt(
              currentRetryState,
              builderResult,
              validatorResult,
              'escalate'
            );
          } else {
            currentRetryState = recordAttempt(
              currentRetryState,
              builderResult,
              validatorResult,
              'fail'
            );
          }
          break;
        }

        // Record retry attempt
        currentRetryState = recordAttempt(
          currentRetryState,
          builderResult,
          validatorResult,
          'retry'
        );
      }
    }

    // Update final state
    result.retryState = currentRetryState;

    // Generate failure report if needed
    if (!result.success && currentRetryState.status !== 'success') {
      result.failureReport = generateFailureReport(
        config.taskId,
        currentRetryState,
        validatorResult
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.cycleResult.issues.push(`Execution error: ${errorMessage}`);
  }

  // Calculate total duration
  result.totalDuration = Date.now() - startTime;

  return result;
}

/**
 * Execute builder phase with real agent spawning
 *
 * Spawns the builder agent with the task prompt and handles retry logic.
 */
async function executeBuilder(
  config: BVTaskConfig,
  attempt: number,
  previousFeedback?: ValidatorOutput
): Promise<AgentOutput | undefined> {
  // Create builder prompt
  let prompt = createBuilderTaskPrompt(config);

  // If this is a retry with feedback, add retry context
  if (attempt > 0 && previousFeedback) {
    const placeholderResult: AgentOutput = {
      agentId: config.builderAgent,
      taskId: config.taskId,
      status: 'partial',
      summary: 'Previous attempt',
      evidence: [],
      timestamp: Date.now()
    };

    prompt = createRetryPrompt(
      config.taskDescription,
      placeholderResult,
      previousFeedback,
      attempt + 1
    );
  }

  // Determine model based on builder agent type
  const model = config.builderAgent.includes('high') ? 'opus'
    : config.builderAgent.includes('low') ? 'haiku'
    : 'sonnet';

  // Spawn real builder agent
  const spawnResult = await spawnBuilderAgent({
    agentType: config.builderAgent,
    model,
    prompt,
    taskId: config.taskId,
    timeout: config.timeout
  });

  if (!spawnResult.success || !spawnResult.output) {
    // Return a failed result if spawn failed
    return {
      agentId: config.builderAgent,
      taskId: config.taskId,
      status: 'failed',
      summary: spawnResult.error || 'Builder agent spawn failed',
      evidence: [],
      timestamp: Date.now()
    };
  }

  return spawnResult.output;
}

/**
 * Execute escalation by spawning architect agent for review
 *
 * When validation failures persist after multiple retries, this function
 * escalates to an architect agent who analyzes the root cause and either
 * fixes the issue or provides specific guidance.
 *
 * @param escalation - Escalation decision with agent selection
 * @param config - Task configuration
 * @param retryState - Current retry state
 * @param failureReport - Report of all failures
 * @returns AgentOutput from architect if escalation succeeds, undefined otherwise
 */
async function executeEscalation(
  escalation: EscalationDecision,
  config: BVTaskConfig,
  retryState: RetryState,
  failureReport: FailureReport
): Promise<AgentOutput | undefined> {
  if (!escalation.shouldEscalate) {
    return undefined;
  }

  // Create architect review prompt with full failure context
  const escalationPrompt = `# ESCALATION REVIEW REQUEST

You are reviewing a task that failed B-V validation after ${failureReport.totalAttempts} attempts.

## Original Task
${config.taskDescription}

${config.requirements.length > 0 ? `## Requirements
${config.requirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}
` : ''}

${config.acceptanceCriteria.length > 0 ? `## Acceptance Criteria
${config.acceptanceCriteria.map((crit, i) => `${i + 1}. ${crit}`).join('\n')}
` : ''}

## Failure History
${retryState.history.map((attempt, i) => `
**Attempt ${i + 1}:**
- Builder Agent: ${attempt.builderResult?.agentId || 'unknown'}
- Status: ${attempt.builderResult?.status || 'unknown'}
- Issues: ${attempt.validatorResult?.issues.join('; ') || 'No validator feedback'}
- Recommendations: ${attempt.validatorResult?.recommendations.join('; ') || 'None'}
`).join('\n')}

## Root Cause Analysis
${failureReport.rootCauseAnalysis}

## Persistent Issues
${escalation.context.persistentIssues.length > 0 ? escalation.context.persistentIssues.map(p => `- ${p}`).join('\n') : 'No clear patterns detected'}

## Suggested Action
${escalation.context.suggestedAction}

## Your Task

1. **Analyze** why previous attempts failed despite validator feedback
2. **Identify** the root cause (architectural issue, missing context, incorrect approach)
3. **Either:**
   - Fix the issue directly if it's straightforward
   - Provide specific, actionable guidance for the builder agent

4. **Ensure** all validators would pass after your changes

## Output Requirements

- If you make code changes, include all modified files
- Provide evidence (test output, diagnostics) showing the fix works
- If providing guidance, be specific about what needs to change and why

Respond with your analysis and solution.
`;

  // Determine model and agent based on escalation level
  let model: 'haiku' | 'sonnet' | 'opus';
  let agentType: string;

  switch (escalation.escalationLevel) {
    case 'architect':
      model = 'opus';
      agentType = 'architect';
      break;
    case 'coordinator':
      model = 'sonnet';
      agentType = 'coordinator';
      break;
    case 'human':
      // Cannot spawn human agent, return undefined
      return undefined;
    default:
      model = 'sonnet';
      agentType = 'architect';
  }

  // Spawn architect agent
  const result = await spawnBuilderAgent({
    agentType,
    model,
    prompt: escalationPrompt,
    taskId: config.taskId,
    timeout: 180000 // 3 minutes for architect review
  });

  if (!result.success || !result.output) {
    return undefined;
  }

  return result.output;
}

/**
 * Select validator agent based on config and team
 */
function selectValidatorAgent(
  config: BVTaskConfig,
  team?: TeamDefinition
): string {
  // If team has a specific validator, use it
  if (team?.members) {
    const validator = team.members.find(m => m.role === 'validator');
    if (validator) {
      return validator.agentType;
    }
  }

  // Default validators based on validation type
  switch (config.validationType) {
    case 'architect':
      return 'architect';
    case 'validator':
      return 'validator-logic';
    case 'self-only':
    default:
      return 'self';
  }
}

// ============================================================================
// Prompt Generation
// ============================================================================

/**
 * Create builder prompt with task context
 *
 * Generates a comprehensive prompt for the builder agent including
 * all requirements and acceptance criteria.
 *
 * @param config - Task configuration
 * @returns Formatted prompt string
 */
export function createBuilderTaskPrompt(config: BVTaskConfig): string {
  const lines: string[] = [];

  // Header
  lines.push('# BUILDER TASK');
  lines.push('');
  lines.push(`**Task ID:** ${config.taskId}`);
  lines.push('');

  // Description
  lines.push('## Task Description');
  lines.push(config.taskDescription);
  lines.push('');

  // Requirements
  if (config.requirements.length > 0) {
    lines.push('## Requirements');
    config.requirements.forEach((req, idx) => {
      lines.push(`${idx + 1}. ${req}`);
    });
    lines.push('');
  }

  // Acceptance Criteria
  if (config.acceptanceCriteria.length > 0) {
    lines.push('## Acceptance Criteria');
    config.acceptanceCriteria.forEach((criteria, idx) => {
      lines.push(`${idx + 1}. ${criteria}`);
    });
    lines.push('');
  }

  // Validation info
  lines.push('## Validation');
  lines.push(`- **Validation Level:** ${config.validationType}`);
  if (config.validatorAgents && config.validatorAgents.length > 0) {
    lines.push(`- **Validators:** ${config.validatorAgents.join(', ')}`);
  }
  lines.push(`- **Max Retries:** ${config.maxRetries}`);
  lines.push('');

  // Instructions
  lines.push('## Instructions');
  lines.push('');
  lines.push('1. Implement the task according to the requirements');
  lines.push('2. Ensure all acceptance criteria are met');
  lines.push('3. Run self-validation before submitting');
  lines.push('4. Provide evidence of successful completion');
  lines.push('');
  lines.push('**Important:** Your output will be validated. Include:');
  lines.push('- All files created/modified');
  lines.push('- Evidence of testing (command output, diagnostics)');
  lines.push('- Self-validation results');

  return lines.join('\n');
}

// ============================================================================
// Cycle Completion Handling
// ============================================================================

/**
 * Handle B-V cycle completion
 *
 * Determines the next action based on validation result and retry state.
 *
 * @param result - Validation cycle result
 * @param retryState - Current retry state
 * @returns Action to take and optional next step
 */
export function handleCycleCompletion(
  result: ValidationCycleResult,
  retryState: RetryState
): {
  action: 'complete' | 'retry' | 'escalate';
  nextStep?: string;
} {
  // Success case
  if (result.success) {
    return { action: 'complete' };
  }

  // Check retry state
  if (retryState.status === 'escalated') {
    return {
      action: 'escalate',
      nextStep: 'Review escalation decision and delegate to appropriate agent'
    };
  }

  if (retryState.status === 'failed') {
    return {
      action: 'escalate',
      nextStep: 'Generate failure report and notify coordinator'
    };
  }

  // Can still retry
  if (retryState.currentAttempt < retryState.maxAttempts) {
    const issues = result.issues.join(', ');
    return {
      action: 'retry',
      nextStep: `Address issues: ${issues}`
    };
  }

  // Max retries reached
  return {
    action: 'escalate',
    nextStep: 'Maximum retries reached, escalate for human review'
  };
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Create initial B-V orchestration state
 *
 * @param defaultValidationType - Default validation type for new tasks
 * @returns Initial orchestration state
 */
export function createBVOrchestrationState(
  defaultValidationType: BVValidationType = 'validator'
): BVOrchestrationState {
  return {
    tasks: [],
    bvCycles: {
      enabled: true,
      defaultValidationType,
      completedCycles: [],
      activeCycle: null
    }
  };
}

/**
 * Integrate B-V results into orchestration state
 *
 * Updates the orchestration state with the results from a B-V cycle.
 *
 * @param currentState - Current orchestration state
 * @param bvResult - Result from B-V cycle execution
 * @returns Updated orchestration state
 */
export function updateOrchestrationState(
  currentState: BVOrchestrationState,
  bvResult: BVOrchestrationResult
): BVOrchestrationState {
  // Find the task in the tasks list
  const taskIndex = currentState.tasks.findIndex(
    t => t.config.taskId === bvResult.taskId
  );

  // Determine new status
  let newStatus: BVTaskState['status'];
  if (bvResult.success) {
    newStatus = 'complete';
  } else if (bvResult.escalation?.shouldEscalate) {
    newStatus = 'escalated';
  } else {
    newStatus = 'failed';
  }

  // Update task state if found
  const updatedTasks = [...currentState.tasks];
  if (taskIndex >= 0) {
    updatedTasks[taskIndex] = {
      ...updatedTasks[taskIndex],
      status: newStatus,
      completedAt: Date.now(),
      currentAttempt: bvResult.retryState.currentAttempt
    };
  }

  // Add to completed cycles
  const updatedCompletedCycles = [
    ...currentState.bvCycles.completedCycles,
    bvResult
  ];

  return {
    ...currentState,
    tasks: updatedTasks,
    bvCycles: {
      ...currentState.bvCycles,
      completedCycles: updatedCompletedCycles,
      activeCycle: null // Clear active cycle
    }
  };
}

// ============================================================================
// Reporting
// ============================================================================

/**
 * Generate orchestration report with B-V details
 *
 * Creates a comprehensive summary of all B-V cycles executed.
 *
 * @param results - Array of B-V orchestration results
 * @returns Report summary
 */
export function generateBVReport(results: BVOrchestrationResult[]): BVReportSummary {
  if (results.length === 0) {
    return {
      totalTasks: 0,
      successful: 0,
      failed: 0,
      escalated: 0,
      totalRetries: 0,
      averageCycleTime: 0,
      details: []
    };
  }

  const successful = results.filter(r => r.success).length;
  const escalated = results.filter(r => r.escalation?.shouldEscalate).length;
  const failed = results.filter(
    r => !r.success && !r.escalation?.shouldEscalate
  ).length;

  const totalRetries = results.reduce(
    (sum, r) => sum + r.retryState.currentAttempt,
    0
  );

  const totalDuration = results.reduce((sum, r) => sum + r.totalDuration, 0);
  const averageCycleTime = totalDuration / results.length;

  const details = results.map(r => {
    let status: string;
    if (r.success) {
      status = 'success';
    } else if (r.escalation?.shouldEscalate) {
      status = `escalated:${r.escalation.escalationLevel}`;
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
    totalTasks: results.length,
    successful,
    failed,
    escalated,
    totalRetries,
    averageCycleTime,
    details
  };
}

/**
 * Format B-V report as markdown
 *
 * @param report - Report summary
 * @returns Formatted markdown string
 */
export function formatBVReportMarkdown(report: BVReportSummary): string {
  const lines: string[] = [];

  lines.push('# Builder-Validator Orchestration Report');
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Tasks:** ${report.totalTasks}`);
  lines.push(`- **Successful:** ${report.successful}`);
  lines.push(`- **Failed:** ${report.failed}`);
  lines.push(`- **Escalated:** ${report.escalated}`);
  lines.push(`- **Total Retries:** ${report.totalRetries}`);
  lines.push(`- **Average Cycle Time:** ${Math.round(report.averageCycleTime)}ms`);
  lines.push('');

  // Success rate
  if (report.totalTasks > 0) {
    const successRate = ((report.successful / report.totalTasks) * 100).toFixed(1);
    lines.push(`**Success Rate:** ${successRate}%`);
    lines.push('');
  }

  // Details
  if (report.details.length > 0) {
    lines.push('## Task Details');
    lines.push('');
    lines.push('| Task ID | Status | Attempts | Duration |');
    lines.push('|---------|--------|----------|----------|');

    for (const detail of report.details) {
      lines.push(
        `| ${detail.taskId} | ${detail.status} | ${detail.attempts} | ${detail.duration}ms |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Note: Types (BVTaskConfig, BVOrchestrationResult, BVOrchestrationState,
// BVTaskState, BVReportSummary) are exported inline with their definitions above.
