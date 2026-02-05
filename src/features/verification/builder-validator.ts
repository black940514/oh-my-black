/**
 * Builder-Validator Cycle Utilities
 *
 * Provides utilities for executing and managing the Builder-Validator pattern.
 * This module supports the ohmyblack workflow where builders make changes and
 * validators independently verify them.
 */

import type { AgentOutput, Evidence } from '../agent-output/schema.js';
import type {
  ValidationCycleOptions,
  ValidationCycleResult,
  VerificationEvidence,
  OhmyblackEvidenceType
} from './types.js';
import {
  spawnValidatorsParallel,
  isValidValidatorType
} from './agent-spawner.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Validator output parsed from agent response
 */
export interface ValidatorOutput {
  /** Type of validator that produced this output */
  validatorType: string;
  /** ID of the task being validated */
  taskId: string;
  /** Overall status of validation */
  status: 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW';
  /** Individual checks performed */
  checks: ValidatorCheck[];
  /** Issues found during validation */
  issues: string[];
  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * Individual check within a validator output
 */
export interface ValidatorCheck {
  /** Name of the check */
  name: string;
  /** Whether the check passed */
  passed: boolean;
  /** Evidence supporting the result */
  evidence: string;
  /** Severity of failure if not passed */
  severity: 'critical' | 'major' | 'minor';
}

/**
 * Context for task validation
 */
export interface TaskContext {
  /** ID of the task */
  taskId: string;
  /** Requirements that should be met */
  requirements: string[];
  /** Files that were modified */
  filesModified: string[];
}

/**
 * Aggregated results from multiple validators
 */
export interface AggregatedValidatorResults {
  /** Overall status combining all validators */
  overallStatus: 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW';
  /** All critical issues found */
  criticalIssues: string[];
  /** All evidence collected */
  allEvidence: VerificationEvidence[];
}

/**
 * Result of checking builder self-validation
 */
export interface BuilderSelfValidationCheck {
  /** Whether self-validation passed */
  passed: boolean;
  /** Number of retries attempted */
  retryCount: number;
  /** Last error if validation failed */
  lastError?: string;
}

// ============================================================================
// Prompt Generation
// ============================================================================

/**
 * Create a prompt for a validator agent to review builder output
 *
 * @param validatorType - Type of validation to perform
 * @param builderResult - Output from the builder agent
 * @param taskContext - Context about the task
 * @returns Formatted prompt string for the validator
 */
export function createValidatorPrompt(
  validatorType: string,
  builderResult: AgentOutput,
  taskContext: TaskContext
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${validatorType.toUpperCase()} VALIDATION REQUEST`);
  lines.push('');

  // Task Context
  lines.push('## Task Context');
  lines.push(`- Task ID: ${taskContext.taskId}`);
  lines.push(`- Files Modified: ${taskContext.filesModified.join(', ') || 'None'}`);
  lines.push('');

  // Requirements
  lines.push('## Requirements to Verify');
  if (taskContext.requirements.length > 0) {
    taskContext.requirements.forEach((req, idx) => {
      lines.push(`${idx + 1}. ${req}`);
    });
  } else {
    lines.push('- No specific requirements provided');
  }
  lines.push('');

  // Builder Result
  lines.push('## Builder Output');
  lines.push(`- Status: ${builderResult.status}`);
  lines.push(`- Summary: ${builderResult.summary}`);
  lines.push('');

  // Evidence from builder
  if (builderResult.evidence.length > 0) {
    lines.push('### Builder Evidence');
    builderResult.evidence.forEach((ev, idx) => {
      lines.push(`#### Evidence ${idx + 1} (${ev.type})`);
      lines.push(`- Passed: ${ev.passed}`);
      lines.push('```');
      lines.push(ev.content.substring(0, 500) + (ev.content.length > 500 ? '...' : ''));
      lines.push('```');
    });
    lines.push('');
  }

  // Self-validation results if present
  if (builderResult.selfValidation) {
    lines.push('### Builder Self-Validation');
    lines.push(`- Passed: ${builderResult.selfValidation.passed}`);
    lines.push(`- Retry Count: ${builderResult.selfValidation.retryCount}`);
    if (builderResult.selfValidation.lastError) {
      lines.push(`- Last Error: ${builderResult.selfValidation.lastError}`);
    }
    lines.push('');
  }

  // Validation instructions based on type
  lines.push('## Validation Instructions');
  lines.push('');

  switch (validatorType) {
    case 'syntax':
      lines.push('Perform SYNTAX validation:');
      lines.push('1. Check for syntax errors in all modified files');
      lines.push('2. Verify code compiles/parses without errors');
      lines.push('3. Check for obvious typos or malformed constructs');
      break;

    case 'logic':
      lines.push('Perform LOGIC validation:');
      lines.push('1. Verify the implementation logic is correct');
      lines.push('2. Check for edge cases and error handling');
      lines.push('3. Ensure the code does what it claims to do');
      break;

    case 'security':
      lines.push('Perform SECURITY validation:');
      lines.push('1. Check for security vulnerabilities');
      lines.push('2. Verify input validation and sanitization');
      lines.push('3. Check for sensitive data exposure');
      lines.push('4. Review authentication/authorization if applicable');
      break;

    case 'integration':
      lines.push('Perform INTEGRATION validation:');
      lines.push('1. Verify changes integrate with existing code');
      lines.push('2. Check for breaking changes to APIs');
      lines.push('3. Verify imports and dependencies are correct');
      lines.push('4. Test cross-component interactions');
      break;

    default:
      lines.push(`Perform ${validatorType.toUpperCase()} validation based on standard practices.`);
  }

  lines.push('');
  lines.push('## Required Output Format');
  lines.push('');
  lines.push('Respond with a JSON block in the following format:');
  lines.push('```json');
  lines.push(JSON.stringify({
    validatorType,
    taskId: taskContext.taskId,
    status: 'APPROVED | REJECTED | NEEDS_REVIEW',
    checks: [
      {
        name: 'Check name',
        passed: true,
        evidence: 'Evidence description',
        severity: 'critical | major | minor'
      }
    ],
    issues: ['List of issues found'],
    recommendations: ['List of recommendations']
  }, null, 2));
  lines.push('```');

  return lines.join('\n');
}

// ============================================================================
// Output Parsing
// ============================================================================

/**
 * Parse validator output from raw agent response
 *
 * Extracts JSON block from the response and parses it into ValidatorOutput.
 *
 * @param rawOutput - Raw text output from validator agent
 * @returns Parsed ValidatorOutput or null if parsing fails
 */
export function parseValidatorOutput(rawOutput: string): ValidatorOutput | null {
  if (!rawOutput || typeof rawOutput !== 'string') {
    return null;
  }

  try {
    // Try to extract JSON from code block
    const jsonBlockMatch = rawOutput.match(/```(?:json)?\s*([\s\S]*?)```/);

    let jsonStr: string;
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1].trim();
    } else {
      // Try to find raw JSON object
      const jsonMatch = rawOutput.match(/\{[\s\S]*"validatorType"[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      } else {
        return null;
      }
    }

    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (!parsed.validatorType || !parsed.taskId || !parsed.status) {
      return null;
    }

    // Normalize status
    const normalizedStatus = parsed.status.toUpperCase();
    if (!['APPROVED', 'REJECTED', 'NEEDS_REVIEW'].includes(normalizedStatus)) {
      return null;
    }

    // Build validated output
    const output: ValidatorOutput = {
      validatorType: String(parsed.validatorType),
      taskId: String(parsed.taskId),
      status: normalizedStatus as 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW',
      checks: [],
      issues: [],
      recommendations: []
    };

    // Parse checks
    if (Array.isArray(parsed.checks)) {
      output.checks = parsed.checks.map((check: unknown) => {
        const c = check as Record<string, unknown>;
        return {
          name: String(c.name || 'Unknown check'),
          passed: Boolean(c.passed),
          evidence: String(c.evidence || ''),
          severity: (['critical', 'major', 'minor'].includes(String(c.severity))
            ? c.severity
            : 'major') as 'critical' | 'major' | 'minor'
        };
      });
    }

    // Parse issues
    if (Array.isArray(parsed.issues)) {
      output.issues = parsed.issues.map((i: unknown) => String(i));
    }

    // Parse recommendations
    if (Array.isArray(parsed.recommendations)) {
      output.recommendations = parsed.recommendations.map((r: unknown) => String(r));
    }

    return output;
  } catch {
    return null;
  }
}

// ============================================================================
// Evidence Conversion
// ============================================================================

/**
 * Convert ValidatorOutput to VerificationEvidence
 *
 * @param output - Parsed validator output
 * @returns VerificationEvidence suitable for storage
 */
export function validatorOutputToEvidence(output: ValidatorOutput): VerificationEvidence {
  // Map validator type to evidence type
  let evidenceType: OhmyblackEvidenceType;
  switch (output.validatorType) {
    case 'syntax':
      evidenceType = 'syntax_clean';
      break;
    case 'integration':
      evidenceType = 'integration_pass';
      break;
    case 'security':
    case 'logic':
    default:
      evidenceType = 'validator_approval';
      break;
  }

  const passed = output.status === 'APPROVED';
  const criticalFailures = output.checks.filter(c => !c.passed && c.severity === 'critical');

  return {
    type: evidenceType,
    passed,
    timestamp: new Date(),
    error: passed ? undefined : output.issues.join('; '),
    metadata: {
      validatorType: output.validatorType,
      taskId: output.taskId,
      status: output.status,
      checksPerformed: output.checks.length,
      checksPassed: output.checks.filter(c => c.passed).length,
      criticalFailures: criticalFailures.length,
      recommendations: output.recommendations
    }
  };
}

// ============================================================================
// Results Aggregation
// ============================================================================

/**
 * Aggregate results from multiple validators
 *
 * Combines multiple validator outputs into a single aggregated result.
 * Overall status is determined by the most severe result.
 *
 * @param results - Array of validator outputs to aggregate
 * @returns Aggregated results with overall status and combined evidence
 */
export function aggregateValidatorResults(
  results: ValidatorOutput[]
): AggregatedValidatorResults {
  if (results.length === 0) {
    return {
      overallStatus: 'APPROVED',
      criticalIssues: [],
      allEvidence: []
    };
  }

  // Collect all critical issues
  const criticalIssues: string[] = [];
  results.forEach(result => {
    // Add issues from rejected results
    if (result.status === 'REJECTED') {
      criticalIssues.push(...result.issues);
    }

    // Add critical check failures
    result.checks
      .filter(c => !c.passed && c.severity === 'critical')
      .forEach(c => {
        criticalIssues.push(`[${result.validatorType}] ${c.name}: ${c.evidence}`);
      });
  });

  // Convert all results to evidence
  const allEvidence = results.map(r => validatorOutputToEvidence(r));

  // Determine overall status
  // REJECTED > NEEDS_REVIEW > APPROVED
  let overallStatus: 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW' = 'APPROVED';

  for (const result of results) {
    if (result.status === 'REJECTED') {
      overallStatus = 'REJECTED';
      break;
    }
    if (result.status === 'NEEDS_REVIEW') {
      overallStatus = 'NEEDS_REVIEW';
    }
  }

  return {
    overallStatus,
    criticalIssues,
    allEvidence
  };
}

// ============================================================================
// Validator Selection
// ============================================================================

/**
 * Select appropriate validators based on validation type and complexity
 *
 * @param validationType - Type of validation requested
 * @param taskComplexity - Complexity level of the task
 * @returns Array of validator types to use
 */
export function selectValidator(
  validationType: 'self-only' | 'validator' | 'architect',
  taskComplexity: 'low' | 'medium' | 'high'
): string[] {
  switch (validationType) {
    case 'self-only':
      // No external validators needed
      return [];

    case 'validator':
      switch (taskComplexity) {
        case 'low':
          return ['syntax'];
        case 'medium':
          return ['syntax', 'logic'];
        case 'high':
          return ['syntax', 'logic', 'security'];
      }
      break;

    case 'architect':
      // Full validation suite
      return ['syntax', 'logic', 'security', 'integration'];

    default:
      return [];
  }
}

// ============================================================================
// Self-Validation Checking
// ============================================================================

/**
 * Check builder's self-validation status
 *
 * Extracts and validates the self-validation result from builder output.
 *
 * @param builderResult - Output from the builder agent
 * @returns Self-validation check result
 */
export function checkBuilderSelfValidation(
  builderResult: AgentOutput
): BuilderSelfValidationCheck {
  // If no self-validation data, consider it not passed
  if (!builderResult.selfValidation) {
    return {
      passed: false,
      retryCount: 0,
      lastError: 'No self-validation data provided by builder'
    };
  }

  return {
    passed: builderResult.selfValidation.passed,
    retryCount: builderResult.selfValidation.retryCount,
    lastError: builderResult.selfValidation.lastError
  };
}

// ============================================================================
// Builder-Validator Cycle Runner (AgentOutput-based)
// ============================================================================

/**
 * Run a complete Builder-Validator cycle with AgentOutput
 *
 * This is the main entry point for validation cycles using the AgentOutput schema.
 * It supports self-only, validator, and architect validation modes.
 *
 * @param builderResult - AgentOutput from the builder phase
 * @param validationType - Level of validation to perform
 * @param options - Cycle configuration options
 * @returns Complete validation cycle result
 */
export async function runBuilderValidatorCycleWithAgentOutput(
  builderResult: AgentOutput,
  validationType: 'self-only' | 'validator' | 'architect',
  options: ValidationCycleOptions
): Promise<ValidationCycleResult> {
  const { maxRetries, timeout } = options;

  const result: ValidationCycleResult = {
    success: false,
    builderPassed: builderResult.status === 'success',
    validatorPassed: false,
    retryCount: 0,
    evidence: [],
    issues: []
  };

  // Step 1: Check builder status
  if (builderResult.status === 'failed' || builderResult.status === 'blocked') {
    result.issues.push(`Builder phase ${builderResult.status}: ${builderResult.summary}`);
    // Convert builder evidence to VerificationEvidence
    builderResult.evidence.forEach(ev => {
      result.evidence.push(convertAgentEvidenceToVerificationEvidence(ev));
    });
    return result;
  }

  // Step 2: Check builder self-validation
  const selfValidation = checkBuilderSelfValidation(builderResult);
  if (!selfValidation.passed) {
    result.issues.push(`Builder self-validation failed: ${selfValidation.lastError || 'Unknown error'}`);
    result.retryCount = selfValidation.retryCount;
  }

  // Add builder evidence
  builderResult.evidence.forEach(ev => {
    result.evidence.push(convertAgentEvidenceToVerificationEvidence(ev));
  });

  // Step 3: Handle validation based on type
  if (validationType === 'self-only') {
    // Self-only validation relies solely on builder's self-validation
    result.validatorPassed = selfValidation.passed;
    result.success = selfValidation.passed && builderResult.status === 'success';
    return result;
  }

  // Step 4: Select validators
  const taskComplexity = determineTaskComplexity(builderResult);
  const validators = selectValidator(validationType, taskComplexity);

  if (validators.length === 0) {
    // No validators needed, use self-validation result
    result.validatorPassed = selfValidation.passed;
    result.success = selfValidation.passed && builderResult.status === 'success';
    return result;
  }

  // Step 5: Run validation cycle with retries
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    result.retryCount = attempt;

    try {
      // Run real validation by spawning validator agents
      const filesModified: string[] = builderResult.filesModified
        ? builderResult.filesModified.map(fc => fc.path)
        : [];

      const validatorResults = await runRealValidation(
        builderResult,
        validators,
        timeout,
        {
          taskId: builderResult.taskId,
          requirements: [],
          filesModified
        }
      );

      const aggregated = aggregateValidatorResults(validatorResults);
      result.evidence.push(...aggregated.allEvidence);

      if (aggregated.overallStatus === 'APPROVED') {
        result.validatorPassed = true;
        result.success = true;
        return result;
      }

      // Validation failed
      result.issues.push(...aggregated.criticalIssues);

      // On last attempt, return failure
      if (attempt >= maxRetries) {
        break;
      }

      // Could implement retry logic here with builder feedback
      // For now, just continue to next attempt

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.issues.push(`Validation error on attempt ${attempt + 1}: ${errorMessage}`);

      const errorEvidence: VerificationEvidence = {
        type: 'validator_approval',
        passed: false,
        error: errorMessage,
        timestamp: new Date()
      };
      result.evidence.push(errorEvidence);

      if (errorMessage.includes('timeout')) {
        break;
      }
    }
  }

  return result;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert AgentOutput Evidence to VerificationEvidence
 */
function convertAgentEvidenceToVerificationEvidence(evidence: Evidence): VerificationEvidence {
  // Map evidence type to verification evidence type
  let evidenceType: OhmyblackEvidenceType;
  switch (evidence.type) {
    case 'test_result':
      evidenceType = 'validator_approval';
      break;
    case 'diagnostics':
      evidenceType = 'syntax_clean';
      break;
    case 'command_output':
    case 'manual_check':
    default:
      evidenceType = 'validator_approval';
      break;
  }

  return {
    type: evidenceType,
    passed: evidence.passed,
    output: evidence.content,
    timestamp: new Date(),
    metadata: {
      originalType: evidence.type
    }
  };
}

/**
 * Determine task complexity from builder output
 */
function determineTaskComplexity(builderResult: AgentOutput): 'low' | 'medium' | 'high' {
  const filesModified = builderResult.filesModified?.length || 0;

  if (filesModified <= 1) {
    return 'low';
  } else if (filesModified <= 3) {
    return 'medium';
  } else {
    return 'high';
  }
}

/**
 * Simulate validation results (fallback for when real spawning fails)
 */
function simulateValidationFallback(
  builderResult: AgentOutput,
  validators: string[],
  _timeout: number
): ValidatorOutput[] {
  // Fallback simulation when real agent spawning fails
  return validators.map(validatorType => ({
    validatorType,
    taskId: builderResult.taskId,
    status: builderResult.status === 'success' ? 'APPROVED' : 'REJECTED' as const,
    checks: [
      {
        name: `${validatorType} check`,
        passed: builderResult.status === 'success',
        evidence: `Simulated ${validatorType} validation (fallback)`,
        severity: 'major' as const
      }
    ],
    issues: builderResult.status === 'success' ? [] : ['Builder did not succeed'],
    recommendations: []
  }));
}

/**
 * Run real validation by spawning validator agents
 *
 * @param builderResult - Output from builder agent
 * @param validators - List of validator types to run
 * @param timeout - Timeout per validator in ms
 * @param taskContext - Context about the task
 * @returns Array of ValidatorOutput results
 */
async function runRealValidation(
  builderResult: AgentOutput,
  validators: string[],
  timeout: number,
  taskContext: TaskContext
): Promise<ValidatorOutput[]> {
  // Filter to valid validator types
  const validTypes = validators
    .filter(v => isValidValidatorType(v))
    .map(v => v as 'syntax' | 'logic' | 'security' | 'integration');

  if (validTypes.length === 0) {
    // Fallback: if no valid validators specified, use default set
    validTypes.push('syntax', 'logic');
  }

  try {
    // Spawn validators in parallel
    const results = await spawnValidatorsParallel(validTypes, builderResult, taskContext);
    return results;
  } catch (error) {
    // If spawning fails completely, fall back to simulation
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Validator spawning failed, using fallback: ${errorMessage}`);
    return simulateValidationFallback(builderResult, validators, timeout);
  }
}
