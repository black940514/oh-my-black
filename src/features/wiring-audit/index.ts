/**
 * Wiring Audit Module
 *
 * Static analysis tool for detecting wiring issues in the codebase.
 * Identifies placeholders, unused exports, registry inconsistencies,
 * and path drift to ensure codebase health.
 *
 * @example
 * ```typescript
 * import { runWiringAudit, formatWiringReport } from './wiring-audit';
 *
 * const result = await runWiringAudit({
 *   paths: ['src/**\/*.ts'],
 *   checkPlaceholders: true,
 *   checkPathDrift: true,
 * });
 *
 * console.log(formatWiringReport(result));
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  WiringAuditResult,
  WiringAuditOptions,
  WiringAuditSummary,
  WiringIssue,
  DEFAULT_AUDIT_OPTIONS,
} from './types.js';
import {
  detectPlaceholders,
  detectPathDrift,
  detectUnusedExports,
  checkRegistries,
} from './analyzers/index.js';

/**
 * Run a complete wiring audit
 *
 * @param options Audit configuration options
 * @returns Audit results with all detected issues
 */
export async function runWiringAudit(
  options?: WiringAuditOptions
): Promise<WiringAuditResult> {
  // Merge with defaults
  const opts: Required<WiringAuditOptions> = {
    paths: options?.paths ?? ['src/**/*.ts', 'skills/**/*.md'],
    ignore: options?.ignore ?? ['node_modules/**', 'dist/**', '*.test.ts', '**/*.test.ts'],
    checkPlaceholders: options?.checkPlaceholders ?? true,
    checkUnusedExports: options?.checkUnusedExports ?? true,
    checkRegistry: options?.checkRegistry ?? true,
    checkPathDrift: options?.checkPathDrift ?? true,
    checkOrphanHud: options?.checkOrphanHud ?? true,
  };

  const allIssues: WiringIssue[] = [];

  // Find all files to analyze
  const filePaths = await findFilesToAudit(opts.paths, opts.ignore);

  // Run analyzers
  if (opts.checkPlaceholders) {
    for (const filePath of filePaths) {
      const issues = detectPlaceholders(filePath);
      allIssues.push(...issues);
    }
  }

  if (opts.checkPathDrift) {
    for (const filePath of filePaths) {
      const issues = detectPathDrift(filePath);
      allIssues.push(...issues);
    }
  }

  if (opts.checkUnusedExports) {
    // Only check TypeScript files for unused exports
    const tsFiles = filePaths.filter(f => f.endsWith('.ts'));
    const issues = detectUnusedExports(tsFiles);
    allIssues.push(...issues);
  }

  if (opts.checkRegistry) {
    const projectRoot = process.cwd();
    const issues = checkRegistries(projectRoot);
    allIssues.push(...issues);
  }

  // Generate summary
  const summary = generateSummary(allIssues, filePaths);

  return {
    passed: summary.errorCount === 0,
    issues: allIssues,
    summary,
  };
}

/**
 * Check if a path matches any of the ignore patterns
 *
 * @param filePath Path to check
 * @param ignorePatterns Patterns to match against
 * @returns True if path should be ignored
 */
function shouldIgnore(filePath: string, ignorePatterns: string[]): boolean {
  return ignorePatterns.some(pattern => {
    // Convert glob pattern to regex
    const regex = new RegExp('^' + pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.') + '$');
    return regex.test(filePath);
  });
}

/**
 * Check if a path matches a glob pattern
 *
 * @param filePath Path to check
 * @param pattern Glob pattern
 * @returns True if path matches
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regex = new RegExp('^' + pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.') + '$');
  return regex.test(filePath);
}

/**
 * Recursively find files in a directory
 *
 * @param dir Directory to search
 * @param ignorePatterns Patterns to ignore
 * @returns Array of file paths
 */
function findFilesRecursive(dir: string, ignorePatterns: string[]): string[] {
  const results: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(process.cwd(), fullPath);

      if (shouldIgnore(relativePath, ignorePatterns)) {
        continue;
      }

      if (entry.isDirectory()) {
        results.push(...findFilesRecursive(fullPath, ignorePatterns));
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Failed to read directory ${dir}:`, error);
  }

  return results;
}

/**
 * Find files to audit based on glob patterns
 *
 * @param patterns Glob patterns to match
 * @param ignore Patterns to ignore
 * @returns Array of absolute file paths
 */
async function findFilesToAudit(
  patterns: string[],
  ignore: string[]
): Promise<string[]> {
  const allFiles: Set<string> = new Set();

  for (const pattern of patterns) {
    // Extract directory and extension from pattern
    // e.g., "src/**/*.ts" -> dir: "src", ext: ".ts"
    const parts = pattern.split('**/');
    const baseDir = parts[0] || '.';
    const extensionPattern = parts[parts.length - 1];

    // Find all files in base directory
    const files = findFilesRecursive(baseDir, ignore);

    // Filter by pattern
    for (const file of files) {
      const relativePath = path.relative(process.cwd(), file);
      if (matchesPattern(relativePath, pattern)) {
        allFiles.add(file);
      }
    }
  }

  return Array.from(allFiles);
}

/**
 * Generate audit summary statistics
 *
 * @param issues All detected issues
 * @param filePaths All files that were audited
 * @returns Summary statistics
 */
function generateSummary(
  issues: WiringIssue[],
  filePaths: string[]
): WiringAuditSummary {
  const filesWithIssues = new Set(issues.map(i => i.file)).size;

  return {
    totalFiles: filePaths.length,
    filesWithIssues,
    errorCount: issues.filter(i => i.severity === 'error').length,
    warningCount: issues.filter(i => i.severity === 'warning').length,
    infoCount: issues.filter(i => i.severity === 'info').length,
  };
}

/**
 * Format audit results as a human-readable report
 *
 * @param result Audit results to format
 * @returns Formatted markdown report
 */
export function formatWiringReport(result: WiringAuditResult): string {
  const lines: string[] = [];

  // Header
  lines.push('# Wiring Audit Report');
  lines.push('');
  lines.push(`**Status:** ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Files:** ${result.summary.totalFiles}`);
  lines.push(`- **Files with Issues:** ${result.summary.filesWithIssues}`);
  lines.push(`- **Errors:** ${result.summary.errorCount}`);
  lines.push(`- **Warnings:** ${result.summary.warningCount}`);
  lines.push(`- **Info:** ${result.summary.infoCount}`);
  lines.push('');

  // Issues by severity
  if (result.issues.length === 0) {
    lines.push('## Issues');
    lines.push('');
    lines.push('No issues found! 🎉');
    lines.push('');
  } else {
    const errorIssues = result.issues.filter(i => i.severity === 'error');
    const warningIssues = result.issues.filter(i => i.severity === 'warning');
    const infoIssues = result.issues.filter(i => i.severity === 'info');

    if (errorIssues.length > 0) {
      lines.push('## Errors');
      lines.push('');
      for (const issue of errorIssues) {
        lines.push(formatIssue(issue));
      }
      lines.push('');
    }

    if (warningIssues.length > 0) {
      lines.push('## Warnings');
      lines.push('');
      for (const issue of warningIssues) {
        lines.push(formatIssue(issue));
      }
      lines.push('');
    }

    if (infoIssues.length > 0) {
      lines.push('## Informational');
      lines.push('');
      for (const issue of infoIssues) {
        lines.push(formatIssue(issue));
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Format a single issue for display
 *
 * @param issue Issue to format
 * @returns Formatted issue string
 */
function formatIssue(issue: WiringIssue): string {
  const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
  const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;

  let formatted = `${icon} **${issue.message}**\n`;
  formatted += `   - Location: \`${location}\`\n`;
  formatted += `   - Type: ${issue.type}\n`;

  if (issue.suggestion) {
    formatted += `   - Suggestion: ${issue.suggestion}\n`;
  }

  return formatted;
}

/**
 * Check if wiring audit passed (no errors)
 *
 * @param result Audit results to check
 * @returns True if no errors were found
 */
export function isWiringClean(result: WiringAuditResult): boolean {
  return result.passed;
}

/**
 * Get issues by type
 *
 * @param result Audit results
 * @param type Issue type to filter by
 * @returns Filtered issues
 */
export function getIssuesByType(
  result: WiringAuditResult,
  type: WiringIssue['type']
): WiringIssue[] {
  return result.issues.filter(i => i.type === type);
}

/**
 * Get issues by severity
 *
 * @param result Audit results
 * @param severity Severity level to filter by
 * @returns Filtered issues
 */
export function getIssuesBySeverity(
  result: WiringAuditResult,
  severity: WiringIssue['severity']
): WiringIssue[] {
  return result.issues.filter(i => i.severity === severity);
}

/**
 * Get issues by file
 *
 * @param result Audit results
 * @param filePath File path to filter by
 * @returns Filtered issues
 */
export function getIssuesByFile(
  result: WiringAuditResult,
  filePath: string
): WiringIssue[] {
  return result.issues.filter(i => i.file === filePath);
}

// Re-export types
export type {
  WiringAuditResult,
  WiringAuditOptions,
  WiringAuditSummary,
  WiringIssue,
  WiringIssueType,
} from './types.js';

export { DEFAULT_AUDIT_OPTIONS } from './types.js';
