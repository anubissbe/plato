# Tool Calls Best Practices

## One-Liner Contract
- Always request tools with a fenced `json` code block containing only:

```json
{"tool_call": {"server": "<server-id>", "name": "<tool-name>", "input": {}}}
```

- No prose in the block. Use valid JSON (double quotes, no comments, no trailing commas).
- Continue your answer after Plato executes the tool and returns results.

## Model-Specific Notes
- OpenAI/GitHub Models (gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, o3-mini, o4-mini):
  Keep JSON strict; fenced `json` language hint helps.
- Anthropic (Claude):
  Use a single fenced JSON block; no extra text inside the block.
- Google (Gemini):
  Strict JSON in fenced block; avoid commentary.

## Customizing the One-Liner
- Global/project config in `.plato/config.yaml`:
```yaml
toolCallPreset:
  enabled: true
  strictOnly: true
  allowHeuristics: false
  messageOverride: "Tool calls: fenced json {\"tool_call\":{...}} only; no prose."
  overrides:
    gpt-4o-mini: "Use strict JSON with double quotes in a fenced json block."
    o4-mini: "Emit only {\"tool_call\":{...}} in a fenced json code block."
```
- TUI helpers:
  - `/tool-call-preset on|off`
  - `/tool-call-preset strict on|off`
  - `/tool-call-preset heuristics on|off`
  - `/tool-call-preset override <message...>`
  - `/tool-call-preset per-model <modelId> <message...>`
