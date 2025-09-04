# Testing Strategy

## Unit
- Tools: fs_patch, exec, grep, tests, git.
- Provider: Copilot client (mock HTTP), token refresh logic.

## Integration
- Patch engine writes to temp repos; verify diffs and reverts.
- PTY manager with short-lived sessions.

## E2E
- TUI flows via Ink testing library; scripted `/` commands.
- Golden transcripts for common scenarios.

## CI
- Linux/macOS runners; Windows smoke tests.
- Deterministic snapshots and seeded randomness.
