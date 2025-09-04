# Patch Engine Internals

## Inputs
- Assistant proposal: unified diff (apply-patch syntax) or file blocks.
- Safety gate: `/security-review` runs pre-apply.

## Apply
- Dry-run: validate hunks against current workspace; report conflicts.
- 3-way merge: attempt auto-merge when offsets drift.
- Atomic write: temp file + rename; preserve mode bits; normalize EOL per file.
- Journal: record applied chunks for `/revert` and audit.

## Revert
- Maintain stack of applied diffs; revert by index or last N.
- Detect external edits; prompt on partial reversions.

## Edge Cases
- Symlinks and perms: deny writes unless explicitly allowed.
- Binary files: require `/write` confirmation.
- CRLF/LF: detect per-file; keep consistent.
