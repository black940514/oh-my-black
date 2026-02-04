/**
 * Retry Logic for Builder-Validator Cycle
 *
 * Handles retry state tracking, retry decisions, escalation logic, and failure reporting
 * for the Builder-Validator cycle when validation fails.
 */

import type { AgentOutput } from '../agent-output/schema.js';
import type { VerificationEvidence } from './types.js';
import type { ValidatorOutput } from './builder-validator.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Retry state tracking
 */
export interface RetryState {
  currentAttempt: number;
  maxAttempts: number;
  history: RetryAttempt[];
  status: 'in_progress' | 'success' | 'failed' | 'escalated';
}

export interface RetryAttempt {
  attemptNumber: number;
  timestamp: number;
  builderResult?: AgentOutput;
  validatorResult?: ValidatorOutput;
  issues: string[];
  action: 'retry' | 'escalate' | 'success' | 'fail';
}

/**
 * Escalation decision
 */
export interface EscalationDecision {
  shouldEscalate: boolean;
  escalationLevel: 'coordinator' | 'architect' | 'human';
  reason: string;
  context: {
    attemptHistory: RetryAttempt[];
    persistentIssues: string[];
    suggestedAction: string;
  };
}

/**
 * Failure report
 */
export interface FailureReport {
  taskId: string;
  totalAttempts: number;
  finalStatus: 'failed' | 'escalated';
  persistentIssues: string[];
  attemptSummary: Array<{
    attempt: number;
    action: string;
    issues: string[];
  }>;
  rootCauseAnalysis: string;
  recommendedAction: string;
  evidence: VerificationEvidence[];
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Create initial retry state
 *
 * @param maxAttempts - Maximum number of retry attempts allowed
 * @returns Initial retry state
 */
export function createRetryState(maxAttempts: number): RetryState {
  return {
    currentAttempt: 0,
    maxAttempts,
    history: [],
    status: 'in_progress'
  };
}

/**
 * Record a retry attempt in the state
 *
 * @param state - Current retry state
 * @param builderResult - Result from builder (if available)
 * @param validatorResult - Result from validator (if available)
 * @param action - Action taken for this attempt
 * @returns Updated retry state
 */
export function recordAttempt(
  state: RetryState,
  builderResult: AgentOutput | undefined,
  validatorResult: ValidatorOutput | undefined,
  action: 'retry' | 'escalate' | 'success' | 'fail'
): RetryState {
  const attempt: RetryAttempt = {
    attemptNumber: state.currentAttempt,
    timestamp: Date.now(),
    builderResult,
    validatorResult,
    issues: validatorResult?.issues || [],
    action
  };

  return {
    ...state,
    currentAttempt: state.currentAttempt + 1,
    history: [...state.history, attempt],
    status:
      action === 'success'
        ? 'success'
        : action === 'escalate'
          ? 'escalated'
          : action === 'fail'
            ? 'failed'
            : 'in_progress'
  };
}

// ============================================================================
// Retry Decision Logic
// ============================================================================

/**
 * Determine if retry should be attempted
 *
 * @param state - Current retry state
 * @param validatorResult - Result from validator
 * @returns Decision on whether to retry and the action to take
 */
export function shouldRetry(
  state: RetryState,
  validatorResult: ValidatorOutput
): {
  shouldRetry: boolean;
  reason: string;
  action: 'retry' | 'escalate' | 'success' | 'fail';
} {
  // Check max attempts reached
  if (state.currentAttempt >= state.maxAttempts) {
    return {
      shouldRetry: false,
      reason: `Maximum retry attempts (${state.maxAttempts}) reached`,
      action: 'fail'
    };
  }

  // Handle validator status
  switch (validatorResult.status) {
    case 'APPROVED':
      return {
        shouldRetry: false,
        reason: 'Validation passed',
        action: 'success'
      };

    case 'NEEDS_REVIEW':
      return {
        shouldRetry: false,
        reason: 'Manual review required - escalating',
        action: 'escalate'
      };

    case 'REJECTED': {
      // Check if issues are retryable
      const hasNonRetryableIssue = validatorResult.issues.some(
        issue => !isRetryableIssue(issue)
      );

      if (hasNonRetryableIssue) {
        return {
          shouldRetry: false,
          reason: 'Non-retryable issue detected - escalating',
          action: 'escalate'
        };
      }

      // Check for critical failures
      const hasCriticalFailure = validatorResult.checks.some(
        check => !check.passed && check.severity === 'critical'
      );

      if (hasCriticalFailure) {
        // Critical failures need escalation
        return {
          shouldRetry: false,
          reason: 'Critical validation failure - escalating',
          action: 'escalate'
        };
      }

      // Check for persistent issues (same issue across multiple attempts)
      const persistentIssues = detectPersistentIssues(state, validatorResult);
      if (persistentIssues.length > 0 && state.currentAttempt >= 2) {
        return {
          shouldRetry: false,
          reason: `Persistent issues detected after ${state.currentAttempt} attempts`,
          action: 'escalate'
        };
      }

      // Retryable issues remain
      return {
        shouldRetry: true,
        reason: 'Retryable issues found - attempting fix',
        action: 'retry'
      };
    }

    default:
      return {
        shouldRetry: false,
        reason: `Unknown validator status: ${validatorResult.status}`,
        action: 'fail'
      };
  }
}

/**
 * Check if an issue is retryable
 *
 * @param issue - Issue description
 * @returns True if the issue can be retried
 */
export function isRetryableIssue(issue: string): boolean {
  const lowerIssue = issue.toLowerCase();

  // Non-retryable patterns (should escalate)
  const nonRetryablePatterns = [
    // Security issues
    'security',
    'vulnerability',
    'sensitive data',
    'sql injection',
    'xss',
    'authentication',
    'authorization',

    // Missing dependencies/config
    'missing dependency',
    'module not found',
    'cannot find module',
    'package not installed',
    'missing configuration',
    'config file not found',

    // Architectural issues
    'architectural',
    'design flaw',
    'fundamental issue',

    // Manual intervention needed
    'requires manual',
    'human review',
    'cannot proceed'
  ];

  if (nonRetryablePatterns.some(pattern => lowerIssue.includes(pattern))) {
    return false;
  }

  // Retryable patterns
  const retryablePatterns = [
    // Syntax issues
    'syntax error',
    'parse error',
    'unexpected token',
    'missing semicolon',
    'missing bracket',
    'indentation',

    // Type errors
    'type error',
    'type mismatch',
    'cannot assign',
    'incompatible type',
    'undefined variable',

    // Logic errors (conditional)
    'logic error',
    'incorrect implementation',
    'edge case',
    'boundary condition',
    'null check',
    'error handling'
  ];

  return retryablePatterns.some(pattern => lowerIssue.includes(pattern));
}

/**
 * Detect issues that persist across multiple attempts
 *
 * @param state - Current retry state
 * @param currentResult - Current validator result
 * @returns Array of persistent issue descriptions
 */
function detectPersistentIssues(
  state: RetryState,
  currentResult: ValidatorOutput
): string[] {
  if (state.history.length === 0) {
    return [];
  }

  const persistent: string[] = [];
  const currentIssues = new Set(currentResult.issues);

  // Check each previous attempt
  for (const attempt of state.history) {
    if (!attempt.validatorResult) continue;

    // Find issues that appear in both current and previous attempts
    for (const issue of attempt.validatorResult.issues) {
      // Use fuzzy matching for similar issues
      const hasSimilarIssue = Array.from(currentIssues).some(currentIssue =>
        areSimilarIssues(issue, currentIssue)
      );

      if (hasSimilarIssue && !persistent.includes(issue)) {
        persistent.push(issue);
      }
    }
  }

  return persistent;
}

/**
 * Check if two issues are similar (fuzzy matching)
 *
 * @param issue1 - First issue
 * @param issue2 - Second issue
 * @returns True if issues are similar
 */
function areSimilarIssues(issue1: string, issue2: string): boolean {
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
  const norm1 = normalize(issue1);
  const norm2 = normalize(issue2);

  // Exact match after normalization
  if (norm1 === norm2) return true;

  // Check if one contains the other (for partial matches)
  if (norm1.length > 20 && norm2.length > 20) {
    return norm1.includes(norm2) || norm2.includes(norm1);
  }

  return false;
}

// ============================================================================
// Escalation Logic
// ============================================================================

/**
 * Determine escalation level and context
 *
 * @param state - Current retry state
 * @param validatorResult - Final validator result
 * @returns Escalation decision with context
 */
export function determineEscalation(
  state: RetryState,
  validatorResult: ValidatorOutput
): EscalationDecision {
  const persistentIssues = detectPersistentIssues(state, validatorResult);

  // Security issues → architect
  const hasSecurityIssue = validatorResult.issues.some(issue =>
    /security|vulnerability|sensitive data/i.test(issue)
  );
  if (hasSecurityIssue) {
    return {
      shouldEscalate: true,
      escalationLevel: 'architect',
      reason: 'Critical security issue detected',
      context: {
        attemptHistory: state.history,
        persistentIssues,
        suggestedAction:
          'Security architect review required for vulnerability assessment and remediation guidance'
      }
    };
  }

  // 5+ attempts → human
  if (state.currentAttempt >= 5) {
    return {
      shouldEscalate: true,
      escalationLevel: 'human',
      reason: `Exceeded reasonable retry limit (${state.currentAttempt} attempts)`,
      context: {
        attemptHistory: state.history,
        persistentIssues,
        suggestedAction:
          'Manual intervention needed - automated retries are not resolving the issues'
      }
    };
  }

  // Missing dependencies/config → human
  const hasDependencyIssue = validatorResult.issues.some(issue =>
    /missing dependency|module not found|package not installed|config file not found/i.test(
      issue
    )
  );
  if (hasDependencyIssue) {
    return {
      shouldEscalate: true,
      escalationLevel: 'human',
      reason: 'Missing dependencies or configuration files',
      context: {
        attemptHistory: state.history,
        persistentIssues,
        suggestedAction:
          'Install required dependencies or update configuration files manually'
      }
    };
  }

  // 3+ consecutive same issues → coordinator
  if (persistentIssues.length > 0 && state.currentAttempt >= 3) {
    return {
      shouldEscalate: true,
      escalationLevel: 'coordinator',
      reason: `Persistent issues detected after ${state.currentAttempt} attempts`,
      context: {
        attemptHistory: state.history,
        persistentIssues,
        suggestedAction:
          'Coordinator should re-evaluate approach or delegate to specialized agent'
      }
    };
  }

  // Critical validation failures → architect
  const hasCriticalFailure = validatorResult.checks.some(
    check => !check.passed && check.severity === 'critical'
  );
  if (hasCriticalFailure) {
    return {
      shouldEscalate: true,
      escalationLevel: 'architect',
      reason: 'Critical validation check failed',
      context: {
        attemptHistory: state.history,
        persistentIssues,
        suggestedAction:
          'Architect review needed to address fundamental design or implementation issues'
      }
    };
  }

  // Default - should not escalate
  return {
    shouldEscalate: false,
    escalationLevel: 'coordinator',
    reason: 'No escalation needed',
    context: {
      attemptHistory: state.history,
      persistentIssues,
      suggestedAction: 'Continue with retry logic'
    }
  };
}

// ============================================================================
// Failure Reporting
// ============================================================================

/**
 * Generate comprehensive failure report
 *
 * @param taskId - ID of the task that failed
 * @param state - Final retry state
 * @param finalValidatorResult - Last validator result (if available)
 * @returns Detailed failure report
 */
export function generateFailureReport(
  taskId: string,
  state: RetryState,
  finalValidatorResult?: ValidatorOutput
): FailureReport {
  const persistentIssues = finalValidatorResult
    ? detectPersistentIssues(state, finalValidatorResult)
    : [];

  const attemptSummary = state.history.map(attempt => ({
    attempt: attempt.attemptNumber,
    action: attempt.action,
    issues: attempt.issues
  }));

  // Collect all evidence from attempts
  const evidence: VerificationEvidence[] = [];
  for (const attempt of state.history) {
    if (attempt.builderResult?.evidence) {
      for (const ev of attempt.builderResult.evidence) {
        evidence.push({
          type: 'validator_approval',
          passed: ev.passed,
          output: ev.content,
          timestamp: new Date(attempt.timestamp),
          metadata: {
            attemptNumber: attempt.attemptNumber,
            evidenceType: ev.type
          }
        });
      }
    }
  }

  // Root cause analysis
  const rootCauseAnalysis = analyzeRootCause(state, persistentIssues);

  // Recommended action
  const recommendedAction = generateRecommendedAction(
    state,
    persistentIssues,
    finalValidatorResult
  );

  return {
    taskId,
    totalAttempts: state.history.length,
    finalStatus: state.status === 'escalated' ? 'escalated' : 'failed',
    persistentIssues,
    attemptSummary,
    rootCauseAnalysis,
    recommendedAction,
    evidence
  };
}

/**
 * Analyze root cause of failure
 *
 * @param state - Retry state
 * @param persistentIssues - Issues that persisted across attempts
 * @returns Root cause analysis
 */
function analyzeRootCause(state: RetryState, persistentIssues: string[]): string {
  if (persistentIssues.length > 0) {
    return `The following issues persisted across ${state.history.length} attempts: ${persistentIssues.join('; ')}. This suggests either a fundamental misunderstanding of the requirements or a limitation in the builder's capability to address these specific issues.`;
  }

  if (state.history.length === 0) {
    return 'No retry attempts were made - builder phase may have failed immediately.';
  }

  const lastAttempt = state.history[state.history.length - 1];
  if (lastAttempt.issues.length === 0) {
    return 'Last attempt had no specific issues recorded - failure may be due to timeout or system error.';
  }

  return `Last attempt failed with the following issues: ${lastAttempt.issues.join('; ')}. The builder was unable to resolve these within the retry limit.`;
}

/**
 * Generate recommended action based on failure analysis
 *
 * @param state - Retry state
 * @param persistentIssues - Persistent issues
 * @param finalValidatorResult - Final validator result
 * @returns Recommended action
 */
function generateRecommendedAction(
  state: RetryState,
  persistentIssues: string[],
  finalValidatorResult?: ValidatorOutput
): string {
  // Check for escalation decision
  if (finalValidatorResult) {
    const escalation = determineEscalation(state, finalValidatorResult);
    if (escalation.shouldEscalate) {
      return escalation.context.suggestedAction;
    }
  }

  // Check for specific issue patterns
  if (persistentIssues.some(issue => /security|vulnerability/i.test(issue))) {
    return 'Escalate to security architect for vulnerability assessment and secure coding guidance.';
  }

  if (persistentIssues.some(issue => /missing dependency|module not found/i.test(issue))) {
    return 'Install missing dependencies or update package.json/requirements.txt as needed.';
  }

  if (persistentIssues.some(issue => /type error|type mismatch/i.test(issue))) {
    return 'Review type definitions and ensure proper type annotations throughout the codebase.';
  }

  // Generic recommendations
  if (state.history.length >= 5) {
    return 'Consider breaking the task into smaller, more manageable subtasks or seeking human guidance.';
  }

  return 'Review the issues from the last attempt and consider alternative implementation approaches.';
}

// ============================================================================
// Retry Prompt Generation
// ============================================================================

/**
 * Create retry prompt for builder
 *
 * Generates a prompt that instructs the builder to retry with feedback
 * from the validator.
 *
 * @param originalTask - Original task description
 * @param previousResult - Previous builder result
 * @param validatorFeedback - Feedback from validator
 * @param attemptNumber - Current attempt number
 * @returns Formatted retry prompt
 */
export function createRetryPrompt(
  originalTask: string,
  previousResult: AgentOutput,
  validatorFeedback: ValidatorOutput,
  attemptNumber: number
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# RETRY REQUEST (Attempt ${attemptNumber})`);
  lines.push('');

  // Original task
  lines.push('## Original Task');
  lines.push(originalTask);
  lines.push('');

  // Previous attempt summary
  lines.push('## Previous Attempt Summary');
  lines.push(`- Status: ${previousResult.status}`);
  lines.push(`- Summary: ${previousResult.summary}`);
  lines.push('');

  // Validation feedback
  lines.push('## Validation Feedback');
  lines.push(`**Validator Status:** ${validatorFeedback.status}`);
  lines.push('');

  // Failed checks
  const failedChecks = validatorFeedback.checks.filter(c => !c.passed);
  if (failedChecks.length > 0) {
    lines.push('### Failed Checks');
    failedChecks.forEach(check => {
      lines.push(
        `- **${check.name}** (${check.severity}): ${check.evidence}`
      );
    });
    lines.push('');
  }

  // Issues to fix
  if (validatorFeedback.issues.length > 0) {
    lines.push('### Issues to Fix');
    validatorFeedback.issues.forEach((issue, idx) => {
      lines.push(`${idx + 1}. ${issue}`);
    });
    lines.push('');
  }

  // Recommendations
  if (validatorFeedback.recommendations.length > 0) {
    lines.push('### Recommendations');
    validatorFeedback.recommendations.forEach((rec, idx) => {
      lines.push(`${idx + 1}. ${rec}`);
    });
    lines.push('');
  }

  // Instructions
  lines.push('## Instructions');
  lines.push('');
  lines.push(
    `This is attempt ${attemptNumber}. Focus on fixing the specific issues identified above.`
  );
  lines.push('');
  lines.push('**Priority Actions:**');
  lines.push('1. Address all failed validation checks, starting with critical severity');
  lines.push('2. Fix the issues listed above in order');
  lines.push('3. Follow the recommendations provided by the validator');
  lines.push('4. Run self-validation before submitting');
  lines.push('');
  lines.push(
    '**Important:** Do not introduce new issues while fixing existing ones. Test thoroughly.'
  );

  return lines.join('\n');
}
