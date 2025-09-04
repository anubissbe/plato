# SPEC GAPS — Plato Repo

This document lists all unclear or incomplete areas found during the initial scan. For each item, I’ve proposed possible intents and specific questions. I will not change any code until you confirm the intended behavior for each gap.

Legend: ID = SG-###, Severity = high/medium/low

## Items

1) ID: SG-001 — Patch engine assumes Git repo (no non-git fallback)
- File: `src/tools/patch.ts` (lines 7–31)
- Description: Uses `git apply` for dry-run/apply/revert. In a folder that is not a Git repo (your stated context), these operations will fail. Docs promise 3‑way merge and atomic writes even outside Git.
- Possible intents:
  - A) Require a Git repo. Pros: leverage `git apply`; Cons: breaks for non-git projects.
  - B) Provide a non-git patch applier (pure JS, with optional 3‑way merge). Pros: works everywhere; Cons: more code to maintain.
- Questions:
  1. Should Plato work without Git? If yes, approve implementing a non‑git patch engine (with 3‑way merge when feasible).
  2. If Git is required, should `/apply` clearly error with guidance to `git init`?

2) ID: SG-002 — Mis-nested `/tool-call-preset` handler inside `/add-dir`
- File: `src/tui/app.tsx` (lines ~103–161)
- Description: The `/tool-call-preset` command block is nested inside the `/add-dir` handler (missing closing brace). This makes the preset command unreachable unless the `/add-dir` branch executes and continues, and muddles control flow.
- Possible intents:
  - A) Move `/tool-call-preset` to top-level command routing like others.
  - B) Merge it into `/model` or `/mcp` subcommands.
- Questions:
  1. Confirm we should lift `/tool-call-preset` to its own top-level handler.
  2. Keep current subcommands exactly as docs specify? (status|on|off|strict|heuristics|override|per-model)

3) ID: SG-003 — Duplicate command handlers
- File: `src/tui/app.tsx` (first set lines ~223–261; duplicates later ~240–320 in file)
- Description: `/apply`, `/revert`, `/permissions`, and `/run` handlers appear twice. This risks inconsistent behavior, future drift, and harder debugging.
- Possible intents:
  - A) Keep a single canonical implementation (remove duplicates).
  - B) Extract common helpers to reduce branching inside `App()`.
- Questions:
  1. Confirm we should dedupe to a single instance for each command.
  2. Any preference for extracting command router helpers per command group?

4) ID: SG-004 — Many documented slash commands not yet implemented
- Files: `src/tui/app.tsx`, `src/slash/commands.ts`, `docs/tui/commands.md`
- Description: Commands listed in docs/registry are not wired in TUI: `/statusline`, `/init`, `/agents`, `/bashes`, `/memory`, `/output-style`, `/output-style:new`, `/compact`, `/hooks`, `/security-review` (as a standalone command), `/todos`, `/vim`, `/proxy`, `/upgrade`, `/resume`, `/privacy-settings`, `/release-notes`.
- Possible intents:
  - A) Implement all for v1 parity.
  - B) Phase delivery (prioritize a subset now, others later).
- Questions:
  1. Which commands are in-scope for this milestone? Please list required vs. nice-to-have.
  2. For `/statusline`, confirm the config format and UI (interactive editor vs. flags).
  3. For `/proxy`, confirm start/stop and default port behavior.

5) ID: SG-005 — Credentials storage deviates from spec (plaintext file vs. OS keychain)
- File: `src/providers/copilot.ts`
- Description: Credentials saved to `~/.config/plato/credentials.json`. Docs say OS keychain preferred with file as fallback (and encrypted).
- Possible intents:
  - A) Integrate `keytar` (optional dep) for keychain, fallback to file.
  - B) Keep file-only for now.
- Questions:
  1. Approve adding keychain support via `keytar` when available?
  2. If falling back to file, should we add basic encryption (OS-specific) or accept plaintext?

6) ID: SG-006 — Chat roles and Copilot compatibility for `tool` role
- Files: `src/providers/chat.ts`, `src/runtime/orchestrator.ts`
- Description: Orchestrator appends messages with role `tool`. Need confirmation Copilot Chat Completions accepts that role as-is.
- Possible intents:
  - A) Translate tool results into `assistant` content rather than `tool` role.
  - B) Keep `tool` role and rely on OpenAI-compat handling.
- Questions:
  1. Confirm Copilot API accepts `role: "tool"`. If not, prefer approach A?

7) ID: SG-007 — Model catalog listing/fetching
- Files: `src/tui/app.tsx` (`/model`), `docs/providers/models.md`
- Description: `/model` reads a local config catalog if present; no provider fetch implemented.
- Possible intents:
  - A) Support local curated catalog only (simpler).
  - B) Add provider-driven listing if available, falling back to local.
- Questions:
  1. Should we implement remote model listing for Copilot, or keep config-only for now?

8) ID: SG-008 — Security review is minimal vs. docs
- Files: `src/policies/security.ts`, `docs/policies/security-review.md`
- Description: Current checks are lightweight (env files, rm -rf, chmod 777, secret-ish). Docs suggest broader OWASP/security checks.
- Possible intents:
  - A) Keep minimal v1 checks.
  - B) Expand checks (secret patterns, path escapes, symlink writes) before `/apply`.
- Questions:
  1. Which additional checks are must-have for this milestone?

9) ID: SG-009 — Proxy command missing; proxy features not exposed
- Files: `src/integrations/proxy.ts`, `docs/integrations/proxy.md`, `src/tui/app.tsx`
- Description: Start/stop functions exist, but `/proxy` command is not implemented. Docs mention CORS and rate limits not present.
- Possible intents:
  - A) Implement `/proxy start|stop [--port]` minimal first.
  - B) Add CORS and rate-limit config.
- Questions:
  1. Minimal acceptable scope for `/proxy`? Include CORS/limits now or later?

10) ID: SG-010 — Bashes use non-PTY execa; PTY expected
- Files: `src/tools/bashes.ts`, `docs/tui/bashes.md`
- Description: Uses `execa` (no PTY). Docs imply persistent PTY sessions (optional dep `node-pty`).
- Possible intents:
  - A) Keep simple exec sessions.
  - B) Add PTY sessions via `node-pty` when available.
- Questions:
  1. Implement PTY now (best-effort, optional), or defer?

11) ID: SG-011 — No tests present; coverage target unspecified here
- Files: entire repo; `docs/testing/testing.md` suggests strategy, but there are no tests.
- Description: Acceptance criteria mention coverage ≥ 80% or +10%. Need concrete target and scope.
- Questions:
  1. Target coverage? 80% overall vs. changed lines?
  2. Which modules to prioritize (patch engine, orchestrator, MCP, TUI routing)?

12) ID: SG-012 — Config `plato config set` only supports top-level keys
- Files: `src/cli.ts` (config set), `src/config.ts`
- Description: The setter writes top-level keys only; docs envisage nested items (e.g., `statusline.format`).
- Possible intents:
  - A) Support dotted paths for nested updates.
  - B) Keep as-is; encourage JSON payloads.
- Questions:
  1. Prefer dotted path support (e.g., `plato config set statusline.format "..."`)?

13) ID: SG-013 — Tool-call preset setting vs. bridging behavior
- Files: `src/runtime/orchestrator.ts` (prepareMessages, maybeBridgeTool)
- Description: `toolCallPreset.enabled` only controls the one-liner injection, not whether tool-call parsing/bridging happens. Might not match expectations.
- Possible intents:
  - A) `enabled=false` disables both one-liner and auto-bridging.
  - B) Keep parsing/bridging independent.
- Questions:
  1. Should `enabled=false` also disable auto-bridging entirely?

14) ID: SG-014 — Orchestrator tool-bridge cycles hard-coded to 3
- File: `src/runtime/orchestrator.ts` (loop in `maybeBridgeTool`)
- Description: Max 3 follow-up cycles after tool runs is arbitrary.
- Questions:
  1. Make this configurable (e.g., `toolBridge.max_cycles`), or keep at 3?

15) ID: SG-015 — Token estimate heuristic is crude (bytes/4)
- File: `src/context/context.ts` (`tokenEstimateForFiles`)
- Description: Approximates tokens as bytes/4. This may mislead budgeting.
- Questions:
  1. Accept this heuristic, or switch to a tokenizer for selected models?

16) ID: SG-016 — `X-Initiator` header not toggled when tools are used
- File: `src/providers/copilot.ts`
- Description: Docs suggest `X-Initiator: agent` when tool-calls are present. We always send `user`.
- Questions:
  1. Should we detect tool-call presence and set `X-Initiator: agent` for those requests?

17) ID: SG-017 — Telemetry/cost reporting not implemented beyond counters
- Files: `docs/ops/telemetry.md`, `src/runtime/orchestrator.ts`
- Description: No telemetry pipeline; only token counters. Docs propose opt-in telemetry.
- Questions:
  1. Implement lightweight local telemetry now or defer?

18) ID: SG-018 — `/todos` documented but not wired in TUI
- Files: `src/todos/todos.ts`, `src/tui/app.tsx`, `docs/tui/commands.md`
- Description: Todo scanner exists but no `/todos` handler.
- Questions:
  1. Should `/todos` run a scan across configured roots, list, and allow `:done <id>`?

19) ID: SG-019 — Statusline customization not implemented
- Files: `src/tui/app.tsx`, `docs/tui/statusline.md`
- Description: Statusline is hardcoded; `/statusline` command absent.
- Questions:
  1. Implement placeholder-based format (`{model}`, `{tokens}`, `{branch}`)?
  2. Persist to `statusline.format` in config?

20) ID: SG-020 — Agents, memory, output-style features not implemented
- Files: `src/tui/app.tsx`, `docs/*`
- Description: Docs define `/agents`, `/memory`, `/output-style`, `/output-style:new`; not implemented.
- Questions:
  1. Provide simple file-based storage in `.plato/agents/` and `.plato/memory.*` for v1?

21) ID: SG-021 — Doctor checks are minimal
- Files: `src/ops/doctor.ts`, `docs/ops/doctor.md`
- Description: Only checks for git, rg, and Copilot base URL. Docs call for broader diagnostics (auth, model list, MCP health).
- Questions:
  1. Expand doctor now (auth probe, `/mcp health`, model fetch), or keep minimal?

22) ID: SG-022 — MCP: permissions scope per-server/tool not enforced
- Files: `src/integrations/mcp.ts`, `docs/integrations/mcp.md`, `src/tools/permissions.ts`
- Description: Permissions engine checks `tool: 'mcp'` + `command`, but no per-server tool allowlist integration.
- Questions:
  1. Add per-server allowlists as described in docs (config schema)?

23) ID: SG-023 — Resume/session persistence is partial
- Files: `src/runtime/orchestrator.ts`, `docs/persistence/session.md`
- Description: Export exists, but `/resume` and auto-persist/restore of history not implemented.
- Questions:
  1. Scope `/resume` to restoring last session from `.plato/session.json`?

24) ID: SG-024 — Git helpers minimal vs. docs
- Files: `src/tools/git.ts`, `docs/tools/git.md`
- Description: Only status/diff/commit are implemented; docs mention branching, stash, PR via `gh`.
- Questions:
  1. Which git operations should be in-scope for this milestone?

25) ID: SG-025 — Config precedence/merging depth
- Files: `src/config.ts`
- Description: Shallow merge across top-level sections; nested merges (e.g., `toolCallPreset.overrides`) not deep-merged between global and project.
- Questions:
  1. Keep shallow merge or add deep merge for nested objects?

26) ID: SG-026 — Proxy auth/CORS/rate-limit behavior
- Files: `src/integrations/proxy.ts`, `docs/integrations/proxy.md`
- Description: Proxy ignores Authorization header, no CORS headers, no rate limits.
- Questions:
  1. Should proxy accept any `Authorization` and forward using active provider auth? Add CORS allowlist from config?

27) ID: SG-027 — Command router growth/structure
- Files: `src/tui/app.tsx`
- Description: Large `App()` monolith handling many commands inline; harder to maintain and test.
- Questions:
  1. Approve refactor to a declarative router (map: name -> handler) per docs?


## Global Questions
1. Acceptance metrics: target coverage threshold and list of priority modules for tests.
2. Security posture: which rules are blocking vs. warning for `/apply`? Provide a severity policy.
3. Cross-platform constraints: prioritize Linux/macOS; any Windows support requirements in v1?
4. Telemetry: opt-in by default? If enabled, what fields are permissible to record?
5. Scope of v1 parity: confirm the exact command set we must deliver before stabilization.

## Decisions (from maintainer)
- SG-001: Require Git for patching; show clear error suggesting `git init`.
- SG-002: Lift `/tool-call-preset` to top-level; keep subcommands per docs.
- SG-003: Deduplicate command handlers; single canonical implementation.
- SG-004: Implement parity commands only: `/apply`, `/revert`, `/run`, `/permissions`, `/model`, `/proxy`, `/todos`, `/statusline`.
- SG-005: Use `keytar` if available; fallback to plaintext file (no custom encryption).
- SG-006: Translate `tool` role → `assistant` for Copilot.
- SG-007: Config-only model catalog for now.
- SG-008: Keep minimal security checks (env files, rm -rf, chmod 777, obvious secrets).
- SG-009: Minimal `/proxy start|stop [--port]` (no CORS/rate-limits).
- SG-010: Keep simple `execa` sessions (no PTY yet).
- SG-011: Aim ~70–80% coverage on patch engine, orchestrator, provider; do not block delivery.
- SG-012: Keep top-level `config set` only.
- SG-013: `toolCallPreset.enabled=false` disables auto-bridging entirely.
- SG-014: Keep bridge cycles hard-coded to 3.
- SG-015: Token heuristic bytes/4 is acceptable.
- SG-016: Set `X-Initiator: agent` when tool calls are present.
- SG-017: Telemetry out of scope for now.
- SG-018: Implement `/todos` minimally (scan/list/mark done).
- SG-019: Implement statusline placeholders persisted in config.
- SG-020: Agents/memory/output-style out of scope.
- SG-021: Doctor minimal (git, rg, Copilot auth/base).
- SG-022: Skip MCP per-server allowlists for now.
- SG-023: Implement session restore from `.plato/session.json`.
- SG-024: Keep git helpers minimal (status/diff/commit).
- SG-025: Shallow config merge is fine.
- SG-026: Proxy auth/CORS not needed now.
- SG-027: Keep monolithic router for v1.
