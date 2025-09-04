# Plato – Architecture

## Overview
Plato is a Node.js/TypeScript CLI + TUI that mirrors Claude Code’s UX while integrating with GitHub Copilot for auth and models. It is local-first and tool-augmented, producing safe diffs and gated file operations.

## High-Level Components
- CLI Entrypoint: `plato` binary; subcommands `login`, `logout`, `config`, `index`.
- TUI Renderer: React/Ink (or Blessed) app with panes (chat, diff, context, status).
- Core Orchestrator: Manages turns, tool calls, slash command router, cancellations.
- Model Provider: Copilot client over GitHub Models/Copilot Chat API with streaming.
- Tools Layer: shell runner, git ops, file patcher, search, test runner, PR helper.
- Context Manager: repo index, file sampler, RAG snippets, token budgeting.
- Persistence: config store, keychain tokens, cache (index, embeddings, history).

### Subsystems mapped to Slash Commands
- Status & Statusline: status service aggregates version, provider identity, model, API health, and tool readiness; statusline renderer is configurable and persisted.
- Init: repo introspection generates `PLATO.md` with structure, tech stack, scripts, and entrypoints.
- Agents: YAML/JSON personas stored in `~/.config/plato/agents/` and project `.plato/agents/`; merge and select at runtime.
- Permissions: allow/deny rules by tool, path glob, command regex; enforced at tool boundary with confirm prompts and audit log.
- Context & Add-Dir: multi-root workspace support; explicit include/exclude lists; token budget visualization.
- Bashes: PTY session manager for long-running shells; attach/detach; streaming logs; kill/restart.
- Memory: project-scoped and global memory files influence system prompt; CRUD via `/memory`.
- Output Styles: named style profiles change prompting, verbosity, and UI rendering; custom styles saved under `styles/*.yaml`.
- Cost Tracking: token/cost/duration accounting per turn and session; surface in `/cost` and statusline.
- Doctor: diagnostics runner checks binaries (git, rg), API reachability, auth, model list, MCP server health.
- Compact: summarization pipeline condenses history with a retained summary frame.
- Export: serialize chat and patches to Markdown/JSON; clipboard support (pbcopy/xclip/win32 API).
- MCP: Model Context Protocol client to attach external tools/knowledge; lifecycle: list, attach, detach, health.
- Hooks: event hooks (pre-prompt, post-response, on-apply) load from project and user config; sandboxed exec.
- Security Review: static checks on pending diffs (secrets, deletions, risky commands); blocks `/apply` without confirm.
- TODOs: heuristic + LLM extraction of tasks; stored in `.plato/todos.json`, surfaced in `/todos`.
- Vim Mode: alternate keymap; statusline indicator; persists to config.
- Proxy: local HTTP server implementing OpenAI-compatible Chat Completions; forwards to active provider with auth.
- Upgrade: provider capability/plan probe; deep-link to upgrade flow if supported.
- Resume: session persistence (transcript, context, pending diffs) for pause/resume.
- Privacy Settings: toggles for telemetry, redaction, file inclusion rules; shown in `/privacy-settings`.
- Release Notes: render packaged notes, fallback to remote release feed if enabled.

## Data Flow
1) User prompt or `/command` → Orchestrator.
2) Build context (selected files, diffs, search results, system prompts).
3) Model call (streaming) → tool calls when requested (ReAct style).
4) Tool results → assistant patch/diff proposal.
5) User reviews → `/apply` writes atomically; history records enable `/revert`.
6) Optional pre-apply hooks and `/security-review` gate before write.

## Copilot Integration
- Auth: GitHub OAuth device flow; scopes minimal for models. Store token in OS keychain (Keychain/SecretService/CredMan), fallback to encrypted file in `~/.config/plato/credentials`.
- Models: OpenAI-compatible Chat Completions wrapper to GitHub Models. Configurable model id (e.g., `gpt-4o`, `o3-mini`) via `/model` or `plato config`.
- Endpoints: configured via `~/.config/plato/config.yaml` (base URL, headers).

## Files & Indexing
- Ignore: `.gitignore`, `.platoignore`. Binary and large files excluded.
- Search: ripgrep with JSON output; ranking by path heuristics + recency.
- Optional semantic index: lightweight sqlite + embeddings (background job).

## Git Integration
- Shell `git` (preferred) with dry-run checks. Commands: status, diff, apply, checkout, branch, commit, stash. PR creation via GitHub CLI if available.

## Tools (Built-ins)
- `fs_patch`: apply/revert unified diffs with 3-way merge detection.
- `exec`: sandboxed shell runner (cwd-aware), stream to TUI log.
- `grep`: code search with include/exclude globs.
- `tests`: framework adapters (pytest, npm test, go test) via detectors.
- `git`: porcelain helpers for branch/commit/diff.
 - `mcp`: client adapter to talk to MCP servers.
 - `proxy`: local proxy server starter/stopper.

## Slash Command Router
- Declarative registry: name, args schema, handler, permissions, confirms.
- Autocomplete via file/glob providers and recent context artifacts.
- Mappings maintained to match Claude Code parity; aliases supported.

## Config & Telemetry
- Config file: `~/.config/plato/config.yaml`. Project overrides: `.plato/config.yaml`.
- Telemetry off by default; opt-in. On enable, only anonymous perf metrics.
 - `privacy` section: redaction rules, network egress prompts, export sanitization.

## Security & Privacy
- Redaction middleware (common secrets, `.env` values). Network egress prompt for large payloads. Local sandbox checks on destructive ops.
 - `/security-review` runs before apply if enabled; configurable rule severities.

## Extensibility
- Provider interface: add other OpenAI-compatible backends.
- Tool interface: register new tools; exposed carefully to model via tool schemas.
- Plugin hooks: on-turn, on-apply, on-diff to integrate CI/linting.

## CLI Surface
- `plato` (TUI), `plato login`, `plato logout`, `plato config get|set`, `plato index`.
- Inside TUI: see DESIGN.md Slash Commands for complete list and semantics.

## References
- Providers & Auth: `docs/providers/copilot-auth.md`, `docs/providers/models.md`
- Orchestrator & Streaming: `docs/runtime/orchestrator.md`, `docs/runtime/streaming.md`
- Indexing & Context: `docs/context/indexing.md`
- Tools: `docs/tools/patch-engine.md`, `docs/tools/permissions.md`, `docs/tools/hooks.md`, `docs/tools/git.md`, `docs/tools/exec-tests.md`
- Integrations: `docs/integrations/mcp.md`, `docs/integrations/proxy.md`
- Persistence & Config: `docs/persistence/config-schema.md`, `docs/persistence/session.md`
- Ops: `docs/ops/doctor.md`, `docs/ops/telemetry.md`
- Platforms & Policies: `docs/platforms/cross-platform.md`, `docs/platforms/a11y-i18n.md`, `docs/policies/privacy.md`, `docs/policies/security-review.md`
