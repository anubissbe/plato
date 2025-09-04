# MCP Integration

## Overview
Attach external Model Context Protocol servers to expose tools/knowledge.

## Recommended Tool Call Format
Plato encourages the assistant to request tool runs using a compact JSON format to ensure reliable bridging:

```json
{"tool_call": {"server": "<server-id>", "name": "<tool-name>", "input": {}}}
```

- Emit the JSON inside a fenced code block with language `json` and no extra prose.
- Keys must be exactly `server`, `name`, `input`.
- Plato will run the tool (subject to permissions) and stream the follow-up.

### Customizing the one-liner
- Global/project override: in `.plato/config.yaml` set
```yaml
toolCallPreset:
  enabled: true
  strictOnly: true        # accept only fenced JSON tool_call blocks
  allowHeuristics: false  # allow legacy detection when strictOnly=false
  messageOverride: "Tool calls: fenced json with {\"tool_call\":{...}} only, no prose."
  overrides:
    gpt-4o-mini: "Use strict JSON with double quotes inside fenced json block."
    o4-mini: "Emit only {\"tool_call\":{...}} in a fenced json code block."
```
- TUI helpers:
  - `/tool-call-preset on|off`
  - `/tool-call-preset strict on|off`
  - `/tool-call-preset heuristics on|off`
  - `/tool-call-preset override <message...>`
  - `/tool-call-preset per-model <modelId> <message...>`



## Commands
- `/mcp tools [id]`: list available tools for each server.
- `/mcp run <id> <tool> <json>`: run a tool manually with JSON input.

## Commands
- `/mcp`: list/attach/detach servers; health checks.

## Security
- Tools are proxied through permissions engine.
- Per-server allowlist of exposed tools; redact secrets.

## Config
```yaml
mcp:
  servers:
    - id: my-mcp
      url: http://localhost:8719
      tools_allow: [search, fetch]
```
