/**
 * Safety Rules Engine
 *
 * Detects and classifies destructive commands that could harm the codebase.
 * Used by PreToolUse hook to warn or block dangerous operations.
 */

// Destructive patterns organized by category
const DESTRUCTIVE_PATTERNS = {
  git: [
    { pattern: /git\s+checkout\s+--\s*\./, severity: 'block', reason: 'Discards all unstaged changes' },
    { pattern: /git\s+reset\s+--hard/, severity: 'block', reason: 'Discards all uncommitted changes' },
    { pattern: /git\s+push\s+.*--force/, severity: 'block', reason: 'Force push can overwrite remote history' },
    { pattern: /git\s+push\s+.*-f\b/, severity: 'block', reason: 'Force push can overwrite remote history' },
    { pattern: /git\s+clean\s+-f/, severity: 'block', reason: 'Removes untracked files permanently' },
    { pattern: /git\s+branch\s+-D/, severity: 'warn', reason: 'Force deletes branch regardless of merge status' },
    { pattern: /git\s+rebase\s+-i/, severity: 'warn', reason: 'Interactive rebase requires user input' },
  ],

  shell: [
    { pattern: /rm\s+-rf\s+\/(?!\w)/, severity: 'block', reason: 'Recursive delete from root - EXTREMELY DANGEROUS' },
    { pattern: /rm\s+-rf\s+~/, severity: 'block', reason: 'Recursive delete from home directory' },
    { pattern: /rm\s+-rf\s+\*/, severity: 'warn', reason: 'Recursive delete with wildcard' },
    { pattern: /chmod\s+777/, severity: 'warn', reason: 'Sets world-writable permissions' },
    { pattern: /chmod\s+-R\s+777/, severity: 'block', reason: 'Recursively sets dangerous permissions' },
    { pattern: /sudo\s+rm/, severity: 'block', reason: 'Elevated privilege deletion' },
    { pattern: />\s*\/dev\/sd[a-z]/, severity: 'block', reason: 'Writes directly to disk device' },
    { pattern: /mkfs\./, severity: 'block', reason: 'Formats filesystem' },
    { pattern: /dd\s+if=.*of=\/dev/, severity: 'block', reason: 'Direct disk write' },
  ],

  wrappers: [
    { pattern: /bash\s+-c\s+['"].*rm\s+-rf/, severity: 'warn', reason: 'Shell wrapper hiding rm -rf' },
    { pattern: /sh\s+-c\s+['"].*rm\s+-rf/, severity: 'warn', reason: 'Shell wrapper hiding rm -rf' },
    { pattern: /eval\s*\(/, severity: 'warn', reason: 'Dynamic code execution' },
  ],

  interpreters: [
    { pattern: /python[3]?\s+-c\s+['"].*os\.remove/, severity: 'warn', reason: 'Python one-liner with file deletion' },
    { pattern: /node\s+-e\s+['"].*unlink/, severity: 'warn', reason: 'Node one-liner with file deletion' },
    { pattern: /ruby\s+-e\s+['"].*File\.delete/, severity: 'warn', reason: 'Ruby one-liner with file deletion' },
  ]
};

// Always blocked regardless of mode
const ALWAYS_BLOCK = [
  /rm\s+-rf\s+\/$/,
  /rm\s+-rf\s+\/\s*$/,
  /:\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,  // Fork bomb
];

/**
 * Inline ReDoS safety check for user-provided regex patterns.
 * Cannot use npm packages since this runs as a standalone hook.
 * Detects common catastrophic backtracking patterns.
 * @param {string} pattern - Regex pattern string to validate
 * @returns {boolean} True if pattern is safe to use
 */
function isSafeRegex(pattern) {
  if (typeof pattern !== 'string' || pattern.length > 200) return false;
  try {
    new RegExp(pattern);
  } catch {
    return false; // Invalid regex syntax
  }
  // Detect nested quantifiers: (x+)+, (x*)+, (x+)*, (x*)*, (x{n,})+
  if (/\([^)]*[+*][^)]*\)[+*{]/.test(pattern)) return false;
  // Detect overlapping alternation with quantifiers: (a|a)+
  if (/\([^)]*\|[^)]*\)[+*{]/.test(pattern)) return false;
  return true;
}

/**
 * Check a command against safety rules
 * @param {string} command - The command to check
 * @param {object} config - Safety configuration
 * @param {string} [config.mode='warn'] - Safety mode: 'off', 'warn', 'strict', 'paranoid'
 * @param {string[]} [config.allowlist=[]] - Patterns to always allow
 * @param {string[]} [config.blocklist=[]] - Patterns to always block
 * @returns {{ blocked: boolean, reason: string, severity: 'allow'|'warn'|'block', pattern?: string, category?: string }}
 */
export function checkCommand(command, config = {}) {
  const { mode = 'warn', allowlist = [], blocklist = [] } = config;

  if (mode === 'off') {
    return { blocked: false, reason: '', severity: 'allow' };
  }

  // Check custom allowlist first (with ReDoS protection)
  for (const pattern of allowlist) {
    if (!isSafeRegex(pattern)) continue; // Skip unsafe patterns
    if (new RegExp(pattern).test(command)) {
      return { blocked: false, reason: 'Allowlisted', severity: 'allow' };
    }
  }

  // Check custom blocklist (with ReDoS protection)
  for (const pattern of blocklist) {
    if (!isSafeRegex(pattern)) continue; // Skip unsafe patterns
    if (new RegExp(pattern).test(command)) {
      return { blocked: true, reason: 'Custom blocklist', severity: 'block', pattern };
    }
  }

  // Always blocked patterns
  for (const pattern of ALWAYS_BLOCK) {
    if (pattern.test(command)) {
      return { blocked: true, reason: 'Critical safety violation', severity: 'block', pattern: pattern.toString() };
    }
  }

  // Check categorized patterns
  for (const [category, patterns] of Object.entries(DESTRUCTIVE_PATTERNS)) {
    for (const rule of patterns) {
      if (rule.pattern.test(command)) {
        const shouldBlock = (mode === 'strict' && rule.severity === 'warn') ||
                           (mode === 'paranoid') ||
                           (rule.severity === 'block');

        return {
          blocked: shouldBlock && mode !== 'warn',
          reason: rule.reason,
          severity: rule.severity,
          pattern: rule.pattern.toString(),
          category
        };
      }
    }
  }

  return { blocked: false, reason: '', severity: 'allow' };
}

/**
 * Get all defined rules (for documentation/audit)
 * @returns {object} All destructive patterns organized by category
 */
export function getAllRules() {
  return DESTRUCTIVE_PATTERNS;
}

/**
 * Validate safety config
 * @param {object} config - Configuration to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateConfig(config) {
  const validModes = ['off', 'warn', 'strict', 'paranoid'];
  if (config.mode && !validModes.includes(config.mode)) {
    return { valid: false, error: `Invalid mode: ${config.mode}` };
  }
  // Validate regex patterns in allowlist/blocklist
  for (const list of ['allowlist', 'blocklist']) {
    if (config[list]) {
      for (const pattern of config[list]) {
        if (!isSafeRegex(pattern)) {
          return { valid: false, error: `Unsafe regex pattern in ${list}: ${pattern}` };
        }
      }
    }
  }
  return { valid: true };
}

export default { checkCommand, getAllRules, validateConfig };
