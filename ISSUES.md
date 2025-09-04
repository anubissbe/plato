# ISSUES

Status key: OPEN (unresolved), BLOCKED (needs decision), CLOSED (fixed)

| ID | File | Line(s) | Type | Severity | Status | Summary |
|----|------|---------|------|----------|--------|---------|
| SG-001 | src/tools/patch.ts | 7-31 | SPEC_GAP | high | CLOSED | Now errors clearly if not a Git repo; suggests `git init`. |
| SG-002 | src/tui/app.tsx | ~103-161 | SPEC_GAP | high | CLOSED | `/tool-call-preset` moved to top-level routing. |
| SG-003 | src/tui/app.tsx | ~223-320 | SPEC_GAP | high | CLOSED | Duplicate handlers removed; single canonical implementation kept. |
| SG-004 | src/tui/app.tsx | N/A | SPEC_GAP | high | OPEN | Many documented slash commands not implemented. |
| SG-005 | src/providers/copilot.ts | N/A | SPEC_GAP | high | CLOSED | Keytar-backed storage added with plaintext file fallback. |
| SG-006 | src/providers/chat.ts | N/A | SPEC_GAP | medium | CLOSED | `tool` role translated to `assistant` when sending to Copilot. |
| SG-007 | src/tui/app.tsx | N/A | SPEC_GAP | medium | OPEN | `/model` catalog: provider fetch vs. config-only not defined. |
| SG-008 | src/policies/security.ts | N/A | SPEC_GAP | medium | OPEN | Security review minimal vs. docs; missing checks. |
| SG-009 | src/integrations/proxy.ts | N/A | SPEC_GAP | medium | CLOSED | `/proxy start|stop [--port]` added (no CORS/rate-limits per v1 scope). |
| SG-010 | src/tools/bashes.ts | N/A | SPEC_GAP | medium | OPEN | No PTY; uses execa rather than node-pty. |
| SG-011 | repo | N/A | SPEC_GAP | high | OPEN | No tests; coverage target unspecified. |
| SG-012 | src/cli.ts, src/config.ts | N/A | SPEC_GAP | medium | OPEN | `config set` supports only top-level keys. |
| SG-013 | src/runtime/orchestrator.ts | N/A | SPEC_GAP | medium | CLOSED | `enabled=false` now disables auto-bridging entirely. |
| SG-014 | src/runtime/orchestrator.ts | N/A | SPEC_GAP | low | OPEN | Tool-bridge cycles hard-coded to 3. |
| SG-015 | src/context/context.ts | N/A | SPEC_GAP | low | OPEN | Token estimate uses bytes/4 heuristic. |
| SG-016 | src/providers/copilot.ts | N/A | SPEC_GAP | medium | CLOSED | `X-Initiator` set to `agent` for follow-up after tool calls. |
| SG-017 | docs/ops/telemetry.md | N/A | SPEC_GAP | medium | OPEN | Telemetry not implemented; cost reporting basic. |
| SG-018 | src/todos/todos.ts, src/tui/app.tsx | N/A | SPEC_GAP | medium | CLOSED | `/todos` implemented: scan/list/done. |
| SG-019 | src/tui/app.tsx | N/A | SPEC_GAP | medium | CLOSED | `/statusline show|set` implemented with placeholder format. |
| SG-020 | src/tui/app.tsx | N/A | SPEC_GAP | medium | OPEN | `/agents`, `/memory`, `/output-style` features missing. |
| SG-021 | src/ops/doctor.ts | N/A | SPEC_GAP | medium | OPEN | Doctor checks minimal vs. docs. |
| SG-022 | src/integrations/mcp.ts | N/A | SPEC_GAP | medium | OPEN | MCP per-server/tool allowlist not enforced via permissions. |
| SG-023 | src/runtime/orchestrator.ts | N/A | SPEC_GAP | medium | CLOSED | Auto-saves to `.plato/session.json`; `/resume` restores.
| SG-024 | src/tools/git.ts | N/A | SPEC_GAP | medium | OPEN | Git helpers minimal (branch/stash/PR missing). |
| SG-025 | src/config.ts | N/A | SPEC_GAP | low | OPEN | Shallow config merges; nested merges unspecified. |
| SG-026 | src/integrations/proxy.ts | N/A | SPEC_GAP | medium | OPEN | Proxy auth/CORS/rate-limit behavior unspecified. |
| SG-027 | src/tui/app.tsx | N/A | SPEC_GAP | medium | OPEN | Command router monolith; refactor to declarative router? |
