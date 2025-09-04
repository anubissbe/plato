# Verification Guide (Copilot + Tool-Bridge)

This guide walks through logging into Copilot and validating the end-to-end tool-call bridge with a mock MCP server.

Prereqs
- Node.js 18+
- `npm ci`

1) Start Plato
- `npm run dev`
- In the TUI, run `/doctor` to confirm basic checks.

2) Login with Copilot
- In the TUI, run `/login` and follow the device code instructions.
- Re-run `/doctor` — you should see `copilot auth — <your-username>`.

3) Start a Mock MCP Server
- In a separate terminal: `npx tsx scripts/mock-mcp.ts`
- In the TUI: `/mcp attach local http://localhost:8719`
- Optional: `/mcp tools` should list `echo` and `sum`.

4) Ensure Tool-Call Preset is Enabled
- `/tool-call-preset status` (enabled by default)
- If disabled: `/tool-call-preset on`
- Strict mode is fine: `/tool-call-preset strict on`

5) Trigger a Tool Call (Assistant)
Send a prompt asking the assistant to use the tool:
- Example prompt: `Use the MCP tool 'sum' from server 'local' to add 2 and 3.`

The system injects a one-liner: the assistant should produce a fenced `json` block like:
```json
{"tool_call": {"server": "local", "name": "sum", "input": {"a": 2, "b": 3}}}
```

When the block appears, you should see TUI lines:
- `tool: Running local:sum`
- `tool: done`

Then the assistant continues with the result (e.g., `5`).

6) Patch Engine Check (optional)
- In a non-git folder, `/apply` will fail with a clear message.
- In a git repo, diffs proposed by the assistant can be previewed via `/diff` then applied via `/apply`.

7) Proxy Check (optional)
- `/proxy start --port 11434` and then `/proxy stop`.

Notes
- If the assistant doesn’t emit the tool_call JSON, try prompting explicitly: “Output only a fenced json block with a tool_call to local:sum for a=2,b=3”.
- `/tool-call-preset off` disables auto-bridging; `/tool-call-preset on` re-enables it.
