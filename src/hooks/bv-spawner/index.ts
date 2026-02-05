/**
 * B-V Spawner Hook - Hook-Based Bridge Pattern
 *
 * Reads pending agent spawn requests and returns instructions for the main LLM
 * to spawn agents via the Task tool. This provides proper project context.
 *
 * Flow:
 * 1. agent-spawner.ts writes request to .omb/state/bv-requests/
 * 2. This hook reads pending requests (called from bridge.ts PostToolUse)
 * 3. Returns instructions for main LLM to spawn agents
 * 4. Main LLM spawns agents via Task tool
 * 5. Main LLM writes responses to .omb/state/bv-responses/
 * 6. agent-spawner.ts polls for responses
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { SpawnRequest } from './types.js';

const BV_REQUEST_DIR = '.omb/state/bv-requests';

export interface BVSpawnInstruction {
  requestId: string;
  agentType: string;
  model: 'haiku' | 'sonnet' | 'opus';
  prompt: string;
  taskId: string;
}

/**
 * Process pending B-V spawn requests
 * Returns instructions for the main LLM to spawn agents
 */
export function processPendingRequests(directory: string): BVSpawnInstruction[] {
  const requestDir = join(directory, BV_REQUEST_DIR);

  if (!existsSync(requestDir)) {
    return [];
  }

  const instructions: BVSpawnInstruction[] = [];
  const files = readdirSync(requestDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const content = readFileSync(join(requestDir, file), 'utf-8');
      const request = JSON.parse(content) as SpawnRequest;

      // Only process pending requests
      if (request.status !== 'pending') {
        continue;
      }

      // Mark as processing
      request.status = 'processing';
      writeFileSync(join(requestDir, file), JSON.stringify(request, null, 2));

      instructions.push({
        requestId: request.requestId,
        agentType: request.agentType,
        model: request.model,
        prompt: request.prompt,
        taskId: request.taskId
      });
    } catch {
      // Skip invalid files
    }
  }

  return instructions;
}

/**
 * Format spawn instructions as LLM message
 */
export function formatSpawnInstructions(instructions: BVSpawnInstruction[]): string {
  if (instructions.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('[B-V CYCLE - AGENT SPAWN REQUIRED]');
  lines.push('');
  lines.push('The following agents need to be spawned for Builder-Validator cycle:');
  lines.push('');

  for (const inst of instructions) {
    lines.push(`## Request: ${inst.requestId}`);
    lines.push(`- Agent: oh-my-black:${inst.agentType}`);
    lines.push(`- Model: ${inst.model}`);
    lines.push(`- Task ID: ${inst.taskId}`);
    lines.push('');
    lines.push('**Action Required:** Spawn this agent using the Task tool:');
    lines.push('```');
    lines.push(`Task(`);
    lines.push(`  subagent_type="oh-my-black:${inst.agentType}",`);
    lines.push(`  model="${inst.model}",`);
    lines.push(`  prompt="${inst.prompt.replace(/"/g, '\\"').slice(0, 200)}..."`);
    lines.push(`)`);
    lines.push('```');
    lines.push('');
    lines.push('**After agent completes**, write the response to:');
    lines.push(`\`.omb/state/bv-responses/${inst.requestId}.json\``);
    lines.push('');
    lines.push('Response format:');
    lines.push('```json');
    lines.push('{');
    lines.push(`  "requestId": "${inst.requestId}",`);
    lines.push('  "success": true,');
    lines.push('  "rawOutput": "<agent output text>",');
    lines.push('  "parsedOutput": {');
    lines.push('    "agentId": "<agent_id>",');
    lines.push('    "taskId": "<task_id>",');
    lines.push('    "status": "success",');
    lines.push('    "summary": "<brief summary>",');
    lines.push('    "evidence": [{ "type": "command_output", "content": "...", "passed": true }],');
    lines.push('    "timestamp": <timestamp>');
    lines.push('  },');
    lines.push('  "completedAt": <timestamp>,');
    lines.push('  "duration": <milliseconds>');
    lines.push('}');
    lines.push('```');
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Clean up old request files older than 24 hours
 */
export function cleanupOldRequests(directory: string, maxAgeMs = 24 * 60 * 60 * 1000): number {
  const requestDir = join(directory, BV_REQUEST_DIR);
  let cleaned = 0;

  if (!existsSync(requestDir)) {
    return 0;
  }

  const now = Date.now();
  const files = readdirSync(requestDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = join(requestDir, file);
    try {
      const content = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as SpawnRequest;
      const timestamp = data.createdAt || 0;

      if (now - timestamp > maxAgeMs) {
        unlinkSync(filePath);
        cleaned++;
      }
    } catch {
      // If we can't parse, delete it
      try {
        unlinkSync(filePath);
        cleaned++;
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  return cleaned;
}

// Re-export types
export type { SpawnRequest, SpawnResponse } from './types.js';
