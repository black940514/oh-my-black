/**
 * Validator Syntax Agent - Type/Syntax Verification
 *
 * Specialized validator for checking code syntax and type correctness.
 * Part of the ohmyblack Builder-Validator cycle system.
 *
 * Responsibilities:
 * - TypeScript/JavaScript type checking via tsc --noEmit
 * - Lint verification
 * - Syntax error detection
 * - Build verification
 */

import type { AgentConfig, AgentPromptMetadata } from './types.js';
import { loadAgentPrompt } from './utils.js';

export const VALIDATOR_SYNTAX_PROMPT_METADATA: AgentPromptMetadata = {
  category: 'reviewer',
  cost: 'CHEAP',
  promptAlias: 'validator-syntax',
  triggers: [
    { domain: 'Verification', trigger: 'Type checking and lint verification' },
    { domain: 'Build', trigger: 'Compilation error detection' },
    { domain: 'Syntax', trigger: 'Code syntax validation' },
  ],
  useWhen: [
    'After code changes need type verification',
    'Before commit to ensure build passes',
    'Part of B-V cycle for syntax validation',
    'Quick verification of TypeScript/JavaScript code',
  ],
  avoidWhen: [
    'Logic verification needed (use validator-logic)',
    'Security review needed (use validator-security)',
    'Cross-component integration checks (use validator-integration)',
  ],
};

export const validatorSyntaxAgent: AgentConfig = {
  name: 'validator-syntax',
  description: 'Type/syntax verification specialist (Haiku). Runs tsc --noEmit, lint checks, and syntax validation. Fast, cheap verification for B-V cycles.',
  prompt: loadAgentPrompt('validator-syntax'),
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'lsp_diagnostics', 'lsp_diagnostics_directory'],
  model: 'haiku',
  defaultModel: 'haiku',
  metadata: VALIDATOR_SYNTAX_PROMPT_METADATA
};
