import { bench, describe } from 'vitest';
import { compile, render, TemplateEngine } from '../../src/features/meta-prompt/index.js';

describe('Template Engine Performance', () => {
  const simpleTemplate = '{{name}} is {{age}} years old';
  const complexTemplate = `
    {{#each items}}
      {{this.name | upper}}: {{this.value | default 0}}
    {{/each}}
    Total: {{items | length}}
  `;

  const nestedTemplate = `
    {{#if user}}
      User: {{user.name}}
      {{#each user.roles}}
        - {{this | capitalize}}
      {{/each}}
    {{/if}}
  `;

  const deeplyNestedTemplate = `
    {{#each sections}}
      Section: {{this.title}}
      {{#each this.items}}
        {{#if this.active}}
          {{this.name | upper}}: {{this.value | default 0}}
        {{/if}}
      {{/each}}
    {{/each}}
  `;

  // Test data
  const simpleContext = { name: 'Test', age: 25 };
  const complexContext10 = {
    items: Array(10).fill(0).map((_, i) => ({ name: `item${i}`, value: i }))
  };
  const complexContext100 = {
    items: Array(100).fill(0).map((_, i) => ({ name: `item${i}`, value: i }))
  };
  const complexContext1000 = {
    items: Array(1000).fill(0).map((_, i) => ({ name: `item${i}`, value: i }))
  };

  const nestedContext = {
    user: {
      name: 'John Doe',
      roles: ['admin', 'developer', 'reviewer']
    }
  };

  const deeplyNestedContext = {
    sections: Array(20).fill(0).map((_, i) => ({
      title: `Section ${i}`,
      items: Array(10).fill(0).map((_, j) => ({
        name: `Item ${j}`,
        value: j * 10,
        active: j % 2 === 0
      }))
    }))
  };

  // Compilation benchmarks
  bench('compile simple template', () => {
    compile(simpleTemplate);
  });

  bench('compile complex template with loop', () => {
    compile(complexTemplate);
  });

  bench('compile nested template', () => {
    compile(nestedTemplate);
  });

  bench('compile deeply nested template', () => {
    compile(deeplyNestedTemplate);
  });

  // Rendering benchmarks - simple
  bench('render simple template', () => {
    render(simpleTemplate, simpleContext);
  });

  // Rendering benchmarks - complex with different sizes
  bench('render complex template (10 items)', () => {
    render(complexTemplate, complexContext10);
  });

  bench('render complex template (100 items)', () => {
    render(complexTemplate, complexContext100);
  });

  bench('render complex template (1000 items)', () => {
    render(complexTemplate, complexContext1000);
  });

  // Rendering benchmarks - nested
  bench('render nested template', () => {
    render(nestedTemplate, nestedContext);
  });

  bench('render deeply nested template (20 sections x 10 items)', () => {
    render(deeplyNestedTemplate, deeplyNestedContext);
  });

  // TemplateEngine with caching
  bench('TemplateEngine with caching (1 template, 100 renders)', () => {
    const engine = new TemplateEngine();
    engine.register('test', simpleTemplate);
    for (let i = 0; i < 100; i++) {
      engine.render('test', { name: 'Test', age: i });
    }
  });

  bench('TemplateEngine with caching (10 templates, 10 renders each)', () => {
    const engine = new TemplateEngine();
    for (let i = 0; i < 10; i++) {
      engine.register(`test${i}`, simpleTemplate);
    }
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        engine.render(`test${i}`, { name: `Test${j}`, age: j });
      }
    }
  });

  // Helper chain benchmarks
  bench('render with single helper', () => {
    render('{{name | upper}}', { name: 'test' });
  });

  bench('render with helper chain (3 helpers)', () => {
    render('{{name | upper | lower | capitalize}}', { name: 'test' });
  });

  // Combined operations (realistic usage)
  bench('full cycle: compile + render (simple)', () => {
    const compiled = compile(simpleTemplate);
    compiled(simpleContext);
  });

  bench('full cycle: compile + render (complex 100 items)', () => {
    const compiled = compile(complexTemplate);
    compiled(complexContext100);
  });
});
