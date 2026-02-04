import { IntentDetectionResult, IntentMode, ValidationLevel } from './types.js';
import { KOREAN_KEYWORDS, ENGLISH_KEYWORDS, detectQualityKeywords, detectSpeedKeywords, detectArchitectKeywords } from './keywords.js';
import { analyzeComplexity } from './complexity.js';

/**
 * Remove code blocks from input to avoid false positives in keyword detection
 */
function stripCodeBlocks(input: string): string {
  // Remove triple-backtick code blocks
  let cleaned = input.replace(/```[\s\S]*?```/g, '');

  // Remove single-backtick inline code
  cleaned = cleaned.replace(/`[^`]+`/g, '');

  return cleaned;
}

/**
 * Detect mode from explicit keywords with priority handling
 */
export function detectModeFromKeywords(input: string): IntentMode {
  const cleanInput = stripCodeBlocks(input);
  const lowerInput = cleanInput.toLowerCase();

  // Priority order: ralplan > ralph > ultrapilot > autopilot
  // Each mode gets a priority score based on matched keywords

  const modePriorities = {
    ralplan: 4,
    ralph: 3,
    ultrapilot: 2,
    autopilot: 1,
    analyze: 1,
  };

  interface ModeMatch {
    mode: IntentMode;
    keywords: string[];
    priority: number;
  }

  const matches: ModeMatch[] = [];

  // Check ralplan keywords
  const ralplanKeywords = [
    ...ENGLISH_KEYWORDS.ralplan,
    ...KOREAN_KEYWORDS.ralplan,
  ];
  const ralplanMatches = ralplanKeywords.filter(kw =>
    lowerInput.includes(kw.toLowerCase())
  );
  if (ralplanMatches.length > 0) {
    matches.push({
      mode: 'ralplan',
      keywords: ralplanMatches,
      priority: modePriorities.ralplan,
    });
  }

  // Check ralph keywords
  const ralphKeywords = [
    ...ENGLISH_KEYWORDS.ralph,
    ...KOREAN_KEYWORDS.ralph,
  ];
  const ralphMatches = ralphKeywords.filter(kw =>
    lowerInput.includes(kw.toLowerCase())
  );
  if (ralphMatches.length > 0) {
    matches.push({
      mode: 'ralph',
      keywords: ralphMatches,
      priority: modePriorities.ralph,
    });
  }

  // Check ultrapilot keywords
  const ultrapilotKeywords = [
    ...ENGLISH_KEYWORDS.ultrapilot,
    ...KOREAN_KEYWORDS.ultrapilot,
  ];
  const ultrapilotMatches = ultrapilotKeywords.filter(kw =>
    lowerInput.includes(kw.toLowerCase())
  );
  if (ultrapilotMatches.length > 0) {
    matches.push({
      mode: 'ultrapilot',
      keywords: ultrapilotMatches,
      priority: modePriorities.ultrapilot,
    });
  }

  // Check autopilot keywords
  const autopilotKeywords = [
    ...ENGLISH_KEYWORDS.autopilot,
    ...KOREAN_KEYWORDS.autopilot,
  ];
  const autopilotMatches = autopilotKeywords.filter(kw =>
    lowerInput.includes(kw.toLowerCase())
  );
  if (autopilotMatches.length > 0) {
    matches.push({
      mode: 'autopilot',
      keywords: autopilotMatches,
      priority: modePriorities.autopilot,
    });
  }

  // Check analyze keywords (question words, debugging terms)
  const analyzeKeywords = [
    'why', 'how', 'what', 'debug', 'investigate', 'analyze',
    '왜', '어떻게', '뭐', '디버그', '조사', '분석',
  ];
  const analyzeMatches = analyzeKeywords.filter(kw =>
    lowerInput.includes(kw.toLowerCase())
  );
  if (analyzeMatches.length > 0) {
    matches.push({
      mode: 'analyze',
      keywords: analyzeMatches,
      priority: modePriorities.analyze,
    });
  }

  // Return highest priority match
  if (matches.length > 0) {
    const sortedMatches = matches.sort((a, b) => b.priority - a.priority);
    return sortedMatches[0].mode;
  }

  return 'none';
}

/**
 * Determine validation level based on keywords and complexity
 */
function determineValidationLevel(
  input: string,
  complexity: number
): ValidationLevel {
  // Architect validation needed for:
  // 1. Quality/security keywords
  // 2. Architect-specific keywords
  // 3. High complexity tasks
  if (detectQualityKeywords(input) || detectArchitectKeywords(input)) {
    return 'architect';
  }

  if (complexity >= 0.6) {
    return 'architect';
  }

  // Speed keywords suggest self-validation (explicit opt-out from B-V)
  if (detectSpeedKeywords(input)) {
    return 'self-only';
  }

  // Default to validator for B-V cycle (enabled by default)
  return 'validator';
}

/**
 * Calculate confidence based on keyword matches
 */
function calculateConfidence(keywordCount: number): 'high' | 'medium' | 'low' {
  if (keywordCount >= 3) {
    return 'high';
  } else if (keywordCount >= 2) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Main intent detection function
 */
export function detectIntent(input: string): IntentDetectionResult {
  const cleanInput = stripCodeBlocks(input);

  // Detect mode from keywords
  const mode = detectModeFromKeywords(cleanInput);

  // Analyze complexity
  const complexityAnalysis = analyzeComplexity(cleanInput);

  // Determine validation level
  const validationLevel = determineValidationLevel(
    cleanInput,
    complexityAnalysis.score
  );

  // Collect all matched keywords for reasoning
  const allKeywords = [
    ...ENGLISH_KEYWORDS.autopilot,
    ...KOREAN_KEYWORDS.autopilot,
    ...ENGLISH_KEYWORDS.ralplan,
    ...KOREAN_KEYWORDS.ralplan,
    ...ENGLISH_KEYWORDS.ultrapilot,
    ...KOREAN_KEYWORDS.ultrapilot,
    ...ENGLISH_KEYWORDS.ralph,
    ...KOREAN_KEYWORDS.ralph,
  ];

  const lowerInput = cleanInput.toLowerCase();
  const matchedKeywords = allKeywords.filter(kw =>
    lowerInput.includes(kw.toLowerCase())
  );

  // Calculate confidence
  const confidence = calculateConfidence(matchedKeywords.length);

  // Build reasoning
  let reasoning = `Detected mode: ${mode} with ${confidence} confidence. `;

  if (matchedKeywords.length > 0) {
    reasoning += `Matched keywords: ${matchedKeywords.slice(0, 3).join(', ')}. `;
  }

  reasoning += `Complexity score: ${complexityAnalysis.score.toFixed(2)} (${complexityAnalysis.riskLevel}). `;
  reasoning += `Estimated ${complexityAnalysis.estimatedFiles} files. `;

  if (complexityAnalysis.suggestRalplan && mode !== 'ralplan') {
    reasoning += `Consider using ralplan for better planning. `;
  }

  reasoning += `Validation level: ${validationLevel}.`;

  return {
    mode,
    confidence,
    validationLevel,
    keywords: matchedKeywords.slice(0, 5), // Top 5 keywords
    reasoning,
  };
}

// Re-export all types and utilities
export * from './types.js';
export * from './keywords.js';
export * from './complexity.js';
