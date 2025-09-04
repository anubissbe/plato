# Slash Commands

Complete command list and semantics (see DESIGN.md for overview):

- `/help`: List commands and keybinds.
- `/status`: Show version, provider, model, account, API, tool statuses.
- `/statusline`: Configure statusline (segments, format); persists to config.
- `/init`: Generate `PLATO.md` with codebase structure and scripts.
- `/agents`: List/select personas; create/edit profiles.
- `/permissions`: Show/edit permission rules; test a command/file.
- `/model`: List models; `--set <id>` to switch.
- `/context`: Show/add/remove files/dirs; visualize token usage.
- `/add-dir <path>`: Add workspace root; reindex.
- `/bashes`: Manage PTY sessions (new/list/attach/kill).
- `/memory`: View/edit/reset project/global memory.
- `/output-style [name]`: Switch style; `:new` to create.
- `/cost`: Show token, cost, duration rollups.
- `/doctor`: Run diagnostics (binaries, auth, APIs, MCP).
- `/compact`: Summarize history; keep pinned messages.
- `/export [--md|--json] [path]`: Save transcript and patches.
- `/mcp`: List/attach/detach servers; health check.
- `/login` / `/logout`: Authenticate/clear provider credentials.
- `/hooks`: Show/edit hook configs; run a dry-run.
- `/security-review`: Review pending diffs for risks; block/allow.
- `/todos`: Generate/list TODOs from context; mark done.
- `/vim`: Toggle Vim mode.
- `/proxy [start|stop] [--port N]`: OpenAI-compatible proxy.
- `/upgrade`: Probe provider plan and deep-link.
- `/resume`: Restore a paused session.
- `/privacy-settings`: Show/update privacy options.
- `/release-notes`: Show release notes.
