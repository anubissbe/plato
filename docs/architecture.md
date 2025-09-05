**Overview**
- Purpose: Terminal coding assistant CLI with a Claude Code–like UX, but backed by GitHub Copilot (GitHub Models API).
- Scope: Clean-room, minimal feature set focusing on chat and basic sessioning. Excludes proprietary internals (UI, MCP, tools, and plugins) of Claude Code.

**Why Not Copy Claude Code?**
- License: The global package `@anthropic-ai/claude-code` is distributed as a bundled binary with a restrictive license. Reverse engineering or cloning it verbatim would violate those terms.
- Repository: The public GitHub repo primarily contains docs, changelogs, and examples; the application source is not open.

**Observed Distribution (Claude Code)**
- Global install contents (examples):
  - `cli.js` (~9 MB bundled Node CLI executable)
  - `sdk.mjs` + `sdk.d.ts` (public SDK surface; references MCP types and flags like `--model`, `--fallback-model`, `--mcp-config`)
  - `vendor/` assets (e.g., VSIX, IDE plugin jars, ripgrep binaries)
  - CLI options for sessions, MCP tools, model selection, permission modes.
- Inferred architecture:
  - CLI entrypoint parses flags and launches a session.
  - Session manager maintains conversation state, compaction, and permissions.
  - Tooling layer via MCP (Model Context Protocol) for tools, prompts, resources.
  - Provider(s) abstraction for Anthropic (and variants like Bedrock/Vertex), with model aliases.
  - UI layer renders interactive TUI, permission prompts, and streaming output.

**Local Implementation (This Project)**
- Language: TypeScript (ESM)
- Structure:
  - `src/cli.ts`: CLI entry with `--print`, `--model`, `--output-format` flags.
  - `src/config/`: Loads env and defaults (GitHub token, endpoint, default model).
  - `src/core/`:
    - `provider/copilot.ts`: Copilot provider using GitHub Models Chat Completions.
    - `session.ts`: Simple in-memory chat history manager.
    - `types.ts`: Core message and streaming types.
- Provider specifics (Copilot):
  - Endpoint: `https://models.inference.ai.azure.com`
  - Auth: `Authorization: Bearer $GITHUB_TOKEN` (requires Copilot subscription)
  - Model header: `x-ms-model: <model-id>` (e.g., `gpt-4o-mini`)
  - API: `POST /chat/completions` with OpenAI-compatible schema.
  - Streaming: SSE via `eventsource-parser` (implemented; interactive CLI currently uses non-streaming for simplicity).

**Key Design Choices**
- Clean-room: No usage of Anthropic’s bundled SDK or code. Only public behavior and docs inform UX choices.
- Minimal viable CLI: Focus on core chat to validate provider. Flags mirror a subset of Claude Code for familiarity.
- Extensibility: Provider encapsulates all network details; easy to add other providers/tools later.

**How This Maps to Claude Code Concepts**
- Session: Mirrors conversation history management.
- Model selection: `--model` flag analogous to Claude Code’s.
- Printing vs interactive: `--print` for scripting, otherwise enter REPL-like loop.
- Tools/MCP: Not implemented here. In Claude Code, tools are integrated via MCP; we intentionally excluded this proprietary surface for now.

**Running**
- Prerequisites: Node 18+, GitHub Copilot-enabled token in `GITHUB_TOKEN`.
- Commands:
  - `npm install`
  - `npm run dev` (interactive)
  - `npm run build && ./dist/cli.js -p "Explain file foo.ts"`
  - Set model: `--model gpt-4o-mini` (default configurable via `COPILOT_DEFAULT_MODEL`).

**Future Work (Optional)**
- Add streaming to interactive mode.
- Implement a tool abstraction and minimal file-read/edit shell tools.
- Add settings file and permission prompts.
- Add tests for provider and session behaviors.

