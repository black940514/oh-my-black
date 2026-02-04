export type IntentMode = 'autopilot' | 'ralplan' | 'ultrapilot' | 'ralph' | 'analyze' | 'none';
export type ValidationLevel = 'self-only' | 'validator' | 'architect';

export interface IntentDetectionResult {
  mode: IntentMode;
  confidence: 'high' | 'medium' | 'low';
  validationLevel?: ValidationLevel;
  keywords: string[];
  reasoning: string;
}

export interface KeywordPattern {
  keywords: string[];
  mode: IntentMode;
  priority: number;
}
