/**
 * Ralph Types
 *
 * Type definitions for ralph mode configuration and state.
 */

export interface RalphConfig {
  /** Maximum iterations before stopping */
  maxIterations?: number;
  /** Disable auto-activation of ultrawork (default: false - ultrawork is enabled) */
  disableUltrawork?: boolean;
  /** Enable automatic team composition */
  autoTeam?: boolean;
  /** Team template to use (overrides auto-selection) */
  teamTemplate?: 'minimal' | 'standard' | 'robust' | 'secure' | 'fullstack';
}

export interface RalphTeamConfig {
  /** Agents selected for the team */
  agents: string[];
  /** Reasoning for team composition */
  reasoning: string;
  /** Template used (if any) */
  template?: string;
}
