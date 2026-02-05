/**
 * Verification Types
 *
 * Common types for verification protocol used across ralph, ultrawork, and autopilot
 */

/**
 * Types of verification evidence
 */
export type VerificationEvidenceType =
  | 'build_success'
  | 'test_pass'
  | 'lint_clean'
  | 'functionality_verified'
  | 'architect_approval'
  | 'todo_complete'
  | 'error_free'
  | 'wiring_proof';

/**
 * Extended evidence types for Ohmyblack Builder-Validator cycle
 */
export type OhmyblackEvidenceType =
  | VerificationEvidenceType
  | 'syntax_clean'
  | 'validator_approval'
  | 'integration_pass';

/**
 * Proof of verification for a specific check
 */
export interface VerificationEvidence {
  /** Type of evidence (supports both standard and ohmyblack types) */
  type: VerificationEvidenceType | OhmyblackEvidenceType;
  /** Whether the check passed */
  passed: boolean;
  /** Command that was run to verify (if applicable) */
  command?: string;
  /** Output from the verification command */
  output?: string;
  /** Error message if check failed */
  error?: string;
  /** Timestamp when evidence was collected */
  timestamp: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A single verification check requirement
 */
export interface VerificationCheck {
  /** Unique identifier for this check */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this check verifies */
  description: string;
  /** Type of evidence this check produces (supports both standard and ohmyblack types) */
  evidenceType: VerificationEvidenceType | OhmyblackEvidenceType;
  /** Whether this check is required for completion */
  required: boolean;
  /** Command to run for verification (if applicable) */
  command?: string;
  /** Whether this check has been completed */
  completed: boolean;
  /** Evidence collected for this check */
  evidence?: VerificationEvidence;
}

/**
 * Ohmyblack-specific verification check with extended evidence types
 */
export interface OhmyblackVerificationCheck extends Omit<VerificationCheck, 'evidenceType'> {
  /** Type of evidence this check produces (ohmyblack-specific) */
  evidenceType: OhmyblackEvidenceType;
}

/**
 * Complete verification protocol definition
 */
export interface VerificationProtocol {
  /** Protocol name (e.g., "ralph", "autopilot", "ultrawork") */
  name: string;
  /** Description of what this protocol verifies */
  description: string;
  /** List of verification checks to perform */
  checks: VerificationCheck[];
  /** Whether all required checks must pass */
  strictMode: boolean;
  /** Optional custom validation function */
  customValidator?: (checklist: VerificationChecklist) => Promise<ValidationResult>;
}

/**
 * Current state of verification checks
 */
export interface VerificationChecklist {
  /** Protocol being followed */
  protocol: VerificationProtocol;
  /** Timestamp when verification started */
  startedAt: Date;
  /** Timestamp when verification completed (if finished) */
  completedAt?: Date;
  /** All checks with their current status */
  checks: VerificationCheck[];
  /** Overall completion status */
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  /** Summary of results */
  summary?: VerificationSummary;
}

/**
 * Summary of verification results
 */
export interface VerificationSummary {
  /** Total number of checks */
  total: number;
  /** Number of checks passed */
  passed: number;
  /** Number of checks failed */
  failed: number;
  /** Number of checks skipped (non-required) */
  skipped: number;
  /** Whether all required checks passed */
  allRequiredPassed: boolean;
  /** List of failed check IDs */
  failedChecks: string[];
  /** Overall verdict */
  verdict: 'approved' | 'rejected' | 'incomplete';
}

/**
 * Result of validation
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation message */
  message: string;
  /** List of issues found */
  issues: string[];
  /** Recommendations for fixing issues */
  recommendations?: string[];
}

/**
 * Options for running verification
 */
export interface VerificationOptions {
  /** Whether to run checks in parallel */
  parallel?: boolean;
  /** Timeout per check in milliseconds */
  timeout?: number;
  /** Whether to stop on first failure */
  failFast?: boolean;
  /** Whether to skip non-required checks */
  skipOptional?: boolean;
  /** Custom working directory */
  cwd?: string;
}

/**
 * Report format options
 */
export interface ReportOptions {
  /** Include detailed evidence in report */
  includeEvidence?: boolean;
  /** Include command output in report */
  includeOutput?: boolean;
  /** Format for report */
  format?: 'text' | 'markdown' | 'json';
  /** Whether to colorize output (for terminal) */
  colorize?: boolean;
}

/**
 * Options for Builder-Validator cycle execution
 */
export interface ValidationCycleOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Agent to use for validation (e.g., 'architect', 'validator', 'self') */
  validatorAgent: string;
  /** Timeout per cycle in milliseconds */
  timeout: number;
}

/**
 * Result of a Builder-Validator cycle
 */
export interface ValidationCycleResult {
  /** Whether the entire cycle succeeded */
  success: boolean;
  /** Whether the builder phase passed */
  builderPassed: boolean;
  /** Whether the validator phase passed */
  validatorPassed: boolean;
  /** Number of retries performed */
  retryCount: number;
  /** All evidence collected during the cycle */
  evidence: VerificationEvidence[];
  /** List of issues found during validation */
  issues: string[];
}
