/**
 * Agent Spawner for Builder-Validator Cycle
 *
 * Provides real agent spawning utilities for the B-V cycle.
 * Uses a hook-based interface where spawn requests are written to a file
 * and a hook reads and executes them, writing responses back.
 */

import type { AgentOutput } from '../agent-output/schema.js';
import type { ValidatorOutput, TaskContext } from './builder-validator.js';
import { createValidatorPrompt } from './builder-validator.js';
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';

// ============================================================================
// Constants
// ============================================================================

const BV_REQUEST_DIR = '.omb/state/bv-requests';
const BV_RESPONSE_DIR = '.omb/state/bv-responses';
const DEFAULT_TIMEOUT = 120000; // 2 minutes
const POLL_INTERVAL = 500; // 500ms
// CLI fallback is the default and recommended mode
// Set OMB_CLI_FALLBACK=false to use hook-based polling (experimental)
const USE_CLI_FALLBACK = process.env.OMB_CLI_FALLBACK !== 'false';

/**
 * Validator type to agent configuration mapping
 */
const VALIDATOR_AGENTS = {
  syntax: { agent: 'validator-syntax', model: 'haiku' as const },
  logic: { agent: 'validator-logic', model: 'sonnet' as const },
  security: { agent: 'validator-security', model: 'opus' as const },
  integration: { agent: 'validator-integration', model: 'sonnet' as const }
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Options for spawning an agent
 */
export interface SpawnOptions {
  /** Agent type (e.g., 'executor', 'validator-syntax') */
  agentType: string;
  /** Model to use */
  model: 'haiku' | 'sonnet' | 'opus';
  /** Prompt to send to the agent */
  prompt: string;
  /** Task ID for tracking */
  taskId: string;
  /** Timeout in milliseconds (default: 120000) */
  timeout?: number;
}

/**
 * Result from spawning an agent
 */
export interface SpawnResult {
  /** Whether the spawn was successful */
  success: boolean;
  /** Generated agent ID (request ID) */
  agentId?: string;
  /** Parsed output from the agent */
  output?: AgentOutput;
  /** Error message if spawn failed */
  error?: string;
  /** Execution duration in milliseconds */
  duration: number;
}

/**
 * Request structure written to the request file
 */
export interface SpawnRequest {
  /** Unique request ID */
  requestId: string;
  /** Agent type to spawn */
  agentType: string;
  /** Model to use */
  model: 'haiku' | 'sonnet' | 'opus';
  /** Prompt for the agent */
  prompt: string;
  /** Associated task ID */
  taskId: string;
  /** Timeout in milliseconds */
  timeout: number;
  /** Timestamp when request was created */
  createdAt: number;
  /** Request status */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'timeout';
}

/**
 * Response structure read from the response file
 */
export interface SpawnResponse {
  /** Request ID this response is for */
  requestId: string;
  /** Whether the agent execution was successful */
  success: boolean;
  /** Raw output from the agent */
  rawOutput?: string;
  /** Parsed agent output (if available) */
  parsedOutput?: AgentOutput;
  /** Error message if execution failed */
  error?: string;
  /** Timestamp when response was created */
  completedAt: number;
  /** Execution duration in milliseconds */
  duration: number;
}

// ============================================================================
// Directory Management
// ============================================================================

/**
 * Ensure B-V directories exist
 */
function ensureDirectories(): void {
  const requestDir = join(process.cwd(), BV_REQUEST_DIR);
  const responseDir = join(process.cwd(), BV_RESPONSE_DIR);

  if (!existsSync(requestDir)) {
    mkdirSync(requestDir, { recursive: true });
  }
  if (!existsSync(responseDir)) {
    mkdirSync(responseDir, { recursive: true });
  }
}

/**
 * Get the path for a request file
 */
function getRequestPath(requestId: string): string {
  return join(process.cwd(), BV_REQUEST_DIR, `${requestId}.json`);
}

/**
 * Get the path for a response file
 */
function getResponsePath(requestId: string): string {
  return join(process.cwd(), BV_RESPONSE_DIR, `${requestId}.json`);
}

// ============================================================================
// Request/Response Management
// ============================================================================

/**
 * Write a spawn request to the request directory
 */
function writeRequest(request: SpawnRequest): void {
  ensureDirectories();
  const path = getRequestPath(request.requestId);
  writeFileSync(path, JSON.stringify(request, null, 2), 'utf-8');
}

/**
 * Read a spawn response from the response directory
 */
function readResponse(requestId: string): SpawnResponse | null {
  const path = getResponsePath(requestId);

  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as SpawnResponse;
  } catch {
    return null;
  }
}

/**
 * Clean up request and response files
 */
function cleanupFiles(requestId: string): void {
  const requestPath = getRequestPath(requestId);
  const responsePath = getResponsePath(requestId);

  try {
    if (existsSync(requestPath)) {
      unlinkSync(requestPath);
    }
    if (existsSync(responsePath)) {
      unlinkSync(responsePath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Polling Logic
// ============================================================================

/**
 * Poll for a response with timeout
 */
async function pollForResponse(
  requestId: string,
  timeout: number
): Promise<SpawnResponse | null> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const checkResponse = (): void => {
      const elapsed = Date.now() - startTime;

      // Check for timeout
      if (elapsed >= timeout) {
        resolve(null);
        return;
      }

      // Check for response
      const response = readResponse(requestId);
      if (response) {
        resolve(response);
        return;
      }

      // Continue polling
      setTimeout(checkResponse, POLL_INTERVAL);
    };

    checkResponse();
  });
}

// ============================================================================
// Main Spawn Functions
// ============================================================================

/**
 * Execute agent using Claude CLI
 * Spawns claude CLI with the Task tool parameters
 */
async function executeAgentViaCLI(request: SpawnRequest): Promise<SpawnResponse> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    // Build the prompt for Claude CLI
    const fullPrompt = `You are a ${request.agentType} agent. Execute this task and output structured JSON with your findings.

Task: ${request.prompt}

Output your response as valid JSON with this structure:
{
  "summary": "brief summary of work done",
  "changes": ["list of changes made"],
  "evidence": "proof of completion"
}`;

    // Map model to full model ID
    const modelMap = {
      haiku: 'claude-3-5-haiku-latest',
      sonnet: 'claude-sonnet-4-20250514',
      opus: 'claude-opus-4-5-20251101'
    };

    // Spawn claude CLI
    const child = spawn('claude', [
      '--print',  // Output only, no interactive mode
      '--model', modelMap[request.model],
      fullPrompt
    ], {
      cwd: process.cwd(),
      env: { ...process.env },
      timeout: request.timeout
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;

      if (code === 0 && stdout) {
        // Try to parse JSON from output
        try {
          const jsonMatch = stdout.match(/\{[\s\S]*\}/);
          const parsedOutput = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

          resolve({
            requestId: request.requestId,
            success: true,
            rawOutput: stdout,
            parsedOutput: parsedOutput ? {
              agentId: request.requestId,
              taskId: request.taskId,
              status: 'success' as const,
              summary: parsedOutput.summary || stdout.slice(0, 500),
              evidence: parsedOutput.evidence && Array.isArray(parsedOutput.evidence)
                ? parsedOutput.evidence
                : [{ type: 'command_output' as const, content: parsedOutput.evidence || 'Completed', passed: true }],
              timestamp: Date.now(),
              filesModified: parsedOutput.changes?.map((change: string) => ({
                path: change,
                changeType: 'modified' as const,
                diagnosticsClean: false
              }))
            } : {
              agentId: request.requestId,
              taskId: request.taskId,
              status: 'success' as const,
              summary: stdout.slice(0, 500),
              evidence: [{ type: 'command_output' as const, content: 'Raw output captured', passed: true }],
              timestamp: Date.now()
            },
            completedAt: Date.now(),
            duration
          });
        } catch {
          resolve({
            requestId: request.requestId,
            success: true,
            rawOutput: stdout,
            parsedOutput: {
              agentId: request.requestId,
              taskId: request.taskId,
              status: 'success' as const,
              summary: stdout.slice(0, 500),
              evidence: [{ type: 'command_output' as const, content: 'Output captured but not JSON', passed: true }],
              timestamp: Date.now()
            },
            completedAt: Date.now(),
            duration
          });
        }
      } else {
        resolve({
          requestId: request.requestId,
          success: false,
          error: stderr || `Process exited with code ${code}`,
          completedAt: Date.now(),
          duration
        });
      }
    });

    child.on('error', (err) => {
      resolve({
        requestId: request.requestId,
        success: false,
        error: `Failed to spawn process: ${err.message}`,
        completedAt: Date.now(),
        duration: Date.now() - startTime
      });
    });
  });
}

/**
 * Spawn a builder agent to execute a task
 *
 * Creates a spawn request file and polls for the response.
 * The hook bridge (bv-spawner) reads requests and instructs the main LLM to spawn agents.
 *
 * @param options - Spawn options including agent type, model, and prompt
 * @returns SpawnResult with success status and parsed output
 */
export async function spawnBuilderAgent(options: SpawnOptions): Promise<SpawnResult> {
  const startTime = Date.now();
  const requestId = randomUUID();
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  // Create the request
  const request: SpawnRequest = {
    requestId,
    agentType: options.agentType,
    model: options.model,
    prompt: options.prompt,
    taskId: options.taskId,
    timeout,
    createdAt: startTime,
    status: 'pending'
  };

  try {
    // Write the request
    writeRequest(request);

    // If CLI fallback is enabled, use it (for testing/standalone)
    if (USE_CLI_FALLBACK) {
      const response = await executeAgentViaCLI(request);
      cleanupFiles(requestId);

      if (!response) {
        return {
          success: false,
          agentId: requestId,
          error: `Agent spawn timed out after ${timeout}ms (CLI fallback mode)`,
          duration: Date.now() - startTime
        };
      }

      if (response.success && response.parsedOutput) {
        return {
          success: true,
          agentId: requestId,
          output: response.parsedOutput,
          duration: response.duration
        };
      }

      return {
        success: false,
        agentId: requestId,
        error: response.error ?? 'Unknown error occurred',
        duration: response.duration
      };
    }

    // Otherwise, poll for response (hook will process)
    const response = await pollForResponse(requestId, timeout);
    cleanupFiles(requestId);

    if (!response) {
      return {
        success: false,
        agentId: requestId,
        error: `Agent spawn timed out after ${timeout}ms. Ensure bv-spawner hook is active and main LLM is spawning agents.`,
        duration: Date.now() - startTime
      };
    }

    // Handle success
    if (response.success && response.parsedOutput) {
      return {
        success: true,
        agentId: requestId,
        output: response.parsedOutput,
        duration: response.duration
      };
    }

    // Handle failure
    return {
      success: false,
      agentId: requestId,
      error: response.error ?? 'Unknown error occurred',
      duration: response.duration
    };
  } catch (error) {
    // Clean up on error
    cleanupFiles(requestId);

    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      agentId: requestId,
      error: `Failed to spawn agent: ${errorMessage}`,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Spawn a validator agent to verify builder output
 *
 * Creates a validator-specific prompt and spawns the appropriate validator agent.
 *
 * @param validatorType - Type of validation to perform
 * @param builderOutput - Output from the builder agent to validate
 * @param taskContext - Context about the task being validated
 * @returns ValidatorOutput with validation results
 */
export async function spawnValidatorAgent(
  validatorType: 'syntax' | 'logic' | 'security' | 'integration',
  builderOutput: AgentOutput,
  taskContext: TaskContext
): Promise<ValidatorOutput> {
  const validatorConfig = VALIDATOR_AGENTS[validatorType];

  // Create the validator prompt
  const prompt = createValidatorPrompt(validatorType, builderOutput, taskContext);

  // Spawn the validator agent
  const result = await spawnBuilderAgent({
    agentType: validatorConfig.agent,
    model: validatorConfig.model,
    prompt,
    taskId: taskContext.taskId,
    timeout: DEFAULT_TIMEOUT
  });

  // If spawn failed, return a rejection
  if (!result.success || !result.output) {
    return {
      validatorType,
      taskId: taskContext.taskId,
      status: 'REJECTED',
      checks: [
        {
          name: 'Agent spawn',
          passed: false,
          evidence: result.error ?? 'Validator agent spawn failed',
          severity: 'critical'
        }
      ],
      issues: [result.error ?? 'Validator agent spawn failed'],
      recommendations: ['Retry validation or check agent availability']
    };
  }

  // Try to parse the validator response from the agent output
  const rawOutput = result.output.summary;
  const parsed = parseValidatorResponse(rawOutput, validatorType, taskContext.taskId);

  return parsed;
}

/**
 * Spawn multiple validators in parallel
 *
 * Spawns all specified validators concurrently and waits for all results.
 *
 * @param validators - Array of validator types to spawn
 * @param builderOutput - Output from the builder agent to validate
 * @param taskContext - Context about the task being validated
 * @returns Array of ValidatorOutput results
 */
export async function spawnValidatorsParallel(
  validators: Array<'syntax' | 'logic' | 'security' | 'integration'>,
  builderOutput: AgentOutput,
  taskContext: TaskContext
): Promise<ValidatorOutput[]> {
  if (validators.length === 0) {
    return [];
  }

  // Spawn all validators in parallel
  const promises = validators.map((validatorType) =>
    spawnValidatorAgent(validatorType, builderOutput, taskContext)
  );

  // Wait for all to complete
  const results = await Promise.allSettled(promises);

  // Process results
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    // Handle rejection
    const validatorType = validators[index];
    const errorMessage = result.reason instanceof Error
      ? result.reason.message
      : String(result.reason);

    return {
      validatorType,
      taskId: taskContext.taskId,
      status: 'REJECTED' as const,
      checks: [
        {
          name: 'Validator execution',
          passed: false,
          evidence: errorMessage,
          severity: 'critical' as const
        }
      ],
      issues: [`Validator ${validatorType} failed: ${errorMessage}`],
      recommendations: ['Retry validation']
    };
  });
}

/**
 * Parse agent text output to extract structured ValidatorOutput
 *
 * Looks for JSON blocks or structured verdict markers in the raw output.
 *
 * @param rawOutput - Raw text output from validator agent
 * @param validatorType - Type of validator that produced the output
 * @param taskId - Task ID being validated
 * @returns Parsed ValidatorOutput
 */
export function parseValidatorResponse(
  rawOutput: string,
  validatorType: string,
  taskId: string
): ValidatorOutput {
  // Default fallback output
  const fallbackOutput: ValidatorOutput = {
    validatorType,
    taskId,
    status: 'NEEDS_REVIEW',
    checks: [],
    issues: ['Could not parse validator response'],
    recommendations: ['Manually review the validator output']
  };

  if (!rawOutput || typeof rawOutput !== 'string') {
    return fallbackOutput;
  }

  try {
    // Try to extract JSON from code block
    const jsonBlockMatch = rawOutput.match(/```(?:json)?\s*([\s\S]*?)```/);

    let jsonStr: string | null = null;

    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1].trim();
    } else {
      // Try to find raw JSON object with validatorType
      const jsonMatch = rawOutput.match(/\{[\s\S]*"validatorType"[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      } else {
        // Try to find any JSON object with status
        const statusMatch = rawOutput.match(/\{[\s\S]*"status"[\s\S]*\}/);
        if (statusMatch) {
          jsonStr = statusMatch[0];
        }
      }
    }

    if (!jsonStr) {
      // Fallback: Try to extract verdict from structured markers
      return parseStructuredMarkers(rawOutput, validatorType, taskId);
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and normalize
    const status = normalizeStatus(parsed.status);
    if (!status) {
      return fallbackOutput;
    }

    // Build validated output
    const output: ValidatorOutput = {
      validatorType: String(parsed.validatorType || validatorType),
      taskId: String(parsed.taskId || taskId),
      status,
      checks: [],
      issues: [],
      recommendations: []
    };

    // Parse checks
    if (Array.isArray(parsed.checks)) {
      output.checks = parsed.checks.map((check: unknown) => {
        const c = check as Record<string, unknown>;
        return {
          name: String(c.name || 'Unknown check'),
          passed: Boolean(c.passed),
          evidence: String(c.evidence || ''),
          severity: normalizeSeverity(c.severity)
        };
      });
    }

    // Parse issues
    if (Array.isArray(parsed.issues)) {
      output.issues = parsed.issues.map((i: unknown) => String(i));
    }

    // Parse recommendations
    if (Array.isArray(parsed.recommendations)) {
      output.recommendations = parsed.recommendations.map((r: unknown) => String(r));
    }

    return output;
  } catch {
    // Try structured marker fallback
    return parseStructuredMarkers(rawOutput, validatorType, taskId);
  }
}

/**
 * Parse structured markers from text output
 *
 * Looks for patterns like "VERDICT: APPROVED" or "STATUS: REJECTED"
 */
function parseStructuredMarkers(
  rawOutput: string,
  validatorType: string,
  taskId: string
): ValidatorOutput {
  const output: ValidatorOutput = {
    validatorType,
    taskId,
    status: 'NEEDS_REVIEW',
    checks: [],
    issues: [],
    recommendations: []
  };

  // Look for verdict/status markers
  const verdictMatch = rawOutput.match(/(?:VERDICT|STATUS|RESULT)\s*:\s*(APPROVED|REJECTED|NEEDS_REVIEW)/i);
  if (verdictMatch) {
    const status = normalizeStatus(verdictMatch[1]);
    if (status) {
      output.status = status;
    }
  }

  // Look for issue markers
  const issueMatches = Array.from(rawOutput.matchAll(/(?:ISSUE|ERROR|PROBLEM)\s*:\s*(.+)/gi));
  for (const match of issueMatches) {
    output.issues.push(match[1].trim());
  }

  // Look for recommendation markers
  const recMatches = Array.from(rawOutput.matchAll(/(?:RECOMMENDATION|SUGGESTION|FIX)\s*:\s*(.+)/gi));
  for (const match of recMatches) {
    output.recommendations.push(match[1].trim());
  }

  // Look for check markers
  const checkMatches = Array.from(rawOutput.matchAll(/\[([✓✗X])\]\s*(.+)/g));
  for (const match of checkMatches) {
    const passed = match[1] === '✓';
    output.checks.push({
      name: match[2].trim(),
      passed,
      evidence: 'Extracted from structured output',
      severity: 'major'
    });
  }

  // If we found any structured content, return it
  if (output.issues.length > 0 || output.checks.length > 0 || verdictMatch) {
    return output;
  }

  // Complete fallback
  output.issues = ['Could not parse validator response'];
  output.recommendations = ['Manually review the validator output'];
  return output;
}

/**
 * Normalize status string to valid status enum value
 */
function normalizeStatus(
  status: unknown
): 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW' | null {
  if (typeof status !== 'string') {
    return null;
  }

  const normalized = status.toUpperCase().trim();

  switch (normalized) {
    case 'APPROVED':
    case 'APPROVE':
    case 'PASS':
    case 'PASSED':
    case 'SUCCESS':
      return 'APPROVED';
    case 'REJECTED':
    case 'REJECT':
    case 'FAIL':
    case 'FAILED':
    case 'FAILURE':
      return 'REJECTED';
    case 'NEEDS_REVIEW':
    case 'NEEDS REVIEW':
    case 'REVIEW':
    case 'PENDING':
    case 'UNKNOWN':
      return 'NEEDS_REVIEW';
    default:
      return null;
  }
}

/**
 * Normalize severity string to valid severity enum value
 */
function normalizeSeverity(severity: unknown): 'critical' | 'major' | 'minor' {
  if (typeof severity !== 'string') {
    return 'major';
  }

  const normalized = severity.toLowerCase().trim();

  switch (normalized) {
    case 'critical':
    case 'blocker':
    case 'high':
      return 'critical';
    case 'major':
    case 'medium':
    case 'warning':
      return 'major';
    case 'minor':
    case 'low':
    case 'info':
      return 'minor';
    default:
      return 'major';
  }
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Get validator agent configuration
 */
export function getValidatorConfig(
  validatorType: 'syntax' | 'logic' | 'security' | 'integration'
): { agent: string; model: 'haiku' | 'sonnet' | 'opus' } {
  return VALIDATOR_AGENTS[validatorType];
}

/**
 * Get all validator types
 */
export function getValidatorTypes(): Array<'syntax' | 'logic' | 'security' | 'integration'> {
  return ['syntax', 'logic', 'security', 'integration'];
}

/**
 * Check if a validator type is valid
 */
export function isValidValidatorType(
  type: string
): type is 'syntax' | 'logic' | 'security' | 'integration' {
  return ['syntax', 'logic', 'security', 'integration'].includes(type);
}

// Re-export constants for external use
export { BV_REQUEST_DIR, BV_RESPONSE_DIR, DEFAULT_TIMEOUT, VALIDATOR_AGENTS };
