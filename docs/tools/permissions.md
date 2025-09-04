# Permissions Engine

## Goal
Prevent unintended actions. Every tool passes through allow/deny rules with optional confirmation.

## Rule Schema
```yaml
permissions:
  defaults:
    exec: confirm
    fs_patch: allow
    git: confirm
  rules:
    - match: { tool: exec, command: /rm\s+-rf/ }
      action: deny
    - match: { tool: fs_patch, path: '**/.env*' }
      action: confirm
```

## Evaluation
- First matching rule wins; else fall back to `defaults`.
- `action`: allow | deny | confirm.
- Audit log written on confirm/deny.

## UI
- Confirm dialog shows tool + args + impacted files.
- `/permissions` lists and edits rules.
