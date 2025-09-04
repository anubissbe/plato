# Session, Export, Resume

## Persistence
- Store transcript, tool outputs, diffs, and metadata under `.plato/session.json`.
- Autorecover on crash; `/resume` restores UI state.

## Export
- `/export --md` produces Markdown with collapsible diffs.
- `/export --json` saves machine-readable transcript and patches.
- Redact secrets per privacy settings.

## Resume
- Rehydrate last active turn; reattach PTY sessions; reload context selection.
