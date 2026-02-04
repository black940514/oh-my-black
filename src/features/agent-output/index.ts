/**
 * Agent Output Schema Validation and Utilities
 * Provides parsing, validation, and serialization for agent outputs
 */

import type {
  AgentOutput,
  Evidence,
  FileChange,
  SelfValidationResult,
  AgentOutputValidationResult,
} from './schema.js';

export * from './schema.js';

/**
 * Validates that an agent output conforms to the standard schema
 *
 * @param output - Unknown value to validate
 * @returns Validation result with errors and warnings
 */
export function validateAgentOutput(output: unknown): AgentOutputValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Type guard
  if (!output || typeof output !== 'object') {
    errors.push('Output must be an object');
    return { valid: false, errors, warnings };
  }

  const obj = output as Record<string, unknown>;

  // === Validate Required Fields (6) ===

  // agentId
  if (!obj.agentId) {
    errors.push('Missing required field: agentId');
  } else if (typeof obj.agentId !== 'string') {
    errors.push('agentId must be a string');
  }

  // taskId
  if (!obj.taskId) {
    errors.push('Missing required field: taskId');
  } else if (typeof obj.taskId !== 'string') {
    errors.push('taskId must be a string');
  }

  // status
  if (!obj.status) {
    errors.push('Missing required field: status');
  } else if (!['success', 'partial', 'failed', 'blocked'].includes(obj.status as string)) {
    errors.push('status must be one of: success, partial, failed, blocked');
  }

  // summary
  if (!obj.summary) {
    errors.push('Missing required field: summary');
  } else if (typeof obj.summary !== 'string') {
    errors.push('summary must be a string');
  } else if (obj.summary.length < 10) {
    warnings.push('summary is very short (less than 10 characters)');
  }

  // evidence
  if (!obj.evidence) {
    errors.push('Missing required field: evidence');
  } else if (!Array.isArray(obj.evidence)) {
    errors.push('evidence must be an array');
  } else {
    // Validate each evidence item
    obj.evidence.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        errors.push(`evidence[${index}] must be an object`);
        return;
      }

      const ev = item as Record<string, unknown>;

      if (!ev.type) {
        errors.push(`evidence[${index}] missing required field: type`);
      } else if (!['command_output', 'test_result', 'diagnostics', 'manual_check'].includes(ev.type as string)) {
        errors.push(`evidence[${index}].type must be one of: command_output, test_result, diagnostics, manual_check`);
      }

      if (!ev.content) {
        errors.push(`evidence[${index}] missing required field: content`);
      } else if (typeof ev.content !== 'string') {
        errors.push(`evidence[${index}].content must be a string`);
      }

      if (ev.passed === undefined) {
        errors.push(`evidence[${index}] missing required field: passed`);
      } else if (typeof ev.passed !== 'boolean') {
        errors.push(`evidence[${index}].passed must be a boolean`);
      }
    });

    // Warning if no evidence provided
    if (obj.evidence.length === 0) {
      warnings.push('No evidence provided to support status claim');
    }
  }

  // timestamp
  if (!obj.timestamp) {
    errors.push('Missing required field: timestamp');
  } else if (typeof obj.timestamp !== 'number') {
    errors.push('timestamp must be a number');
  } else if (obj.timestamp < 0) {
    errors.push('timestamp must be a positive number');
  }

  // === Validate Optional Fields (4) ===

  // filesModified
  if (obj.filesModified !== undefined) {
    if (!Array.isArray(obj.filesModified)) {
      errors.push('filesModified must be an array');
    } else {
      obj.filesModified.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
          errors.push(`filesModified[${index}] must be an object`);
          return;
        }

        const fc = item as Record<string, unknown>;

        if (!fc.path || typeof fc.path !== 'string') {
          errors.push(`filesModified[${index}] missing or invalid field: path`);
        }

        if (!fc.changeType || !['created', 'modified', 'deleted'].includes(fc.changeType as string)) {
          errors.push(`filesModified[${index}].changeType must be one of: created, modified, deleted`);
        }

        if (fc.diagnosticsClean === undefined || typeof fc.diagnosticsClean !== 'boolean') {
          errors.push(`filesModified[${index}].diagnosticsClean must be a boolean`);
        }
      });
    }
  }

  // selfValidation
  if (obj.selfValidation !== undefined) {
    if (!obj.selfValidation || typeof obj.selfValidation !== 'object') {
      errors.push('selfValidation must be an object');
    } else {
      const sv = obj.selfValidation as Record<string, unknown>;

      if (sv.passed === undefined || typeof sv.passed !== 'boolean') {
        errors.push('selfValidation.passed must be a boolean');
      }

      if (sv.retryCount === undefined || typeof sv.retryCount !== 'number') {
        errors.push('selfValidation.retryCount must be a number');
      }

      if (sv.lastError !== undefined && typeof sv.lastError !== 'string') {
        errors.push('selfValidation.lastError must be a string');
      }
    }
  }

  // nextSteps
  if (obj.nextSteps !== undefined) {
    if (!Array.isArray(obj.nextSteps)) {
      errors.push('nextSteps must be an array');
    } else if (!obj.nextSteps.every((item) => typeof item === 'string')) {
      errors.push('nextSteps must be an array of strings');
    }
  }

  // learnings
  if (obj.learnings !== undefined) {
    if (!Array.isArray(obj.learnings)) {
      errors.push('learnings must be an array');
    } else if (!obj.learnings.every((item) => typeof item === 'string')) {
      errors.push('learnings must be an array of strings');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Parses agent response text to extract structured AgentOutput
 * Supports multiple formats: JSON blocks, AGENT_OUTPUT markers, etc.
 *
 * @param response - Raw agent response text
 * @returns Parsed AgentOutput or null if parsing fails
 */
export function parseAgentOutput(response: string): AgentOutput | null {
  if (!response || typeof response !== 'string') {
    return null;
  }

  // Strategy 1: Look for JSON code blocks
  const jsonBlockMatch = response.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1]);
      const validation = validateAgentOutput(parsed);
      if (validation.valid) {
        return parsed as AgentOutput;
      }
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 2: Look for AGENT_OUTPUT: marker
  const markerMatch = response.match(/AGENT_OUTPUT:\s*\n([\s\S]*?)(?:\n\n|$)/);
  if (markerMatch) {
    try {
      const parsed = JSON.parse(markerMatch[1]);
      const validation = validateAgentOutput(parsed);
      if (validation.valid) {
        return parsed as AgentOutput;
      }
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 3: Look for any JSON object in the response
  const jsonMatch = response.match(/\{[\s\S]*"agentId"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const validation = validateAgentOutput(parsed);
      if (validation.valid) {
        return parsed as AgentOutput;
      }
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 4: Structured text parsing (fallback)
  try {
    const output = extractStructuredFields(response);
    if (output) {
      const validation = validateAgentOutput(output);
      if (validation.valid) {
        return output as AgentOutput;
      }
    }
  } catch {
    // All strategies failed
  }

  return null;
}

/**
 * Attempts to extract AgentOutput fields from structured text
 * @private
 */
function extractStructuredFields(text: string): Partial<AgentOutput> | null {
  const output: Partial<AgentOutput> = {
    evidence: [],
  };

  // Extract agentId
  const agentIdMatch = text.match(/(?:Agent ID|agentId):\s*([^\n]+)/i);
  if (agentIdMatch) {
    output.agentId = agentIdMatch[1].trim();
  }

  // Extract taskId
  const taskIdMatch = text.match(/(?:Task ID|taskId):\s*([^\n]+)/i);
  if (taskIdMatch) {
    output.taskId = taskIdMatch[1].trim();
  }

  // Extract status
  const statusMatch = text.match(/(?:Status):\s*(success|partial|failed|blocked)/i);
  if (statusMatch) {
    output.status = statusMatch[1].toLowerCase() as AgentOutput['status'];
  }

  // Extract summary
  const summaryMatch = text.match(/(?:Summary):\s*([^\n]+)/i);
  if (summaryMatch) {
    output.summary = summaryMatch[1].trim();
  }

  // Extract timestamp
  const timestampMatch = text.match(/(?:Timestamp):\s*(\d+)/i);
  if (timestampMatch) {
    output.timestamp = parseInt(timestampMatch[1], 10);
  } else {
    output.timestamp = Date.now();
  }

  // Only return if we got the minimum required fields
  if (output.agentId && output.taskId && output.status && output.summary) {
    return output;
  }

  return null;
}

/**
 * Serializes AgentOutput to standard JSON string format
 *
 * @param output - AgentOutput to serialize
 * @returns JSON string representation
 */
export function serializeAgentOutput(output: AgentOutput): string {
  return JSON.stringify(output, null, 2);
}

/**
 * Creates an AgentOutput with required defaults
 *
 * @param partial - Partial AgentOutput with at least required fields
 * @returns Complete AgentOutput object
 */
export function createAgentOutput(partial: Partial<AgentOutput>): AgentOutput {
  const defaults: AgentOutput = {
    agentId: partial.agentId || 'unknown',
    taskId: partial.taskId || 'unknown',
    status: partial.status || 'failed',
    summary: partial.summary || 'No summary provided',
    evidence: partial.evidence || [],
    timestamp: partial.timestamp || Date.now(),
  };

  // Add optional fields if provided
  if (partial.filesModified) {
    defaults.filesModified = partial.filesModified;
  }
  if (partial.selfValidation) {
    defaults.selfValidation = partial.selfValidation;
  }
  if (partial.nextSteps) {
    defaults.nextSteps = partial.nextSteps;
  }
  if (partial.learnings) {
    defaults.learnings = partial.learnings;
  }

  return defaults;
}
