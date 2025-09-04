# Copilot Provider & Auth

## Endpoints
- Device code: `https://github.com/login/device/code`
- Access token (device flow): `https://github.com/login/oauth/access_token`
- Copilot token: `https://api.github.com/copilot_internal/v2/token`

## OAuth Device Flow
- Client ID (default): `Iv1.b507a08c87ecfe98` (GitHub Copilot Chat)
- Scope: `read:user` (sufficient for device code and Copilot token exchange)
- Flow: request device code → user enters code → poll access token → exchange for Copilot token.

## Token Exchange
- Request Copilot token with Authorization: `Bearer <oauth_access_token>`
- Response includes `token` and `expires_at` (seconds since epoch). Store: `access=<token>`, `expires=expires_at*1000`, keep `refresh=<oauth_access_token>` for future exchanges.

## Required Headers (Copilot API requests)
- `Authorization: Bearer <Copilot token>`
- `User-Agent: GitHubCopilotChat/0.26.7`
- `Editor-Version: vscode/1.99.3`
- `Editor-Plugin-Version: copilot-chat/0.26.7`
- `Copilot-Integration-Id: vscode-chat`
- `Openai-Intent: conversation-edits`
- `X-Initiator: agent|user` (agent if tool-calls present)
- If vision content: `Copilot-Vision-Request: true`

## Configuration
- `provider.active: copilot`
- `provider.copilot.client_id`: default above; override via `PLATO_COPILOT_CLIENT_ID`.
- `provider.copilot.headers`: override any header; defaults as listed.
- Token storage: OS keychain preferred; fallback encrypted file `~/.config/plato/credentials`.

## Models
- Use Copilot subscription models exposed by the Copilot API. Map short names (e.g., `gpt-4o`, `o3-mini`) to provider IDs if needed.
- `/model` lists known models and marks capability flags (tool-use, vision, token window). Persist selection.

## Notes
- Do not send repository files unless explicitly included in context.
- Retry policy: exponential backoff on 429/5xx; refresh Copilot token on 401.
