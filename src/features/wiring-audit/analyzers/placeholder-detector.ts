/**
 * Placeholder Detector
 *
 * Detects TODO, FIXME, and other placeholder code patterns that indicate
 * incomplete or temporary implementations.
 */

import * as fs from 'fs';
import type { WiringIssue } from '../types.js';

/**
 * Patterns that indicate placeholder code
 */
const PLACEHOLDER_PATTERNS = [
  { pattern: /\bTODO\b/gi, name: 'TODO' },
  { pattern: /\bFIXME\b/gi, name: 'FIXME' },
  { pattern: /\bXXX\b/gi, name: 'XXX' },
  { pattern: /\bHACK\b/gi, name: 'HACK' },
  { pattern: /throw new Error\(['"]Not implemented['"]\)/gi, name: 'Not implemented error' },
  { pattern: /console\.log\(['"]placeholder['"]\)/gi, name: 'Placeholder console.log' },
  { pattern: /\/\/ placeholder/gi, name: 'Placeholder comment' },
  { pattern: /\/\*\s*placeholder\s*\*\//gi, name: 'Placeholder block comment' },
];

/**
 * Detect placeholder code in a file
 *
 * @param filePath Path to file to analyze
 * @returns Array of wiring issues found
 */
export function detectPlaceholders(filePath: string): WiringIssue[] {
  const issues: WiringIssue[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const { pattern, name } of PLACEHOLDER_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        pattern.lastIndex = 0; // Reset regex state

        if (pattern.test(line)) {
          issues.push({
            type: 'placeholder_detected',
            severity: 'warning',
            file: filePath,
            line: i + 1,
            message: `Placeholder detected: ${name}`,
            suggestion: 'Complete the implementation or remove placeholder code',
          });
        }
      }
    }
  } catch (error) {
    // If file cannot be read, skip it
    console.warn(`Failed to read file ${filePath}:`, error);
  }

  return issues;
}

/**
 * Check if a string contains placeholder patterns
 *
 * @param content Content to check
 * @returns True if placeholders detected
 */
export function hasPlaceholders(content: string): boolean {
  return PLACEHOLDER_PATTERNS.some(({ pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(content);
  });
}
