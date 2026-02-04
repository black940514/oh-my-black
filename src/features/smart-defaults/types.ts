export interface SmartDefaultsConfig {
  autoIntentDetection: boolean;
  autoSmartDefaults: boolean;
}

export interface AutoConfigResult {
  validationType: 'self-only' | 'validator' | 'architect';
  teamTemplate: 'minimal' | 'standard' | 'robust' | 'secure' | 'fullstack' | 'frontend' | 'backend' | 'bugfix' | 'refactoring';
  parallelWorkers: number;
  enableOhmyblack: boolean;
}
