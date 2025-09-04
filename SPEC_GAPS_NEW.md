# SPEC GAPS - Implementation Directives for Claude Code Parity

This document provides clear implementation requirements to achieve exact Claude Code CLI/TUI parity, but using GitHub Copilot as the provider and named "Plato".

## Implementation Requirements for Claude Code Parity

### SG-028: Slash Commands Registry
- **Current State**: 13 commands in registry but unimplemented
- **FILE TO MODIFY**: `src/tui/app.tsx` (lines 174-530)
- **REQUIRED ACTION**: 
  - Keep ALL commands in SLASH_COMMANDS for parity with Claude Code
  - Add the following implementations in the handleSubmit() function:

```typescript
// /init - Generate PLATO.md
if (text === '/init') {
  setLines(prev => prev.concat('Analyzing codebase...'));
  const { generateProjectDoc } = await import('../ops/init.js');
  await generateProjectDoc(); // Creates PLATO.md
  setLines(prev => prev.concat('✅ Generated PLATO.md with codebase documentation'));
  return;
}

// /agents - Placeholder for future
if (text === '/agents') {
  setLines(prev => prev.concat('Agent management coming soon'));
  return;
}

// /bashes - Shell sessions
if (text.startsWith('/bashes')) {
  const { handleBashCommand } = await import('../tools/bashes.js');
  const result = await handleBashCommand(text);
  setLines(prev => prev.concat(...result));
  return;
}

// /memory - Conversation memory
if (text.startsWith('/memory')) {
  const parts = text.split(/\s+/);
  if (parts[1] === 'clear') {
    await orchestrator.clearMemory();
    setLines(prev => prev.concat('Memory cleared'));
  } else {
    const memory = await orchestrator.getMemory();
    setLines(prev => prev.concat('Memory:', ...memory.map(m => `  ${m}`)));
  }
  return;
}

// /output-style - Style switching
if (text.startsWith('/output-style')) {
  const parts = text.split(/\s+/);
  const styles = ['markdown', 'minimal', 'verbose'];
  if (parts[1] && styles.includes(parts[1])) {
    await setConfigValue('outputStyle', parts[1]);
    setCfg(await loadConfig());
    setLines(prev => prev.concat(`Output style set to ${parts[1]}`));
  } else {
    setLines(prev => prev.concat(`Current style: ${cfg?.outputStyle || 'markdown'}`, 
                                  'Available: markdown, minimal, verbose'));
  }
  return;
}

// /compact - History compaction
if (text === '/compact') {
  const before = orchestrator.getHistory().length;
  orchestrator.compactHistory(20); // Keep last 20 messages
  const after = orchestrator.getHistory().length;
  setLines(prev => prev.concat(`Compacted: ${before} → ${after} messages`));
  return;
}

// /hooks - Hook management
if (text.startsWith('/hooks')) {
  const { manageHooks } = await import('../tools/hooks.js');
  const result = await manageHooks(text);
  setLines(prev => prev.concat(...result));
  return;
}

// /security-review - Security scan
if (text === '/security-review') {
  const { runSecurityReview } = await import('../policies/security.js');
  const issues = await runSecurityReview();
  if (issues.length === 0) {
    setLines(prev => prev.concat('✅ No security issues found'));
  } else {
    setLines(prev => prev.concat('⚠️ Security issues:', ...issues.map(i => `  [${i.severity}] ${i.message}`)));
  }
  return;
}

// /vim - Toggle vim mode
if (text === '/vim') {
  const vimMode = !cfg?.vimMode;
  await setConfigValue('vimMode', String(vimMode));
  setCfg(await loadConfig());
  setLines(prev => prev.concat(`Vim mode ${vimMode ? 'enabled' : 'disabled'}`));
  return;
}

// /upgrade - Provider plan info
if (text === '/upgrade') {
  setLines(prev => prev.concat(
    'GitHub Copilot Plans:',
    '  Individual: $10/month',
    '  Business: $19/user/month',
    '  Enterprise: Contact sales',
    'Visit: https://github.com/features/copilot'
  ));
  return;
}

// /privacy-settings - Privacy settings
if (text.startsWith('/privacy-settings')) {
  const parts = text.split(/\s+/);
  if (parts[1] === 'telemetry' && (parts[2] === 'on' || parts[2] === 'off')) {
    await setConfigValue('telemetry', parts[2] === 'on');
    setLines(prev => prev.concat(`Telemetry ${parts[2]}`));
  } else {
    const telemetry = cfg?.telemetry !== false;
    setLines(prev => prev.concat(
      'Privacy Settings:',
      `  Telemetry: ${telemetry ? 'on' : 'off'}`,
      '  Usage: /privacy-settings telemetry [on|off]'
    ));
  }
  return;
}

// /release-notes - Show changelog
if (text === '/release-notes') {
  const changelog = await fs.readFile('CHANGELOG.md', 'utf8').catch(() => 'No release notes available');
  const lines = changelog.split('\n').slice(0, 50); // First 50 lines
  setLines(prev => prev.concat(...lines));
  return;
}
```

### SG-029: Error Handling Strategy
- **FILES TO MODIFY**: All files with empty catch blocks
- **REQUIRED ACTION**: 
  Replace empty catch blocks with appropriate handling:

```typescript
// For Git status checks (src/tui/app.tsx:152)
} catch (e) {
  // Silent - git not required
}

// For API/Network errors
} catch (e: any) {
  setLines(prev => prev.concat(`❌ Error: ${e?.message || 'Network request failed'}`));
}

// For file operations
} catch (e: any) {
  setLines(prev => prev.concat(`❌ Failed to read/write file: ${e?.message || e}`));
}

// For optional dependencies (keytar, node-pty)
} catch {
  // Silent - optional dependency
}

// For config reading
} catch {
  // Use defaults
  return {};
}
```

### SG-030: /export Implementation
- **FILE TO MODIFY**: `src/runtime/orchestrator.ts`
- **REQUIRED ACTION**:
  Add these methods to the orchestrator object:

```typescript
async exportJSON(file?: string): Promise<void> {
  const data = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    messages: history,
    metrics: metrics,
    context: await getSelected(), // from context.ts
    config: await loadConfig()
  };
  const json = JSON.stringify(data, null, 2);
  if (file) {
    await fs.writeFile(file, json, 'utf8');
  } else {
    console.log(json);
  }
},

async exportMarkdown(file?: string): Promise<void> {
  let md = '# Plato Conversation\n\n';
  md += `Date: ${new Date().toISOString()}\n\n`;
  
  for (const msg of history) {
    if (msg.role === 'user') {
      md += `## User\n${msg.content}\n\n`;
    } else if (msg.role === 'assistant') {
      md += `## Assistant\n${msg.content}\n\n`;
    } else if (msg.role === 'tool') {
      md += `> Tool Result:\n> ${msg.content.replace(/\n/g, '\n> ')}\n\n`;
    }
  }
  
  if (file) {
    await fs.writeFile(file, md, 'utf8');
  } else {
    console.log(md);
  }
},

async exportToClipboard(): Promise<void> {
  const { clipboard } = await import('clipboardy');
  const md = await this.exportMarkdown();
  await clipboard.write(md);
}
```

### SG-031: Session Auto-Save
- **FILE TO MODIFY**: `src/runtime/orchestrator.ts`
- **REQUIRED ACTION**:
  Add debounced session saving:

```typescript
let saveTimer: NodeJS.Timeout | null = null;

async function saveSessionDebounced() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await saveSessionDefault();
  }, 2000); // 2 second debounce
}

// Call saveSessionDebounced() instead of saveSessionDefault() during streaming
// Call saveSessionDefault() immediately after response completion

async function saveSessionDefault() {
  const session = {
    version: '1.0',
    timestamp: Date.now(),
    messages: history.slice(-100), // Last 100 messages
    context: await getSelected(),
    config: await loadConfig(),
    metrics
  };
  
  const json = JSON.stringify(session);
  if (json.length > 10 * 1024 * 1024) { // 10MB limit
    // Rotate: keep last 50 messages
    session.messages = history.slice(-50);
  }
  
  await fs.mkdir('.plato', { recursive: true });
  await fs.writeFile('.plato/session.json', JSON.stringify(session), 'utf8');
}

// Add process exit handler
process.on('SIGINT', async () => {
  await saveSessionDefault();
  process.exit(0);
});
```

### SG-032: MCP Tool Call Handling
- **FILE TO MODIFY**: `src/integrations/mcp.ts` (lines 66-81)
- **REQUIRED ACTION**:
  Implement proper retry logic:

```typescript
export async function callTool(serverId: string, toolName: string, input: any): Promise<any> {
  const servers = await listServers();
  const s = servers.find(x => x.id === serverId);
  if (!s) throw new Error(`no mcp server: ${serverId}`);
  
  console.log(`🔧 Running tool: ${toolName}...`);
  
  const endpoints = [
    `${s.url.replace(/\/$/,'')}/tools/${encodeURIComponent(toolName)}`,
    `${s.url.replace(/\/$/,'')}/.well-known/mcp/tools/${encodeURIComponent(toolName)}`
  ];
  
  let lastErr: any;
  const retryDelays = [1000, 2000, 4000];
  const retryableCodes = [502, 503, 504, 429];
  const nonRetryableCodes = [400, 401, 403, 404];
  
  for (const ep of endpoints) {
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const r = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input })
        });
        
        if (nonRetryableCodes.includes(r.status)) {
          throw new Error(`Tool call failed: ${r.status} ${r.statusText}`);
        }
        
        if (retryableCodes.includes(r.status) && attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
          continue;
        }
        
        if (!r.ok) {
          lastErr = new Error(`status ${r.status}`);
          break;
        }
        
        const data = await r.json();
        console.log('\x1b[90m' + JSON.stringify(data, null, 2) + '\x1b[0m'); // Gray output
        return data;
      } catch (e) {
        lastErr = e;
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
        }
      }
    }
  }
  throw lastErr || new Error('tool call failed');
}
```

### SG-033: Config Type Safety
- **FILE TO MODIFY**: `src/config.ts`
- **REQUIRED ACTION**:
  Add type coercion:

```typescript
export async function setConfigValue(key: string, value: string): Promise<void> {
  // Type coercion based on known keys
  let parsedValue: any = value;
  
  // Boolean fields
  if (['telemetry', 'vimMode', 'autoApply'].includes(key)) {
    parsedValue = value === 'true' || value === 'on';
  }
  // Number fields
  else if (['port', 'timeout', 'maxRetries'].includes(key)) {
    parsedValue = Number(value);
    if (isNaN(parsedValue)) {
      throw new Error(`Invalid value for ${key}: expected number`);
    }
  }
  // JSON fields
  else if (['toolCallPreset', 'statusline', 'editing'].includes(key)) {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      throw new Error(`Invalid value for ${key}: expected valid JSON`);
    }
  }
  
  const cfg = await loadConfig();
  cfg[key] = parsedValue;
  await saveConfig(cfg);
}
```

### SG-034: Patch Sanitization
- **FILE TO MODIFY**: `src/tools/patch.ts`
- **ADD FUNCTION** at the top of the file:

```typescript
function sanitizeDiff(diff: string): string {
  // Remove potential command injection
  diff = diff.replace(/\$\(.+?\)/g, '');
  diff = diff.replace(/`.+?`/g, ''); // Remove backtick command substitution
  
  // Normalize line endings
  diff = diff.replace(/\r\n/g, '\n');
  
  // Strip null bytes and control characters
  diff = diff.replace(/\0/g, '');
  diff = diff.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Control chars except \t \n \r
  
  // Ensure valid UTF-8 by encoding and decoding
  diff = Buffer.from(diff, 'utf8').toString('utf8');
  
  // Validate patch headers don't contain path traversal
  const lines = diff.split('\n');
  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---')) {
      const path = line.slice(4).trim().split(/\s+/)[0];
      if (path.includes('../') || path.includes('..\\') || path.startsWith('/')) {
        throw new Error('Patch contains path traversal attempt');
      }
    }
  }
  
  return diff;
}
```

### SG-035: Git Repository Handling
- **FILE TO MODIFY**: `src/tui/app.tsx`
- **ADD** after line 152 (git status check):

```typescript
useEffect(() => {
  (async () => {
    try {
      const { default: simpleGit } = await import('simple-git');
      const git = simpleGit();
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        setLines(prev => prev.concat(
          '',
          '⚠️  Not a Git repository. Run \'git init\' to enable patch operations.',
          ''
        ));
      }
      const s = await git.status();
      setBranch(s.current || '');
    } catch {
      setLines(prev => prev.concat(
        '',
        '⚠️  Git not available. Install Git to enable patch operations.',
        ''
      ));
    }
  })();
}, []);
```

**MODIFY** `src/tools/patch.ts` ensureGitRepo function:

```typescript
async function ensureGitRepo() {
  const { default: simpleGit } = await import('simple-git');
  const git = simpleGit();
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error('Patch operations require a Git repository. Run \'git init\' first.');
  }
}
```

### SG-036: Tool Call JSON Detection
- **FILE TO MODIFY**: `src/runtime/orchestrator.ts`
- **REPLACE** the tool call detection logic:

```typescript
// In maybeBridgeTool function
async function maybeBridgeTool(content: string, onEvent?: (e: OrchestratorEvent)=>void): Promise<void> {
  // Use strict JSON block detection matching Claude Code
  const toolCallRegex = /```json\s*\n\s*\{\s*"tool_call"\s*:\s*\{[\s\S]*?\}\s*\}\s*\n\s*```/;
  const match = content.match(toolCallRegex);
  
  if (!match) return;
  
  const jsonBlock = match[0];
  const jsonStr = jsonBlock.replace(/```json\s*\n/, '').replace(/\n\s*```/, '');
  
  let toolCall: any;
  try {
    // Parse with timeout protection
    const parsePromise = new Promise((resolve, reject) => {
      try {
        const parsed = JSON.parse(jsonStr);
        resolve(parsed);
      } catch (e) {
        reject(e);
      }
    });
    
    toolCall = await Promise.race([
      parsePromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tool call parse timeout')), 30000)
      )
    ]);
  } catch (e: any) {
    console.error('Failed to parse tool call:', e.message);
    return;
  }
  
  // Validate required fields
  if (!toolCall?.tool_call?.server || !toolCall?.tool_call?.name) {
    console.error('Invalid tool call format: missing server or name');
    return;
  }
  
  // Execute tool call...
  const { server, name, input = {} } = toolCall.tool_call;
  onEvent?.({ type: 'tool-start', message: `Running ${name}...` });
  
  try {
    const result = await callTool(server, name, input);
    history.push({ role: 'tool', content: JSON.stringify(result) });
    onEvent?.({ type: 'tool-end', message: 'Tool completed' });
  } catch (e: any) {
    const error = `Tool failed: ${e?.message || e}`;
    history.push({ role: 'tool', content: error });
    onEvent?.({ type: 'tool-end', message: error });
  }
}
```

### SG-037: Bash Sessions Implementation
- **CREATE FILE**: `src/tools/bashes.ts`

```typescript
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

interface BashSession {
  id: string;
  pid: number;
  process: ChildProcess;
  created: Date;
  cwd: string;
}

const sessions = new Map<string, BashSession>();

export async function handleBashCommand(command: string): Promise<string[]> {
  const parts = command.split(/\s+/);
  const subcommand = parts[1] || 'list';
  
  switch (subcommand) {
    case 'list':
      return listSessions();
    
    case 'new':
      return createSession();
    
    case 'kill':
      const id = parts[2];
      if (!id) return ['Usage: /bashes kill <id>'];
      return killSession(id);
    
    default:
      return ['Usage: /bashes [list|new|kill <id>]'];
  }
}

function listSessions(): string[] {
  if (sessions.size === 0) {
    return ['No active bash sessions'];
  }
  
  const lines = ['Active bash sessions:'];
  for (const [id, session] of sessions) {
    lines.push(`  ${id.slice(0, 8)} - PID: ${session.pid} - Created: ${session.created.toLocaleString()}`);
  }
  return lines;
}

async function createSession(): Promise<string[]> {
  const id = randomUUID();
  const shell = process.env.SHELL || 'bash';
  
  const proc = spawn(shell, ['-i'], {
    cwd: process.cwd(),
    env: { ...process.env, PS1: `[${id.slice(0, 8)}]$ ` }
  });
  
  const session: BashSession = {
    id,
    pid: proc.pid!,
    process: proc,
    created: new Date(),
    cwd: process.cwd()
  };
  
  sessions.set(id, session);
  
  // Log output to file
  const logPath = path.join('.plato', 'bashes', `${id}.log`);
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const logStream = await fs.open(logPath, 'w');
  
  proc.stdout?.on('data', (data) => {
    logStream.write(data);
  });
  
  proc.stderr?.on('data', (data) => {
    logStream.write(data);
  });
  
  proc.on('exit', () => {
    sessions.delete(id);
    logStream.close();
  });
  
  return [`Created bash session: ${id.slice(0, 8)}`];
}

function killSession(id: string): string[] {
  const fullId = Array.from(sessions.keys()).find(k => k.startsWith(id));
  if (!fullId) {
    return [`No session found with ID: ${id}`];
  }
  
  const session = sessions.get(fullId)!;
  session.process.kill();
  sessions.delete(fullId);
  
  return [`Killed session: ${fullId.slice(0, 8)}`];
}

export function killAllSessions() {
  for (const session of sessions.values()) {
    session.process.kill();
  }
  sessions.clear();
}

// Clean up on exit
process.on('exit', killAllSessions);
process.on('SIGINT', killAllSessions);
process.on('SIGTERM', killAllSessions);
```

### SG-038: Hooks System Enhancement
- **FILE TO MODIFY**: `src/tools/hooks.ts`
- **ADD** hook management functionality:

```typescript
import YAML from 'yaml';

interface Hook {
  name: string;
  type: 'pre-prompt' | 'post-response' | 'pre-apply' | 'post-apply';
  command: string;
  timeout?: number;
}

export async function manageHooks(command: string): Promise<string[]> {
  const parts = command.split(/\s+/);
  const subcommand = parts[1] || 'list';
  
  switch (subcommand) {
    case 'list':
      return listHooks();
    
    case 'add':
      if (parts.length < 4) {
        return ['Usage: /hooks add <type> <command>'];
      }
      return addHook(parts[2] as any, parts.slice(3).join(' '));
    
    case 'remove':
      if (!parts[2]) {
        return ['Usage: /hooks remove <name>'];
      }
      return removeHook(parts[2]);
    
    case 'test':
      if (!parts[2]) {
        return ['Usage: /hooks test <name>'];
      }
      return testHook(parts[2]);
    
    default:
      return ['Usage: /hooks [list|add <type> <command>|remove <name>|test <name>]'];
  }
}

async function loadHooks(): Promise<Hook[]> {
  try {
    const content = await fs.readFile('.plato/hooks.yaml', 'utf8');
    return YAML.parse(content)?.hooks || [];
  } catch {
    return [];
  }
}

async function saveHooks(hooks: Hook[]): Promise<void> {
  await fs.mkdir('.plato', { recursive: true });
  await fs.writeFile('.plato/hooks.yaml', YAML.stringify({ hooks }), 'utf8');
}

async function listHooks(): Promise<string[]> {
  const hooks = await loadHooks();
  if (hooks.length === 0) {
    return ['No hooks configured'];
  }
  
  return [
    'Configured hooks:',
    ...hooks.map(h => `  ${h.name} (${h.type}): ${h.command}`)
  ];
}

async function addHook(type: Hook['type'], command: string): Promise<string[]> {
  const hooks = await loadHooks();
  const name = `hook_${Date.now()}`;
  
  hooks.push({
    name,
    type,
    command,
    timeout: 5000
  });
  
  await saveHooks(hooks);
  return [`Added hook: ${name}`];
}

async function removeHook(name: string): Promise<string[]> {
  const hooks = await loadHooks();
  const filtered = hooks.filter(h => h.name !== name);
  
  if (filtered.length === hooks.length) {
    return [`Hook not found: ${name}`];
  }
  
  await saveHooks(filtered);
  return [`Removed hook: ${name}`];
}

async function testHook(name: string): Promise<string[]> {
  const hooks = await loadHooks();
  const hook = hooks.find(h => h.name === name);
  
  if (!hook) {
    return [`Hook not found: ${name}`];
  }
  
  try {
    const { execa } = await import('execa');
    const result = await execa('sh', ['-c', hook.command], {
      timeout: hook.timeout || 5000
    });
    return [`Hook test succeeded:`, result.stdout || '(no output)'];
  } catch (e: any) {
    return [`Hook test failed: ${e?.message || e}`];
  }
}

// Update existing runHooks to show spinner
export async function runHooks(type: string, phase?: string): Promise<void> {
  const hooks = await loadHooks();
  const relevant = hooks.filter(h => h.type === type || h.type === `${type}-${phase}`);
  
  for (const hook of relevant) {
    process.stdout.write(`⏳ Running hook: ${hook.name}...`);
    try {
      const { execa } = await import('execa');
      await execa('sh', ['-c', hook.command], {
        timeout: hook.timeout || 5000
      });
      process.stdout.write('\r✅\n');
    } catch {
      process.stdout.write('\r❌\n');
    }
  }
}
```

## Claude Code UI/UX Requirements

### Welcome Message
- Show exactly: "✻ Welcome to Plato!" (not "Claude Code")
- Follow with: Empty line, then "/help for help, /status for your current setup"

### Status Line Format
- Default: `plato | {provider} | {model} | {tokens} {branch}`
- Support all Claude Code placeholders: provider, model, tokens, branch, cwd, mode, duration, turns
- Update every response

### Input Handling
- Multi-line: Detect Shift+Enter (may need terminal-specific handling)
- Ctrl+C: Cancel streaming response, clear input
- Ctrl+D: Show "Exit? (y/n)" confirmation
- Up/Down arrows: Navigate command history
- Tab: Complete slash commands (show popup with matches)

### Output Formatting
```typescript
// Color codes for exact Claude Code match
const colors = {
  assistant: '\x1b[0m',      // Default
  tool: '\x1b[90m',          // Gray/dim
  error: '\x1b[31m',         // Red
  success: '\x1b[32m',       // Green
  warning: '\x1b[33m',       // Yellow
  info: '\x1b[36m',          // Cyan
  reset: '\x1b[0m'
};

// Apply formatting
setLines(prev => prev.concat(
  colors.error + '❌ Error: ' + message + colors.reset
));
```

### File Write Behavior (Critical for Parity)
- With `/apply-mode auto`:
  ```typescript
  // Don't show patch, just write and confirm
  setLines(prev => prev.concat('📝 Writing hello.py...'));
  await fs.writeFile('hello.py', content);
  setLines(prev => prev.concat('  ✓ Wrote 15 lines to hello.py'));
  ```
- Without auto mode:
  ```typescript
  // Show full diff and wait for /apply
  setLines(prev => prev.concat(
    '--- a/hello.py',
    '+++ b/hello.py',
    '@@ -1,3 +1,4 @@',
    ' def hello():',
    '+    print("Hello, world!")',
    '     return',
    '',
    'Run /apply to apply this patch'
  ));
  ```

## Critical Implementation Notes

1. **Name Replacement**: 
   - Welcome message: "Plato" not "Claude Code"
   - Help text: "Plato is a coding assistant" not "Claude Code is..."
   - Config dir: `.plato/` not `.claude/`

2. **Provider Integration**:
   - Keep using Copilot auth flow
   - Model selection from Copilot's available models
   - Headers must match Copilot requirements

3. **File Structure**:
   ```
   .plato/
   ├── config.yaml        # Main config
   ├── session.json       # Current session
   ├── hooks.yaml         # Hook definitions
   ├── memory/            # Conversation memory
   ├── bashes/            # Bash session logs
   ├── mcp-servers.json   # MCP server registry
   └── patch-journal.json # Applied patches log
   ```

4. **Environment Variables**:
   - `PLATO_CONFIG_DIR` (default: ~/.config/plato)
   - `PLATO_PROJECT_DIR` (default: .plato)
   - `PLATO_DEBUG` (enables console.error logging)

5. **Default Config Values**:
   ```yaml
   provider:
     active: copilot
   model:
     active: gpt-4
   outputStyle: markdown
   vimMode: false
   telemetry: true
   statusline:
     format: "plato | {provider} | {model} | {tokens} {branch}"
   editing:
     autoApply: off
   toolCallPreset:
     enabled: true
   ```

## Testing Requirements for Parity

Each feature MUST be tested for:

1. **Output Format**: Character-perfect match with Claude Code
2. **Command Behavior**: Same flags, same results
3. **Error Messages**: Identical wording and format
4. **Keyboard Shortcuts**: Same keys, same actions
5. **Session Format**: Compatible structure for debugging

## Priority Order for Implementation

1. **P0 (Blocking - Do First)**:
   - SG-034: Add sanitizeDiff() function
   - SG-036: Fix tool call detection regex
   - SG-031: Implement session auto-save with debouncing

2. **P1 (Critical - Do Second)**:
   - SG-028: Implement ALL slash commands
   - SG-037: Create bashes.ts file and implementation
   - SG-035: Add Git repository warnings

3. **P2 (Important - Do Third)**:
   - SG-029: Fix all error handling
   - SG-030: Complete export functions
   - SG-038: Enhance hooks system

4. **P3 (Nice to have - Do Last)**:
   - SG-033: Add config type validation
   - Welcome message and UI polish
   - Color formatting consistency

## Acceptance Criteria

✅ App behaves IDENTICALLY to Claude Code except:
  - Uses "Plato" name
  - Uses Copilot as provider
  - Uses .plato/ directory

✅ All 35 slash commands work and show appropriate output

✅ File writes match Claude Code's immediate-write behavior exactly

✅ Session saves automatically and can be resumed

✅ Error messages match Claude Code's format exactly

✅ Keyboard interactions work identically

✅ Status line updates with all placeholders

✅ Tool calls show gray output and "Running tool:" message

✅ Git warnings appear but don't block operations

✅ Each command outputs EXACTLY what Claude Code would output