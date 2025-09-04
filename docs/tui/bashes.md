# Bashes (PTY Sessions)

## Lifecycle
- Create named sessions; default shell from env.
- Attach/detach; stream stdout/stderr to TUI pane.
- Persist session metadata; logs optional.

## Integration
- `/bashes`: list, switch, kill; set cwd/env per session.
- `/run` may target a session or spawn ephemeral process.

## Safety
- Permissions apply to `exec`; confirm on destructive patterns.
- Output truncation and log rotation for long tasks.
