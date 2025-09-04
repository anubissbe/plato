# Privacy Settings

## Controls
- Never send files unless explicitly included.
- Redact secrets: `.env*` keys, tokens, passwords.
- Prompt before large network egress.

## Config
```yaml
privacy:
  redact: true
  prompt_on_large_payloads: true
  max_payload_mb: 2
```

## Commands
- `/privacy-settings`: view/update; show current redaction rules.
