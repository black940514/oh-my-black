/**
 * Skeptic Status HUD Element
 *
 * Displays continuous validation health status in the status line.
 */

import { join } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';

const SKEPTIC_STATE_DIR = '.omb/state/skeptic';

export interface SkepticHudConfig {
  enabled: boolean;
  showHealth: boolean;
  showTrend: boolean;
  showLastCheck: boolean;
  colorize: boolean;
}

const DEFAULT_CONFIG: SkepticHudConfig = {
  enabled: true,
  showHealth: true,
  showTrend: true,
  showLastCheck: true,
  colorize: true
};

interface HealthSnapshot {
  id: string;
  timestamp: string;
  buildStatus: string;
  typeCheckStatus: string;
  overallHealth: number;
}

/**
 * Get color for health score
 */
function getHealthColor(health: number): string {
  if (health >= 0.9) return '\x1b[32m';  // Green
  if (health >= 0.7) return '\x1b[33m';  // Yellow
  if (health >= 0.5) return '\x1b[36m';  // Cyan
  return '\x1b[31m';  // Red
}

const RESET = '\x1b[0m';

/**
 * Get the latest health snapshot
 */
function getLatestSnapshot(projectDir: string = process.cwd()): HealthSnapshot | null {
  const stateDir = join(projectDir, SKEPTIC_STATE_DIR);
  if (!existsSync(stateDir)) return null;

  const files = readdirSync(stateDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const latestFile = join(stateDir, files[0]);
  return JSON.parse(readFileSync(latestFile, 'utf-8'));
}

/**
 * Get health trend from recent snapshots
 */
function getHealthTrend(projectDir: string = process.cwd()): { trend: 'up' | 'down' | 'stable'; delta: number } {
  const stateDir = join(projectDir, SKEPTIC_STATE_DIR);
  if (!existsSync(stateDir)) return { trend: 'stable', delta: 0 };

  const files = readdirSync(stateDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, 5);  // Last 5 snapshots

  if (files.length < 2) return { trend: 'stable', delta: 0 };

  const snapshots = files.map(f =>
    JSON.parse(readFileSync(join(stateDir, f), 'utf-8')) as HealthSnapshot
  );

  const latest = snapshots[0].overallHealth;
  const previous = snapshots[snapshots.length - 1].overallHealth;
  const delta = latest - previous;

  if (delta > 0.05) return { trend: 'up', delta };
  if (delta < -0.05) return { trend: 'down', delta };
  return { trend: 'stable', delta };
}

/**
 * Format health score for display
 */
export function formatHealth(health: number, colorize: boolean = true): string {
  const percentage = Math.round(health * 100);

  if (colorize) {
    const color = getHealthColor(health);
    return `${color}${percentage}%${RESET}`;
  }
  return `${percentage}%`;
}

/**
 * Format trend indicator
 */
export function formatTrend(trend: 'up' | 'down' | 'stable', delta: number, colorize: boolean = true): string {
  const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const deltaStr = Math.abs(Math.round(delta * 100));

  if (colorize) {
    const color = trend === 'up' ? '\x1b[32m' : trend === 'down' ? '\x1b[31m' : '\x1b[90m';
    return `${color}${arrow}${deltaStr > 0 ? deltaStr : ''}${RESET}`;
  }
  return `${arrow}${deltaStr > 0 ? deltaStr : ''}`;
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

/**
 * Render the Skeptic status HUD element
 */
export function renderSkepticHud(config: Partial<SkepticHudConfig> = {}): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!cfg.enabled) return '';

  const snapshot = getLatestSnapshot();

  if (!snapshot) {
    return cfg.colorize
      ? '\x1b[90m🔍 Skeptic: inactive\x1b[0m'
      : '🔍 Skeptic: inactive';
  }

  const parts: string[] = [];

  // Health score
  if (cfg.showHealth) {
    const healthStr = formatHealth(snapshot.overallHealth, cfg.colorize);
    parts.push(`🔍 ${healthStr}`);
  }

  // Trend
  if (cfg.showTrend) {
    const { trend, delta } = getHealthTrend();
    const trendStr = formatTrend(trend, delta, cfg.colorize);
    parts.push(trendStr);
  }

  // Last check time
  if (cfg.showLastCheck) {
    const timeStr = formatRelativeTime(snapshot.timestamp);
    const timeDisplay = cfg.colorize
      ? `\x1b[90m(${timeStr})\x1b[0m`
      : `(${timeStr})`;
    parts.push(timeDisplay);
  }

  return parts.join(' ');
}

/**
 * Get detailed Skeptic status summary
 */
export function getSkepticSummary(): string {
  const snapshot = getLatestSnapshot();
  const { trend, delta } = getHealthTrend();

  if (!snapshot) {
    return 'Skeptic is not active. No health snapshots found.';
  }

  const lines: string[] = [
    '## Skeptic Health Summary',
    '',
    `**Overall Health**: ${formatHealth(snapshot.overallHealth)}`,
    `**Trend**: ${formatTrend(trend, delta)} (${trend})`,
    `**Last Check**: ${formatRelativeTime(snapshot.timestamp)}`,
    '',
    '### Status Breakdown',
    `- Build: ${snapshot.buildStatus}`,
    `- Type Check: ${snapshot.typeCheckStatus}`,
    ''
  ];

  return lines.join('\n');
}

export default {
  render: renderSkepticHud,
  formatHealth,
  formatTrend,
  getSummary: getSkepticSummary
};
