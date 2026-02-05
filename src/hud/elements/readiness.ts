/**
 * Readiness HUD Element
 *
 * Displays Quality Gradient readiness scores in the status line.
 */

import { readinessState } from '../../features/state-manager/readiness-state.js';
import type { ReadinessScore } from '../../quality/readiness.js';
import { getThresholdForScore, READINESS_THRESHOLDS } from '../../quality/readiness.js';

export interface ReadinessHudConfig {
  enabled: boolean;
  showAverage: boolean;
  showBlockers: boolean;
  colorize: boolean;
}

const DEFAULT_CONFIG: ReadinessHudConfig = {
  enabled: true,
  showAverage: true,
  showBlockers: true,
  colorize: true
};

// ANSI color codes
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const RED = '\x1b[31m';
const GRAY = '\x1b[90m';

/**
 * Get color code for readiness score
 */
function getScoreColor(score: number): string {
  if (score >= 0.9) return GREEN;   // Ready to ship
  if (score >= 0.7) return YELLOW;  // Production-ready draft
  if (score >= 0.5) return CYAN;    // Functional but rough
  if (score >= 0.3) return MAGENTA; // Partially functional
  return RED;                        // Broken
}

/**
 * Format a single readiness score for display
 */
export function formatScore(score: number, colorize: boolean = true): string {
  const percentage = Math.round(score * 100);

  if (colorize) {
    const color = getScoreColor(score);
    return `${color}${percentage}%${RESET}`;
  }
  return `${percentage}%`;
}

/**
 * Format readiness bar visualization
 */
export function formatReadinessBar(score: number, width: number = 10, colorize: boolean = true): string {
  const filled = Math.round(score * width);
  const empty = width - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  if (colorize) {
    const color = getScoreColor(score);
    return `${color}${bar}${RESET}`;
  }
  return bar;
}

/**
 * Render the readiness HUD element
 */
export function renderReadinessHud(config: Partial<ReadinessHudConfig> = {}): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!cfg.enabled) return '';

  const scores = readinessState.getAllScores();

  if (scores.length === 0) {
    return cfg.colorize
      ? `${GRAY}📊 No readiness data${RESET}`
      : '📊 No readiness data';
  }

  const parts: string[] = [];

  // Average readiness
  if (cfg.showAverage) {
    const avg = readinessState.getAverageReadiness();
    const avgStr = formatScore(avg, cfg.colorize);
    const bar = formatReadinessBar(avg, 8, cfg.colorize);
    parts.push(`📊 ${bar} ${avgStr}`);
  }

  // Blockers count
  if (cfg.showBlockers) {
    const blocked = readinessState.getBlockedTasks();
    if (blocked.length > 0) {
      const blockerStr = cfg.colorize
        ? `${RED}⚠️ ${blocked.length} blocked${RESET}`
        : `⚠️ ${blocked.length} blocked`;
      parts.push(blockerStr);
    }
  }

  return parts.join(' | ');
}

/**
 * Get detailed readiness summary
 */
export function getReadinessSummary(): string {
  const scores = readinessState.getAllScores();

  if (scores.length === 0) {
    return 'No readiness scores recorded.';
  }

  const lines: string[] = [
    '## Readiness Summary',
    '',
    `Total tasks: ${scores.length}`,
    `Average: ${formatScore(readinessState.getAverageReadiness())}`,
    ''
  ];

  // Group by threshold
  for (const threshold of READINESS_THRESHOLDS) {
    const inRange = scores.filter(s => {
      const isLastThreshold = threshold.max === 1.0;
      return s.overall >= threshold.min &&
             (isLastThreshold ? s.overall <= threshold.max : s.overall < threshold.max);
    });

    if (inRange.length > 0) {
      lines.push(`### ${threshold.name} (${threshold.min}-${threshold.max}): ${inRange.length} tasks`);
      for (const score of inRange) {
        lines.push(`- ${score.taskId}: ${formatScore(score.overall)}`);
        if (score.blockers.length > 0) {
          lines.push(`  Blockers: ${score.blockers.join(', ')}`);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export default {
  render: renderReadinessHud,
  formatScore,
  formatReadinessBar,
  getSummary: getReadinessSummary
};
