# Plato Documentation - Claude Code Compatible CLI/TUI

## Overview

Plato is an exact behavioral clone of Claude Code's CLI/TUI application, but powered by GitHub Copilot instead of Anthropic's API. It provides an interactive terminal-based AI coding assistant with immediate file writing capabilities, tool integration, and session persistence.

## Table of Contents

1. [Architecture](#architecture)
2. [Installation & Setup](#installation--setup)
3. [Core Features](#core-features)
4. [Slash Commands Reference](#slash-commands-reference)
5. [API Reference](#api-reference)
6. [Configuration](#configuration)
7. [Development Guide](#development-guide)
8. [Claude Code Parity](#claude-code-parity)

## Architecture

### System Components

```
┌─────────────────────────────────────────────────┐
│                   TUI Layer                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────┐ │
│  │ Input Handler│  │ Command Router│  │ Display│ │
│  └─────────────┘  └──────────────┘  └────────┘ │
└─────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────┐
│              Runtime Orchestrator                │
│  ┌──────────┐  ┌─────────┐  ┌───────────────┐  │
│  │ Chat Loop│  │Tool Bridge│ │Session Manager│  │
│  └──────────┘  └─────────┘  └───────────────┘  │
└─────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────┐
│                Provider Layer                    │
│  ┌─────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Copilot │  │Chat Fallback││ Proxy Server │   │
│  └─────────┘  └──────────┘  └──────────────┘   │
└─────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────┐
│                 Tools Layer                      │
│  ┌──────┐  ┌─────┐  ┌──────┐  ┌────────────┐   │
│  │Patch │  │ MCP │  │Bashes│  │Permissions │   │
│  └──────┘  └─────┘  └──────┘  └────────────┘   │
└─────────────────────────────────────────────────┘
```

### Directory Structure

```
plato/
├── src/
│   ├── tui/
│   │   └── app.tsx          # Main TUI React component
│   ├── runtime/
│   │   └── orchestrator.ts  # Core orchestration logic
│   ├── providers/
│   │   ├── copilot.ts       # GitHub Copilot integration
│   │   ├── chat.ts          # Chat completion logic
│   │   └── chat_fallback.ts # Provider switching
│   ├── tools/
│   │   ├── patch.ts         # Git patch operations
│   │   ├── bashes.ts        # Shell session management
│   │   ├── permissions.ts   # Permission system
│   │   └── hooks.ts         # Hook management
│   ├── integrations/
│   │   ├── mcp.ts           # MCP server integration
│   │   └── proxy.ts         # OpenAI proxy server
│   ├── context/
│   │   ├── context.ts       # Context management
│   │   └── indexer.ts       # File indexing
│   ├── ops/
│   │   ├── doctor.ts        # System diagnostics
│   │   └── init.ts          # Project initialization
│   ├── policies/
│   │   └── security.ts      # Security review
│   ├── slash/
│   │   └── commands.ts      # Command registry
│   ├── todos/
│   │   └── todos.ts         # TODO management
│   └── config.ts            # Configuration management
├── .plato/                  # Project-specific data
│   ├── config.yaml          # Project configuration
│   ├── session.json         # Current session state
│   ├── hooks.yaml           # Hook definitions
│   ├── memory/              # Conversation memory
│   ├── bashes/              # Shell session logs
│   └── mcp-servers.json     # MCP server registry
└── ~/.config/plato/         # User configuration
    └── credentials.json     # Copilot credentials
```

## Installation & Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git (required for patch operations)
- GitHub account (for Copilot authentication)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/plato.git
cd plato

# Install dependencies
npm ci

# Build TypeScript
npm run build

# Start the TUI
npm run dev
```

### Initial Setup

1. **Launch Plato**:
   ```bash
   npm run dev
   ```

2. **Run Doctor Check**:
   ```
   /doctor
   ```
   Verifies Git, ripgrep, and system requirements

3. **Authenticate with Copilot**:
   ```
   /login
   ```
   Follow device code flow for GitHub authentication

4. **Enable Claude Code Parity Mode**:
   ```
   /permissions default fs_patch allow
   /apply-mode auto
   ```
   This enables immediate file writing like Claude Code

5. **Verify Setup**:
   ```
   /status
   ```

## Core Features

### 1. Immediate File Writing (Claude Code Parity)

With `/apply-mode auto` enabled, Plato writes files immediately without showing patches:

```
User: Create a Python hello world script
Assistant: I'll create a hello world Python script for you.

📝 Writing hello.py...
  ✓ Wrote 2 lines to hello.py

Done! Created hello.py with a simple hello world program.
```

### 2. Tool Call Bridge

Plato bridges to MCP servers using Claude Code's exact JSON format:

```json
{
  "tool_call": {
    "server": "local",
    "name": "sum",
    "input": {"a": 2, "b": 3}
  }
}
```

Tool results appear in gray text blocks, exactly like Claude Code.

### 3. Session Persistence

Sessions auto-save to `.plato/session.json` with:
- Complete conversation history
- Token metrics
- Context files
- Configuration snapshot

Resume with:
```
/resume
```

### 4. Patch Engine

For Git repositories, Plato can apply unified diffs:
- Sanitized for security
- Applied via `git apply`
- Journaled for reverting
- Path traversal protection

### 5. Multi-Provider Support

- **Primary**: GitHub Copilot (OAuth device flow)
- **Fallback**: Local providers
- **Proxy**: OpenAI-compatible HTTP endpoint

## Slash Commands Reference

### Essential Commands

| Command | Description | Claude Code Parity |
|---------|-------------|-------------------|
| `/help` | Show all commands | ✅ Exact match |
| `/status` | Show current setup | ✅ Exact match |
| `/login` | Authenticate with Copilot | ✅ Same flow |
| `/logout` | Clear credentials | ✅ Exact match |
| `/doctor` | Diagnose system | ✅ Same checks |

### File Operations

| Command | Description | Example |
|---------|-------------|---------|
| `/apply` | Apply pending patch | `/apply` |
| `/revert` | Revert last patch | `/revert` |
| `/apply-mode` | Toggle auto-apply | `/apply-mode auto` |
| `/diff` | Show pending patch | `/diff` |

### Configuration

| Command | Description | Example |
|---------|-------------|---------|
| `/model` | Switch AI model | `/model set gpt-4` |
| `/statusline` | Customize status | `/statusline set "plato \| {model}"` |
| `/permissions` | Manage permissions | `/permissions default fs_patch allow` |
| `/privacy-settings` | Privacy controls | `/privacy-settings telemetry off` |

### Context Management

| Command | Description | Example |
|---------|-------------|---------|
| `/context` | Manage file context | `/context add *.js` |
| `/add-dir` | Add directory | `/add-dir src/` |
| `/init` | Generate PLATO.md | `/init` |
| `/compact` | Compact history | `/compact` |

### Development Tools

| Command | Description | Example |
|---------|-------------|---------|
| `/todos` | Manage TODOs | `/todos scan` |
| `/bashes` | Shell sessions | `/bashes new` |
| `/hooks` | Manage hooks | `/hooks add pre-prompt "echo start"` |
| `/security-review` | Security scan | `/security-review` |

### MCP Integration

| Command | Description | Example |
|---------|-------------|---------|
| `/mcp` | Manage MCP servers | `/mcp attach local http://localhost:8719` |
| `/proxy` | OpenAI proxy | `/proxy start --port 11434` |
| `/run` | Execute command | `/run npm test` |

### Session Management

| Command | Description | Example |
|---------|-------------|---------|
| `/resume` | Resume session | `/resume` |
| `/export` | Export conversation | `/export --json session.json` |
| `/cost` | Show token usage | `/cost` |
| `/memory` | View memory | `/memory clear` |

### UI/UX Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/output-style` | Change output style | `/output-style minimal` |
| `/vim` | Toggle vim mode | `/vim` |
| `/keydebug` | Debug key input | `/keydebug` |

### Information

| Command | Description | Example |
|---------|-------------|---------|
| `/upgrade` | Plan information | `/upgrade` |
| `/release-notes` | Show changelog | `/release-notes` |
| `/agents` | Agent management | `/agents` (placeholder) |

## API Reference

### Orchestrator API

```typescript
interface Orchestrator {
  // Core conversation methods
  respond(input: string): Promise<string>;
  respondStream(input: string, onDelta: (delta: string) => void): Promise<string>;
  
  // Session management
  exportJSON(file?: string): Promise<void>;
  exportMarkdown(file?: string): Promise<void>;
  importJSON(file: string): Promise<void>;
  
  // History management
  getHistory(): Message[];
  compactHistory(keep: number): void;
  clearMemory(): void;
  
  // Metrics
  getMetrics(): {
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    turns: number;
  };
  
  // Patch management
  getPendingPatch(): string | null;
  clearPendingPatch(): void;
}
```

### MCP Server API

```typescript
interface McpServer {
  id: string;
  url: string;
}

interface McpTool {
  id: string;
  name: string;
  description?: string;
  input_schema?: any;
}

// Server management
async function attachServer(id: string, url: string): Promise<void>;
async function detachServer(id: string): Promise<void>;
async function listServers(): Promise<McpServer[]>;

// Tool operations
async function listTools(serverId?: string): Promise<{ server: string; tools: McpTool[] }[]>;
async function callTool(serverId: string, toolName: string, input: any): Promise<any>;
```

### Patch Engine API

```typescript
// Patch operations (requires Git repository)
async function dryRunApply(diff: string): Promise<{ ok: boolean; conflicts: string[] }>;
async function apply(diff: string): Promise<void>;
async function revert(diff: string): Promise<void>;
async function revertLast(): Promise<boolean>;

// Sanitization
function sanitizeDiff(diff: string): string;
```

### Permission System API

```typescript
interface Permissions {
  defaults?: Record<string, 'allow' | 'deny' | 'confirm'>;
  rules?: Rule[];
}

interface Rule {
  match: {
    tool?: string;
    path?: string;
    command?: string;
  };
  action: 'allow' | 'deny' | 'confirm';
}

async function checkPermission(request: {
  tool: string;
  path?: string;
  command?: string;
}): Promise<'allow' | 'deny' | 'confirm'>;
```

## Configuration

### Global Configuration
Location: `~/.config/plato/config.yaml`

```yaml
provider:
  active: copilot
  copilot:
    client_id: Iv1.b507a08c87ecfe98
    
model:
  active: gpt-4
  catalogs:
    copilot: 
      - id: gpt-4
      - id: gpt-3.5-turbo
      
outputStyle: markdown  # markdown | minimal | verbose
vimMode: false
telemetry: true

statusline:
  format: "plato | {provider} | {model} | {tokens} {branch}"
  
editing:
  autoApply: off  # off | on
  
toolCallPreset:
  enabled: true
  strictOnly: false
  allowHeuristics: false
```

### Project Configuration
Location: `.plato/config.yaml`

```yaml
permissions:
  defaults:
    fs_patch: allow
    exec: confirm
    mcp: allow
  rules:
    - match:
        tool: exec
        command: "rm.*"
      action: deny
      
context:
  roots:
    - src/
    - tests/
  selected:
    - src/main.js
    - src/utils.js
```

## Development Guide

### Building from Source

```bash
# Install dependencies
npm ci

# Run TypeScript compiler
npm run build

# Start development mode
npm run dev

# Type checking
npm run typecheck
```

### Adding New Slash Commands

1. Register in `src/slash/commands.ts`:
```typescript
export const SLASH_COMMANDS: SlashCommand[] = [
  { name: '/mycommand', summary: 'My new command' },
  // ...
];
```

2. Implement handler in `src/tui/app.tsx`:
```typescript
if (text === '/mycommand') {
  setLines(prev => prev.concat('Executing my command...'));
  // Implementation
  return;
}
```

### Creating MCP Servers

MCP servers provide tool functionality. Example server:

```javascript
// mock-mcp.js
const http = require('http');

const tools = [
  {
    id: 'echo',
    name: 'echo',
    description: 'Echo input back',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  }
];

const server = http.createServer((req, res) => {
  if (req.url === '/tools' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tools }));
  } else if (req.url === '/tools/echo' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { input } = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ output: input.message }));
    });
  }
});

server.listen(8719);
```

### Testing

```bash
# Run verification guide
npx tsx scripts/mock-mcp.ts  # Start mock server
# In TUI:
/mcp attach local http://localhost:8719
/mcp tools
```

## Claude Code Parity

### Exact Behavioral Match

Plato matches Claude Code exactly in:

1. **Output Format**
   - Welcome message: "✻ Welcome to Plato!"
   - Status line: `plato | {provider} | {model} | {tokens} {branch}`
   - Error formatting with color codes
   - Tool call gray text blocks

2. **File Operations**
   - Immediate writes with `/apply-mode auto`
   - Same "📝 Writing..." format
   - Unified diff display without auto mode

3. **Keyboard Interactions**
   - Ctrl+C: Cancel operation
   - Ctrl+D: Exit confirmation
   - Arrow keys: History navigation
   - Tab: Command completion

4. **Session Format**
   - Auto-save after responses
   - 10MB file size limit with rotation
   - Compatible JSON structure

### Differences from Claude Code

| Feature | Claude Code | Plato |
|---------|------------|-------|
| Provider | Anthropic API | GitHub Copilot |
| Name | Claude Code | Plato |
| Config Dir | `.claude/` | `.plato/` |
| Env Vars | `CLAUDE_*` | `PLATO_*` |
| Default Model | Claude models | Copilot models |

### Migration from Claude Code

1. **Session Import**: Sessions are compatible, just copy `.claude/session.json` to `.plato/session.json`

2. **Config Migration**: Update paths from `.claude/` to `.plato/` in any scripts

3. **Environment Variables**: Replace `CLAUDE_` prefixed vars with `PLATO_`

## Troubleshooting

### Common Issues

**Git Not Found**
```
⚠️ Not a Git repository. Run 'git init' to enable patch operations.
```
Solution: Initialize Git or install Git if missing

**Copilot Authentication Failed**
```
/login
# Follow device code flow
/status  # Verify authentication
```

**Tool Call Not Working**
- Ensure tool call preset is enabled: `/tool-call-preset on`
- Check MCP server health: `/mcp health`
- Verify JSON format matches exactly

**Session Not Saving**
- Check `.plato/` directory permissions
- Verify disk space for session file
- Session auto-rotates at 10MB

### Debug Mode

Enable debug logging:
```bash
PLATO_DEBUG=1 npm run dev
```

## Support

- GitHub Issues: [github.com/yourusername/plato/issues](https://github.com/yourusername/plato/issues)
- Documentation: This file
- Verification: Run `/doctor` for diagnostics

## License

MIT License - See LICENSE file for details