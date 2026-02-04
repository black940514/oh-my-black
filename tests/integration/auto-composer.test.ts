/**
 * Team Auto-Composer Integration Tests
 *
 * Tests automatic team composition including:
 * - Template selection based on complexity and task type
 * - Team member composition
 * - Specialist addition based on task analysis
 * - Fitness score calculation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TeamAutoComposer,
  selectTemplateByComplexity,
  selectTemplateByTaskType,
  selectTemplateByCapabilities,
  analyzeRequirements,
  extractRequiredCapabilities,
  determineBuilders,
  determineValidators,
  addSpecialists,
  balanceTeam,
  type CompositionRequest,
  type CompositionConstraints
} from '../../src/features/team/auto-composer.js';
import type { AgentCapability } from '../../src/features/team/types.js';
import {
  createMockTaskAnalysis,
  createMockDecomposition,
  expectTeamHasRole,
  expectTeamHasCapability
} from './helpers.js';

describe('Team Auto-Composer', () => {
  describe('Template Selection', () => {
    it('should select minimal for low complexity', () => {
      const template = selectTemplateByComplexity(0.2);
      expect(template).toBe('minimal');

      const template2 = selectTemplateByComplexity(0.29);
      expect(template2).toBe('minimal');
    });

    it('should select standard for low-medium complexity', () => {
      const template = selectTemplateByComplexity(0.4);
      expect(template).toBe('standard');
    });

    it('should select robust for medium-high complexity', () => {
      const template = selectTemplateByComplexity(0.6);
      expect(template).toBe('robust');
    });

    it('should select secure for high complexity', () => {
      const template = selectTemplateByComplexity(0.8);
      expect(template).toBe('secure');
    });

    it('should select fullstack for very high complexity', () => {
      const template = selectTemplateByComplexity(0.9);
      expect(template).toBe('fullstack');

      const template2 = selectTemplateByComplexity(0.95);
      expect(template2).toBe('fullstack');
    });

    it('should select template based on task type', () => {
      expect(selectTemplateByTaskType('fullstack-app')).toBe('fullstack');
      expect(selectTemplateByTaskType('bug-fix')).toBe('standard');
      expect(selectTemplateByTaskType('documentation')).toBe('minimal');
      expect(selectTemplateByTaskType('refactoring')).toBe('robust');
      expect(selectTemplateByTaskType('infrastructure')).toBe('secure');
      expect(selectTemplateByTaskType('unknown')).toBe('standard');
    });

    it('should select template based on capabilities', () => {
      const securityCaps: AgentCapability[] = ['code_modification', 'security_analysis'];
      expect(selectTemplateByCapabilities(securityCaps)).toBe('secure');

      const designCaps: AgentCapability[] = ['code_modification', 'design'];
      expect(selectTemplateByCapabilities(designCaps)).toBe('fullstack');

      const manyCaps: AgentCapability[] = [
        'code_modification',
        'code_review',
        'testing',
        'design',
        'documentation'
      ];
      expect(selectTemplateByCapabilities(manyCaps)).toBe('fullstack');

      const fewCaps: AgentCapability[] = ['code_modification'];
      expect(selectTemplateByCapabilities(fewCaps)).toBe('minimal');
    });
  });

  describe('Requirements Analysis', () => {
    it('should detect need for designer from keywords', () => {
      const analysis = createMockTaskAnalysis({
        task: 'Build a responsive UI component',
        areas: ['frontend', 'ui']
      });

      const requirements = analyzeRequirements(analysis);

      expect(requirements.needsDesigner).toBe(true);
    });

    it('should detect need for security review', () => {
      const analysis = createMockTaskAnalysis({
        task: 'Implement authentication with JWT tokens',
        areas: ['backend', 'security']
      });

      const requirements = analyzeRequirements(analysis);

      expect(requirements.needsSecurityReview).toBe(true);
    });

    it('should detect need for architect', () => {
      const analysis = createMockTaskAnalysis({
        task: 'Refactor the monolith into microservices',
        type: 'refactoring',
        complexity: 0.9
      });

      const requirements = analyzeRequirements(analysis);

      expect(requirements.needsArchitect).toBe(true);
    });

    it('should detect need for documentation', () => {
      const analysis = createMockTaskAnalysis({
        task: 'Write API documentation',
        type: 'documentation'
      });

      const requirements = analyzeRequirements(analysis);

      expect(requirements.needsDocumentation).toBe(true);
    });

    it('should estimate appropriate team size', () => {
      const simpleAnalysis = createMockTaskAnalysis({ complexity: 0.2 });
      const simpleReqs = analyzeRequirements(simpleAnalysis);
      expect(simpleReqs.estimatedTeamSize).toBeLessThanOrEqual(2);

      const complexAnalysis = createMockTaskAnalysis({
        complexity: 0.8,
        task: 'Build secure authentication with UI',
        areas: ['frontend', 'backend', 'security']
      });
      const complexReqs = analyzeRequirements(complexAnalysis);
      expect(complexReqs.estimatedTeamSize).toBeGreaterThan(3);
    });

    it('should recommend appropriate validation type', () => {
      // B-V cycle is now default: low complexity uses validator (no security keywords)
      const simple = createMockTaskAnalysis({
        complexity: 0.2,
        areas: ['backend'],  // No security area
        task: 'Add logging'  // No security keywords
      });
      expect(analyzeRequirements(simple).recommendedValidation).toBe('validator');

      const medium = createMockTaskAnalysis({
        complexity: 0.5,
        areas: ['backend'],
        task: 'Implement feature'
      });
      expect(analyzeRequirements(medium).recommendedValidation).toBe('validator');

      const complex = createMockTaskAnalysis({ complexity: 0.8 });
      expect(analyzeRequirements(complex).recommendedValidation).toBe('architect');

      const security = createMockTaskAnalysis({
        complexity: 0.4,
        task: 'Add security headers'
      });
      expect(analyzeRequirements(security).recommendedValidation).toBe('architect');
    });
  });

  describe('Capability Extraction', () => {
    it('should extract code_modification for all tasks', () => {
      const analysis = createMockTaskAnalysis();
      const capabilities = extractRequiredCapabilities(analysis);

      expect(capabilities).toContain('code_modification');
    });

    it('should extract design capability', () => {
      const analysis = createMockTaskAnalysis({
        task: 'Create a beautiful UI component',
        areas: ['frontend']
      });
      const capabilities = extractRequiredCapabilities(analysis);

      expect(capabilities).toContain('design');
    });

    it('should extract security capability', () => {
      const analysis = createMockTaskAnalysis({
        task: 'Implement secure authentication',
        areas: ['security']
      });
      const capabilities = extractRequiredCapabilities(analysis);

      expect(capabilities).toContain('security_analysis');
    });

    it('should extract testing capability', () => {
      const analysis = createMockTaskAnalysis({
        type: 'testing',
        task: 'Write integration tests'
      });
      const capabilities = extractRequiredCapabilities(analysis);

      expect(capabilities).toContain('testing');
    });

    it('should extract documentation capability', () => {
      const analysis = createMockTaskAnalysis({
        task: 'Document the API endpoints'
      });
      const capabilities = extractRequiredCapabilities(analysis);

      expect(capabilities).toContain('documentation');
    });

    it('should extract planning and exploration for complex tasks', () => {
      const analysis = createMockTaskAnalysis({
        complexity: 0.8,
        type: 'refactoring'
      });
      const capabilities = extractRequiredCapabilities(analysis);

      expect(capabilities).toContain('planning');
      expect(capabilities).toContain('exploration');
    });
  });

  describe('Team Composition', () => {
    it('should compose team with required builders', () => {
      const decomposition = createMockDecomposition(3);
      const builders = determineBuilders(decomposition.subtasks);

      expect(builders.length).toBeGreaterThan(0);
      expect(builders.every(b => b.role === 'builder')).toBe(true);
      expect(builders.every(b => b.agentType)).toBeTruthy();
    });

    it('should use highest model tier for each agent type', () => {
      const decomposition = createMockDecomposition(2);
      // Set different tiers for same agent type
      decomposition.subtasks[0].agentType = 'executor';
      decomposition.subtasks[0].modelTier = 'low';
      decomposition.subtasks[1].agentType = 'executor';
      decomposition.subtasks[1].modelTier = 'high';

      const builders = determineBuilders(decomposition.subtasks);

      const executorBuilder = builders.find(b => b.agentType === 'executor');
      expect(executorBuilder).toBeDefined();
      expect(executorBuilder!.modelTier).toBe('high');
    });

    it('should add validators based on validation type', () => {
      const selfOnlyValidators = determineValidators('self-only');
      expect(selfOnlyValidators.length).toBe(0);

      const validatorValidators = determineValidators('validator');
      expect(validatorValidators.length).toBe(2);
      expect(validatorValidators.every(v => v.role === 'validator')).toBe(true);

      const architectValidators = determineValidators('architect');
      expect(architectValidators.length).toBe(3);
      const hasArchitect = architectValidators.some(v => v.agentType === 'architect');
      expect(hasArchitect).toBe(true);
    });

    it('should add specialists based on task analysis', () => {
      const team = createMockTeam('standard');

      const uiAnalysis = createMockTaskAnalysis({
        task: 'Build UI components',
        areas: ['frontend', 'ui']
      });

      const withDesigner = addSpecialists(team, uiAnalysis);
      expectTeamHasCapability(withDesigner, 'design');

      const securityAnalysis = createMockTaskAnalysis({
        task: 'Add security features',
        areas: ['security']
      });

      const withSecurity = addSpecialists(team, securityAnalysis);
      expectTeamHasCapability(withSecurity, 'security_analysis');
    });

    it('should not duplicate specialists', () => {
      const team = createMockTeam('standard');
      const analysis = createMockTaskAnalysis({
        task: 'Build secure UI',
        areas: ['frontend', 'security']
      });

      const composed1 = addSpecialists(team, analysis);
      const count1 = composed1.members.length;

      // Add specialists again
      const composed2 = addSpecialists(composed1, analysis);
      const count2 = composed2.members.length;

      // Should not add duplicates
      expect(count2).toBe(count1);
    });
  });

  describe('Team Auto-Composer Class', () => {
    let composer: TeamAutoComposer;

    beforeEach(() => {
      composer = new TeamAutoComposer();
    });

    it('should compose team from simple task analysis', () => {
      const analysis = createMockTaskAnalysis({
        complexity: 0.3,
        type: 'bug-fix'
      });

      const request: CompositionRequest = { analysis };
      const result = composer.composeTeam(request);

      expect(result.team).toBeDefined();
      expect(result.templateUsed).toBeDefined();
      expect(result.reasoning).toBeTruthy();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);

      expectTeamHasRole(result.team, 'builder');
    });

    it('should compose team for complex fullstack task', () => {
      const analysis = createMockTaskAnalysis({
        complexity: 0.9,
        type: 'fullstack-app',
        task: 'Build authentication system with UI',
        areas: ['frontend', 'backend', 'security']
      });

      const request: CompositionRequest = { analysis };
      const result = composer.composeTeam(request);

      expect(result.templateUsed).toBe('fullstack');
      expect(result.team.members.length).toBeGreaterThan(2);
      expectTeamHasRole(result.team, 'builder');
      expectTeamHasCapability(result.team, 'design');
      expectTeamHasCapability(result.team, 'security_analysis');
    });

    it('should respect composition constraints', () => {
      const analysis = createMockTaskAnalysis({ complexity: 0.7 });

      const constraints: CompositionConstraints = {
        maxMembers: 3,
        validationType: 'self-only'
      };

      const request: CompositionRequest = { analysis, constraints };
      const result = composer.composeTeam(request);

      expect(result.team.members.length).toBeLessThanOrEqual(3);
      expect(result.team.defaultValidationType).toBe('self-only');
    });

    it('should apply model tier limit', () => {
      const analysis = createMockTaskAnalysis({ complexity: 0.8 });

      const constraints: CompositionConstraints = {
        maxModelTier: 'medium'
      };

      const request: CompositionRequest = { analysis, constraints };
      const result = composer.composeTeam(request);

      const allMediumOrLower = result.team.members.every(
        m => m.modelTier === 'low' || m.modelTier === 'medium'
      );
      expect(allMediumOrLower).toBe(true);
    });

    it('should calculate high fitness score for well-matched team', () => {
      const analysis = createMockTaskAnalysis({
        complexity: 0.5,
        type: 'feature',
        areas: ['backend']
      });

      const request: CompositionRequest = { analysis };
      const result = composer.composeTeam(request);

      // Should have good match
      expect(result.score).toBeGreaterThan(0.7);
    });

    it('should penalize over-provisioning', () => {
      const analysis = createMockTaskAnalysis({
        complexity: 0.2, // Very simple
        type: 'documentation'
      });

      const request: CompositionRequest = {
        analysis,
        preferredTemplate: 'fullstack' // Way too much
      };

      const result = composer.composeTeam(request);

      // Fitness score should be lower due to over-provisioning
      expect(result.score).toBeLessThan(0.9);
    });

    it('should balance team to meet constraints', () => {
      const analysis = createMockTaskAnalysis({ complexity: 0.8 });

      const constraints: CompositionConstraints = {
        maxMembers: 2,
        requiredCapabilities: ['code_modification', 'code_review']
      };

      const request: CompositionRequest = { analysis, constraints };
      const result = composer.composeTeam(request);

      expect(result.team.members.length).toBeLessThanOrEqual(2);
      expectTeamHasCapability(result.team, 'code_modification');
      expectTeamHasCapability(result.team, 'code_review');
    });
  });

  describe('Constraint Validation', () => {
    let composer: TeamAutoComposer;

    beforeEach(() => {
      composer = new TeamAutoComposer();
    });

    it('should validate team against constraints', () => {
      const team = createMockTeam('fullstack');

      const constraints: CompositionConstraints = {
        maxMembers: 2
      };

      const validation = composer.validateComposition(team, constraints);

      // Fullstack team likely has more than 2 members
      if (team.members.length > 2) {
        expect(validation.valid).toBe(false);
        expect(validation.violations.length).toBeGreaterThan(0);
        expect(validation.suggestions.length).toBeGreaterThan(0);
      } else {
        expect(validation.valid).toBe(true);
      }
    });

    it('should detect missing required capabilities', () => {
      const team = createMockTeam('minimal');

      const constraints: CompositionConstraints = {
        requiredCapabilities: ['design', 'security_analysis']
      };

      const validation = composer.validateComposition(team, constraints);

      expect(validation.valid).toBe(false);
      expect(validation.violations.some(v => v.includes('design'))).toBe(true);
      expect(validation.violations.some(v => v.includes('security_analysis'))).toBe(true);
    });

    it('should detect excluded agents', () => {
      const team = createMockTeam('standard');

      const constraints: CompositionConstraints = {
        excludedAgents: ['executor']
      };

      const validation = composer.validateComposition(team, constraints);

      if (team.members.some(m => m.agentType === 'executor')) {
        expect(validation.valid).toBe(false);
        expect(validation.violations.some(v => v.includes('executor'))).toBe(true);
      }
    });
  });

  describe('Team Balancing', () => {
    it('should reduce team size to meet max constraint', () => {
      const team = createMockTeam('fullstack');
      const originalSize = team.members.length;

      const constraints: CompositionConstraints = {
        maxMembers: 2
      };

      const balanced = balanceTeam(team, constraints);

      expect(balanced.members.length).toBeLessThanOrEqual(2);
      expect(balanced.members.length).toBeLessThan(originalSize);

      // Should keep at least one builder
      expectTeamHasRole(balanced, 'builder');
    });

    it('should increase team size to meet min constraint', () => {
      const team = createMockTeam('minimal');

      const constraints: CompositionConstraints = {
        minMembers: 5
      };

      const balanced = balanceTeam(team, constraints);

      expect(balanced.members.length).toBeGreaterThanOrEqual(5);
    });

    it('should remove excluded agents', () => {
      const team = createMockTeam('standard');

      const constraints: CompositionConstraints = {
        excludedAgents: ['executor']
      };

      const balanced = balanceTeam(team, constraints);

      const hasExcluded = balanced.members.some(m => m.agentType === 'executor');
      expect(hasExcluded).toBe(false);
    });
  });
});
