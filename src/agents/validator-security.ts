/**
 * Validator Security Agent - Security Vulnerability Detection
 *
 * Specialized validator for security analysis and vulnerability detection.
 * Part of the ohmyblack Builder-Validator cycle system.
 *
 * Responsibilities:
 * - OWASP Top 10 vulnerability detection
 * - Secret/credential exposure checks
 * - Injection vulnerability analysis
 * - Authentication/authorization verification
 * - Secure coding practice validation
 */

import type { AgentConfig, AgentPromptMetadata } from './types.js';
import { loadAgentPrompt } from './utils.js';

export const VALIDATOR_SECURITY_PROMPT_METADATA: AgentPromptMetadata = {
  category: 'reviewer',
  cost: 'EXPENSIVE',
  promptAlias: 'validator-security',
  triggers: [
    { domain: 'Security', trigger: 'Vulnerability detection and security review' },
    { domain: 'Compliance', trigger: 'Security compliance verification' },
    { domain: 'Secrets', trigger: 'Credential and secret exposure detection' },
  ],
  useWhen: [
    'Code handles user input or authentication',
    'API endpoints or sensitive data operations',
    'Security-critical code changes',
    'Part of secure/fullstack team B-V cycles',
  ],
  avoidWhen: [
    'Simple syntax checks (use validator-syntax)',
    'Non-security functional verification (use validator-logic)',
    'Low-risk internal utilities',
  ],
};

export const validatorSecurityAgent: AgentConfig = {
  name: 'validator-security',
  description: 'Security vulnerability detection specialist (Opus). Detects OWASP Top 10 vulnerabilities, secrets exposure, and unsafe patterns. High-quality security analysis for B-V cycles.',
  prompt: loadAgentPrompt('validator-security'),
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'ast_grep_search'],
  model: 'opus',
  defaultModel: 'opus',
  metadata: VALIDATOR_SECURITY_PROMPT_METADATA
};
