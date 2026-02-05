/**
 * Readiness Calculator
 *
 * Evaluates task output across multiple dimensions to produce a ReadinessScore.
 * Uses heuristics and static analysis to assess quality without running code.
 */

import type { ReadinessScore, ReadinessDimensions } from './readiness.js';
import { createEmptyScore, calculateOverall } from './readiness.js';

/**
 * Context information for evaluating task output
 */
export interface EvaluationContext {
  /** Unique identifier for the task being evaluated */
  taskId: string;
  /** Human-readable description of the task */
  taskDescription: string;
  /** Files that were created, modified, or deleted */
  files: FileChange[];
  /** Output from build commands (e.g., tsc, webpack) */
  buildOutput?: string;
  /** Output from test execution */
  testOutput?: string;
  /** Output from linting tools (e.g., eslint) */
  lintOutput?: string;
  /** Output from type checking (e.g., tsc --noEmit) */
  typeCheckOutput?: string;
}

/**
 * Represents a file change in the evaluation context
 */
export interface FileChange {
  /** Absolute or relative path to the file */
  path: string;
  /** File contents (for created/modified files) */
  content: string;
  /** Type of change */
  type: 'created' | 'modified' | 'deleted';
}

/**
 * Evaluates task output across multiple quality dimensions
 * to produce a comprehensive readiness assessment
 */
export class ReadinessCalculator {
  /**
   * Evaluate task output and produce a ReadinessScore
   *
   * @param context - Context containing task details and outputs
   * @returns Complete readiness score with dimensions, blockers, and confidence
   */
  evaluate(context: EvaluationContext): ReadinessScore {
    const dimensions = this.evaluateDimensions(context);
    const blockers = this.identifyBlockers(context, dimensions);
    const confidence = this.calculateConfidence(context);

    return {
      taskId: context.taskId,
      overall: calculateOverall(dimensions),
      dimensions,
      confidence,
      blockers,
      lastUpdated: new Date().toISOString(),
      evaluatedBy: 'readiness-calculator'
    };
  }

  /**
   * Evaluate all quality dimensions
   *
   * @param context - Evaluation context
   * @returns Scores for each dimension (0-1 scale)
   */
  private evaluateDimensions(context: EvaluationContext): ReadinessDimensions {
    return {
      functionality: this.evaluateFunctionality(context),
      tests: this.evaluateTests(context),
      types: this.evaluateTypes(context),
      style: this.evaluateStyle(context),
      documentation: this.evaluateDocumentation(context),
      security: this.evaluateSecurity(context)
    };
  }

  /**
   * Evaluate functionality dimension
   *
   * Checks build output for errors and warnings.
   * Higher score indicates code likely works as intended.
   *
   * @param ctx - Evaluation context
   * @returns Score 0-1 (0=broken, 1=fully functional)
   */
  private evaluateFunctionality(ctx: EvaluationContext): number {
    // No files changed = no functionality
    if (ctx.files.length === 0) return 0;

    // Check build output if available
    if (ctx.buildOutput) {
      if (ctx.buildOutput.includes('error')) return 0.2;
      if (ctx.buildOutput.includes('warning')) return 0.7;
      return 0.9; // Clean build
    }

    // No build info available, assume functional
    return 0.8;
  }

  /**
   * Evaluate tests dimension
   *
   * Checks test execution output for passes/failures.
   *
   * @param ctx - Evaluation context
   * @returns Score 0-1 (0=failing tests, 1=all passing)
   */
  private evaluateTests(ctx: EvaluationContext): number {
    if (!ctx.testOutput) return 0.5; // No test info available

    if (ctx.testOutput.includes('failed')) return 0.3;
    if (ctx.testOutput.includes('passed')) return 0.9;

    return 0.5;
  }

  /**
   * Evaluate types dimension
   *
   * Analyzes type checking output (e.g., tsc --noEmit) for errors.
   *
   * @param ctx - Evaluation context
   * @returns Score 0-1 (0=many type errors, 1=type-safe)
   */
  private evaluateTypes(ctx: EvaluationContext): number {
    if (!ctx.typeCheckOutput) return 0.5;

    // Try to extract error count from output like "5 errors found"
    const errorMatch = ctx.typeCheckOutput.match(/(\d+)\s+error/i);
    if (errorMatch) {
      const errors = parseInt(errorMatch[1]);
      if (errors === 0) return 1.0;
      if (errors < 5) return 0.7;
      if (errors < 20) return 0.4;
      return 0.2;
    }

    // Fallback to text matching
    if (ctx.typeCheckOutput.includes('error')) return 0.3;

    return 0.8;
  }

  /**
   * Evaluate style dimension
   *
   * Checks linting output for style issues.
   *
   * @param ctx - Evaluation context
   * @returns Score 0-1 (0=many style issues, 1=clean)
   */
  private evaluateStyle(ctx: EvaluationContext): number {
    if (!ctx.lintOutput) return 0.6;

    if (ctx.lintOutput.includes('0 problems')) return 1.0;

    // Try to extract problem count from output like "5 problems (3 errors, 2 warnings)"
    const problemMatch = ctx.lintOutput.match(/(\d+)\s+problem/i);
    if (problemMatch) {
      const problems = parseInt(problemMatch[1]);
      if (problems < 5) return 0.8;
      if (problems < 20) return 0.5;
      return 0.3;
    }

    return 0.6;
  }

  /**
   * Evaluate documentation dimension
   *
   * Checks for JSDoc comments and inline documentation in source files.
   *
   * @param ctx - Evaluation context
   * @returns Score 0-1 (0=no docs, 1=well-documented)
   */
  private evaluateDocumentation(ctx: EvaluationContext): number {
    let totalScore = 0;
    let fileCount = 0;

    for (const file of ctx.files) {
      if (file.type === 'deleted') continue;
      if (!file.path.match(/\.(ts|js|tsx|jsx)$/)) continue;

      fileCount++;
      const hasJsDoc = file.content.includes('/**');
      const hasComments = file.content.includes('//');

      if (hasJsDoc) totalScore += 1.0;
      else if (hasComments) totalScore += 0.5;
      else totalScore += 0.2;
    }

    return fileCount > 0 ? totalScore / fileCount : 0.5;
  }

  /**
   * Evaluate security dimension
   *
   * Scans code for obvious security issues like hardcoded secrets
   * or dangerous patterns (eval, dangerouslySetInnerHTML).
   *
   * @param ctx - Evaluation context
   * @returns Score 0-1 (0=major security issues, 1=secure)
   */
  private evaluateSecurity(ctx: EvaluationContext): number {
    let score = 1.0;

    for (const file of ctx.files) {
      if (file.type === 'deleted') continue;

      // Check for hardcoded secrets
      if (file.content.match(/password\s*=\s*['"][^'"]+['"]/i)) score -= 0.3;
      if (file.content.match(/api[_-]?key\s*=\s*['"][^'"]+['"]/i)) score -= 0.3;

      // Check for dangerous patterns
      if (file.content.includes('eval(')) score -= 0.2;
      if (file.content.includes('dangerouslySetInnerHTML')) score -= 0.1;
    }

    return Math.max(0, score);
  }

  /**
   * Identify blockers that prevent task completion
   *
   * A blocker is a critical issue that must be fixed before
   * the task can be considered ready.
   *
   * @param ctx - Evaluation context
   * @param dims - Evaluated dimensions
   * @returns Array of human-readable blocker messages
   */
  private identifyBlockers(ctx: EvaluationContext, dims: ReadinessDimensions): string[] {
    const blockers: string[] = [];

    if (dims.functionality < 0.5) blockers.push('Build failures or major errors');
    if (dims.tests < 0.3) blockers.push('Test failures');
    if (dims.types < 0.5) blockers.push('Type errors');
    if (dims.security < 0.7) blockers.push('Security concerns detected');

    return blockers;
  }

  /**
   * Calculate confidence in the evaluation
   *
   * Confidence increases with more data (build output, tests, etc.).
   * Higher confidence means the score is more reliable.
   *
   * @param ctx - Evaluation context
   * @returns Confidence score 0-1
   */
  private calculateConfidence(ctx: EvaluationContext): number {
    let confidence = 0.5;
    if (ctx.buildOutput) confidence += 0.15;
    if (ctx.testOutput) confidence += 0.15;
    if (ctx.typeCheckOutput) confidence += 0.1;
    if (ctx.lintOutput) confidence += 0.1;
    return Math.min(1.0, confidence);
  }
}

/**
 * Singleton instance of the readiness calculator
 */
export const calculator = new ReadinessCalculator();
