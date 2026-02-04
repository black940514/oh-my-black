/**
 * Validator Integration Agent - Cross-Component Verification
 *
 * Specialized validator for checking integration between components.
 * Part of the ohmyblack Builder-Validator cycle system.
 *
 * Responsibilities:
 * - Cross-component compatibility verification
 * - API contract validation
 * - Interface consistency checks
 * - Integration point verification
 * - Dependency compatibility validation
 */

import type { AgentConfig, AgentPromptMetadata } from './types.js';
import { loadAgentPrompt } from './utils.js';

export const VALIDATOR_INTEGRATION_PROMPT_METADATA: AgentPromptMetadata = {
  category: 'reviewer',
  cost: 'CHEAP',
  promptAlias: 'validator-integration',
  triggers: [
    { domain: 'Integration', trigger: 'Cross-component compatibility verification' },
    { domain: 'API', trigger: 'API contract and interface validation' },
    { domain: 'Dependencies', trigger: 'Dependency compatibility checks' },
  ],
  useWhen: [
    'Multi-file or multi-component changes',
    'API or interface modifications',
    'Changes affecting multiple services',
    'Part of fullstack team B-V cycles',
  ],
  avoidWhen: [
    'Single-file syntax checks (use validator-syntax)',
    'Isolated logic verification (use validator-logic)',
    'Security-only reviews (use validator-security)',
  ],
};

export const validatorIntegrationAgent: AgentConfig = {
  name: 'validator-integration',
  description: 'Cross-component verification specialist (Sonnet). Validates API contracts, interface compatibility, and integration points in B-V cycles.',
  prompt: loadAgentPrompt('validator-integration'),
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'lsp_diagnostics', 'lsp_find_references'],
  model: 'sonnet',
  defaultModel: 'sonnet',
  metadata: VALIDATOR_INTEGRATION_PROMPT_METADATA
};
