#!/usr/bin/env node
/**
 * PostToolUse hook: Validate syntax after Write/Edit operations
 *
 * Part of the ohmyblack self-validation system.
 * Runs type checking on TypeScript files after modifications.
 *
 * Input (via stdin): JSON with tool_input.file_path
 * Output (stdout): JSON with { continue: boolean, message?: string }
 */
import { execSync } from 'child_process';
import { extname, dirname } from 'path';
import { existsSync } from 'fs';

/**
 * Read JSON from stdin
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Find tsconfig.json by walking up from file path
 */
function findTsConfig(filePath) {
  let dir = dirname(filePath);
  while (dir !== '/' && dir !== '.') {
    const tsconfig = `${dir}/tsconfig.json`;
    if (existsSync(tsconfig)) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}

/**
 * Main validation function
 */
async function main() {
  try {
    const input = await readStdin();
    const data = JSON.parse(input);

    // Extract file path from tool input
    const filePath = data.tool_input?.file_path;
    if (!filePath) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const ext = extname(filePath);

    // Only check TypeScript files
    if (ext !== '.ts' && ext !== '.tsx') {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Find project root with tsconfig
    const projectRoot = findTsConfig(filePath);
    if (!projectRoot) {
      // No tsconfig found, skip validation
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    try {
      // Run tsc --noEmit from project root
      execSync('npx tsc --noEmit 2>&1', {
        cwd: projectRoot,
        timeout: 30000,
        encoding: 'utf-8'
      });
      console.log(JSON.stringify({ continue: true }));
    } catch (e) {
      const output = e.stdout || e.stderr || e.message || 'Unknown error';
      // Extract relevant errors (limit output size)
      const relevantOutput = output
        .split('\n')
        .filter(line => line.includes(filePath) || line.includes('error TS'))
        .slice(0, 10)
        .join('\n');

      if (relevantOutput.trim()) {
        console.log(JSON.stringify({
          continue: true,
          message: `⚠️ TypeScript issues detected:\n${relevantOutput.slice(0, 500)}`
        }));
      } else {
        // Errors not related to this file, continue silently
        console.log(JSON.stringify({ continue: true }));
      }
    }
  } catch {
    // On any error, allow continuation (fail-open)
    console.log(JSON.stringify({ continue: true }));
  }
}

main();
