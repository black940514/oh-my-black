import { bench, describe } from 'vitest';
import type { TaskAnalysis } from '../../src/features/task-decomposer/types.js';
import type { CompositionRequest } from '../../src/features/team/auto-composer.js';
import {
  TeamAutoComposer,
  selectTemplateByComplexity,
  selectTemplateByTaskType,
  selectTemplateByCapabilities,
  analyzeRequirements,
  extractRequiredCapabilities,
  addSpecialists,
  balanceTeam
} from '../../src/features/team/auto-composer.js';
import { createTeamFromTemplate } from '../../src/features/team/index.js';

// Mock data generators
function createMockAnalysis(complexity: number, type: string = 'feature'): TaskAnalysis {
  return {
    task: `Test task with ${type}`,
    type,
    complexity,
    areas: ['backend', 'frontend'],
    technologies: ['typescript', 'react'],
    estimatedComponents: Math.ceil(complexity * 10),
    dependencies: [],
    risks: [],
    isParallelizable: complexity > 0.5
  };
}

function createSimpleAnalysis(): TaskAnalysis {
  return {
    task: 'Add a new button to the UI',
    type: 'feature',
    complexity: 0.2,
    areas: ['frontend'],
    technologies: ['react', 'typescript'],
    estimatedComponents: 2,
    dependencies: [],
    risks: [],
    isParallelizable: false
  };
}

function createComplexAnalysis(): TaskAnalysis {
  return {
    task: 'Refactor authentication system with OAuth2, JWT, and RBAC',
    type: 'refactoring',
    complexity: 0.85,
    areas: ['backend', 'security', 'database', 'frontend'],
    technologies: ['typescript', 'node', 'postgresql', 'react', 'jwt', 'oauth2'],
    estimatedComponents: 12,
    dependencies: ['user-service', 'session-manager', 'token-validator'],
    risks: ['security vulnerability', 'breaking changes', 'performance impact'],
    isParallelizable: true
  };
}

function createFullstackAnalysis(): TaskAnalysis {
  return {
    task: 'Build a complete e-commerce checkout flow with payment integration',
    type: 'fullstack-app',
    complexity: 0.95,
    areas: ['frontend', 'backend', 'database', 'api', 'security', 'testing'],
    technologies: ['react', 'node', 'express', 'postgresql', 'stripe', 'jest'],
    estimatedComponents: 20,
    dependencies: ['payment-gateway', 'inventory-system', 'user-accounts'],
    risks: ['payment security', 'data integrity', 'transaction failures'],
    isParallelizable: true
  };
}

function createSecurityAnalysis(): TaskAnalysis {
  return {
    task: 'Implement security audit and fix vulnerabilities',
    type: 'optimization',
    complexity: 0.7,
    areas: ['security', 'backend', 'authentication'],
    technologies: ['node', 'typescript', 'encryption', 'oauth'],
    estimatedComponents: 8,
    dependencies: [],
    risks: ['security breach', 'data leak'],
    isParallelizable: false
  };
}

function createDocumentationAnalysis(): TaskAnalysis {
  return {
    task: 'Write API documentation and user guides',
    type: 'documentation',
    complexity: 0.3,
    areas: ['docs'],
    technologies: ['markdown', 'jsdoc'],
    estimatedComponents: 5,
    dependencies: [],
    risks: [],
    isParallelizable: true
  };
}

describe('Team Composition Performance', () => {
  const composer = new TeamAutoComposer();

  // Template selection benchmarks
  bench('selectTemplateByComplexity (11 different complexities)', () => {
    for (let i = 0; i <= 10; i++) {
      selectTemplateByComplexity(i / 10);
    }
  });

  bench('selectTemplateByTaskType (multiple types)', () => {
    const types = ['feature', 'bug-fix', 'refactoring', 'documentation', 'fullstack-app', 'testing'];
    for (const type of types) {
      selectTemplateByTaskType(type);
    }
  });

  bench('selectTemplateByCapabilities (varying capability sets)', () => {
    const capabilitySets = [
      ['code_modification'],
      ['code_modification', 'testing'],
      ['code_modification', 'testing', 'design'],
      ['code_modification', 'testing', 'design', 'security_analysis'],
      ['code_modification', 'testing', 'design', 'security_analysis', 'documentation']
    ];
    for (const caps of capabilitySets) {
      selectTemplateByCapabilities(caps as any);
    }
  });

  // Requirements analysis benchmarks
  bench('analyzeRequirements (simple task)', () => {
    const analysis = createSimpleAnalysis();
    analyzeRequirements(analysis);
  });

  bench('analyzeRequirements (complex task)', () => {
    const analysis = createComplexAnalysis();
    analyzeRequirements(analysis);
  });

  bench('analyzeRequirements (fullstack task)', () => {
    const analysis = createFullstackAnalysis();
    analyzeRequirements(analysis);
  });

  bench('analyzeRequirements (security task)', () => {
    const analysis = createSecurityAnalysis();
    analyzeRequirements(analysis);
  });

  // Capability extraction benchmarks
  bench('extractRequiredCapabilities (simple)', () => {
    const analysis = createSimpleAnalysis();
    extractRequiredCapabilities(analysis);
  });

  bench('extractRequiredCapabilities (complex)', () => {
    const analysis = createComplexAnalysis();
    extractRequiredCapabilities(analysis);
  });

  // Team composition benchmarks
  bench('composeTeam (simple task)', () => {
    const analysis = createSimpleAnalysis();
    const request: CompositionRequest = { analysis };
    composer.composeTeam(request);
  });

  bench('composeTeam (complex task)', () => {
    const analysis = createComplexAnalysis();
    const request: CompositionRequest = { analysis };
    composer.composeTeam(request);
  });

  bench('composeTeam (fullstack task)', () => {
    const analysis = createFullstackAnalysis();
    const request: CompositionRequest = { analysis };
    composer.composeTeam(request);
  });

  bench('composeTeam (security task)', () => {
    const analysis = createSecurityAnalysis();
    const request: CompositionRequest = { analysis };
    composer.composeTeam(request);
  });

  bench('composeTeam (documentation task)', () => {
    const analysis = createDocumentationAnalysis();
    const request: CompositionRequest = { analysis };
    composer.composeTeam(request);
  });

  // Team composition with constraints
  bench('composeTeam with size constraints', () => {
    const analysis = createComplexAnalysis();
    const request: CompositionRequest = {
      analysis,
      constraints: {
        maxMembers: 5,
        minMembers: 3
      }
    };
    composer.composeTeam(request);
  });

  bench('composeTeam with capability constraints', () => {
    const analysis = createComplexAnalysis();
    const request: CompositionRequest = {
      analysis,
      constraints: {
        requiredCapabilities: ['code_modification', 'security_analysis', 'testing']
      }
    };
    composer.composeTeam(request);
  });

  // Template recommendation benchmarks
  bench('recommendTemplate (varying complexities)', () => {
    for (let i = 0; i <= 10; i++) {
      const analysis = createMockAnalysis(i / 10);
      composer.recommendTemplate(analysis);
    }
  });

  // Specialist addition benchmarks
  bench('addSpecialists (minimal team)', () => {
    const analysis = createComplexAnalysis();
    const team = createTeamFromTemplate('minimal', 'team-1', 'Test Team');
    addSpecialists(team, analysis);
  });

  bench('addSpecialists (standard team)', () => {
    const analysis = createFullstackAnalysis();
    const team = createTeamFromTemplate('standard', 'team-1', 'Test Team');
    addSpecialists(team, analysis);
  });

  // Team balancing benchmarks
  bench('balanceTeam (reduce to max members)', () => {
    const team = createTeamFromTemplate('fullstack', 'team-1', 'Test Team');
    const constraints = { maxMembers: 4 };
    balanceTeam(team, constraints);
  });

  bench('balanceTeam (increase to min members)', () => {
    const team = createTeamFromTemplate('minimal', 'team-1', 'Test Team');
    const constraints = { minMembers: 5 };
    balanceTeam(team, constraints);
  });

  // Fitness score calculation
  bench('calculateFitnessScore (simple match)', () => {
    const analysis = createSimpleAnalysis();
    const request: CompositionRequest = { analysis };
    const result = composer.composeTeam(request);
    composer.calculateFitnessScore(result.team, analysis);
  });

  bench('calculateFitnessScore (complex match)', () => {
    const analysis = createComplexAnalysis();
    const request: CompositionRequest = { analysis };
    const result = composer.composeTeam(request);
    composer.calculateFitnessScore(result.team, analysis);
  });

  // Validation benchmarks
  bench('validateComposition (no constraints)', () => {
    const analysis = createSimpleAnalysis();
    const request: CompositionRequest = { analysis };
    const result = composer.composeTeam(request);
    composer.validateComposition(result.team);
  });

  bench('validateComposition (with constraints)', () => {
    const analysis = createComplexAnalysis();
    const request: CompositionRequest = { analysis };
    const result = composer.composeTeam(request);
    composer.validateComposition(result.team, {
      maxMembers: 10,
      minMembers: 2,
      requiredCapabilities: ['code_modification', 'testing'],
      requiredRoles: ['builder', 'validator']
    });
  });

  // Batch composition (realistic scenario)
  bench('compose teams for 10 different tasks', () => {
    const analyses = [
      createSimpleAnalysis(),
      createComplexAnalysis(),
      createFullstackAnalysis(),
      createSecurityAnalysis(),
      createDocumentationAnalysis(),
      createMockAnalysis(0.4, 'bug-fix'),
      createMockAnalysis(0.6, 'feature'),
      createMockAnalysis(0.8, 'refactoring'),
      createMockAnalysis(0.3, 'testing'),
      createMockAnalysis(0.9, 'migration')
    ];

    for (const analysis of analyses) {
      composer.composeTeam({ analysis });
    }
  });
});
