# Hooks API

## Events
- `pre-prompt`: before model call (mutate prompt, inject tools).
- `post-response`: after model response (summarize, annotate).
- `on-apply`: before/after patch apply (lint, format, tests).

## Config
```yaml
hooks:
  pre-prompt:
    - run: scripts/prompt-filter.sh
      timeout_ms: 2000
  on-apply:
    - run: npm run lint
      when: before
    - run: npm test -s
      when: after
```

## Execution
- Runs in project shell, inherits env, read-only by default.
- Timeouts surface non-blocking warnings unless `required: true`.
