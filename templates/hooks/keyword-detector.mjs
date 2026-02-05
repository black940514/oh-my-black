#!/usr/bin/env node

/**
 * OMB Keyword Detector Hook (Node.js)
 * Detects magic keywords and invokes skill tools
 * Cross-platform: Windows, macOS, Linux
 *
 * Supported keywords (in priority order):
 * 1. cancelomc/stopomc: Stop active modes
 * 2. ralph: Persistence mode until task completion
 * 3. autopilot: Full autonomous execution
 * 4. ultrapilot: Parallel autopilot
 * 5. ultrawork/ulw: Maximum parallel execution
 * 6. ecomode/eco: Token-efficient execution
 * 7. swarm: N coordinated agents
 * 8. pipeline: Sequential agent chaining
 * 9. ralplan: Iterative planning with consensus
 * 10. plan: Planning interview mode
 * 11. tdd: Test-driven development
 * 12. research: Research orchestration
 * 13. ultrathink/think: Extended reasoning
 * 14. deepsearch: Codebase search (restricted patterns)
 * 15. analyze: Analysis mode (restricted patterns)
 */

import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic import for the shared stdin module
const { readStdin } = await import(join(__dirname, 'lib', 'stdin.mjs'));

const ULTRATHINK_MESSAGE = `<think-mode>

**ULTRATHINK MODE ENABLED** - Extended reasoning activated.

You are now in deep thinking mode. Take your time to:
1. Thoroughly analyze the problem from multiple angles
2. Consider edge cases and potential issues
3. Think through the implications of each approach
4. Reason step-by-step before acting

Use your extended thinking capabilities to provide the most thorough and well-reasoned response.

</think-mode>

---
`;

// Extract prompt from various JSON structures
function extractPrompt(input) {
  try {
    const data = JSON.parse(input);
    if (data.prompt) return data.prompt;
    if (data.message?.content) return data.message.content;
    if (Array.isArray(data.parts)) {
      return data.parts
        .filter(p => p.type === 'text')
        .map(p => p.text)
        .join(' ');
    }
    return '';
  } catch {
    // Fallback: try to extract with regex
    const match = input.match(/"(?:prompt|content|text)"\s*:\s*"([^"]+)"/);
    return match ? match[1] : '';
  }
}

// Sanitize text to prevent false positives from code blocks, XML tags, URLs, and file paths
function sanitizeForKeywordDetection(text) {
  return text
    // 1. Strip XML-style tag blocks: <tag-name ...>...</tag-name> (multi-line, greedy on tag name)
    .replace(/<(\w[\w-]*)[\s>][\s\S]*?<\/\1>/g, '')
    // 2. Strip self-closing XML tags: <tag-name />, <tag-name attr="val" />
    .replace(/<\w[\w-]*(?:\s[^>]*)?\s*\/>/g, '')
    // 3. Strip URLs: http://... or https://... up to whitespace
    .replace(/https?:\/\/[^\s)>\]]+/g, '')
    // 4. Strip file paths: /foo/bar/baz or foo/bar/baz (using lookbehind to avoid consuming leading char)
    .replace(/(?<=^|[\s"'`(])(?:\/)?(?:[\w.-]+\/)+[\w.-]+/gm, '')
    // 5. Strip markdown code blocks (existing)
    .replace(/```[\s\S]*?```/g, '')
    // 6. Strip inline code (existing)
    .replace(/`[^`]+`/g, '');
}

/**
 * Check if the text is asking a question ABOUT a specific keyword/mode,
 * rather than requesting to ACTIVATE that mode.
 *
 * Examples that should be EXCLUDED (questions):
 * - "autopilot이란?" "autopilot 모드는 어떻게 동작하는거야?"
 * - "what is autopilot?" "how does autopilot work?"
 * - "explain ralph mode" "tell me about ultrawork"
 *
 * Examples that should be INCLUDED (commands):
 * - "autopilot: build me an app"
 * - "autopilot 시작"
 * - "ralph: fix all bugs"
 */
function isQuestionAboutKeyword(text, keyword) {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();

  // Explicit command patterns always trigger (not questions)
  const explicitPatterns = {
    autopilot: [/^autopilot\s*:/i, /autopilot\s+시작/i, /autopilot\s+start/i, /\/autopilot\b/i],
    ralph: [/^ralph\s*:/i, /ralph\s+시작/i, /\/ralph\b/i],
    ultrawork: [/^ulw\s*:/i, /^ultrawork\s*:/i, /\/ultrawork\b/i, /\/ulw\b/i],
    ultrapilot: [/^ultrapilot\s*:/i, /\/ultrapilot\b/i],
  };

  const patterns = explicitPatterns[lowerKeyword];
  if (patterns) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return false; // Explicit command, not a question
      }
    }
  }

  // Korean question patterns
  const koreanPatterns = [
    new RegExp(`${lowerKeyword}\\s*(이란|란)\\s*(\\?|뭐|무엇|$)`, 'i'),
    new RegExp(`${lowerKeyword}\\s*(모드|기능)?\\s*(는|은)?\\s*(어떻게|뭐|무엇)`, 'i'),
    new RegExp(`${lowerKeyword}\\s*(을|를)?\\s*(설명|알려)`, 'i'),
    new RegExp(`${lowerKeyword}(의|에\\s*대한?)\\s*(사용법|동작|작동|기능)`, 'i'),
  ];

  for (const pattern of koreanPatterns) {
    if (pattern.test(lowerText)) {
      return true;
    }
  }

  // English question patterns
  const englishPatterns = [
    new RegExp(`what\\s+(is|are|does)\\s+${lowerKeyword}`, 'i'),
    new RegExp(`how\\s+(does|do|is|are)\\s+${lowerKeyword}`, 'i'),
    new RegExp(`(explain|describe)\\s+${lowerKeyword}`, 'i'),
    new RegExp(`tell\\s+me\\s+about\\s+${lowerKeyword}`, 'i'),
    new RegExp(`${lowerKeyword}\\s+(documentation|help|docs)`, 'i'),
  ];

  for (const pattern of englishPatterns) {
    if (pattern.test(lowerText)) {
      return true;
    }
  }

  // Check if text ends with ? and keyword is the subject
  if (/\?\s*$/.test(text)) {
    const keywordIndex = lowerText.indexOf(lowerKeyword);
    if (keywordIndex !== -1) {
      const beforeKeyword = lowerText.slice(Math.max(0, keywordIndex - 30), keywordIndex);
      const afterKeyword = lowerText.slice(keywordIndex, Math.min(lowerText.length, keywordIndex + lowerKeyword.length + 30));

      const questionContext = ['뭐', '무엇', '어떻게', '이란', '란', 'what', 'how', 'explain', 'describe'];
      if (questionContext.some(q => beforeKeyword.includes(q) || afterKeyword.includes(q))) {
        return true;
      }
    }
  }

  return false;
}

// Mode keywords that should be checked for question patterns
const MODE_KEYWORDS = ['autopilot', 'ralph', 'ultrawork', 'ulw', 'ultrapilot', 'ecomode', 'eco', 'swarm', 'pipeline', 'ralplan', 'plan', 'tdd', 'research', 'ultrathink', 'deepsearch', 'analyze'];

// Create state file for a mode
function activateState(directory, prompt, stateName, sessionId) {
  const state = {
    active: true,
    started_at: new Date().toISOString(),
    original_prompt: prompt,
    session_id: sessionId || undefined,
    reinforcement_count: 0,
    last_checked_at: new Date().toISOString()
  };

  // Write to local .omb/state directory
  const localDir = join(directory, '.omb', 'state');
  if (!existsSync(localDir)) {
    try { mkdirSync(localDir, { recursive: true }); } catch {}
  }
  try { writeFileSync(join(localDir, `${stateName}-state.json`), JSON.stringify(state, null, 2)); } catch {}

  // Write to global .omb/state directory
  const globalDir = join(homedir(), '.omb', 'state');
  if (!existsSync(globalDir)) {
    try { mkdirSync(globalDir, { recursive: true }); } catch {}
  }
  try { writeFileSync(join(globalDir, `${stateName}-state.json`), JSON.stringify(state, null, 2)); } catch {}
}

/**
 * Clear state files for cancel operation
 */
function clearStateFiles(directory, modeNames) {
  for (const name of modeNames) {
    const localPath = join(directory, '.omb', 'state', `${name}-state.json`);
    const globalPath = join(homedir(), '.omb', 'state', `${name}-state.json`);
    try { if (existsSync(localPath)) unlinkSync(localPath); } catch {}
    try { if (existsSync(globalPath)) unlinkSync(globalPath); } catch {}
  }
}

/**
 * Create a skill invocation message that tells Claude to use the Skill tool
 */
function createSkillInvocation(skillName, originalPrompt, args = '') {
  const argsSection = args ? `\nArguments: ${args}` : '';
  return `[MAGIC KEYWORD: ${skillName.toUpperCase()}]

You MUST invoke the skill using the Skill tool:

Skill: oh-my-black:${skillName}${argsSection}

User request:
${originalPrompt}

IMPORTANT: Invoke the skill IMMEDIATELY. Do not proceed without loading the skill instructions.`;
}

/**
 * Create multi-skill invocation message for combined keywords
 */
function createMultiSkillInvocation(skills, originalPrompt) {
  if (skills.length === 0) return '';
  if (skills.length === 1) {
    return createSkillInvocation(skills[0].name, originalPrompt, skills[0].args);
  }

  const skillBlocks = skills.map((s, i) => {
    const argsSection = s.args ? `\nArguments: ${s.args}` : '';
    return `### Skill ${i + 1}: ${s.name.toUpperCase()}
Skill: oh-my-black:${s.name}${argsSection}`;
  }).join('\n\n');

  return `[MAGIC KEYWORDS DETECTED: ${skills.map(s => s.name.toUpperCase()).join(', ')}]

You MUST invoke ALL of the following skills using the Skill tool, in order:

${skillBlocks}

User request:
${originalPrompt}

IMPORTANT: Invoke ALL skills listed above. Start with the first skill IMMEDIATELY. After it completes, invoke the next skill in order. Do not skip any skill.`;
}

/**
 * Resolve conflicts between detected keywords
 */
function resolveConflicts(matches) {
  const names = matches.map(m => m.name);

  // Cancel is exclusive
  if (names.includes('cancel')) {
    return [matches.find(m => m.name === 'cancel')];
  }

  let resolved = [...matches];

  // Ecomode beats ultrawork
  if (names.includes('ecomode') && names.includes('ultrawork')) {
    resolved = resolved.filter(m => m.name !== 'ultrawork');
  }

  // Ultrapilot beats autopilot
  if (names.includes('ultrapilot') && names.includes('autopilot')) {
    resolved = resolved.filter(m => m.name !== 'autopilot');
  }

  // Sort by priority order
  const priorityOrder = ['cancel','ralph','autopilot','ultrapilot','ultrawork','ecomode',
    'swarm','pipeline','ralplan','plan','tdd','research','ultrathink','deepsearch','analyze'];
  resolved.sort((a, b) => priorityOrder.indexOf(a.name) - priorityOrder.indexOf(b.name));

  return resolved;
}

/**
 * Create proper hook output with additionalContext (Claude Code hooks API)
 * The 'message' field is NOT a valid hook output - use hookSpecificOutput.additionalContext
 */
function createHookOutput(additionalContext) {
  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext
    }
  };
}

// Main
async function main() {
  try {
    const input = await readStdin();
    if (!input.trim()) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    let data = {};
    try { data = JSON.parse(input); } catch {}
    const directory = data.directory || process.cwd();

    const prompt = extractPrompt(input);
    if (!prompt) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const cleanPrompt = sanitizeForKeywordDetection(prompt).toLowerCase();

    // Collect all matching keywords
    const matches = [];

    // Cancel keywords (no question check needed - cancel is always intentional)
    if (/\b(cancelomc|stopomc)\b/i.test(cleanPrompt)) {
      matches.push({ name: 'cancel', args: '' });
    }

    // Ralph keywords
    if (/\b(ralph|don't stop|must complete|until done)\b/i.test(cleanPrompt)) {
      // Check if asking about ralph
      if (!isQuestionAboutKeyword(prompt, 'ralph')) {
        matches.push({ name: 'ralph', args: '' });
      }
    }

    // Autopilot keywords
    const hasAutopilotKeyword = /\b(autopilot|auto pilot|auto-pilot|autonomous|full auto|fullsend)\b/i.test(cleanPrompt);
    const hasAutopilotPhrase = /\bbuild\s+me\s+/i.test(cleanPrompt) ||
        /\bcreate\s+me\s+/i.test(cleanPrompt) ||
        /\bmake\s+me\s+/i.test(cleanPrompt) ||
        /\bi\s+want\s+a\s+/i.test(cleanPrompt) ||
        /\bi\s+want\s+an\s+/i.test(cleanPrompt) ||
        /\bhandle\s+it\s+all\b/i.test(cleanPrompt) ||
        /\bend\s+to\s+end\b/i.test(cleanPrompt) ||
        /\be2e\s+this\b/i.test(cleanPrompt);

    if (hasAutopilotKeyword || hasAutopilotPhrase) {
      // Only check for question if keyword was detected (phrases are always action)
      if (!hasAutopilotKeyword || !isQuestionAboutKeyword(prompt, 'autopilot')) {
        matches.push({ name: 'autopilot', args: '' });
      }
    }

    // Ultrapilot keywords
    if (/\b(ultrapilot|ultra-pilot)\b/i.test(cleanPrompt) ||
        /\bparallel\s+build\b/i.test(cleanPrompt) ||
        /\bswarm\s+build\b/i.test(cleanPrompt)) {
      if (!isQuestionAboutKeyword(prompt, 'ultrapilot')) {
        matches.push({ name: 'ultrapilot', args: '' });
      }
    }

    // Ultrawork keywords
    if (/\b(ultrawork|ulw|uw)\b/i.test(cleanPrompt)) {
      if (!isQuestionAboutKeyword(prompt, 'ultrawork')) {
        matches.push({ name: 'ultrawork', args: '' });
      }
    }

    // Ecomode keywords
    if (/\b(eco|ecomode|eco-mode|efficient|save-tokens|budget)\b/i.test(cleanPrompt)) {
      if (!isQuestionAboutKeyword(prompt, 'ecomode')) {
        matches.push({ name: 'ecomode', args: '' });
      }
    }

    // Swarm - parse N from "swarm N agents"
    const swarmMatch = cleanPrompt.match(/\bswarm\s+(\d+)\s+agents?\b/i);
    if (swarmMatch || /\bcoordinated\s+agents\b/i.test(cleanPrompt)) {
      if (!isQuestionAboutKeyword(prompt, 'swarm')) {
        const agentCount = swarmMatch ? swarmMatch[1] : '3';
        matches.push({ name: 'swarm', args: agentCount });
      }
    }

    // Pipeline keywords
    if (/\b(pipeline)\b/i.test(cleanPrompt) || /\bchain\s+agents\b/i.test(cleanPrompt)) {
      if (!isQuestionAboutKeyword(prompt, 'pipeline')) {
        matches.push({ name: 'pipeline', args: '' });
      }
    }

    // Ralplan keyword
    if (/\b(ralplan)\b/i.test(cleanPrompt)) {
      if (!isQuestionAboutKeyword(prompt, 'ralplan')) {
        matches.push({ name: 'ralplan', args: '' });
      }
    }

    // Plan keywords (only "plan this" or "plan the" - not questions about "plan")
    if (/\b(plan this|plan the)\b/i.test(cleanPrompt)) {
      if (!isQuestionAboutKeyword(prompt, 'plan')) {
        matches.push({ name: 'plan', args: '' });
      }
    }

    // TDD keywords
    if (/\b(tdd)\b/i.test(cleanPrompt) ||
        /\btest\s+first\b/i.test(cleanPrompt) ||
        /\bred\s+green\b/i.test(cleanPrompt)) {
      if (!isQuestionAboutKeyword(prompt, 'tdd')) {
        matches.push({ name: 'tdd', args: '' });
      }
    }

    // Research keywords
    if (/\b(research)\b/i.test(cleanPrompt) ||
        /\banalyze\s+data\b/i.test(cleanPrompt) ||
        /\bstatistics\b/i.test(cleanPrompt)) {
      if (!isQuestionAboutKeyword(prompt, 'research')) {
        matches.push({ name: 'research', args: '' });
      }
    }

    // Ultrathink keywords
    if (/\b(ultrathink|think hard|think deeply)\b/i.test(cleanPrompt)) {
      if (!isQuestionAboutKeyword(prompt, 'ultrathink')) {
        matches.push({ name: 'ultrathink', args: '' });
      }
    }

    // Deepsearch keywords
    if (/\b(deepsearch)\b/i.test(cleanPrompt) ||
        /\bsearch\s+(the\s+)?(codebase|code|files?|project)\b/i.test(cleanPrompt) ||
        /\bfind\s+(in\s+)?(codebase|code|all\s+files?)\b/i.test(cleanPrompt)) {
      if (!isQuestionAboutKeyword(prompt, 'deepsearch')) {
        matches.push({ name: 'deepsearch', args: '' });
      }
    }

    // Analyze keywords
    if (/\b(deep\s*analyze)\b/i.test(cleanPrompt) ||
        /\binvestigate\s+(the|this|why)\b/i.test(cleanPrompt) ||
        /\bdebug\s+(the|this|why)\b/i.test(cleanPrompt)) {
      if (!isQuestionAboutKeyword(prompt, 'analyze')) {
        matches.push({ name: 'analyze', args: '' });
      }
    }

    // No matches - pass through
    if (matches.length === 0) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Resolve conflicts
    const resolved = resolveConflicts(matches);

    // Handle cancel specially - clear states and emit
    if (resolved.length > 0 && resolved[0].name === 'cancel') {
      clearStateFiles(directory, ['ralph', 'autopilot', 'ultrapilot', 'ultrawork', 'ecomode', 'swarm', 'pipeline']);
      console.log(JSON.stringify(createHookOutput(createSkillInvocation('cancel', prompt))));
      return;
    }

    // Activate states for modes that need them
    const sessionId = data.sessionId || data.session_id || '';
    const stateModes = resolved.filter(m => ['ralph', 'autopilot', 'ultrapilot', 'ultrawork', 'ecomode'].includes(m.name));
    for (const mode of stateModes) {
      activateState(directory, prompt, mode.name, sessionId);
    }

    // Special: Ralph with ultrawork (only if ecomode NOT present)
    const hasRalph = resolved.some(m => m.name === 'ralph');
    const hasEcomode = resolved.some(m => m.name === 'ecomode');
    const hasUltrawork = resolved.some(m => m.name === 'ultrawork');
    if (hasRalph && !hasEcomode && !hasUltrawork) {
      activateState(directory, prompt, 'ultrawork', sessionId);
    }

    // Handle ultrathink specially - prepend message instead of skill invocation
    const ultrathinkIndex = resolved.findIndex(m => m.name === 'ultrathink');
    if (ultrathinkIndex !== -1) {
      // Remove ultrathink from skill list
      resolved.splice(ultrathinkIndex, 1);

      // If ultrathink was the only match, emit message
      if (resolved.length === 0) {
        console.log(JSON.stringify(createHookOutput(ULTRATHINK_MESSAGE)));
        return;
      }

      // Otherwise, prepend ultrathink message to skill invocation
      const skillMessage = createMultiSkillInvocation(resolved, prompt);
      console.log(JSON.stringify(createHookOutput(ULTRATHINK_MESSAGE + skillMessage)));
      return;
    }

    // Emit skill invocation(s)
    console.log(JSON.stringify(createHookOutput(createMultiSkillInvocation(resolved, prompt))));
  } catch (error) {
    // On any error, allow continuation
    console.log(JSON.stringify({ continue: true }));
  }
}

main();
