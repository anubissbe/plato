# Plato CLI/TUI – Design

## Product Goals
- Parity with Claude Code’s terminal agent experience, renamed to `plato`.
- Sign-in with GitHub Copilot; use Copilot subscription models.
- Safe, local-first edits with tight git integration and fast iteration.

## UX Overview
- Single-command entry: `plato` opens a full-screen TUI with chat + context.
- Panes: chat thread, file diff preview, context sidebar (files, branch, model).
- Modes: interactive chat, command palette (`/`), quick actions, background tasks.

## Core Features
- Chat-driven coding: propose patches, diffs, refactors, explanations.
- Repo awareness: index files, respect `.gitignore` + `.platoignore`.
- Tooling: run shell, tests, and git operations with confirmation gates.
- Apply/revert: preview unified diffs; apply atomically; undo/redo history.
- Context control: add/remove files, search results, and diffs to the prompt.
- Auth + Models: GitHub Copilot device login; select Copilot models; stream.

## Slash Commands (TUI)
- /help — Show help and list all commands
- /status — Show Plato status: version, provider, model, account, API connectivity, tool statuses
- /statusline — Configure the statusline display
- /init — Initialize a PLATO.md file with codebase documentation
- /agents — Manage agent configurations (personas, roles)
- /permissions — Manage allow/deny tool permission rules
- /model — List available models from all providers and switch active model
- /context — Manage context (show, add/remove files, include/exclude dirs, visualize token usage)
- /add-dir — Add a new working directory to context
- /bashes — List and manage around-shell sessions
- /memory — View, edit, or reset memory (project and global)
- /output-style — Set or switch output style (concise, verbose, code-first, etc.)
- /output-style:new — Create a custom output style
- /cost — Show total tokens, cost, and duration of session
- /doctor — Diagnose and verify installation, API connectivity, provider setup, MCP servers
- /compact — Compact conversation history, keeping a summary to save tokens
- /export — Export the current conversation to file or clipboard
- /mcp — Manage MCP servers (list, attach, detach, health check)
- /login — Authenticate with a provider (API key or OAuth)
- /logout — Logout from a provider and clear credentials
- /hooks — Manage hook configurations for tool events (pre-prompt, post-response, on-apply)
- /security-review — Review pending file changes for safety before applying
- /todos — Generate and list TODO items inferred from context
- /vim — Toggle between Vim editing mode and normal mode
- /proxy — Start an OpenAI-compatible HTTP proxy backed by the active provider
- /upgrade — Upgrade to a higher plan (if provider supports Pro/Max)
- /resume — Resume a paused conversation
- /privacy-settings — View and update privacy settings
- /release-notes — Show Plato release notes

## Additional UX Details
- Agents & memory: switch personas, maintain project/global memory influencing system prompts.
- Output styles: control response tone/format; custom styles saved to config.
- Bashes: persistent shell sessions for long-running tasks; attach/detach.

## Keybinds
- Enter: send. Ctrl-L: clear. Tab: autocomplete `/<cmd>` and file paths.
- Ctrl-D: diff panel toggle. Ctrl-A: apply. Ctrl-R: retry. Ctrl-C: cancel task.

## Safety & Privacy
- Never uploads files unless included in context; shows token usage.
- Redacts secrets; honors `.platoignore`. Confirmation before writes/network.

## Performance
- Ripgrep for search; chunked file loading; streaming UI; incremental index cache.

## Non-Goals (v1)
- No remote execution or container orchestration; local-only runtime.

## Further Reading
- Providers: `docs/providers/copilot-auth.md`, `docs/providers/models.md`
- Orchestrator/Streaming: `docs/runtime/orchestrator.md`, `docs/runtime/streaming.md`
- Patch/Permissions/Hooks: `docs/tools/patch-engine.md`, `docs/tools/permissions.md`, `docs/tools/hooks.md`
- TUI: `docs/tui/commands.md`, `docs/tui/statusline.md`, `docs/tui/bashes.md`
