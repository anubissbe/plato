**What We Can Inspect**
- Global package path: `/usr/lib/node_modules/@anthropic-ai/claude-code` (on this machine).
- Entrypoints and assets:
  - `cli.js`: bundled Node CLI (proprietary, minified).
  - `sdk.mjs` + `sdk.d.ts`: public SDK entry (typed surface hints usage patterns).
  - `vendor/`: VSIX, JetBrains plugin jars, ripgrep binaries, WASM asset (`yoga.wasm`).
  - `package.json`: `bin: { claude: cli.js }`, `type: module`, no direct runtime deps (binaries bundled).

**CLI Surface (observed via `claude --help`)**
- Modes: interactive TUI or non-interactive (`--print`).
- Key flags:
  - `--model` and `--fallback-model`
  - `--append-system-prompt`, `--settings`, `--session-id`
  - Permissions: `--permission-mode`, `--dangerously-skip-permissions`
  - Tool access filters: `--allowed-tools`, `--disallowed-tools`
  - MCP: `--mcp-config`, `--strict-mcp-config`, `--debug`
  - IDE attach: `--ide`
  - Session mgmt: `--continue`, `--resume`

**SDK Hints (`sdk.mjs`)**
- Accepts `prompt` as string or stream; supports streaming I/O (`stream-json`).
- Integrates MCP server registry and tool calling (`tools/list`, `tools/call`, `prompts/list`).
- Manages model preferences and aliases; validates fallback model logic.
- Emits/handles permission prompts, workspace trust, and tool policies.

**Inferred Architecture**
- CLI layer: parses flags, boots session and UI renderer.
- Session manager: maintains history with compaction and fallback logic.
- Provider abstraction: routes to Anthropic console, Bedrock, Vertex, possibly via pluggable backends.
- MCP integration: registers tools/prompts/resources; exposes local/project/user scopes.
- Permissions/Policies: filters tool execution; supports plan/accept modes.
- TUI: keyboard/mouse handling, themes, streaming display, selection states.
- IDE integrations: VS Code (`.vsix`) and JetBrains (jar set), likely connecting via socket/HTTP/SSE.

**Security Model (observed)**
- Permission prompts before edits/exec.
- Workspace trust gate (auto-skipped for `--print`).
- Environment flags: `MCP_TIMEOUT`, `MCP_TOOL_TIMEOUT` (from changelog).

**Why we don’t replicate internals**
- License forbids reverse engineering or redistribution of proprietary code.
- The repo does not publish source, only binaries and SDK surface.

**Outcome**
- We built a clean-room, minimal CLI compatible with the GitHub Copilot provider, preserving the familiar `--print` and `--model` affordances. See `docs/architecture.md` for mapping.

