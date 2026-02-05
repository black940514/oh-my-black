/**
 * Unused Export Detector
 *
 * Detects exported symbols that are never imported anywhere in the codebase.
 * Helps identify dead code and unnecessary exports.
 */

import * as fs from 'fs';
import type { WiringIssue } from '../types.js';

/**
 * Extract exported symbols from a TypeScript file
 *
 * @param filePath Path to file to analyze
 * @returns Array of exported symbol names
 */
export function extractExports(filePath: string): string[] {
  const exports: string[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Match: export function name(...), export const name, export class Name, etc.
    const namedExportPattern = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
    let match;
    while ((match = namedExportPattern.exec(content)) !== null) {
      exports.push(match[1]);
    }

    // Match: export { name1, name2 }
    const exportListPattern = /export\s*\{([^}]+)\}/g;
    while ((match = exportListPattern.exec(content)) !== null) {
      const names = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]);
      exports.push(...names);
    }

    // Match: export default name (if it's an identifier)
    const defaultExportPattern = /export\s+default\s+(\w+)/g;
    while ((match = defaultExportPattern.exec(content)) !== null) {
      exports.push(match[1]);
    }
  } catch (error) {
    console.warn(`Failed to extract exports from ${filePath}:`, error);
  }

  return exports;
}

/**
 * Check if a symbol is imported in a file
 *
 * @param filePath Path to file to check
 * @param symbolName Symbol to look for
 * @returns True if symbol is imported
 */
export function isSymbolImported(filePath: string, symbolName: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Match: import { symbol } from '...'
    const namedImportPattern = new RegExp(`import\\s*\\{[^}]*\\b${symbolName}\\b[^}]*\\}\\s*from`, 'g');
    if (namedImportPattern.test(content)) {
      return true;
    }

    // Match: import symbol from '...'
    const defaultImportPattern = new RegExp(`import\\s+${symbolName}\\s+from`, 'g');
    if (defaultImportPattern.test(content)) {
      return true;
    }

    // Match: import * as name from '...' (might contain the symbol)
    const namespaceImportPattern = /import\s+\*\s+as\s+\w+\s+from/g;
    if (namespaceImportPattern.test(content)) {
      // If namespace import exists, assume symbol might be used
      return true;
    }
  } catch (error) {
    console.warn(`Failed to check imports in ${filePath}:`, error);
  }

  return false;
}

/**
 * Check if a file is an index file (re-export barrel)
 *
 * @param filePath Path to check
 * @returns True if file is an index file
 */
export function isIndexFile(filePath: string): boolean {
  return filePath.endsWith('/index.ts') || filePath.endsWith('/index.js');
}

/**
 * Detect unused exports in files
 *
 * @param filePaths All files to analyze
 * @returns Array of wiring issues for unused exports
 */
export function detectUnusedExports(filePaths: string[]): WiringIssue[] {
  const issues: WiringIssue[] = [];
  const exportMap = new Map<string, { file: string; exports: string[] }>();

  // Build export map (excluding index files)
  for (const filePath of filePaths) {
    if (isIndexFile(filePath)) {
      continue; // Skip index files - they're re-export barrels
    }

    const exports = extractExports(filePath);
    if (exports.length > 0) {
      exportMap.set(filePath, { file: filePath, exports });
    }
  }

  // Check each export against all files
  exportMap.forEach(({ file: exportFile, exports }) => {
    for (const exportName of exports) {
      let isUsed = false;

      // Check if imported in any other file
      for (const checkFile of filePaths) {
        if (checkFile === exportFile) {
          continue; // Don't check the file against itself
        }

        if (isSymbolImported(checkFile, exportName)) {
          isUsed = true;
          break;
        }
      }

      if (!isUsed) {
        issues.push({
          type: 'unused_export',
          severity: 'info',
          file: exportFile,
          message: `Exported symbol '${exportName}' is never imported`,
          suggestion: 'Remove export or use the symbol elsewhere',
        });
      }
    }
  });

  return issues;
}
