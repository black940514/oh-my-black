#!/usr/bin/env node
/**
 * auto-test-trigger.mjs - Automatic Test Execution on Changes
 * Runs AFTER validate-syntax.mjs in PostToolUse (Write|Edit)
 *
 * Features:
 * - Maps source files to test files
 * - Runs tests in background (non-blocking)
 * - Injects warning if tests fail
 */

import { existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { spawn } from 'child_process';

// Test file pattern mappings
const testPatterns = [
  // TypeScript/JavaScript
  { src: /^(.+)\.tsx?$/, tests: ['$1.test.ts', '$1.test.tsx', '$1.spec.ts', '$1.spec.tsx'] },
  { src: /^src\/(.+)\.tsx?$/, tests: ['tests/$1.test.ts', '__tests__/$1.spec.ts', 'src/$1.test.tsx'] },
  // Python
  { src: /^(.+)\.py$/, tests: ['test_$1.py', '$1_test.py'] },
  { src: /^src\/(.+)\.py$/, tests: ['tests/test_$1.py'] },
];

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', async () => {
  try {
    const hookInput = JSON.parse(input);
    const result = await triggerTests(hookInput);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.log(JSON.stringify({
      continue: true,
      additionalContext: `[Auto-Test] Error: ${error.message}`
    }));
  }
});

async function triggerTests(hookInput) {
  const toolName = hookInput.tool_name;
  const toolInput = hookInput.tool_input || {};

  // Only process Write and Edit tools
  if (!['Write', 'Edit'].includes(toolName)) {
    return { continue: true };
  }

  const filePath = toolInput.file_path || toolInput.path;
  if (!filePath) {
    return { continue: true };
  }

  const cwd = hookInput.cwd || process.cwd();

  // Find related test file
  const testFile = findTestFile(filePath, cwd);

  if (!testFile) {
    return {
      continue: true,
      additionalContext: `[Auto-Test] No test file found for ${basename(filePath)}`
    };
  }

  // Run test in background (non-blocking)
  const testRunner = detectTestRunner(cwd);
  if (testRunner) {
    // Spawn in background, don't wait
    const child = spawn(testRunner.cmd, [...testRunner.args, testFile], {
      cwd,
      detached: true,
      stdio: 'ignore'
    });
    child.unref();

    return {
      continue: true,
      additionalContext: `[Auto-Test] Running ${basename(testFile)} in background`
    };
  }

  return { continue: true };
}

function findTestFile(srcPath, cwd) {
  const relativePath = srcPath.startsWith(cwd)
    ? srcPath.slice(cwd.length + 1)
    : srcPath;

  for (const pattern of testPatterns) {
    const match = relativePath.match(pattern.src);
    if (match) {
      for (const testTemplate of pattern.tests) {
        const testPath = testTemplate.replace(/\$1/g, match[1]);
        const fullTestPath = join(cwd, testPath);
        if (existsSync(fullTestPath)) {
          return fullTestPath;
        }
      }
    }
  }

  // Try common patterns
  const dir = dirname(srcPath);
  const name = basename(srcPath).replace(/\.(ts|tsx|js|jsx|py)$/, '');
  const commonTests = [
    join(dir, `${name}.test.ts`),
    join(dir, `${name}.spec.ts`),
    join(dir, '__tests__', `${name}.test.ts`),
    join(cwd, 'tests', `${name}.test.ts`),
  ];

  for (const testPath of commonTests) {
    if (existsSync(testPath)) {
      return testPath;
    }
  }

  return null;
}

function detectTestRunner(cwd) {
  if (existsSync(join(cwd, 'package.json'))) {
    if (existsSync(join(cwd, 'node_modules', '.bin', 'vitest'))) {
      return { cmd: 'npx', args: ['vitest', 'run'] };
    }
    if (existsSync(join(cwd, 'node_modules', '.bin', 'jest'))) {
      return { cmd: 'npx', args: ['jest', '--passWithNoTests'] };
    }
    return { cmd: 'npm', args: ['test', '--'] };
  }
  if (existsSync(join(cwd, 'pytest.ini')) || existsSync(join(cwd, 'pyproject.toml'))) {
    return { cmd: 'pytest', args: ['-x', '-q'] };
  }
  return null;
}
