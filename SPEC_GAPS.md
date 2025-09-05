# SPEC GAPS REPORT - Plato Codebase

## Overview
This report identifies all incomplete implementations, ambiguous logic, and missing specifications in the Plato codebase that require clarification before proceeding with refactoring.

**Scan Date:** 2025-09-05
**Total Issues Found:** 30+ spec gaps across 8 categories
**Status:** AWAITING USER CLARIFICATION

---

## 1. CRITICAL GAPS - Unimplemented Features

### 1.1 IDE Connection Logic (HIGH PRIORITY)
**File:** `src/tui/keyboard-handler.tsx:552`
**Current State:** TODO comment with fake success message
```typescript
// TODO: Implement actual IDE connection logic
setLines(prev => prev.concat(`✅ Connected to ${editor}. File awareness and linter warnings enabled.`));
```
**Questions:**
1. Should the IDE connection be fully implemented or remain a placeholder?
2. If implementing: What protocol? (LSP, custom socket, HTTP API)?
3. Should this command be disabled until implemented?
4. What specific IDE features to support? (file awareness, linter warnings, jump-to-definition)

### 1.2 Markdown Import Feature (MEDIUM PRIORITY)
**File:** `src/memory/manager.ts:350`
**Current State:** Throws error "not yet implemented"
```typescript
throw new Error('Markdown import not yet implemented');
```
**Questions:**
1. Is markdown import required for Phase 2?
2. What markdown format/schema should be supported?
3. Should this return "coming soon" instead of error?

### 1.3 Missing Slash Commands (HIGH PRIORITY)
**Files:** `src/tui/keyboard-handler.tsx`, `src/slash/commands.ts`
**Current State:** Many commands listed but not implemented
**Missing Commands:**
- `/statusline` - Customize status line display
- `/init` - Initialize PLATO.md documentation
- `/agents` - Manage AI agents
- `/bashes` - Manage bash sessions
- `/memory` - View/edit memory
- `/output-style` - Set output style
- `/compact` - Compact conversation
- `/hooks` - Manage hooks
- `/security-review` - Review changes
- `/todos` - TODO management
- `/vim` - Toggle vim mode
- `/proxy` - HTTP proxy control
- `/upgrade` - Upgrade provider plan
- `/resume` - Resume session
- `/privacy-settings` - Privacy controls
- `/release-notes` - Show release notes

**Questions:**
1. Which commands are Phase 2 priority vs Phase 3?
2. Should unimplemented commands be hidden or show "coming soon"?

---

## 2. ERROR HANDLING GAPS

### 2.1 Empty Catch Blocks (21 instances)
**Files:** Multiple locations
**Current State:** Errors silently swallowed
```typescript
try { /* code */ } catch {}
```
**Locations:**
- `src/tools/permissions.ts`: Lines 24, 67, 75
- `src/context/context.ts`: Lines 51, 65
- `src/context/indexer.ts`: Lines 14, 24
- `src/runtime/orchestrator.ts`: Lines 498, 518, 525
- `src/ops/init.ts`: Lines 15, 77, 165
- Plus 10+ more locations

**Questions:**
1. Should these log to debug/telemetry?
2. Which errors are expected vs unexpected?
3. Add error monitoring/telemetry system?

---

## 3. SECURITY & VALIDATION GAPS

### 3.1 Dynamic Import Without Validation
**File:** `src/tui/keyboard-handler.tsx:571`
**Current State:** Imports 'open' package dynamically
```typescript
const open = await import('open');
await open.default(url);
```
**Questions:**
1. Is 'open' a required or optional dependency?
2. Should URLs be validated before opening?
3. What security checks for external URLs?

### 3.2 Process Management Issues
**File:** `src/tools/bashes.ts:96`
**Current State:** Kills process without validation
```typescript
session.process.kill();
sessions.delete(fullId);
```
**Questions:**
1. Check if process exists before killing?
2. Use SIGTERM vs SIGKILL?
3. Implement graceful shutdown with timeout?
4. Handle zombie processes?

### 3.3 GitHub App URL Hardcoded
**File:** `src/tui/keyboard-handler.tsx:566`
**Current State:** Hardcoded URL
```typescript
const url = 'https://github.com/apps/plato-ai-assistant/installations/new';
```
**Questions:**
1. Should this be configurable?
2. Is "plato-ai-assistant" correct app name?
3. Support GitHub Enterprise URLs?

---

## 4. RESOURCE MANAGEMENT GAPS

### 4.1 File Handle Leaks
**File:** `src/tools/bashes.ts:71-83`
**Current State:** File stream may not close properly
```typescript
const logStream = await fs.open(logPath, 'w');
proc.on('exit', () => {
    logStream.close();
});
```
**Questions:**
1. Use try-finally for guaranteed closure?
2. Handle process crash before exit event?
3. Auto-cleanup old log files?
4. Maximum log file size?

### 4.2 Unbounded Session Map
**File:** `src/tools/bashes.ts:14`
**Current State:** Sessions map grows without limit
```typescript
const sessions = new Map<string, BashSession>();
```
**Questions:**
1. Limit concurrent sessions?
2. Auto-clean old/inactive sessions?
3. Maximum session lifetime?

---

## 5. PLATFORM COMPATIBILITY GAPS

### 5.1 Shell Detection
**File:** `src/tools/bashes.ts:51`
**Current State:** Assumes 'bash' availability
```typescript
const shell = process.env.SHELL || 'bash';
```
**Questions:**
1. Detect Windows and use cmd/powershell?
2. Verify shell exists before spawning?
3. Cross-platform shell abstraction?

### 5.2 Git Dependency
**File:** `src/tools/patch.ts:87`
**Current State:** Hard requirement for Git
```typescript
throw new Error('Patch operations require a Git repository. Run `git init` first.');
```
**Questions:**
1. Auto-initialize Git repo if missing?
2. Non-Git fallback for patches?
3. Make this a warning for read operations?

---

## 6. API INTEGRATION GAPS

### 6.1 MCP Server Error Handling
**File:** `src/integrations/mcp.ts:69`
**Current State:** Simple error, no retry
```typescript
if (!s) throw new Error(`no mcp server: ${serverId}`);
```
**Questions:**
1. Implement retry with exponential backoff?
2. How many retries?
3. Try alternative servers on failure?
4. Telemetry for failures?

### 6.2 Copilot API Compatibility
**File:** `src/providers/copilot.ts`
**Current State:** Uses 'tool' role in messages
**Questions:**
1. Does Copilot accept 'tool' role or need translation?
2. Set X-Initiator header based on tool usage?

---

## 7. CONFIGURATION GAPS

### 7.1 Config Type Validation
**File:** `src/config.ts:86-94`
**Current State:** Basic type errors
```typescript
throw new Error(`Invalid value for ${key}: expected number`);
```
**Questions:**
1. More specific error messages?
2. Validate value ranges?
3. Sanitize/transform instead of throwing?

### 7.2 Nested Config Updates
**File:** `src/cli.ts`
**Current State:** Only top-level keys supported
**Questions:**
1. Support dotted paths (e.g., `statusline.format`)?
2. Deep merge for nested objects?

---

## 8. TESTING GAPS

### 8.1 No Test Coverage
**Files:** Entire codebase
**Current State:** Jest configured but no tests implemented
**Questions:**
1. Target coverage percentage?
2. Priority modules for testing?
3. Unit vs integration test balance?

---

## PRIORITY QUESTIONS FOR IMMEDIATE CLARIFICATION

**🔴 HIGH PRIORITY (Blocking):**
1. **IDE Connection**: Implement or keep mock? What protocol if implementing?
2. **Slash Commands**: Which are Phase 2 requirements?
3. **Error Handling**: Add logging for 21 empty catch blocks?
4. **Git Requirement**: Auto-init or keep manual?

**🟡 MEDIUM PRIORITY (Functionality):**
5. **Markdown Import**: Phase 2 or Phase 3?
6. **Shell Detection**: Windows support needed?
7. **Session Limits**: Max concurrent bash sessions?
8. **GitHub App**: Correct app name? Make configurable?

**🟢 LOW PRIORITY (Polish):**
9. **Config Validation**: Detailed error messages?
10. **Log Cleanup**: Auto-cleanup strategy?
11. **Test Coverage**: Target percentage?
12. **MCP Retry**: Implement exponential backoff?

---

## Next Steps

**Please provide answers to the PRIORITY QUESTIONS above.**

Once clarified, I will:
1. Apply agreed-upon fixes
2. Run parallel sub-agents for comprehensive audit:
   - Static Analysis & Lint Agent
   - Types & Contracts Agent
   - Tests & CI Agent
   - Security Agent
   - Performance Agent
   - Documentation Agent
3. Generate improvement reports:
   - ISSUES.md
   - CHANGELOG.md
   - RISK_MATRIX.md
   - SECURITY_REPORT/
   - PERF_REPORT/
   - NEXT_STEPS.md

**Current Status:** ⏸️ AWAITING USER INPUT before any code modifications