/**
 * Wiring Audit Types
 *
 * Type definitions for the wiring audit static analysis module.
 * This module detects wiring issues in the codebase such as placeholders,
 * unused exports, registry inconsistencies, and path drift.
 */

/**
 * Result of a wiring audit
 */
export interface WiringAuditResult {
  /** Whether the audit passed (no errors) */
  passed: boolean;
  /** List of issues found */
  issues: WiringIssue[];
  /** Summary statistics */
  summary: WiringAuditSummary;
}

/**
 * A single wiring issue detected during audit
 */
export interface WiringIssue {
  /** Type of wiring issue */
  type: WiringIssueType;
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  /** File where issue was found */
  file: string;
  /** Line number (if applicable) */
  line?: number;
  /** Human-readable message */
  message: string;
  /** Suggested fix (if applicable) */
  suggestion?: string;
}

/**
 * Types of wiring issues that can be detected
 */
export type WiringIssueType =
  | 'placeholder_detected'      // TODO/FIXME/placeholder code
  | 'unused_export'             // Exported but never imported
  | 'registry_missing'          // Not registered in registry/index
  | 'path_drift'                // Inconsistent paths (.omc vs .omb)
  | 'orphan_hud'                // HUD element without producer
  | 'missing_entry_point'       // No entry point wiring
  | 'missing_call_site';        // Defined but never called

/**
 * Summary statistics from a wiring audit
 */
export interface WiringAuditSummary {
  /** Total files scanned */
  totalFiles: number;
  /** Files with at least one issue */
  filesWithIssues: number;
  /** Number of error-level issues */
  errorCount: number;
  /** Number of warning-level issues */
  warningCount: number;
  /** Number of info-level issues */
  infoCount: number;
}

/**
 * Options for configuring wiring audit behavior
 */
export interface WiringAuditOptions {
  /** Paths to audit (default: src/**\/*.ts, skills/**\/*.md) */
  paths?: string[];
  /** Patterns to ignore (default: node_modules, dist, *.test.ts) */
  ignore?: string[];
  /** Check for placeholder code (default: true) */
  checkPlaceholders?: boolean;
  /** Check for unused exports (default: true) */
  checkUnusedExports?: boolean;
  /** Check registry consistency (default: true) */
  checkRegistry?: boolean;
  /** Check for path drift (default: true) */
  checkPathDrift?: boolean;
  /** Check for orphan HUD elements (default: true) */
  checkOrphanHud?: boolean;
}

/**
 * Default audit options
 */
export const DEFAULT_AUDIT_OPTIONS: Required<WiringAuditOptions> = {
  paths: ['src/**/*.ts', 'skills/**/*.md'],
  ignore: ['node_modules/**', 'dist/**', '*.test.ts', '**/*.test.ts'],
  checkPlaceholders: true,
  checkUnusedExports: true,
  checkRegistry: true,
  checkPathDrift: true,
  checkOrphanHud: true,
};
