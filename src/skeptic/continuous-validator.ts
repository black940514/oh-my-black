/**
 * Skeptic - Continuous Validator
 *
 * Runs builds every 2-5 minutes as the project's "immune system".
 * Catches build breaks early, before they compound.
 * Inspired by Archon's T5 (Skeptic) terminal persona.
 */

import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { execSync, spawn } from 'child_process';

const STATE_DIR = '.omb/state/skeptic';

/**
 * Health snapshot from a validation run
 */
export interface HealthSnapshot {
  id: string;
  timestamp: string;
  buildStatus: 'success' | 'failure' | 'timeout' | 'skipped';
  buildOutput?: string;
  typeCheckStatus: 'success' | 'failure' | 'skipped';
  typeErrors?: string[];
  testStatus: 'success' | 'failure' | 'skipped';
  testResults?: { passed: number; failed: number; skipped: number };
  lintStatus: 'success' | 'failure' | 'skipped';
  lintErrors?: number;
  overallHealth: number;  // 0.0-1.0
  duration: number;       // milliseconds
}

/**
 * Configuration for Skeptic continuous validation
 */
export interface SkepticConfig {
  enabled: boolean;
  intervalMs: number;     // default: 120000 (2 minutes)
  buildCommand: string;   // default: 'npm run build'
  typeCheckCommand: string; // default: 'npx tsc --noEmit'
  testCommand?: string;   // optional
  lintCommand?: string;   // optional
  timeoutMs: number;      // default: 60000
  onFailure: 'amplify' | 'log' | 'both';
}

const DEFAULT_CONFIG: SkepticConfig = {
  enabled: true,
  intervalMs: 120000,
  buildCommand: 'npm run build',
  typeCheckCommand: 'npx tsc --noEmit',
  timeoutMs: 60000,
  onFailure: 'both'
};

/**
 * ContinuousValidator - The project's immune system
 *
 * Periodically runs build, type check, tests, and lint to catch issues early.
 * Maintains health history and alerts on failures.
 */
export class ContinuousValidator {
  private config: SkepticConfig;
  private projectDir: string;
  private stateDir: string;
  private intervalId?: NodeJS.Timeout;
  private isRunning: boolean = false;

  /**
   * Create a new ContinuousValidator instance
   * @param projectDir - Project root directory (defaults to cwd)
   * @param config - Optional configuration overrides
   */
  constructor(projectDir: string = process.cwd(), config?: Partial<SkepticConfig>) {
    this.projectDir = projectDir;
    this.stateDir = join(projectDir, STATE_DIR);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ensureStateDir();
  }

  /**
   * Ensure state directory exists
   */
  private ensureStateDir(): void {
    if (!existsSync(this.stateDir)) {
      mkdirSync(this.stateDir, { recursive: true });
    }
  }

  /**
   * Run a full validation cycle
   * @returns Health snapshot with results
   */
  async runValidation(): Promise<HealthSnapshot> {
    const startTime = Date.now();
    const id = `snapshot-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const snapshot: Partial<HealthSnapshot> = {
      id,
      timestamp,
      buildStatus: 'skipped',
      typeCheckStatus: 'skipped',
      testStatus: 'skipped',
      lintStatus: 'skipped'
    };

    // Run build
    const buildResult = await this.runBuild();
    snapshot.buildStatus = buildResult.status as any;
    snapshot.buildOutput = buildResult.output;

    // Run type check
    const typeCheckResult = await this.runTypeCheck();
    snapshot.typeCheckStatus = typeCheckResult.status as any;
    snapshot.typeErrors = typeCheckResult.errors;

    // Run tests if configured
    if (this.config.testCommand) {
      const testResult = await this.runTests();
      snapshot.testStatus = testResult.status as any;
      snapshot.testResults = testResult.results;
    }

    // Run lint if configured
    if (this.config.lintCommand) {
      const lintResult = await this.runLint();
      snapshot.lintStatus = lintResult.status as any;
      snapshot.lintErrors = lintResult.errorCount;
    }

    // Calculate overall health
    snapshot.overallHealth = this.calculateHealth(snapshot);
    snapshot.duration = Date.now() - startTime;

    const fullSnapshot = snapshot as HealthSnapshot;

    // Save snapshot
    this.saveSnapshot(fullSnapshot);

    // Alert on failure
    if (fullSnapshot.overallHealth < 1.0) {
      await this.alertOnFailure(fullSnapshot);
    }

    return fullSnapshot;
  }

  /**
   * Run build command
   */
  private async runBuild(): Promise<{ status: string; output?: string }> {
    try {
      const output = execSync(this.config.buildCommand, {
        cwd: this.projectDir,
        timeout: this.config.timeoutMs,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      return { status: 'success', output };
    } catch (error: any) {
      if (error.killed) {
        return { status: 'timeout' };
      }
      return {
        status: 'failure',
        output: error.stdout || error.stderr || error.message
      };
    }
  }

  /**
   * Run type check command
   */
  private async runTypeCheck(): Promise<{ status: string; errors?: string[] }> {
    try {
      execSync(this.config.typeCheckCommand, {
        cwd: this.projectDir,
        timeout: this.config.timeoutMs,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      return { status: 'success', errors: [] };
    } catch (error: any) {
      if (error.killed) {
        return { status: 'failure', errors: ['Type check timeout'] };
      }
      const output = error.stdout || error.stderr || error.message;
      const errors = output.split('\n')
        .filter((line: string) => line.includes('error TS'))
        .slice(0, 50); // Limit to first 50 errors
      return { status: 'failure', errors };
    }
  }

  /**
   * Run test command
   */
  private async runTests(): Promise<{ status: string; results?: { passed: number; failed: number; skipped: number } }> {
    if (!this.config.testCommand) {
      return { status: 'skipped' };
    }

    try {
      const output = execSync(this.config.testCommand, {
        cwd: this.projectDir,
        timeout: this.config.timeoutMs,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      // Basic parsing - assumes jest/mocha-like output
      const passMatch = output.match(/(\d+) passing/);
      const failMatch = output.match(/(\d+) failing/);
      const skipMatch = output.match(/(\d+) pending/);

      return {
        status: 'success',
        results: {
          passed: passMatch ? parseInt(passMatch[1]) : 0,
          failed: failMatch ? parseInt(failMatch[1]) : 0,
          skipped: skipMatch ? parseInt(skipMatch[1]) : 0
        }
      };
    } catch (error: any) {
      return { status: 'failure' };
    }
  }

  /**
   * Run lint command
   */
  private async runLint(): Promise<{ status: string; errorCount?: number }> {
    if (!this.config.lintCommand) {
      return { status: 'skipped' };
    }

    try {
      execSync(this.config.lintCommand, {
        cwd: this.projectDir,
        timeout: this.config.timeoutMs,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      return { status: 'success', errorCount: 0 };
    } catch (error: any) {
      const output = error.stdout || error.stderr || '';
      const errorMatch = output.match(/(\d+) error/);
      return {
        status: 'failure',
        errorCount: errorMatch ? parseInt(errorMatch[1]) : 1
      };
    }
  }

  /**
   * Calculate overall health score
   * Weights: build=0.4, types=0.3, tests=0.2, lint=0.1
   */
  private calculateHealth(snapshot: Partial<HealthSnapshot>): number {
    let score = 0;

    // Build: 40%
    if (snapshot.buildStatus === 'success') {
      score += 0.4;
    }

    // Type check: 30%
    if (snapshot.typeCheckStatus === 'success') {
      score += 0.3;
    } else if (snapshot.typeCheckStatus === 'skipped') {
      score += 0.3; // Don't penalize if not configured
    }

    // Tests: 20%
    if (snapshot.testStatus === 'success') {
      score += 0.2;
    } else if (snapshot.testStatus === 'skipped') {
      score += 0.2; // Don't penalize if not configured
    }

    // Lint: 10%
    if (snapshot.lintStatus === 'success') {
      score += 0.1;
    } else if (snapshot.lintStatus === 'skipped') {
      score += 0.1; // Don't penalize if not configured
    }

    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Save snapshot to disk
   */
  saveSnapshot(snapshot: HealthSnapshot): void {
    const filepath = join(this.stateDir, `${snapshot.id}.json`);
    writeFileSync(filepath, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  /**
   * Get the most recent snapshot
   */
  getLatestSnapshot(): HealthSnapshot | null {
    const snapshots = this.getRecentSnapshots(1);
    return snapshots.length > 0 ? snapshots[0] : null;
  }

  /**
   * Get recent snapshots sorted by timestamp (newest first)
   */
  getRecentSnapshots(count: number): HealthSnapshot[] {
    if (!existsSync(this.stateDir)) {
      return [];
    }

    const files = readdirSync(this.stateDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, count);

    return files.map(file => {
      const content = readFileSync(join(this.stateDir, file), 'utf8');
      return JSON.parse(content) as HealthSnapshot;
    });
  }

  /**
   * Get health trend by comparing recent snapshots
   * @returns Trend direction and delta
   */
  getHealthTrend(): { improving: boolean; delta: number } {
    const snapshots = this.getRecentSnapshots(5);

    if (snapshots.length < 2) {
      return { improving: true, delta: 0 };
    }

    const latest = snapshots[0].overallHealth;
    const average = snapshots.slice(1).reduce((sum, s) => sum + s.overallHealth, 0) / (snapshots.length - 1);

    const delta = Math.round((latest - average) * 100) / 100;

    return {
      improving: delta >= 0,
      delta
    };
  }

  /**
   * Start continuous validation
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    if (!this.config.enabled) {
      console.log('[Skeptic] Continuous validation is disabled');
      return;
    }

    this.isRunning = true;
    console.log(`[Skeptic] Starting continuous validation (interval: ${this.config.intervalMs}ms)`);

    // Run immediately
    this.runValidation().catch(err => {
      console.error('[Skeptic] Validation error:', err);
    });

    // Schedule recurring validations
    this.intervalId = setInterval(() => {
      this.runValidation().catch(err => {
        console.error('[Skeptic] Validation error:', err);
      });
    }, this.config.intervalMs);
  }

  /**
   * Stop continuous validation
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('[Skeptic] Stopping continuous validation');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.isRunning = false;
  }

  /**
   * Check if validation is currently active
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Alert on validation failure
   * Integrates with agent-registry broadcasts
   */
  private async alertOnFailure(snapshot: HealthSnapshot): Promise<void> {
    if (this.config.onFailure === 'log' || this.config.onFailure === 'both') {
      console.error(`[Skeptic] Health degraded: ${snapshot.overallHealth * 100}%`);

      if (snapshot.buildStatus === 'failure') {
        console.error(`  Build failed`);
      }
      if (snapshot.typeCheckStatus === 'failure') {
        console.error(`  Type errors: ${snapshot.typeErrors?.length || 0}`);
      }
      if (snapshot.testStatus === 'failure') {
        console.error(`  Tests failed`);
      }
      if (snapshot.lintStatus === 'failure') {
        console.error(`  Lint errors: ${snapshot.lintErrors || 0}`);
      }
    }

    if (this.config.onFailure === 'amplify' || this.config.onFailure === 'both') {
      // Note: broadcastAmplify was removed with src/orchestrator/ cleanup
      // Logging health degradation instead
      const issues: string[] = [];
      if (snapshot.buildStatus === 'failure') {
        issues.push('Build failed');
      }
      if (snapshot.typeCheckStatus === 'failure') {
        issues.push(`${snapshot.typeErrors?.length || 0} type errors`);
      }
      if (snapshot.testStatus === 'failure') {
        issues.push('Tests failed');
      }
      if (snapshot.lintStatus === 'failure') {
        issues.push(`${snapshot.lintErrors || 0} lint errors`);
      }

      console.warn(
        `[Skeptic] Health degraded to ${Math.round(snapshot.overallHealth * 100)}%: ${issues.join(', ')}`
      );
    }
  }
}

/**
 * Singleton instance for global use
 */
export const skeptic = new ContinuousValidator();
