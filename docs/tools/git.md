# Git Integration

## Operations
- Status, diff (staged/unstaged), apply, commit, branch, checkout, stash.
- PR creation via `gh` CLI when available.

## Safety
- Dry-run before apply; confirm rebases/force actions.
- Respect `.gitignore`; exclude generated files unless included.

## Commit Flow
- `/commit [msg]`: propose message (Conventional Commits), stage changes, commit.
- Optionally open editor; include Co-authored-by lines.

## Branching
- `/branch <name>`: create/switch; guard against dirty working tree per config.
