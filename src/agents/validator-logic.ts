/**
 * Validator Logic Agent - Functional Requirement Verification
 *
 * Specialized validator for checking functional correctness and logic.
 * Part of the ohmyblack Builder-Validator cycle system.
 *
 * Responsibilities:
 * - Verify code implements requirements correctly
 * - Check logic flow and edge cases
 * - Validate business logic
 * - Ensure functional completeness
 */

import type { AgentConfig, AgentPromptMetadata } from './types.js';
import { loadAgentPrompt } from './utils.js';

export const VALIDATOR_LOGIC_PROMPT_METADATA: AgentPromptMetadata = {
  category: 'reviewer',
  cost: 'CHEAP',
  promptAlias: 'validator-logic',
  triggers: [
    { domain: 'Verification', trigger: 'Functional requirement validation' },
    { domain: 'Logic', trigger: 'Business logic verification' },
    { domain: 'Correctness', trigger: 'Implementation correctness checks' },
  ],
  useWhen: [
    'After builder completes implementation',
    'Verify code meets functional requirements',
    'Check logic flow and edge cases',
    'Part of B-V cycle for functional validation',
  ],
  avoidWhen: [
    'Syntax checking only (use validator-syntax)',
    'Security vulnerabilities (use validator-security)',
    'Cross-service integration (use validator-integration)',
  ],
};

export const validatorLogicAgent: AgentConfig = {
  name: 'validator-logic',
  description: 'Functional requirement verification specialist (Sonnet). Validates code logic, requirements compliance, and functional correctness in B-V cycles.',
  prompt: loadAgentPrompt('validator-logic'),
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'lsp_diagnostics'],
  model: 'sonnet',
  defaultModel: 'sonnet',
  metadata: VALIDATOR_LOGIC_PROMPT_METADATA
};
