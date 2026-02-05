/**
 * Team Integration for Autopilot
 *
 * Integrates TeamAutoComposer with autopilot when --ohmyblack mode is enabled.
 */

import { join } from 'node:path';
import { TeamAutoComposer, type CompositionResult } from '../../features/team/auto-composer.js';
import { MetaPromptGenerator } from '../../features/meta-prompt/generator.js';
import type { TaskAnalysis, DecompositionResult } from '../../features/task-decomposer/types.js';
import type { AutopilotConfig, AutopilotState } from './types.js';

/**
 * Check if ohmyblack team composition should be used
 */
export function shouldUseTeamComposition(config: AutopilotConfig): boolean {
  return config.ohmyblack?.enabled === true && config.ohmyblack?.autoTeamComposition !== false;
}

/**
 * Compose a team for the autopilot task
 */
export function composeTeamForAutopilot(
  analysis: TaskAnalysis,
  decomposition?: DecompositionResult,
  config?: AutopilotConfig
): CompositionResult | undefined {
  if (!config || !shouldUseTeamComposition(config)) {
    return undefined;
  }

  // Create generator with templates directory if meta-prompts are enabled
  let generator: MetaPromptGenerator | undefined;

  if (config.ohmyblack?.useMetaPrompts !== false) {
    // Default templates directory (adjust path as needed)
    const templatesDir = join(process.cwd(), '.omb', 'templates');
    generator = new MetaPromptGenerator({
      templatesDir,
      includeMetadata: true
    });
  }

  const composer = new TeamAutoComposer(generator);

  return composer.composeTeam({
    analysis,
    decomposition,
    constraints: {
      validationType: config.ohmyblack?.defaultValidationLevel
    }
  });
}

/**
 * Get team composition for current autopilot state
 */
export function getTeamFromState(state: AutopilotState): CompositionResult | undefined {
  return state.teamComposition;
}
