# Telemetry & Cost

## Telemetry (opt-in)
- Collect anonymous performance metrics: latency, token counts, tool timings.
- No code or prompts; can export local-only stats.

## Cost Tracking
- Per-turn: input/output tokens and estimated cost (if pricing known).
- Session rollups shown in `/cost` and statusline.

## Config
```yaml
telemetry:
  enabled: false
  sample_rate: 1.0
```
