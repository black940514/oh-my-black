#!/usr/bin/env node
/**
 * progress-reporter.mjs - Real-time Progress Streaming
 * Runs in SubagentStart and SubagentStop hooks
 *
 * Features:
 * - Tracks total/completed tasks
 * - Updates .omc/progress.json in real-time
 * - Calculates ETA (optional)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const action = process.argv[2] || 'start'; // 'start' or 'stop'

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', async () => {
  try {
    const hookInput = JSON.parse(input);
    const result = await reportProgress(hookInput, action);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.log(JSON.stringify({
      continue: true
    }));
  }
});

async function reportProgress(hookInput, action) {
  const cwd = hookInput.cwd || process.cwd();
  const omcDir = join(cwd, '.omc');
  const progressPath = join(omcDir, 'progress.json');

  // Ensure .omc directory exists
  if (!existsSync(omcDir)) {
    try {
      mkdirSync(omcDir, { recursive: true });
    } catch (e) {
      return { continue: true };
    }
  }

  // Load or initialize progress state
  let progress = {
    total_tasks: 0,
    completed_tasks: 0,
    current_task: null,
    active_agents: [],
    started_at: null,
    last_updated: null,
    eta: null
  };

  if (existsSync(progressPath)) {
    try {
      progress = JSON.parse(readFileSync(progressPath, 'utf8'));
    } catch (e) {
      // Use default
    }
  }

  const agentType = hookInput.subagent_type || hookInput.agent_type || 'unknown';
  const taskDescription = hookInput.description || hookInput.prompt?.slice(0, 50) || 'Task';

  if (action === 'start') {
    // Agent starting
    if (!progress.started_at) {
      progress.started_at = new Date().toISOString();
    }
    progress.total_tasks++;
    progress.current_task = taskDescription;
    progress.active_agents.push({
      type: agentType,
      task: taskDescription,
      started_at: new Date().toISOString()
    });
  } else if (action === 'stop') {
    // Agent stopping
    progress.completed_tasks++;
    progress.active_agents = progress.active_agents.filter(a => a.type !== agentType);

    if (progress.active_agents.length > 0) {
      progress.current_task = progress.active_agents[0].task;
    } else {
      progress.current_task = null;
    }

    // Calculate ETA
    if (progress.completed_tasks > 0 && progress.started_at) {
      const elapsed = Date.now() - new Date(progress.started_at).getTime();
      const avgPerTask = elapsed / progress.completed_tasks;
      const remaining = progress.total_tasks - progress.completed_tasks;
      progress.eta = new Date(Date.now() + avgPerTask * remaining).toISOString();
    }
  }

  progress.last_updated = new Date().toISOString();

  // Write progress file
  try {
    writeFileSync(progressPath, JSON.stringify(progress, null, 2));
  } catch (e) {
    // Ignore write errors
  }

  return { continue: true };
}
