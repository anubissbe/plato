# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Plato is a Claude Code–compatible terminal AI coding assistant wired to GitHub Copilot. It mirrors Claude Code's CLI/TUI behavior with immediate file writes, concise confirmations, and built-in audit tools (diffs, revert).

## Development Commands

```bash
# Development
npm ci                    # Install dependencies
npm run dev              # Start the TUI in development mode (uses tsx)
npm run build            # Build TypeScript to dist/
npm run start            # Run the built application
npm run typecheck        # Type-check without building

# CLI direct usage (bypassing TUI)
npx tsx src/cli.ts login       # Login to Copilot
npx tsx src/cli.ts logout      # Logout
npx tsx src/cli.ts config get  # Show config
npx tsx src/cli.ts config set <key> <value>  # Set config value
npx tsx src/cli.ts index       # Build context index
```

## TUI Slash Commands

The TUI supports many slash commands (defined in `src/slash/commands.ts`):

- `/doctor` - Diagnose setup and connectivity (verify binaries and Copilot)
- `/login` - GitHub Copilot device flow authentication
- `/status` - Show current configuration and auth status
- `/proxy start --port 11434` - Start local OpenAI-compatible proxy
- `/todos scan` and `/todos list` - Manage TODO items
- `/mcp attach <name> <url>` - Attach MCP server for tool usage
- `/apply` - Apply pending patches (requires Git repository)
- `/revert` - Revert last applied patch
- `/permissions default fs_patch allow` - Enable Claude-style immediate writes
- `/apply-mode auto` - Auto-apply patches for file write parity
- `/resume` - Restore last session from .plato/session.json

## Core Architecture

### Tool-Call Bridge System
The assistant emits tool requests via strict JSON blocks:
```json
{"tool_call": {"server": "<server-id>", "name": "<tool-name>", "input": {}}}
```
- Located in `src/integrations/mcp.ts`
- Permissions enforced via `src/tools/permissions.ts`
- Results appended to conversation for continued streaming

### Patch Engine (`src/tools/patch.ts`)
- Processes unified diffs between `*** Begin Patch` / `*** End Patch` markers
- Requires Git repository (`git apply` under the hood)
- Supports dry-run, apply, and revert operations
- Maintains journal in `.plato/patch-journal.json`

### Provider System
- **Copilot Integration** (`src/providers/copilot.ts`): OAuth device flow, token management
- **Chat Fallback** (`src/providers/chat_fallback.ts`): Switches between Copilot and local providers
- **Proxy Server** (`src/integrations/proxy.ts`): OpenAI-compatible HTTP proxy

### TUI Application (`src/tui/app.tsx`)
- React + Ink terminal interface
- Raw mode input handling for cross-platform compatibility (WSL-friendly)
- Slash command processing and confirmation dialogs
- Session persistence to `.plato/session.json`

### Runtime Orchestrator (`src/runtime/orchestrator.ts`)
- Manages conversation history and metrics
- Bridges tool calls to MCP servers
- Handles patch extraction and auto-application
- Coordinates hooks and security reviews

## Testing & Verification

Follow `docs/verification.md` for end-to-end testing:

1. Start mock MCP server: `npx tsx scripts/mock-mcp.ts`
2. In TUI: `/mcp attach local http://localhost:8719`
3. Enable parity mode: `/permissions default fs_patch allow` then `/apply-mode auto`
4. Test tool calls and immediate file writes

## Key Dependencies

- **ink**: Terminal UI framework (React-based)
- **simple-git**: Git operations wrapper
- **execa**: Process execution for git apply
- **keytar** (optional): OS keychain for credential storage
- **node-pty** (optional): Terminal emulation support

## Important Notes

- Patch operations require a Git repository (run `git init` if needed)
- Credentials stored in OS keychain when available, fallback to `~/.config/plato/credentials.json`
- Session auto-saves to `.plato/session.json` for `/resume` functionality
- Tool-call preset is enabled by default (strict mode optional via `/tool-call-preset strict on`)