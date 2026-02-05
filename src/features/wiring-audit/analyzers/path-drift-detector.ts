/**
 * Path Drift Detector
 *
 * Detects inconsistent path usage in the codebase, such as legacy paths
 * (.omc instead of .omb) or old naming conventions (sisyphus instead of oh-my-black).
 */

import * as fs from 'fs';
import type { WiringIssue } from '../types.js';

/**
 * Path drift patterns to detect
 */
const PATH_DRIFT_PATTERNS = [
  {
    pattern: /\.omc\//g,
    name: 'Legacy .omc directory',
    suggestion: 'Replace with .omb/',
    severity: 'error' as const,
  },
  {
    pattern: /['"`]\.omc['"]/g,
    name: 'Legacy .omc path reference',
    suggestion: 'Replace with .omb',
    severity: 'error' as const,
  },
  {
    pattern: /\bsisyphus\b/gi,
    name: 'Legacy sisyphus naming',
    suggestion: 'Replace with oh-my-black',
    severity: 'error' as const,
  },
  {
    pattern: /\.claude\/\.omc/g,
    name: 'Invalid nested path',
    suggestion: 'Use either ~/.claude/ or .omb/ but not both',
    severity: 'error' as const,
  },
  {
    pattern: /~\/\.claude\/\.omb/g,
    name: 'Prohibited ~/.claude/.omb path',
    suggestion: 'Use ~/.omb/ for global state instead',
    severity: 'error' as const,
  },
];

/**
 * Detect path drift issues in a file
 *
 * @param filePath Path to file to analyze
 * @returns Array of wiring issues found
 */
export function detectPathDrift(filePath: string): WiringIssue[] {
  const issues: WiringIssue[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const { pattern, name, suggestion, severity } of PATH_DRIFT_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        pattern.lastIndex = 0; // Reset regex state

        if (pattern.test(line)) {
          issues.push({
            type: 'path_drift',
            severity,
            file: filePath,
            line: i + 1,
            message: `Path drift detected: ${name}`,
            suggestion,
          });
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to read file ${filePath}:`, error);
  }

  return issues;
}

/**
 * Check if content has path drift issues
 *
 * @param content Content to check
 * @returns True if path drift detected
 */
export function hasPathDrift(content: string): boolean {
  return PATH_DRIFT_PATTERNS.some(({ pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(content);
  });
}

/**
 * Suggest fix for path drift issue
 *
 * @param line Line with path drift
 * @returns Suggested corrected line
 */
export function suggestPathFix(line: string): string {
  let fixed = line;

  // Replace .omc with .omb
  fixed = fixed.replace(/\.omc\//g, '.omb/');
  fixed = fixed.replace(/['"`]\.omc['"]/g, '".omb"');

  // Replace sisyphus with oh-my-black
  fixed = fixed.replace(/\bsisyphus\b/gi, 'oh-my-black');

  // Fix nested paths
  fixed = fixed.replace(/\.claude\/\.omc/g, '.omb');
  fixed = fixed.replace(/~\/\.claude\/\.omb/g, '~/.omb');

  return fixed;
}
