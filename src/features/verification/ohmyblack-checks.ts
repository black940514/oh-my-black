/**
 * Ohmyblack Verification Checks
 *
 * Extended verification checks for Builder-Validator cycle used in ohmyblack workflow.
 * These checks complement STANDARD_CHECKS with syntax validation, independent validator
 * approval, and cross-component integration verification.
 */

import type {
  OhmyblackVerificationCheck,
  VerificationEvidence,
  ValidationCycleOptions,
  ValidationCycleResult,
  OhmyblackEvidenceType
} from './types.js';

/**
 * Ohmyblack-specific verification checks
 */
export const OHMYBLACK_CHECKS: Record<string, OhmyblackVerificationCheck> = {
  SYNTAX_CLEAN: {
    id: 'syntax_clean',
    name: 'Syntax Clean',
    description: 'No syntax errors after edit',
    evidenceType: 'syntax_clean',
    required: true,
    completed: false
  },
  VALIDATOR_APPROVAL: {
    id: 'validator_approval',
    name: 'Validator Approval',
    description: 'Independent validator approved the change',
    evidenceType: 'validator_approval',
    required: true,
    completed: false
  },
  INTEGRATION_PASS: {
    id: 'integration_pass',
    name: 'Integration Pass',
    description: 'Cross-component integration verified',
    evidenceType: 'integration_pass',
    required: false,
    completed: false
  }
};

/**
 * Validation type for Builder-Validator cycle
 */
export type ValidationType = 'self-only' | 'validator' | 'architect';

/**
 * Builder result passed to the validation cycle
 */
export interface BuilderResult {
  /** Whether the builder completed successfully */
  success: boolean;
  /** Files modified by the builder */
  filesModified: string[];
  /** Any errors encountered */
  errors: string[];
  /** Output from the builder */
  output?: string;
  /** Evidence from builder phase */
  evidence?: VerificationEvidence;
}

/**
 * Run a Builder-Validator cycle
 *
 * This implements the core Builder-Validator pattern:
 * 1. Builder makes changes
 * 2. Validator independently verifies
 * 3. If validation fails, retry with feedback
 * 4. Repeat until success or max retries
 *
 * @param builderResult - Result from the builder phase
 * @param validationType - Type of validation to perform
 * @param options - Cycle options (maxRetries, validatorAgent, timeout)
 * @returns ValidationCycleResult with success status and collected evidence
 */
export async function runBuilderValidatorCycle(
  builderResult: BuilderResult,
  validationType: ValidationType,
  options: ValidationCycleOptions
): Promise<ValidationCycleResult> {
  const { maxRetries, validatorAgent, timeout } = options;

  const result: ValidationCycleResult = {
    success: false,
    builderPassed: builderResult.success,
    validatorPassed: false,
    retryCount: 0,
    evidence: [],
    issues: []
  };

  // If builder failed, no point in validation
  if (!builderResult.success) {
    result.issues.push('Builder phase failed');
    result.issues.push(...builderResult.errors);
    if (builderResult.evidence) {
      result.evidence.push(builderResult.evidence);
    }
    return result;
  }

  // Add builder evidence if present
  if (builderResult.evidence) {
    result.evidence.push(builderResult.evidence);
  }

  // Run validation cycle
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    result.retryCount = attempt;

    try {
      const validationResult = await runValidation(
        builderResult,
        validationType,
        validatorAgent,
        timeout
      );

      result.evidence.push(validationResult.evidence);

      if (validationResult.passed) {
        result.validatorPassed = true;
        result.success = true;
        return result;
      }

      // Validation failed, collect issues for potential retry
      result.issues.push(...validationResult.issues);

      // If this was the last attempt, break
      if (attempt >= maxRetries) {
        break;
      }

      // For self-only validation, don't retry
      if (validationType === 'self-only') {
        break;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.issues.push(`Validation error on attempt ${attempt + 1}: ${errorMessage}`);

      // Create error evidence
      const errorEvidence: VerificationEvidence = {
        type: 'validator_approval',
        passed: false,
        error: errorMessage,
        timestamp: new Date()
      };
      result.evidence.push(errorEvidence);

      // On timeout or critical error, stop retrying
      if (errorMessage.includes('timeout')) {
        break;
      }
    }
  }

  return result;
}

/**
 * Internal validation runner
 */
async function runValidation(
  builderResult: BuilderResult,
  validationType: ValidationType,
  validatorAgent: string,
  timeout: number
): Promise<{ passed: boolean; evidence: VerificationEvidence; issues: string[] }> {
  const startTime = Date.now();
  const issues: string[] = [];

  // Simulate validation based on type
  // In real implementation, this would delegate to the appropriate agent
  switch (validationType) {
    case 'self-only':
      // Self validation: basic syntax and error checks
      return {
        passed: builderResult.errors.length === 0,
        evidence: {
          type: 'syntax_clean',
          passed: builderResult.errors.length === 0,
          timestamp: new Date(),
          metadata: {
            validationType: 'self-only',
            filesChecked: builderResult.filesModified.length,
            duration: Date.now() - startTime
          }
        },
        issues: builderResult.errors
      };

    case 'validator':
      // Validator agent approval
      // In real implementation: spawn validator agent to review changes
      return {
        passed: true, // Placeholder - would be determined by validator agent
        evidence: {
          type: 'validator_approval',
          passed: true,
          timestamp: new Date(),
          metadata: {
            validationType: 'validator',
            validatorAgent,
            filesReviewed: builderResult.filesModified,
            duration: Date.now() - startTime
          }
        },
        issues: []
      };

    case 'architect':
      // Architect-level deep validation
      // In real implementation: spawn architect agent for comprehensive review
      return {
        passed: true, // Placeholder - would be determined by architect agent
        evidence: {
          type: 'architect_approval',
          passed: true,
          timestamp: new Date(),
          metadata: {
            validationType: 'architect',
            validatorAgent: 'architect',
            filesReviewed: builderResult.filesModified,
            deepAnalysis: true,
            duration: Date.now() - startTime
          }
        },
        issues: []
      };

    default:
      throw new Error(`Unknown validation type: ${validationType}`);
  }
}

/**
 * Create an Ohmyblack verification check with custom command
 */
export function createOhmyblackCheck(
  type: keyof typeof OHMYBLACK_CHECKS,
  command?: string
): OhmyblackVerificationCheck {
  const baseCheck = OHMYBLACK_CHECKS[type];
  return {
    ...baseCheck,
    command,
    completed: false
  };
}

/**
 * Check if all Ohmyblack required checks passed
 */
export function allOhmyblackChecksPassed(
  evidence: VerificationEvidence[]
): boolean {
  const requiredTypes: OhmyblackEvidenceType[] = ['syntax_clean', 'validator_approval'];

  return requiredTypes.every(requiredType =>
    evidence.some(e => e.type === requiredType && e.passed)
  );
}
