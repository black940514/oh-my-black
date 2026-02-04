/**
 * Meta-prompt Generation Integration Tests
 *
 * Tests template compilation, rendering, and prompt generation for:
 * - Teams
 * - Tasks
 * - Agents
 * - Plans
 */

import { describe, it, expect } from 'vitest';
import {
  TemplateEngine,
  type Template,
  type TemplateContext
} from '../../src/features/meta-prompt/index.js';
import {
  teamToContext,
  decompositionToPlanContext,
  type TeamPromptOptions,
  type PlanPromptOptions
} from '../../src/features/meta-prompt/generator.js';
import { createMockTeam, createMockDecomposition } from './helpers.js';

describe('Meta-prompt Generation', () => {
  describe('Template Engine', () => {
    let engine: TemplateEngine;

    beforeEach(() => {
      engine = new TemplateEngine();
    });

    it('should compile and render simple variables', () => {
      const template: Template = {
        name: 'test',
        content: 'Hello {{name}}, you are {{age}} years old.'
      };

      const context: TemplateContext = {
        name: 'Alice',
        age: 30
      };

      const compiled = engine.compile(template);
      const result = engine.render(compiled, context);

      expect(result).toBe('Hello Alice, you are 30 years old.');
    });

    it('should handle nested properties', () => {
      const template: Template = {
        name: 'test',
        content: 'User: {{user.name}}, Email: {{user.email}}'
      };

      const context: TemplateContext = {
        user: {
          name: 'Bob',
          email: 'bob@example.com'
        }
      };

      const compiled = engine.compile(template);
      const result = engine.render(compiled, context);

      expect(result).toBe('User: Bob, Email: bob@example.com');
    });

    it('should process conditionals', () => {
      const template: Template = {
        name: 'test',
        content: '{{#if isAdmin}}Admin Panel{{/if}}'
      };

      const contextTrue: TemplateContext = { isAdmin: true };
      const contextFalse: TemplateContext = { isAdmin: false };

      const compiled = engine.compile(template);
      const resultTrue = engine.render(compiled, contextTrue);
      const resultFalse = engine.render(compiled, contextFalse);

      expect(resultTrue).toBe('Admin Panel');
      expect(resultFalse).toBe('');
    });

    it('should process else conditionals', () => {
      const template: Template = {
        name: 'test',
        content: '{{#if isAdmin}}Admin{{else}}User{{/if}}'
      };

      const compiled = engine.compile(template);

      expect(engine.render(compiled, { isAdmin: true })).toBe('Admin');
      expect(engine.render(compiled, { isAdmin: false })).toBe('User');
    });

    it('should process loops', () => {
      const template: Template = {
        name: 'test',
        content: '{{#each items}}{{this}}{{/each}}'
      };

      const context: TemplateContext = {
        items: ['a', 'b', 'c']
      };

      const compiled = engine.compile(template);
      const result = engine.render(compiled, context);

      expect(result).toBe('abc');
    });

    it('should process loops with object access', () => {
      const template: Template = {
        name: 'test',
        content: '{{#each users}}{{name}}{{/each}}'
      };

      const context: TemplateContext = {
        users: [
          { name: 'Alice' },
          { name: 'Bob' }
        ]
      };

      const compiled = engine.compile(template);
      const result = engine.render(compiled, context);

      expect(result).toBe('AliceBob');
    });

    it('should apply helper functions - upper', () => {
      const template: Template = {
        name: 'test',
        content: '{{name | upper}}'
      };

      const context: TemplateContext = {
        name: 'hello'
      };

      const compiled = engine.compile(template);
      const result = engine.render(compiled, context);

      expect(result).toBe('HELLO');
    });

    it('should apply helper functions - lower', () => {
      const template: Template = {
        name: 'test',
        content: '{{name | lower}}'
      };

      const context: TemplateContext = {
        name: 'HELLO'
      };

      const compiled = engine.compile(template);
      const result = engine.render(compiled, context);

      expect(result).toBe('hello');
    });

    it('should apply helper functions - join', () => {
      const template: Template = {
        name: 'test',
        content: '{{items | join}}'
      };

      const context: TemplateContext = {
        items: ['a', 'b', 'c']
      };

      const compiled = engine.compile(template);
      const result = engine.render(compiled, context);

      expect(result).toBe('a, b, c');
    });

    it('should handle missing variables gracefully', () => {
      const template: Template = {
        name: 'test',
        content: 'Name: {{name}}, Age: {{age}}'
      };

      const context: TemplateContext = {
        name: 'Alice'
        // age is missing
      };

      const compiled = engine.compile(template);
      const result = engine.render(compiled, context);

      expect(result).toBe('Name: Alice, Age: ');
    });

    it('should handle complex nested templates', () => {
      const template: Template = {
        name: 'test',
        content: `
# {{title}}

{{#if hasMembers}}
Members:
{{#each members}}
- {{name}} ({{role}})
{{/each}}
{{else}}
No members
{{/if}}
        `.trim()
      };

      const context: TemplateContext = {
        title: 'Team Report',
        hasMembers: true,
        members: [
          { name: 'Alice', role: 'builder' },
          { name: 'Bob', role: 'validator' }
        ]
      };

      const compiled = engine.compile(template);
      const result = engine.render(compiled, context);

      expect(result).toContain('Team Report');
      expect(result).toContain('Alice (builder)');
      expect(result).toContain('Bob (validator)');
    });
  });

  describe('Context Conversion', () => {
    it('should convert TeamDefinition to context', () => {
      const team = createMockTeam('standard');
      const options: TeamPromptOptions = {
        includeEscalation: true
      };

      const context = teamToContext(team, options);

      expect(context.teamId).toBe(team.id);
      expect(context.teamName).toBe(team.name);
      expect(context.teamDescription).toBe(team.description);
      expect(context.members).toBeDefined();
      expect(context.members!.length).toBe(team.members.length);
      expect(context.defaultValidationType).toBe(team.defaultValidationType);
      expect(context.config).toBeDefined();
      expect(context.escalationPolicy).toBeDefined();
    });

    it('should respect validation type override in team context', () => {
      const team = createMockTeam('standard');
      const options: TeamPromptOptions = {
        validationTypeOverride: 'architect'
      };

      const context = teamToContext(team, options);

      expect(context.defaultValidationType).toBe('architect');
    });

    it('should convert DecompositionResult to plan context', () => {
      const decomposition = createMockDecomposition(3);
      const options: PlanPromptOptions = {
        includeRisks: true,
        includeExecutionOrder: true,
        detailLevel: 'full'
      };

      const context = decompositionToPlanContext('test-plan', decomposition, options);

      expect(context.planName).toBe('test-plan');
      expect(context.taskDescription).toBe(decomposition.analysis.task);
      expect(context.taskType).toBe(decomposition.analysis.type);
      expect(context.complexity).toBe(decomposition.analysis.complexity);
      expect(context.components).toBeDefined();
      expect(context.subtasks).toBeDefined();
      expect(context.executionOrder).toBeDefined();
      expect(context.executionPhases).toBeDefined();
    });

    it('should include only summary for summary detail level', () => {
      const decomposition = createMockDecomposition(2);
      const options: PlanPromptOptions = {
        detailLevel: 'summary'
      };

      const context = decompositionToPlanContext('test-plan', decomposition, options);

      expect(context.subtasks).toBeDefined();
      const subtask = context.subtasks![0];

      expect(subtask.id).toBeDefined();
      expect(subtask.name).toBeDefined();
      expect(subtask.acceptanceCriteria).toBeUndefined();
      expect(subtask.prompt).toBeUndefined();
    });

    it('should include full details for full detail level', () => {
      const decomposition = createMockDecomposition(2);
      const options: PlanPromptOptions = {
        detailLevel: 'full'
      };

      const context = decompositionToPlanContext('test-plan', decomposition, options);

      const subtask = context.subtasks![0];

      expect(subtask.id).toBeDefined();
      expect(subtask.name).toBeDefined();
      expect(subtask.acceptanceCriteria).toBeDefined();
      expect(subtask.prompt).toBeDefined();
      expect(subtask.verification).toBeDefined();
      expect(subtask.ownership).toBeDefined();
    });
  });

  describe('Prompt Generation Integration', () => {
    it('should generate team prompt with template', () => {
      const engine = new TemplateEngine();
      const team = createMockTeam('robust');

      const template: Template = {
        name: 'team',
        content: `
# Team: {{teamName}}

{{teamDescription}}

## Members ({{memberCount}}):
{{#each members}}
- {{id}}: {{agentType}} ({{role}}, {{modelTier}})
{{/each}}

## Configuration:
- Validation: {{defaultValidationType}}
- Max Retries: {{config.maxRetries}}
- Parallel: {{config.parallelExecution}}
        `.trim()
      };

      const context = teamToContext(team);
      const compiled = engine.compile(template);
      const result = engine.render(compiled, context);

      expect(result).toContain(team.name);
      expect(result).toContain(team.description);
      expect(result).toContain('builder-1');
      expect(result).toContain('validator');
      expect(result).toContain(team.defaultValidationType);
    });

    it('should generate task prompt with context', () => {
      const engine = new TemplateEngine();

      const template: Template = {
        name: 'task',
        content: `
# Task: {{taskName}}

{{taskDescription}}

## Acceptance Criteria:
{{#each acceptanceCriteria}}
- {{this}}
{{/each}}

## Verification:
{{verification}}

Agent: {{agentType | upper}}
Model Tier: {{modelTier | upper}}
        `.trim()
      };

      const context: TemplateContext = {
        taskName: 'Implement Auth',
        taskDescription: 'Add JWT authentication',
        acceptanceCriteria: ['Login works', 'Token expires'],
        verification: 'Test authentication flow',
        agentType: 'executor',
        modelTier: 'high'
      };

      const compiled = engine.compile(template);
      const result = engine.render(compiled, context);

      expect(result).toContain('Implement Auth');
      expect(result).toContain('Login works');
      expect(result).toContain('Token expires');
      expect(result).toContain('EXECUTOR');
      expect(result).toContain('HIGH');
    });

    it('should generate plan prompt with execution order', () => {
      const engine = new TemplateEngine();
      const decomposition = createMockDecomposition(3);

      const template: Template = {
        name: 'plan',
        content: `
# Plan: {{planName}}

Task: {{taskDescription}}
Type: {{taskType}}
Complexity: {{complexity}}

## Execution Phases:
{{#if executionPhases}}
{{#each executionPhases}}
Phase {{phase}}:
{{#each tasks}}
  - {{this}}
{{/each}}
{{/each}}
{{/if}}

## Subtasks ({{subtaskCount}}):
{{#each subtasks}}
- {{id}}: {{name}}
{{/each}}
        `.trim()
      };

      const context = decompositionToPlanContext(
        'Auth Implementation',
        decomposition,
        { includeExecutionOrder: true, detailLevel: 'summary' }
      );

      const compiled = engine.compile(template);
      const result = engine.render(compiled, context);

      expect(result).toContain('Auth Implementation');
      expect(result).toContain(decomposition.analysis.task);
      expect(result).toContain('Phase 1');
      expect(result).toContain('task-1');
    });
  });
});
