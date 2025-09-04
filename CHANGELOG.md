# Changelog

## v1.0.0 – Claude-Code Parity (Copilot-backed)

Highlights
- Git-required patch engine with clear failure message (suggests `git init`).
- Copilot auth via device flow; keytar-backed credentials with plaintext fallback.
- Tool-call bridge cleaned up: strict JSON one-liner, permissions, headers, and cycles.
- Minimal parity commands: `/apply`, `/revert`, `/run`, `/permissions`, `/proxy`, `/todos`, `/statusline`, `/resume`.
- Doctor includes Copilot auth status.
- Statusline placeholders persisted to config; session auto-save + `/resume` restore.

Notes
- MCP integration via HTTP shim; bridging requires tool_call JSON from assistant.
- Non-git patch engine, PTY sessions, broader commands, and telemetry are deferred.

Verification
- See `docs/verification.md` for Copilot login and an end-to-end tool_call walkthrough.
