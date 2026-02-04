/**
 * Template variable context
 */
export interface TemplateContext {
	[key: string]: unknown;
}

/**
 * Template compile options
 */
export interface CompileOptions {
	/** Throw on undefined variable (default: false) */
	strict?: boolean;
	/** Custom delimiters */
	delimiters?: {
		variable: [string, string]; // default: ['{{', '}}']
		block: [string, string]; // default: ['{{#', '}}']
		blockEnd: [string, string]; // default: ['{{/', '}}']
		comment: [string, string]; // default: ['{{!', '}}']
	};
}

/**
 * Compiled template function
 */
export type CompiledTemplate = (context: TemplateContext) => string;

/**
 * Template metadata
 */
export interface TemplateMetadata {
	name: string;
	description?: string;
	requiredVariables: string[];
	optionalVariables: string[];
}

/**
 * Template with metadata
 */
export interface Template {
	source: string;
	metadata: TemplateMetadata;
	compiled?: CompiledTemplate;
}
