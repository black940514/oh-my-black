/**
 * Ultrawork Types
 *
 * Type definitions for ultrawork mode configuration and state.
 */

export interface UltraworkConfig {
  /** Enable automatic team composition */
  autoTeam?: boolean;
  /** Team template to use (overrides auto-selection) */
  teamTemplate?: 'minimal' | 'standard' | 'robust' | 'secure' | 'fullstack';
}

export interface UltraworkTeamConfig {
  /** Agents selected for the team */
  agents: string[];
  /** Reasoning for team composition */
  reasoning: string;
  /** Template used (if any) */
  template?: string;
}

export interface UltraworkState {
  /** Whether ultrawork mode is currently active */
  active: boolean;
  /** When ultrawork was activated */
  started_at: string;
  /** The original prompt that triggered ultrawork */
  original_prompt: string;
  /** Session ID the mode is bound to */
  session_id?: string;
  /** Project path for isolation */
  project_path?: string;
  /** Number of times the mode has been reinforced (for metrics) */
  reinforcement_count: number;
  /** Last time the mode was checked/reinforced */
  last_checked_at: string;
  /** Whether this ultrawork session is linked to a ralph-loop session */
  linked_to_ralph?: boolean;
}
