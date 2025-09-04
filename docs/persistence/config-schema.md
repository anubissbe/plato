# Config Schemas

## Global Config `~/.config/plato/config.yaml`
```yaml
provider:
  active: copilot
  copilot:
    client_id: ${PLATO_COPILOT_CLIENT_ID:-Iv1.b507a08c87ecfe98}
    headers:
      User-Agent: GitHubCopilotChat/0.26.7
model:
  active: gpt-4o
permissions: {}
hooks: {}
statusline:
  format: "{mode} | {model} | {tokens} | {cost} | {branch}"
```

## Project Config `.plato/config.yaml`
- Overrides any global key; merged shallow by section.

## Agents `~/.config/plato/agents/*.yaml`
```yaml
id: reviewer
system: |
  You are a strict code reviewer.
style:
  tone: concise
```

## Output Styles `~/.config/plato/styles/*.yaml`
```yaml
id: code-first
rules:
  prefer_code_blocks: true
  include_diffs: true
```
