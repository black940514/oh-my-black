/**
 * Standard Agent Output Schema
 * Defines the contract for all agent responses in the system
 */

// === Required Fields (6) ===
export interface AgentOutput {
  /** Unique identifier of the agent that produced this output */
  agentId: string;

  /** Identifier of the task this output relates to */
  taskId: string;

  /** Execution status */
  status: 'success' | 'partial' | 'failed' | 'blocked';

  /** Human-readable summary of what was accomplished */
  summary: string;

  /** Concrete evidence supporting the status claim */
  evidence: Evidence[];

  /** Unix timestamp (milliseconds) when output was produced */
  timestamp: number;

  // === Optional Fields (4) ===
  /** Files that were created, modified, or deleted */
  filesModified?: FileChange[];

  /** Result of agent's self-validation attempts */
  selfValidation?: SelfValidationResult;

  /** Suggested next actions for continuation */
  nextSteps?: string[];

  /** Learnings or insights discovered during execution */
  learnings?: string[];
}

/**
 * Evidence item supporting agent's status claim
 */
export interface Evidence {
  /** Type of evidence provided */
  type: 'command_output' | 'test_result' | 'diagnostics' | 'manual_check';

  /** Actual evidence content (command output, test results, etc.) */
  content: string;

  /** Whether this evidence indicates success or failure */
  passed: boolean;
}

/**
 * Information about a file change
 */
export interface FileChange {
  /** Absolute or relative path to the changed file */
  path: string;

  /** Type of change performed */
  changeType: 'created' | 'modified' | 'deleted';

  /** Whether LSP diagnostics are clean for this file */
  diagnosticsClean: boolean;
}

/**
 * Self-validation attempt results
 */
export interface SelfValidationResult {
  /** Whether self-validation passed */
  passed: boolean;

  /** Number of retry attempts made */
  retryCount: number;

  /** Last error message if validation failed */
  lastError?: string;
}

/**
 * Validation result for schema compliance
 */
export interface AgentOutputValidationResult {
  /** Whether the output is valid */
  valid: boolean;

  /** Critical errors that prevent acceptance */
  errors: string[];

  /** Non-critical warnings about quality or completeness */
  warnings: string[];
}
