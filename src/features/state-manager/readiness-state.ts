/**
 * Readiness State Manager
 *
 * Manages Quality Gradient readiness scores with file-based persistence.
 * State stored at .omb/state/readiness/{taskId}.json
 *
 * Follows the same patterns as the main state manager but provides
 * specialized methods for querying and filtering readiness scores.
 */

import { join } from "path";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  unlinkSync,
} from "fs";
import type { ReadinessScore } from "../../quality/readiness.js";
import { atomicWriteJsonSync } from "../../lib/atomic-write.js";

const STATE_DIR = ".omb/state/readiness";

/**
 * Manages readiness scores with file-based persistence.
 *
 * Each score is stored as a separate JSON file at:
 * `.omb/state/readiness/{taskId}.json`
 *
 * This allows for efficient querying and filtering of scores.
 */
export class ReadinessStateManager {
  private baseDir: string;

  /**
   * Create a new readiness state manager.
   *
   * @param projectDir - Base directory for the project (defaults to cwd)
   */
  constructor(projectDir: string = process.cwd()) {
    this.baseDir = join(projectDir, STATE_DIR);
    this.ensureDirectory();
  }

  /**
   * Ensure the state directory exists.
   * Creates it recursively if missing.
   */
  private ensureDirectory(): void {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Save a readiness score to disk.
   * Uses atomic writes to prevent data corruption.
   *
   * @param score - The readiness score to save
   */
  saveScore(score: ReadinessScore): void {
    const filePath = join(this.baseDir, `${score.taskId}.json`);
    atomicWriteJsonSync(filePath, score);
  }

  /**
   * Get a readiness score by task ID.
   *
   * @param taskId - Unique task identifier
   * @returns The readiness score, or null if not found
   */
  getScore(taskId: string): ReadinessScore | null {
    const filePath = join(this.baseDir, `${taskId}.json`);
    if (!existsSync(filePath)) return null;

    try {
      const content = readFileSync(filePath, "utf-8");
      return JSON.parse(content) as ReadinessScore;
    } catch (error) {
      console.warn(`Failed to read readiness score for ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Get all readiness scores.
   *
   * @returns Array of all stored readiness scores
   */
  getAllScores(): ReadinessScore[] {
    if (!existsSync(this.baseDir)) return [];

    try {
      const files = readdirSync(this.baseDir).filter((f) => f.endsWith(".json"));
      const scores: ReadinessScore[] = [];

      for (const file of files) {
        try {
          const content = readFileSync(join(this.baseDir, file), "utf-8");
          scores.push(JSON.parse(content) as ReadinessScore);
        } catch (error) {
          console.warn(`Failed to read readiness score from ${file}:`, error);
        }
      }

      return scores;
    } catch (error) {
      console.warn("Failed to list readiness scores:", error);
      return [];
    }
  }

  /**
   * Delete a readiness score.
   *
   * @param taskId - Unique task identifier
   * @returns True if deleted, false if not found
   */
  deleteScore(taskId: string): boolean {
    const filePath = join(this.baseDir, `${taskId}.json`);
    if (!existsSync(filePath)) return false;

    try {
      unlinkSync(filePath);
      return true;
    } catch (error) {
      console.warn(`Failed to delete readiness score for ${taskId}:`, error);
      return false;
    }
  }

  /**
   * Get scores within a specific threshold range.
   *
   * @param minScore - Minimum overall score (inclusive)
   * @param maxScore - Maximum overall score (inclusive, optional)
   * @returns Array of scores matching the criteria
   *
   * @example
   * // Get all scores between 0.5 and 0.7 (functional range)
   * const scores = manager.getScoresByThreshold(0.5, 0.7);
   *
   * @example
   * // Get all scores >= 0.9 (ready to ship)
   * const readyScores = manager.getScoresByThreshold(0.9);
   */
  getScoresByThreshold(minScore: number, maxScore?: number): ReadinessScore[] {
    return this.getAllScores().filter((s) => {
      const meetsMin = s.overall >= minScore;
      const meetsMax = maxScore === undefined || s.overall <= maxScore;
      return meetsMin && meetsMax;
    });
  }

  /**
   * Get all tasks that have blockers preventing completion.
   *
   * @returns Array of scores with non-empty blockers arrays
   *
   * @example
   * const blocked = manager.getBlockedTasks();
   * blocked.forEach(score => {
   *   console.log(`Task ${score.taskId} blocked by:`);
   *   score.blockers.forEach(b => console.log(`  - ${b}`));
   * });
   */
  getBlockedTasks(): ReadinessScore[] {
    return this.getAllScores().filter((s) => s.blockers.length > 0);
  }

  /**
   * Calculate the average readiness across all tasks.
   * Uses weighted overall scores.
   *
   * @returns Average overall score (0.0-1.0), or 0 if no tasks
   *
   * @example
   * const avg = manager.getAverageReadiness();
   * console.log(`Average readiness: ${(avg * 100).toFixed(0)}%`);
   */
  getAverageReadiness(): number {
    const scores = this.getAllScores();
    if (scores.length === 0) return 0;

    const sum = scores.reduce((acc, s) => acc + s.overall, 0);
    const average = sum / scores.length;

    // Round to 2 decimal places to match overall score precision
    return Math.round(average * 100) / 100;
  }

  /**
   * Clear all readiness scores.
   * Deletes all score files from the state directory.
   *
   * @returns Number of scores deleted
   */
  clearAllScores(): number {
    const scores = this.getAllScores();
    let deleted = 0;

    for (const score of scores) {
      if (this.deleteScore(score.taskId)) {
        deleted++;
      }
    }

    return deleted;
  }
}

/**
 * Global singleton instance.
 * Use this for most operations unless you need a custom project directory.
 *
 * @example
 * import { readinessState } from './readiness-state';
 *
 * // Save a score
 * readinessState.saveScore(score);
 *
 * // Get blocked tasks
 * const blocked = readinessState.getBlockedTasks();
 */
export const readinessState = new ReadinessStateManager();
