# Statusline

## Segments
- `mode` (chat/vim), `model`, `tokens`, `cost`, `branch`, `cwd`, `latency`, `provider`.

## Format
- Template string with placeholders and ANSI-safe width control.
- Example: `"{mode} | {model} | {tokens} | {cost} | {branch}"`.

## Config
```yaml
statusline:
  format: "{mode} | {model} | {tokens} | {cost} | {branch}"
  segments:
    tokens: show_running_total: true
    cost: currency: USD
```

## Commands
- `/statusline`: interactive editor; preview updates live.
