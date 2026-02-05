---
name: wiring-audit
description: Run static analysis to detect unwired code, placeholders, and path inconsistencies
triggers:
  - wiring-audit
  - wiring audit
  - check wiring
  - audit wiring
invocable: true
---

# Wiring Audit

[WIRING AUDIT - STATIC ANALYSIS MODE]

## Overview

This skill runs static analysis on the codebase to detect:
- **Placeholder code**: TODO, FIXME, unimplemented functions
- **Unused exports**: Symbols exported but never imported
- **Registry mismatches**: Skills/agents/hooks not registered
- **Path drift**: Legacy .omc/ or sisyphus paths (should be .omb/ and oh-my-black)
- **Orphan HUD elements**: HUD producers without consumers

## Usage

```
/oh-my-black:wiring-audit [options]
```

### Options
- `--fix` - Attempt to auto-fix path drift issues
- `--strict` - Fail on any warning (not just errors)
- `--paths <glob>` - Custom paths to audit (default: src/**/*.ts)
- `--ignore <pattern>` - Additional ignore patterns

## Execution Protocol

When invoked, you MUST:

1. **Import the wiring-audit module**:
   ```typescript
   import { runWiringAudit, formatWiringReport, isWiringClean } from './src/features/wiring-audit/index.js';
   ```

2. **Run the audit**:
   ```typescript
   const result = await runWiringAudit({
     checkPlaceholders: true,
     checkUnusedExports: true,
     checkRegistry: true,
     checkPathDrift: true,
     checkOrphanHud: true
   });
   ```

3. **Report results**:
   - If `isWiringClean(result)` → Report SUCCESS with summary
   - If errors found → Report FAILED with detailed issues
   - Always show `formatWiringReport(result)` output

4. **For --fix option**:
   - Use `suggestPathFix()` from path-drift-detector
   - Apply fixes with Edit tool
   - Re-run audit to verify fixes

## Output Format

```
## Wiring Audit Report

**Status**: PASS/FAIL
**Files Scanned**: N
**Issues Found**: X errors, Y warnings, Z info

### Errors (must fix)
- [path_drift] src/foo.ts:42 - Found .omc/ path, should be .omb/
- [registry_missing] src/skills/bar.md - Skill not registered

### Warnings (should fix)
- [placeholder_detected] src/baz.ts:15 - TODO: implement validation

### Info (optional)
- [unused_export] src/utils.ts:8 - 'helperFn' exported but never imported
```

## Integration with B-V Cycle

When used as part of Builder-Validator cycle:
- Wiring audit should run AFTER build success
- Results become `wiring_proof` evidence type
- REJECT if any errors found
- WARN but APPROVE if only warnings/info

## Example Invocations

```
/oh-my-black:wiring-audit                    # Full audit
/oh-my-black:wiring-audit --strict           # Strict mode
/oh-my-black:wiring-audit --fix              # Auto-fix paths
/oh-my-black:wiring-audit --paths "src/features/**"  # Custom scope
```
