# OpenAI-Compatible Proxy

## Purpose
Expose a local `/v1/chat/completions` endpoint backed by the active provider.

## API
- Start: `/proxy start [--port 11434]`.
- Stop: `/proxy stop`.
- Auth: accepts `Authorization: Bearer <any>` and maps to active provider.

## Behavior
- Streams responses; translates provider formats to OpenAI schema.
- Rate limits and CORS configurable.

## Config
```yaml
proxy:
  port: 11434
  cors: ["http://localhost:3000"]
  rate_limit_rps: 3
```
