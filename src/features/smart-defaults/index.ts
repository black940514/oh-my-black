import { selectValidationType } from './validation-selector.js';
import { selectTeamTemplate } from './team-selector.js';
import { calculateParallelWorkers } from './parallelism-calculator.js';
import type { AutoConfigResult } from './types.js';

/**
 * Zero-configuration defaults for oh-my-black
 * These are applied automatically when user doesn't specify explicit configuration
 */
export const ZERO_CONFIG_DEFAULTS = {
  // Auto-detection switches
  autoDetectMode: true,
  autoDetectComplexity: true,

  // Default behaviors (can be overridden)
  defaultValidationType: 'auto' as const,
  defaultTeamTemplate: 'auto' as const,
  defaultParallelWorkers: 'auto' as const,

  // Ohmyblack (quality gatekeeper) auto-enable thresholds
  ohmyblackAutoThreshold: {
    fileCount: 3,              // Enable for 3+ files
    complexityScore: 0.5,      // Enable for medium+ complexity
    riskKeywords: [
      'production', 'deploy', 'important', 'critical',
      '중요', '프로덕션', '배포', '위험'
    ]
  },

  // Safety settings
  maxAutoRetries: 3,
  validateBeforeComplete: true,
  architectReviewThreshold: 0.7  // Complexity score above which architect reviews
};

/**
 * Detect risk keywords in user input
 */
function detectRiskKeywords(userInput: string): boolean {
  const input = userInput.toLowerCase();
  return ZERO_CONFIG_DEFAULTS.ohmyblackAutoThreshold.riskKeywords.some(
    keyword => input.includes(keyword.toLowerCase())
  );
}

/**
 * Detect speed keywords in user input
 */
function detectSpeedKeywords(userInput: string): boolean {
  const speedKeywords = [
    'quick', 'fast', 'simple', 'easy', 'trivial',
    '빠르게', '간단하게', '쉽게'
  ];
  const input = userInput.toLowerCase();
  return speedKeywords.some(keyword => input.includes(keyword.toLowerCase()));
}

/**
 * Calculate complexity score based on task characteristics
 * Returns 0-1 score (0 = simple, 1 = very complex)
 */
function calculateComplexityScore(
  estimatedFiles: number,
  taskType: string,
  technologies: string[]
): number {
  let score = 0;

  // File count contribution (0-0.4)
  if (estimatedFiles > 10) score += 0.4;
  else if (estimatedFiles > 5) score += 0.3;
  else if (estimatedFiles > 2) score += 0.2;
  else score += 0.1;

  // Task complexity keywords (0-0.3)
  const complexKeywords = ['refactor', 'architecture', 'migrate', 'redesign', 'optimize'];
  const taskLower = taskType.toLowerCase();
  if (complexKeywords.some(k => taskLower.includes(k))) score += 0.3;

  // Multiple technologies (0-0.3)
  if (technologies.length >= 3) score += 0.3;
  else if (technologies.length >= 2) score += 0.2;
  else score += 0.1;

  return Math.min(score, 1.0);
}

/**
 * Auto-configure defaults based on user input and task characteristics
 *
 * @param userInput - Raw user input text
 * @param estimatedFiles - Estimated number of files to be modified
 * @param taskType - Type of task (optional, defaults to 'general')
 * @param technologies - List of technologies involved (optional)
 * @returns Auto-configured defaults
 */
export function autoConfigureDefaults(
  userInput: string,
  estimatedFiles: number,
  taskType: string = 'general',
  technologies: string[] = []
): AutoConfigResult {
  // Detect keywords
  const hasRiskKeywords = detectRiskKeywords(userInput);
  const hasSpeedKeywords = detectSpeedKeywords(userInput);

  // Calculate complexity
  const complexityScore = calculateComplexityScore(
    estimatedFiles,
    taskType,
    technologies
  );

  // Select validation type
  const validationType = selectValidationType(
    estimatedFiles,
    hasRiskKeywords,
    hasSpeedKeywords
  );

  // Select team template
  const teamTemplate = selectTeamTemplate(taskType, technologies);

  // Calculate parallel workers
  const parallelWorkers = calculateParallelWorkers(estimatedFiles);

  // Determine if ohmyblack should be enabled
  const enableOhmyblack =
    estimatedFiles >= ZERO_CONFIG_DEFAULTS.ohmyblackAutoThreshold.fileCount ||
    complexityScore >= ZERO_CONFIG_DEFAULTS.ohmyblackAutoThreshold.complexityScore ||
    hasRiskKeywords;

  return {
    validationType,
    teamTemplate,
    parallelWorkers,
    enableOhmyblack
  };
}

// Re-export types and utilities
export * from './types.js';
export { selectValidationType } from './validation-selector.js';
export { selectTeamTemplate } from './team-selector.js';
export { calculateParallelWorkers } from './parallelism-calculator.js';
