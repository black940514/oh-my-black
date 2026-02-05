/**
 * Wiring Check Hook
 *
 * Runs after Edit/Write tool calls to detect potential wiring issues
 * in modified files.
 */

import { runWiringAudit, isWiringClean, formatWiringReport } from '../../features/wiring-audit/index.js';
import type { WiringAuditOptions, WiringAuditResult } from '../../features/wiring-audit/types.js';

export interface WiringCheckHookConfig {
  /** Enable/disable the hook */
  enabled?: boolean;
  /** Only check modified files (vs full codebase) */
  incrementalOnly?: boolean;
  /** Fail on warnings too (not just errors) */
  strict?: boolean;
  /** Specific checks to run */
  checks?: {
    placeholders?: boolean;
    unusedExports?: boolean;
    registry?: boolean;
    pathDrift?: boolean;
  };
}

export const DEFAULT_WIRING_CHECK_CONFIG: Required<WiringCheckHookConfig> = {
  enabled: true,
  incrementalOnly: true,
  strict: false,
  checks: {
    placeholders: true,
    unusedExports: false,  // Can be noisy
    registry: true,
    pathDrift: true
  }
};

/**
 * Run wiring check on specified files
 */
export async function runWiringCheck(
  modifiedFiles: string[],
  config: WiringCheckHookConfig = {}
): Promise<WiringCheckResult> {
  const finalConfig: Required<WiringCheckHookConfig> = {
    enabled: config.enabled ?? DEFAULT_WIRING_CHECK_CONFIG.enabled,
    incrementalOnly: config.incrementalOnly ?? DEFAULT_WIRING_CHECK_CONFIG.incrementalOnly,
    strict: config.strict ?? DEFAULT_WIRING_CHECK_CONFIG.strict,
    checks: {
      placeholders: config.checks?.placeholders ?? DEFAULT_WIRING_CHECK_CONFIG.checks.placeholders,
      unusedExports: config.checks?.unusedExports ?? DEFAULT_WIRING_CHECK_CONFIG.checks.unusedExports,
      registry: config.checks?.registry ?? DEFAULT_WIRING_CHECK_CONFIG.checks.registry,
      pathDrift: config.checks?.pathDrift ?? DEFAULT_WIRING_CHECK_CONFIG.checks.pathDrift
    }
  };

  if (!finalConfig.enabled) {
    return { passed: true, skipped: true, message: 'Wiring check disabled' };
  }

  const auditOptions: WiringAuditOptions = {
    paths: finalConfig.incrementalOnly ? modifiedFiles : undefined,
    checkPlaceholders: finalConfig.checks.placeholders,
    checkUnusedExports: finalConfig.checks.unusedExports,
    checkRegistry: finalConfig.checks.registry,
    checkPathDrift: finalConfig.checks.pathDrift
  };

  const result = await runWiringAudit(auditOptions);
  const passed = finalConfig.strict
    ? isWiringClean(result)
    : result.summary.errorCount === 0;

  return {
    passed,
    skipped: false,
    result,
    message: passed
      ? `Wiring check passed (${result.summary.totalFiles} files)`
      : `Wiring issues found: ${result.summary.errorCount} errors, ${result.summary.warningCount} warnings`,
    report: formatWiringReport(result)
  };
}

export interface WiringCheckResult {
  passed: boolean;
  skipped: boolean;
  message: string;
  result?: WiringAuditResult;
  report?: string;
}

/**
 * Create a post-tool hook for wiring checks
 */
export function createWiringCheckHook(config?: WiringCheckHookConfig) {
  return {
    name: 'wiring-check',
    description: 'Check for wiring issues after code modifications',
    events: ['post-edit', 'post-write'],
    handler: async (context: { files: string[] }) => {
      return runWiringCheck(context.files, config);
    }
  };
}
