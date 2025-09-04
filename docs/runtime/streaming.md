# Streaming, Timeouts, Retries

## Streaming
- Prefer server-sent streams; render as tokens arrive.
- Buffer partial code blocks and diff hunks until syntactically complete.

## Timeouts
- Model request: default 120s; configurable per provider.
- Tool exec: soft timeout with prompt to extend; hard kill on user cancel.

## Retries
- 429/5xx: backoff 0.5s, 1s, 2s, 4s (jitter), max 4.
- 401: refresh Copilot token once, then fail.

## Error Surfacing
- TUI statusline shows transient failures; `/doctor` suggests remediation.
- Keep failure artifacts in session log for debugging/export.
