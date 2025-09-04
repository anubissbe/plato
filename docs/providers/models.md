# Models & Capabilities

## Catalog
- Source: active provider (Copilot). If list API is unavailable, use a curated catalog in config.
- Each entry: `id`, `alias`, `context_window`, `tool_use` (yes/no), `vision` (yes/no), `rate_limits`.

## Selection
- `/model` prints catalog grouped by provider with active selection.
- Persist to `~/.config/plato/config.yaml` → `model.active` and per-project override `.plato/config.yaml`.

## Defaults
- `model.active`: e.g., `gpt-4o`.
- System prompts vary by capability: add tool-use instructions only when supported.

## Token Budget
- Track request tokens vs. `context_window`.
- Visualize in `/context` with per-artifact contribution.

## Config Snippet
```yaml
model:
  active: gpt-4o
  catalogs:
    copilot:
      - id: gpt-4o
        alias: gpt-4o
        context_window: 128000
        tool_use: true
        vision: true
```
