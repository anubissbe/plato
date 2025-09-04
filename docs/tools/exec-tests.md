# Exec & Tests Adapters

## Exec
- `/run <cmd> [--cwd path]` executes in a PTY or child process.
- Stream output to TUI; capture exit code for summarization.

## Tests
- Detect common frameworks: pytest, npm test, go test, cargo test.
- Parse failures; surface actionable summaries and links to files.

## Config
```yaml
exec:
  default_cwd: .
  pty: true
  env: {}
```
