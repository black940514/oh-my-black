/**
 * Wiring Audit Analyzers
 *
 * Re-exports all analyzer modules for convenient importing.
 */

export {
  detectPlaceholders,
  hasPlaceholders,
} from './placeholder-detector.js';

export {
  extractExports,
  isSymbolImported,
  isIndexFile,
  detectUnusedExports,
} from './unused-export-detector.js';

export {
  extractSkillNames,
  extractAgentNames,
  isRegistered,
  checkSkillRegistry,
  checkAgentRegistry,
  checkHookRegistry,
  checkRegistries,
} from './registry-checker.js';

export {
  detectPathDrift,
  hasPathDrift,
  suggestPathFix,
} from './path-drift-detector.js';
