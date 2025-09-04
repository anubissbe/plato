# Plato Docs

These documents specify Plato’s CLI/TUI, provider integration (Copilot), tool interfaces, and internal systems so implementation can follow directly.

- providers/: Copilot auth, models, headers.
- runtime/: Orchestrator loop, streaming/cancellation.
- context/: Indexing, token budgeting, multi-root.
- tools/: Patch engine, permissions, hooks, git/exec/tests, MCP, proxy.
- tui/: Commands, statusline, bashes/PTY.
- persistence/: Session, export/resume, config schemas.
- ops/: Doctor checks, telemetry/cost.
- release/: Packaging, support matrix.

See ARCHITECTURE.md for the high-level blueprint and DESIGN.md for UX.
