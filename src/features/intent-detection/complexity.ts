export interface ComplexityAnalysis {
  score: number; // 0-1
  estimatedFiles: number;
  riskLevel: 'low' | 'medium' | 'high';
  suggestRalplan: boolean;
}

/**
 * Analyze task complexity based on input characteristics
 */
export function analyzeComplexity(input: string): ComplexityAnalysis {
  let score = 0;
  let estimatedFiles = 1;

  const lowerInput = input.toLowerCase();

  // Indicators of high complexity
  const complexityIndicators = [
    { pattern: /\b(refactor|redesign|migrate|rewrite)\b/i, points: 0.3, files: 5 },
    { pattern: /\b(system|architecture|infrastructure)\b/i, points: 0.25, files: 4 },
    { pattern: /\b(multiple|many|all|entire)\b/i, points: 0.2, files: 3 },
    { pattern: /\b(integrate|connect|sync)\b/i, points: 0.15, files: 3 },
    { pattern: /\b(api|backend|frontend|database)\b/i, points: 0.1, files: 2 },
    { pattern: /\b(security|auth|payment|billing)\b/i, points: 0.2, files: 2 },
    { pattern: /\b(performance|optimize|scale)\b/i, points: 0.15, files: 2 },
    { pattern: /\b(and|also|plus|as well as)\b/i, points: 0.1, files: 1 },
  ];

  // Korean complexity indicators
  const koreanIndicators = [
    { pattern: /리팩토링|재설계|마이그레이션|재작성/i, points: 0.3, files: 5 },
    { pattern: /시스템|아키텍처|인프라/i, points: 0.25, files: 4 },
    { pattern: /여러|많은|모든|전체/i, points: 0.2, files: 3 },
    { pattern: /통합|연결|동기화/i, points: 0.15, files: 3 },
    { pattern: /보안|인증|결제/i, points: 0.2, files: 2 },
    { pattern: /성능|최적화|확장/i, points: 0.15, files: 2 },
  ];

  // Check all indicators
  [...complexityIndicators, ...koreanIndicators].forEach(indicator => {
    if (indicator.pattern.test(input)) {
      score += indicator.points;
      estimatedFiles = Math.max(estimatedFiles, indicator.files);
    }
  });

  // Sentence count indicates complexity
  const sentences = input.split(/[.!?]/).filter(s => s.trim().length > 0);
  if (sentences.length > 3) {
    score += 0.15;
    estimatedFiles += 1;
  }

  // Word count indicates complexity
  const words = input.split(/\s+/).length;
  if (words > 50) {
    score += 0.1;
  } else if (words > 100) {
    score += 0.2;
    estimatedFiles += 1;
  }

  // Cap score at 1.0
  score = Math.min(score, 1.0);

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high';
  if (score >= 0.6) {
    riskLevel = 'high';
  } else if (score >= 0.3) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  // Suggest ralplan for high complexity tasks
  const suggestRalplan = score >= 0.5 || estimatedFiles >= 4;

  return {
    score,
    estimatedFiles,
    riskLevel,
    suggestRalplan,
  };
}
