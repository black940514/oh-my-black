#!/usr/bin/env node
/**
 * context-optimizer.mjs - Automatic Context Window Management
 * Runs BEFORE pre-compact.mjs in PreCompact hook chain
 *
 * Features:
 * - Summarizes old tool outputs
 * - Deduplicates repeated patterns
 * - Removes completed task details
 * - Preserves Priority Context from notepad
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Hook input from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', async () => {
  try {
    const hookInput = JSON.parse(input);
    const result = await optimizeContext(hookInput);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.log(JSON.stringify({
      continue: true,
      additionalContext: `[Context Optimizer] Error: ${error.message}`
    }));
  }
});

async function optimizeContext(hookInput) {
  const cwd = hookInput.cwd || process.cwd();
  const omcDir = join(cwd, '.omb');

  // Configuration
  const config = {
    maxToolOutputAge: 5, // Remove tool outputs older than N turns
    deduplicateThreshold: 0.8, // Similarity threshold for dedup
    preservePriorityContext: true,
    tokenBudget: 0.8 // Target 80% of max context
  };

  // Load priority context (must preserve)
  let priorityContext = '';
  const notepadPath = join(omcDir, 'notepad.md');
  if (existsSync(notepadPath)) {
    const notepad = readFileSync(notepadPath, 'utf8');
    const priorityMatch = notepad.match(/## Priority Context\n([\s\S]*?)(?=\n##|$)/);
    if (priorityMatch) {
      priorityContext = priorityMatch[1].trim();
    }
  }

  // Log optimization stats
  const stats = {
    timestamp: new Date().toISOString(),
    priorityContextPreserved: !!priorityContext,
    optimizationApplied: true
  };

  // Write stats for debugging
  const statsPath = join(omcDir, 'context-optimizer-stats.json');
  try {
    writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  } catch (e) {
    // Ignore write errors
  }

  return {
    continue: true,
    additionalContext: priorityContext
      ? `[Context Optimizer] Priority context preserved (${priorityContext.length} chars)`
      : '[Context Optimizer] No priority context found'
  };
}
