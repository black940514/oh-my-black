/**
 * Quality Gradient System - Readiness Score Types
 *
 * Replaces binary task completion (done/not done) with nuanced 0.0-1.0 readiness scores.
 * Inspired by Archon's organic orchestration philosophy.
 */

/**
 * Individual quality dimensions for a task.
 * Each dimension is scored 0.0-1.0 representing completeness/quality.
 */
export interface ReadinessDimensions {
  /** Does it work? 0.0 = broken, 1.0 = fully functional */
  functionality: number;
  /** Test coverage and passing. 0.0 = no tests, 1.0 = full coverage passing */
  tests: number;
  /** Type safety. 0.0 = no types, 1.0 = fully typed */
  types: number;
  /** Code quality/linting. 0.0 = major issues, 1.0 = clean */
  style: number;
  /** Comments, JSDoc. 0.0 = no docs, 1.0 = comprehensive */
  documentation: number;
  /** Security considerations. 0.0 = major vulnerabilities, 1.0 = secure */
  security: number;
}

/**
 * Complete readiness score for a task.
 * Provides multi-dimensional quality assessment.
 */
export interface ReadinessScore {
  /** Unique task identifier */
  taskId: string;
  /** Weighted average of all dimensions (0.0-1.0) */
  overall: number;
  /** Individual dimension scores */
  dimensions: ReadinessDimensions;
  /** Confidence in this assessment (0.0-1.0) */
  confidence: number;
  /** Issues preventing the task from reaching 1.0 */
  blockers: string[];
  /** ISO 8601 timestamp of last evaluation */
  lastUpdated: string;
  /** Agent that produced this score */
  evaluatedBy: string;
}

/**
 * Threshold definition for readiness levels.
 * Defines action to take based on score range.
 */
export interface ReadinessThreshold {
  /** Human-readable name */
  name: string;
  /** Minimum score (inclusive) */
  min: number;
  /** Maximum score (exclusive, except for last threshold) */
  max: number;
  /** Recommended action at this level */
  action: 'continue' | 'polish' | 'review' | 'ship';
  /** Description of what this level means */
  description: string;
}

/**
 * Standard readiness thresholds for task quality assessment.
 * Ordered from lowest to highest quality.
 */
export const READINESS_THRESHOLDS: ReadinessThreshold[] = [
  {
    name: 'broken',
    min: 0.0,
    max: 0.3,
    action: 'continue',
    description: 'Not started or broken'
  },
  {
    name: 'partial',
    min: 0.3,
    max: 0.5,
    action: 'continue',
    description: 'Partially functional'
  },
  {
    name: 'functional',
    min: 0.5,
    max: 0.7,
    action: 'polish',
    description: 'Functional but rough'
  },
  {
    name: 'draft',
    min: 0.7,
    max: 0.9,
    action: 'review',
    description: 'Production-ready draft'
  },
  {
    name: 'ready',
    min: 0.9,
    max: 1.0,
    action: 'ship',
    description: 'Ship-ready'
  },
];

/**
 * Get the appropriate threshold for a given readiness score.
 *
 * @param score - Readiness score between 0.0 and 1.0
 * @returns The threshold that this score falls into
 * @throws Error if score is outside valid range
 */
export function getThresholdForScore(score: number): ReadinessThreshold {
  if (score < 0.0 || score > 1.0) {
    throw new Error(`Invalid readiness score: ${score}. Must be between 0.0 and 1.0`);
  }

  // Find the threshold where score is within [min, max)
  // For the last threshold, include max (1.0)
  for (let i = 0; i < READINESS_THRESHOLDS.length; i++) {
    const threshold = READINESS_THRESHOLDS[i];
    const isLastThreshold = i === READINESS_THRESHOLDS.length - 1;

    if (score >= threshold.min && (isLastThreshold ? score <= threshold.max : score < threshold.max)) {
      return threshold;
    }
  }

  // Fallback (should never reach here if thresholds are properly defined)
  return READINESS_THRESHOLDS[READINESS_THRESHOLDS.length - 1];
}

/**
 * Create an empty readiness score with all dimensions at 0.
 * Useful for initializing new tasks.
 *
 * @param taskId - Unique identifier for the task
 * @returns Empty readiness score
 */
export function createEmptyScore(taskId: string): ReadinessScore {
  return {
    taskId,
    overall: 0.0,
    dimensions: {
      functionality: 0.0,
      tests: 0.0,
      types: 0.0,
      style: 0.0,
      documentation: 0.0,
      security: 0.0,
    },
    confidence: 0.0,
    blockers: [],
    lastUpdated: new Date().toISOString(),
    evaluatedBy: 'system',
  };
}

/**
 * Calculate weighted overall score from individual dimensions.
 *
 * Weights:
 * - functionality: 0.30 (most important - does it work?)
 * - tests: 0.20 (critical for reliability)
 * - security: 0.15 (important for production)
 * - types: 0.15 (important for maintainability)
 * - documentation: 0.10 (helpful but not critical)
 * - style: 0.10 (nice to have)
 *
 * @param dimensions - Individual dimension scores
 * @returns Weighted average score (0.0-1.0)
 */
export function calculateOverall(dimensions: ReadinessDimensions): number {
  const weights = {
    functionality: 0.30,
    tests: 0.20,
    security: 0.15,
    types: 0.15,
    documentation: 0.10,
    style: 0.10,
  };

  const overall =
    dimensions.functionality * weights.functionality +
    dimensions.tests * weights.tests +
    dimensions.security * weights.security +
    dimensions.types * weights.types +
    dimensions.documentation * weights.documentation +
    dimensions.style * weights.style;

  // Round to 2 decimal places to avoid floating point issues
  return Math.round(overall * 100) / 100;
}
