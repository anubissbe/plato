# Orchestrator & Turn Loop

## Turn Lifecycle
- Input: user message or `/command`.
- Context build: selected files/diffs, repo status, system prompts, memory, output-style.
- Model call: streaming; tool-use if supported; else ReAct with tool-text responses.
- Tool exec: gated by permissions; results summarized back into the turn.
- Patch proposal: accumulate unified diff preview; wait for user `/apply`.
- Post: update cost/tokens, compact if needed, persist session.

## Streaming & Cancellation
- Stream tokens to TUI; partial diffs buffered until complete hunks.
- Cancellation: Ctrl-C → abort request; best-effort to stop tool exec.
- Backpressure: throttle UI render; chunk large tool outputs.

## Concurrency
- Single active turn; queue subsequent messages; `/resume` restores.
- Background tasks: indexing, embeddings, diagnostics; low priority.

## Output Styles
- Profiles control system prompts and renderers: concise/verbose/code-first/custom.
- `/output-style` switches; `/output-style:new` saves under `styles/*.yaml`.
