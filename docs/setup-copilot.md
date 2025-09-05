**Copilot Setup**
- Requirements: GitHub account with Copilot subscription (or enterprise access to GitHub Models), a token with access to the Models API.
- Env vars:
  - `GITHUB_TOKEN`: Token used for `Authorization: Bearer` (required).
  - `COPILOT_ENDPOINT` (optional): Defaults to `https://models.inference.ai.azure.com`.
  - `COPILOT_DEFAULT_MODEL` (optional): Defaults to `gpt-4o-mini`.

**Quick Start**
- `npm install`
- `export GITHUB_TOKEN=ghp_xxx` (or set via a manager)
- Interactive: `npm run dev`
- One-shot: `npm run dev -- -p --model gpt-4o-mini "Summarize src/cli.ts"`

**Notes**
- Streaming is implemented at the provider level but interactive mode currently uses non-streaming for simplicity.
- If your organization uses a different gateway, set `COPILOT_ENDPOINT` accordingly and keep the `x-ms-model` header model id consistent with your gateway.

