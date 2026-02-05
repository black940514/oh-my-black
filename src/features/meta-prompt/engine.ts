import type {
	TemplateContext,
	CompileOptions,
	CompiledTemplate,
	Template,
	TemplateMetadata,
} from './types.js';

/**
 * Default compile options
 */
export const DEFAULT_OPTIONS: CompileOptions = {
	strict: false,
	delimiters: {
		variable: ['{{', '}}'],
		block: ['{{#', '}}'],
		blockEnd: ['{{/', '}}'],
		comment: ['{{!', '}}'],
	},
};

/**
 * Registered custom helpers
 */
const customHelpers = new Map<string, (...args: unknown[]) => unknown>();

/**
 * Built-in helpers
 */
export const helpers = {
	/** Uppercase string */
	upper: (str: string): string => String(str).toUpperCase(),

	/** Lowercase string */
	lower: (str: string): string => String(str).toLowerCase(),

	/** Capitalize first letter */
	capitalize: (str: string): string => {
		const s = String(str);
		return s.charAt(0).toUpperCase() + s.slice(1);
	},

	/** Join array with separator */
	join: (arr: unknown, separator = ', '): string => {
		if (!Array.isArray(arr)) return String(arr);
		return arr.map(String).join(separator);
	},

	/** Get array length */
	length: (arr: unknown): number => {
		if (Array.isArray(arr)) return arr.length;
		if (typeof arr === 'string') return arr.length;
		return 0;
	},

	/** Format as JSON */
	json: (obj: unknown, indent = 2): string => {
		return JSON.stringify(obj, null, indent);
	},

	/** Default value if undefined */
	default: (value: unknown, defaultValue: unknown): unknown => {
		return value !== undefined && value !== null ? value : defaultValue;
	},
};

/**
 * Get nested value from object (supports dot notation)
 * e.g., getValue({ a: { b: 1 } }, 'a.b') => 1
 */
export function getValue(obj: unknown, path: string): unknown {
	if (obj === null || obj === undefined) {
		return undefined;
	}

	const parts = path.split('.');
	let current: unknown = obj;

	for (const part of parts) {
		if (current === null || current === undefined) {
			return undefined;
		}

		if (typeof current === 'object' && part in current) {
			current = (current as Record<string, unknown>)[part];
		} else {
			return undefined;
		}
	}

	return current;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: string): string {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Parse helper chain: "variable | helper1 | helper2 arg1 arg2"
 */
function parseHelperChain(expression: string): {
	variable: string;
	helpers: Array<{ name: string; args: string[] }>;
} {
	const parts = expression.split('|').map((p) => p.trim());
	const variable = parts[0];
	const helperDefs = parts.slice(1);

	const parsedHelpers = helperDefs.map((def) => {
		const tokens = def.split(/\s+/);
		const name = tokens[0];
		const args = tokens.slice(1);
		return { name, args };
	});

	return { variable, helpers: parsedHelpers };
}

/**
 * Apply helper chain to value
 */
function applyHelpers(
	value: unknown,
	helperChain: Array<{ name: string; args: string[] }>,
	context: TemplateContext
): unknown {
	let current = value;

	for (const { name, args } of helperChain) {
		const helper = customHelpers.get(name) || helpers[name as keyof typeof helpers];

		if (!helper) {
			throw new Error(`Unknown helper: ${name}`);
		}

		// Resolve argument values from context
		const resolvedArgs = args.map((arg) => {
			// Try to parse as number
			if (/^\d+$/.test(arg)) {
				return parseInt(arg, 10);
			}
			// Try to parse as string literal
			if (/^["'].*["']$/.test(arg)) {
				return arg.slice(1, -1);
			}
			// Otherwise treat as variable reference
			return getValue(context, arg);
		});

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
		current = (helper as any)(current, ...resolvedArgs);
	}

	return current;
}

/**
 * Compile template string to function
 */
export function compile(source: string, options?: CompileOptions): CompiledTemplate {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const delims = opts.delimiters!;

	// Escape regex special characters
	const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

	const varOpen = escapeRegex(delims.variable[0]);
	const varClose = escapeRegex(delims.variable[1]);
	const blockOpen = escapeRegex(delims.block[0]);
	const blockClose = escapeRegex(delims.block[1]);
	const blockEndOpen = escapeRegex(delims.blockEnd[0]);
	const blockEndClose = escapeRegex(delims.blockEnd[1]);
	const commentOpen = escapeRegex(delims.comment[0]);
	const commentClose = escapeRegex(delims.comment[1]);

	return (context: TemplateContext): string => {
		let result = source;

		// Remove comments
		const commentRegex = new RegExp(
			`${commentOpen}\\s*.*?\\s*${commentClose}`,
			'gs'
		);
		result = result.replace(commentRegex, '');

		// Process blocks (#if, #each, #else) and variables
		// Variables are now processed within processBlocks to handle loop contexts correctly
		result = processBlocks(result, context, opts);

		return result;
	};
}

/**
 * Process block directives (#if, #each, #else) and variables
 */
function processBlocks(
	source: string,
	context: TemplateContext,
	options: CompileOptions
): string {
	let result = source;

	// Process #each blocks first (they may contain nested blocks)
	result = processEachBlocks(result, context, options);

	// Process #if blocks
	result = processIfBlocks(result, context, options);

	// Process variables within this context
	result = processVariables(result, context, options);

	return result;
}

/**
 * Process variable substitution {{variable}} and {{variable | helper}}
 */
function processVariables(
	source: string,
	context: TemplateContext,
	options: CompileOptions
): string {
	const delims = options.delimiters!;
	const varOpen = escapeRegex(delims.variable[0]);
	const varClose = escapeRegex(delims.variable[1]);

	// Don't match block starts ({{#) or block ends ({{/)
	const varRegex = new RegExp(`${varOpen}\\s*([^#/}][^}]*?)\\s*${varClose}`, 'g');

	return source.replace(varRegex, (match, expression: string) => {
		// Skip else keyword
		if (expression.trim() === 'else') {
			return match;
		}

		const { variable, helpers: helperChain } = parseHelperChain(expression);

		let value = getValue(context, variable);

		if (value === undefined && options.strict) {
			throw new Error(`Undefined variable: ${variable}`);
		}

		if (value === undefined) {
			return '';
		}

		// Apply helpers
		if (helperChain.length > 0) {
			value = applyHelpers(value, helperChain, context);
		}

		return escapeHtml(String(value));
	});
}

/**
 * Process #if blocks
 */
function processIfBlocks(
	source: string,
	context: TemplateContext,
	options: CompileOptions
): string {
	const delims = options.delimiters!;
	const blockOpen = escapeRegex(delims.block[0]);
	const blockClose = escapeRegex(delims.block[1]);
	const blockEndOpen = escapeRegex(delims.blockEnd[0]);
	const blockEndClose = escapeRegex(delims.blockEnd[1]);

	// Match #if blocks with optional {{else}} (not {{#else}})
	const varOpen = escapeRegex(options.delimiters!.variable[0]);
	const varClose = escapeRegex(options.delimiters!.variable[1]);
	const ifRegex = new RegExp(
		`${blockOpen}if\\s+([^}]+?)${blockClose}` +
			`(.*?)` +
			`(?:${varOpen}else${varClose}(.*?))?` +
			`${blockEndOpen}if${blockEndClose}`,
		'gs'
	);

	return source.replace(
		ifRegex,
		(match, condition: string, trueBlock: string, falseBlock?: string) => {
			const value = getValue(context, condition.trim());
			const isTruthy = Boolean(value);

			if (isTruthy) {
				return processBlocks(trueBlock, context, options);
			} else if (falseBlock) {
				return processBlocks(falseBlock, context, options);
			}

			return '';
		}
	);
}

/**
 * Process #each blocks
 */
function processEachBlocks(
	source: string,
	context: TemplateContext,
	options: CompileOptions
): string {
	const delims = options.delimiters!;
	const blockOpen = escapeRegex(delims.block[0]);
	const blockClose = escapeRegex(delims.block[1]);
	const blockEndOpen = escapeRegex(delims.blockEnd[0]);
	const blockEndClose = escapeRegex(delims.blockEnd[1]);

	// Match #each blocks
	const eachRegex = new RegExp(
		`${blockOpen}each\\s+([^}]+?)${blockClose}(.*?)${blockEndOpen}each${blockEndClose}`,
		'gs'
	);

	return source.replace(
		eachRegex,
		(match, expression: string, block: string) => {
			// Parse "items" or "items as item"
			const asMatch = expression.match(/^(\S+)(?:\s+as\s+(\S+))?$/);
			if (!asMatch) {
				throw new Error(`Invalid #each expression: ${expression}`);
			}

			const [, arrayPath, aliasName] = asMatch;
			const array = getValue(context, arrayPath);

			if (!Array.isArray(array)) {
				return '';
			}

			return array
				.map((item, index) => {
					const itemContext: TemplateContext = {
						...context,
						this: item,
						'@index': index,
						'@first': index === 0,
						'@last': index === array.length - 1,
					};

					// If item is an object, spread its properties into context
					// This allows {{name}} instead of {{this.name}}
					if (item && typeof item === 'object' && !Array.isArray(item)) {
						Object.assign(itemContext, item);
					}

					if (aliasName) {
						itemContext[aliasName] = item;
					}

					return processBlocks(block, itemContext, options);
				})
				.join('');
		}
	);
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Render template with context (compile + execute)
 */
export function render(
	source: string,
	context: TemplateContext,
	options?: CompileOptions
): string {
	const compiled = compile(source, options);
	return compiled(context);
}

/**
 * Parse template and extract metadata
 */
export function parseMetadata(source: string): TemplateMetadata {
	const variables = new Set<string>();

	// Extract variables from {{variable}} patterns
	const varRegex = /\{\{\s*([^}#/!|]+?)(?:\s*\|[^}]*)?\s*\}\}/g;
	let match;

	while ((match = varRegex.exec(source)) !== null) {
		const varName = match[1].trim();
		// Skip special variables
		if (
			!varName.startsWith('@') &&
			varName !== 'this' &&
			!varName.includes(' ')
		) {
			// Extract root variable name (before first dot)
			const rootVar = varName.split('.')[0];
			variables.add(rootVar);
		}
	}

	// Extract variables from #if and #each blocks
	const blockRegex = /\{\{#(?:if|each)\s+([^}]+?)\}\}/g;
	while ((match = blockRegex.exec(source)) !== null) {
		const expression = match[1].trim();
		// Handle "items as item" syntax
		const rootVar = expression.split(/\s+/)[0].split('.')[0];
		variables.add(rootVar);
	}

	return {
		name: '',
		requiredVariables: Array.from(variables),
		optionalVariables: [],
	};
}

/**
 * Create template object with metadata
 */
export function createTemplate(
	name: string,
	source: string,
	description?: string
): Template {
	const metadata = parseMetadata(source);
	metadata.name = name;
	metadata.description = description;

	return {
		source,
		metadata,
	};
}

/**
 * Validate context against template requirements
 */
export function validateContext(
	template: Template,
	context: TemplateContext
): { valid: boolean; missing: string[]; extra: string[] } {
	const contextKeys = Object.keys(context);
	const requiredKeys = template.metadata.requiredVariables;
	const allExpectedKeys = [
		...requiredKeys,
		...template.metadata.optionalVariables,
	];

	const missing = requiredKeys.filter((key) => !(key in context));
	const extra = contextKeys.filter((key) => !allExpectedKeys.includes(key));

	return {
		valid: missing.length === 0,
		missing,
		extra,
	};
}

/**
 * Register custom helper
 */
export function registerHelper(
	name: string,
	fn: (...args: unknown[]) => unknown
): void {
	customHelpers.set(name, fn);
}
