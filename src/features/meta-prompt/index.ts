export * from './types.js';
export * from './engine.js';
export * from './generator.js';

import type {
	TemplateContext,
	CompileOptions,
	Template,
	TemplateMetadata,
} from './types.js';
import {
	compile,
	render,
	createTemplate,
	validateContext,
	registerHelper,
} from './engine.js';

/**
 * Stateful template engine with template registry
 */
export class TemplateEngine {
	private templates: Map<string, Template> = new Map();
	private options: CompileOptions;

	constructor(options?: CompileOptions) {
		this.options = options || {};
	}

	/**
	 * Register template
	 */
	register(name: string, source: string, description?: string): void {
		const template = createTemplate(name, source, description);
		this.templates.set(name, template);
	}

	/**
	 * Get registered template
	 */
	get(name: string): Template | undefined {
		return this.templates.get(name);
	}

	/**
	 * Render registered template
	 */
	render(name: string, context: TemplateContext): string {
		const template = this.templates.get(name);
		if (!template) {
			throw new Error(`Template not found: ${name}`);
		}

		// Compile if not already compiled
		if (!template.compiled) {
			template.compiled = compile(template.source, this.options);
		}

		// Validate context
		const validation = validateContext(template, context);
		if (!validation.valid) {
			throw new Error(
				`Missing required variables: ${validation.missing.join(', ')}`
			);
		}

		return template.compiled(context);
	}

	/**
	 * List registered templates
	 */
	list(): TemplateMetadata[] {
		return Array.from(this.templates.values()).map((t) => t.metadata);
	}

	/**
	 * Register custom helper
	 */
	registerHelper(name: string, fn: (...args: unknown[]) => unknown): void {
		registerHelper(name, fn);
	}

	/**
	 * Render template directly without registration
	 */
	renderDirect(source: string, context: TemplateContext): string {
		return render(source, context, this.options);
	}

	/**
	 * Clear all registered templates
	 */
	clear(): void {
		this.templates.clear();
	}

	/**
	 * Check if template exists
	 */
	has(name: string): boolean {
		return this.templates.has(name);
	}

	/**
	 * Delete template
	 */
	delete(name: string): boolean {
		return this.templates.delete(name);
	}

	/**
	 * Compile a template object (for direct use without registration)
	 * Supports both standard Template format and simplified { name, content } format
	 */
	compile(template: Template | { name: string; content: string }): Template {
		// Handle simplified format { name, content } used in tests
		const source = 'content' in template ? template.content : template.source;
		const normalizedTemplate: Template = 'content' in template
			? {
					source: template.content,
					metadata: {
						name: template.name,
						requiredVariables: [],
						optionalVariables: [],
					},
				}
			: template;

		if (!normalizedTemplate.compiled) {
			normalizedTemplate.compiled = compile(source, this.options);
		}
		return normalizedTemplate;
	}

	/**
	 * Render a compiled template with context
	 * Overload: render(compiled: Template, context: TemplateContext)
	 * Supports both standard Template format and simplified { name, content } format
	 */
	renderCompiled(
		compiled: Template | { name: string; content: string },
		context: TemplateContext
	): string {
		// Handle simplified format { name, content } used in tests
		const source = 'content' in compiled ? compiled.content : compiled.source;

		if ('content' in compiled) {
			// Simplified format - compile on the fly
			const compiledFn = compile(source, this.options);
			return compiledFn(context);
		}

		if (!compiled.compiled) {
			compiled.compiled = compile(source, this.options);
		}
		return compiled.compiled(context);
	}
}
