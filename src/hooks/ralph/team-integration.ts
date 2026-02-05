/**
 * Team Integration for Ralph
 *
 * Optional team composition for ralph mode when --auto-team flag is used.
 */

import { selectTeamTemplate } from '../../features/smart-defaults/team-selector.js';
import type { RalphConfig, RalphTeamConfig } from './types.js';

export type { RalphConfig, RalphTeamConfig } from './types.js';

/**
 * Check if auto-team composition should be used
 */
export function shouldUseAutoTeam(config: RalphConfig): boolean {
  return config.autoTeam === true;
}

/**
 * Compose team for ralph based on task description and complexity
 */
export function composeTeamForRalph(
  taskDescription: string,
  complexity: number = 0.5,
  config?: RalphConfig
): RalphTeamConfig {
  // If explicit template is provided, use it
  if (config?.teamTemplate) {
    return getTeamByTemplate(config.teamTemplate);
  }

  // Otherwise, auto-select based on complexity
  if (complexity < 0.3) {
    return {
      agents: ['executor-low'],
      reasoning: 'Simple task - single lightweight executor',
      template: 'minimal'
    };
  } else if (complexity < 0.5) {
    return {
      agents: ['executor', 'validator-syntax'],
      reasoning: 'Standard task - executor with syntax validation',
      template: 'standard'
    };
  } else if (complexity < 0.7) {
    return {
      agents: ['executor', 'validator-syntax', 'validator-logic'],
      reasoning: 'Complex task - full validation coverage',
      template: 'robust'
    };
  } else if (complexity < 0.9) {
    return {
      agents: ['executor-high', 'validator-syntax', 'validator-logic', 'validator-security'],
      reasoning: 'Critical task - security-focused full team',
      template: 'secure'
    };
  } else {
    return {
      agents: ['executor-high', 'architect', 'validator-syntax', 'validator-logic', 'validator-security', 'validator-integration'],
      reasoning: 'Very complex task - fullstack team with architect oversight',
      template: 'fullstack'
    };
  }
}

/**
 * Get team composition by explicit template
 */
function getTeamByTemplate(template: string): RalphTeamConfig {
  switch (template) {
    case 'minimal':
      return {
        agents: ['executor-low'],
        reasoning: 'Minimal template - lightweight executor',
        template: 'minimal'
      };
    case 'standard':
      return {
        agents: ['executor', 'validator-syntax'],
        reasoning: 'Standard template - executor with syntax validation',
        template: 'standard'
      };
    case 'robust':
      return {
        agents: ['executor', 'validator-syntax', 'validator-logic'],
        reasoning: 'Robust template - full validation',
        template: 'robust'
      };
    case 'secure':
      return {
        agents: ['executor-high', 'validator-syntax', 'validator-logic', 'validator-security'],
        reasoning: 'Secure template - security-focused team',
        template: 'secure'
      };
    case 'fullstack':
      return {
        agents: ['executor-high', 'architect', 'validator-syntax', 'validator-logic', 'validator-security', 'validator-integration'],
        reasoning: 'Fullstack template - complete team with oversight',
        template: 'fullstack'
      };
    default:
      return {
        agents: ['executor'],
        reasoning: 'Default fallback - standard executor',
        template: 'standard'
      };
  }
}

/**
 * Estimate task complexity from description (simple heuristic)
 */
export function estimateComplexity(taskDescription: string): number {
  const desc = taskDescription.toLowerCase();
  let score = 0.3; // Base score

  // Complexity indicators
  const complexityKeywords = {
    simple: ['fix', 'update', 'change', 'add'],
    moderate: ['refactor', 'implement', 'create', 'build'],
    complex: ['architecture', 'system', 'integration', 'security', 'auth', 'database'],
    veryComplex: ['migrate', 'redesign', 'fullstack', 'distributed', 'scale']
  };

  if (complexityKeywords.simple.some(k => desc.includes(k))) score += 0.1;
  if (complexityKeywords.moderate.some(k => desc.includes(k))) score += 0.2;
  if (complexityKeywords.complex.some(k => desc.includes(k))) score += 0.3;
  if (complexityKeywords.veryComplex.some(k => desc.includes(k))) score += 0.4;

  // File count indicators
  if (desc.includes('multiple files') || desc.includes('several')) score += 0.15;
  if (desc.includes('across') || desc.includes('entire')) score += 0.2;

  return Math.min(1.0, score);
}
