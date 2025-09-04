# SPEC GAPS AUDIT - Plato Codebase Review

## Overview
This audit identifies remaining spec gaps after recent modifications to achieve Claude Code parity. The codebase has been partially updated but requires clarification on several implementation details.

## Current State Assessment

### ✅ Already Implemented (from recent modifications)
1. **Session Management**: Auto-save with debouncing implemented in `orchestrator.ts`
2. **Export Functions**: `exportJSON`, `exportMarkdown`, `exportToClipboard` added
3. **Tool Call Detection**: Strict regex matching Claude Code format
4. **MCP Retry Logic**: Exponential backoff with proper status code handling
5. **Patch Sanitization**: `sanitizeDiff()` function implemented
6. **Git Repository Warnings**: Added startup checks and user warnings
7. **Multiple Slash Commands**: Several commands implemented including `/init`, `/agents`, `/bashes`, `/memory`, etc.

## 🔴 CRITICAL SPEC GAPS REQUIRING CLARIFICATION

### SG-A001: Bash Sessions Implementation Missing
- **File**: `src/tools/bashes.ts` (DOES NOT EXIST)
- **Impact**: `/bashes` command references non-existent module
- **Current Code**: Line 467 in `app.tsx` imports `'../tools/bashes.js'` which doesn't exist
- **Questions**:
  1. Should I create the full bash sessions implementation as specified in SPEC_GAPS_NEW.md?
  2. Should bash sessions use `child_process.spawn` or `node-pty` if available?
  3. What's the maximum number of concurrent sessions allowed?
  4. Should sessions persist across Plato restarts?

### SG-A002: Hooks System Incomplete
- **File**: `src/tools/hooks.ts` 
- **Issue**: `manageHooks` function is imported but not implemented
- **Line**: 507 in `app.tsx`
- **Questions**:
  1. Should hooks configuration use YAML format as specified?
  2. What's the security model for hook execution (sandboxing)?
  3. Should hooks have access to environment variables?
  4. Default timeout of 5000ms acceptable?

### SG-A003: Init Operation Missing
- **File**: `src/ops/init.ts` (DOES NOT EXIST)
- **Issue**: `/init` command calls non-existent `generateProjectDoc`
- **Line**: 455 in `app.tsx`
- **Questions**:
  1. Should PLATO.md generation analyze all files or respect .gitignore?
  2. What's the maximum file size to analyze?
  3. Should it include dependency analysis?
  4. Template for PLATO.md structure?

### SG-A004: Config Type Coercion Incomplete
- **File**: `src/config.ts`
- **Issue**: `setConfigValue` doesn't implement type coercion as specified
- **Current**: Simple key-value storage without validation
- **Questions**:
  1. Should invalid types throw errors or coerce silently?
  2. Which config keys require boolean vs number vs JSON parsing?
  3. Should we validate against a schema file?

### SG-A005: Security Review Function Scope
- **File**: `src/policies/security.ts`
- **Issue**: `runSecurityReview` function imported but not defined
- **Line**: 514 in `app.tsx` references undefined function
- **Questions**:
  1. Should security review scan entire workspace or just pending changes?
  2. What security patterns should be checked beyond the current minimal set?
  3. Should it integrate with external security tools?
  4. Blocking vs warning severity levels?

### SG-A006: Memory System Placeholder
- **File**: `src/runtime/orchestrator.ts`
- **Issue**: `getMemory()` and `clearMemory()` return empty/no-op
- **Lines**: 89-90
- **Questions**:
  1. Should memory persist to `.plato/memory/` directory?
  2. What's the memory retention policy (size/time limits)?
  3. Format for memory storage (JSON, SQLite, other)?
  4. Should memory include context about file changes?

### SG-A007: Output Style Not Applied
- **File**: `src/tui/app.tsx`
- **Issue**: `/output-style` sets config but doesn't affect actual output
- **Questions**:
  1. How should 'minimal' vs 'markdown' vs 'verbose' differ?
  2. Should style affect tool output formatting?
  3. Should style persist across sessions?
  4. Color/emoji usage per style?

### SG-A008: Vim Mode Non-Functional
- **File**: `src/tui/app.tsx`
- **Issue**: `/vim` toggles config but doesn't change input behavior
- **Line**: 527
- **Questions**:
  1. Which vim keybindings should be supported (basic vs full)?
  2. Should it support command/insert/visual modes?
  3. Integration with Ink's input system possible?
  4. Fallback if vim mode can't be implemented?

### SG-A009: Privacy Settings Storage
- **File**: `src/tui/app.tsx`
- **Issue**: Telemetry setting stored as string 'true'/'false' not boolean
- **Line**: 542
- **Questions**:
  1. Should telemetry actually send data somewhere?
  2. What data would be collected if enabled?
  3. Opt-in vs opt-out default?
  4. GDPR compliance requirements?

### SG-A010: Doctor Command Minimal
- **File**: `src/ops/doctor.ts`
- **Issue**: Only checks git/rg/copilot, not comprehensive
- **Questions**:
  1. Should doctor verify all MCP servers?
  2. Check Node.js version compatibility?
  3. Verify file permissions for .plato directory?
  4. Network connectivity tests needed?

## 🟡 MEDIUM PRIORITY GAPS

### SG-B001: Clipboard Support
- **Issue**: `exportToClipboard` uses eval hack for dynamic import
- **Line**: 130 in `orchestrator.ts`
- **Question**: Should we add clipboardy as a required dependency or keep optional?

### SG-B002: Error Message Consistency
- **Issue**: Mix of error formats throughout codebase
- **Question**: Standardize all errors to Claude Code format `❌ Error: message`?

### SG-B003: Context File Selection
- **Issue**: `/context` command exists but integration with orchestrator unclear
- **Question**: Should context files be automatically included in prompts?

### SG-B004: Model Catalog Management
- **Issue**: Model list hardcoded, no dynamic fetching
- **Question**: Keep static list or implement provider-specific catalog fetching?

## 🟢 LOW PRIORITY GAPS

### SG-C001: Keybinding Conflicts
- **Issue**: Some key combinations might conflict with terminal emulators
- **Question**: Document known conflicts or attempt detection?

### SG-C002: Color Support Detection
- **Issue**: ANSI colors assumed, no terminal capability checking
- **Question**: Add color detection or assume modern terminal?

### SG-C003: Session File Rotation
- **Issue**: 10MB limit mentioned but rotation not implemented
- **Question**: Implement rotation or just truncate?

## IMMEDIATE QUESTIONS REQUIRING ANSWERS

Before I proceed with ANY code modifications, I need your decisions on:

1. **Bash Sessions** (SG-A001): Should I create the complete implementation now, or stub it out?

2. **Hooks System** (SG-A002): Full implementation with YAML config, or simpler JSON approach?

3. **Project Init** (SG-A003): What should PLATO.md generation actually analyze and include?

4. **Type Safety** (SG-A004): Which config fields need type validation?

5. **Security Review** (SG-A005): What security checks are actually needed beyond current minimal set?

6. **Memory System** (SG-A006): Implement actual persistence or keep as no-op for now?

7. **Critical for Claude Code Parity**: Which of these MUST work exactly like Claude Code vs which can differ?

## RECOMMENDED APPROACH

Based on the audit, I suggest:

1. **Phase 1 (Critical)**: Implement missing files (bashes.ts, init.ts) with basic functionality
2. **Phase 2 (Important)**: Fix type coercion, memory system, hooks
3. **Phase 3 (Enhancement)**: Polish output styles, vim mode, comprehensive doctor

Please provide your decisions on the critical gaps (SG-A001 through SG-A010) so I can proceed with implementation.

## FILES THAT NEED CREATION

These files are referenced but don't exist:
1. `src/tools/bashes.ts` - Bash session management
2. `src/ops/init.ts` - Project documentation generator
3. `.plato/hooks.yaml` - Hook configuration (example)
4. `.plato/memory/` - Memory storage directory

## CONFIGURATION SCHEMA NEEDED

Current config has no validation schema. Need to define:
- Required fields vs optional
- Type constraints per field
- Default values
- Migration strategy for config updates

---

**WAITING FOR YOUR CLARIFICATION** before proceeding with any code modifications.