import { chatCompletions, chatStream } from '../providers/chat.js';
import { runHooks } from '../tools/hooks.js';
import fs from 'fs/promises';
import { checkPermission } from '../tools/permissions.js';
import { callTool } from '../integrations/mcp.js';
import { loadConfig } from '../config.js';

type Msg = { role: 'system'|'user'|'assistant'|'tool', content: string };
const history: Msg[] = [
  { role: 'system', content: [
    'You are Plato, an expert coding assistant. Keep answers concise and propose safe diffs.',
    '',
    'Tool calls: When you want Plato to run an external MCP tool, emit exactly one fenced JSON code block with the following format and nothing else in the block:',
    '```json',
    '{"tool_call": {"server": "<server-id>", "name": "<tool-name>", "input": { /* arguments */ }}}',
    '```',
    'Rules:',
    '- Do not include prose in the code block, only valid JSON.',
    '- Use keys exactly: server, name, input. Do not add extra keys.',
    '- After Plato runs the tool, it will provide results and you will continue the answer.',
    '',
    'Patches: When proposing file changes, output unified diffs wrapped in *** Begin Patch / *** End Patch blocks.'
  ].join('\n') }
];

const metrics = {
  inputTokens: 0,
  outputTokens: 0,
  durationMs: 0,
  turns: 0,
};

let pendingPatch: string | null = null;

type OrchestratorEvent = { type: 'tool-start'|'tool-end'|'info'; message: string };

export const orchestrator = {
  async respond(input: string, onEvent?: (e: OrchestratorEvent)=>void): Promise<string> {
    await runHooks('pre-prompt');
    history.push({ role: 'user', content: input });
    const t0 = Date.now();
    const msgs = await prepareMessages(history);
    const { content, usage } = await chatCompletions(msgs);
    const dt = Date.now() - t0;
    metrics.durationMs += dt;
    metrics.turns += 1;
    if (usage) {
      metrics.inputTokens += usage.prompt_tokens ?? usage.input_tokens ?? 0;
      metrics.outputTokens += usage.completion_tokens ?? usage.output_tokens ?? 0;
    }
    const assistant = content || '(no content)';
    history.push({ role: 'assistant', content: assistant });
    await runHooks('post-response');
    // Extract pending patch blocks if present
    pendingPatch = extractPatch(assistant) || null;
    await maybeBridgeTool(assistant, onEvent);
    await saveSessionDefault();
    return assistant;
  },
  async respondStream(input: string, onDelta: (text: string)=>void, onEvent?: (e: OrchestratorEvent)=>void): Promise<string> {
    await runHooks('pre-prompt');
    history.push({ role: 'user', content: input });
    const t0 = Date.now();
    const msgs = await prepareMessages(history);
    const { content, usage } = await chatStream(msgs, {}, onDelta);
    const dt = Date.now() - t0;
    metrics.durationMs += dt;
    metrics.turns += 1;
    if (usage) {
      metrics.inputTokens += usage.prompt_tokens ?? usage.input_tokens ?? 0;
      metrics.outputTokens += usage.completion_tokens ?? usage.output_tokens ?? 0;
    }
    const assistant = content || '(no content)';
    history.push({ role: 'assistant', content: assistant });
    await runHooks('post-response');
    pendingPatch = extractPatch(assistant) || null;
    await maybeBridgeTool(assistant, onEvent, onDelta);
    await saveSessionDefault();
    return assistant;
  },
  getMetrics() { return { ...metrics }; },
  getHistory() { return [...history]; },
  getPendingPatch() { return pendingPatch; },
  clearPendingPatch() { pendingPatch = null; },
  async exportJSON(file: string) {
    const data = { history, metrics };
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  },
  async exportMarkdown(file: string) {
    const lines: string[] = [];
    for (const m of history) {
      lines.push(`### ${m.role}`);
      lines.push('');
      lines.push(m.content);
      lines.push('');
    }
    lines.push('');
    lines.push(`Tokens: in ${metrics.inputTokens} / out ${metrics.outputTokens} | duration ${metrics.durationMs}ms | turns ${metrics.turns}`);
    await fs.writeFile(file, lines.join('\n'), 'utf8');
  },
  async importJSON(file: string) {
    const txt = await fs.readFile(file, 'utf8');
    const data = JSON.parse(txt);
    if (Array.isArray(data.history)) {
      history.splice(0, history.length, ...data.history);
    }
    if (data.metrics && typeof data.metrics === 'object') {
      Object.assign(metrics, data.metrics);
    }
  }
};

function extractPatch(text: string): string | null {
  const m = text.match(/\*\*\* Begin Patch[\s\S]*?\*\*\* End Patch/);
  return m ? m[0] : null;
}

function parseToolCall(text: string, strict = true): null | { server: string; name: string; input: any } {
  // Preferred: explicit tool_call wrapper in fenced JSON
  const fences = Array.from(text.matchAll(/```(?:json)?\n([\s\S]*?)\n```/g));
  for (const m of fences) {
    try {
      const obj = JSON.parse(m[1]);
      const tc = obj.tool_call || obj["tool_call"];
      if (tc && typeof tc === 'object') {
        const server = tc.server;
        const name = tc.name;
        const input = tc.input ?? {};
        if (server && name) return { server, name, input };
      }
      if (!strict) {
        const server = obj.server || obj.mcp_server || obj.provider;
        const name = obj.name || obj.tool || obj.tool_name;
        const input = obj.input || obj.arguments || obj.params || {};
        if (server && name) return { server, name, input };
      }
    } catch {}
  }
  if (!strict) {
  // Inline JSON containing tool_call
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      const tc = (obj as any).tool_call || (obj as any)["tool_call"];
      if (tc && typeof tc === 'object') {
        const server = tc.server;
        const name = tc.name;
        const input = tc.input ?? {};
        if (server && name) return { server, name, input };
      } else {
        const server = (obj as any).server || (obj as any).mcp_server || (obj as any).provider;
        const name = (obj as any).name || (obj as any).tool || (obj as any).tool_name;
        const input = (obj as any).input || (obj as any).arguments || (obj as any).params || {};
        if (server && name) return { server, name, input };
      }
    } catch {}
  }
  const slash = text.match(/\/mcp\s+run\s+(\S+)\s+(\S+)\s+([\s\S]+)/);
  if (slash) {
    try {
      const input = JSON.parse(slash[3]);
      return { server: slash[1], name: slash[2], input } as any;
    } catch {}
  }
  }
  return null;
}

async function maybeBridgeTool(assistant: string, onEvent?: (e: OrchestratorEvent)=>void, onDelta?: (t: string)=>void) {
  let cycles = 0;
  let lastAssistant = assistant;
  const cfg = await loadConfig();
  if (cfg.toolCallPreset?.enabled === false) return; // Disabled entirely per config
  const strict = cfg.toolCallPreset?.strictOnly !== false && !(cfg.toolCallPreset?.allowHeuristics);
  while (cycles < 3) {
    const calls = parseAllToolCalls(lastAssistant, strict);
    if (!calls.length) break;
    for (const call of calls) {
      const decision = await checkPermission({ tool: 'mcp', command: `${call.server}:${call.name}` });
      if (decision === 'deny') { onEvent?.({ type: 'info', message: `Tool call denied: ${call.server}:${call.name}` }); continue; }
      if (decision === 'confirm') { onEvent?.({ type: 'info', message: `Tool call requires confirmation: ${call.server}:${call.name}. Use /mcp run to execute.` }); continue; }
      onEvent?.({ type: 'tool-start', message: `Running ${call.server}:${call.name}` });
      try {
        const result = await callTool(call.server, call.name, call.input);
        history.push({ role: 'tool', content: JSON.stringify({ server: call.server, name: call.name, input: call.input, result }) });
      } catch (e: any) {
        onEvent?.({ type: 'info', message: `Tool error: ${e?.message || e}` });
      } finally {
        onEvent?.({ type: 'tool-end', message: `Done` });
      }
    }
    const msgs = await prepareMessages(history);
    const { content } = await chatStream(msgs, { initiator: 'agent' }, (d)=> onDelta?.(d));
    lastAssistant = content || '';
    history.push({ role: 'assistant', content: lastAssistant });
    pendingPatch = extractPatch(lastAssistant) || null;
    cycles++;
  }
}

function parseAllToolCalls(text: string, strict = true): { server: string; name: string; input: any }[] {
  const out: { server: string; name: string; input: any }[] = [];
  const fences = Array.from(text.matchAll(/```(?:json)?\n([\s\S]*?)\n```/g));
  for (const m of fences) {
    try {
      const obj = JSON.parse(m[1]);
      const tc = (obj as any).tool_call || (obj as any)["tool_call"];
      if (tc && typeof tc === 'object' && tc.server && tc.name) out.push({ server: tc.server, name: tc.name, input: tc.input ?? {} });
      else if (!strict) {
        const server = (obj as any).server || (obj as any).mcp_server || (obj as any).provider;
        const name = (obj as any).name || (obj as any).tool || (obj as any).tool_name;
        const input = (obj as any).input || (obj as any).arguments || (obj as any).params || {};
        if (server && name) out.push({ server, name, input });
      }
    } catch {}
  }
  if (!out.length) {
    const single = parseToolCall(text, strict);
    if (single) out.push(single);
  }
  return out;
}

async function prepareMessages(msgs: Msg[]) {
  const cfg = await loadConfig();
  if (cfg.toolCallPreset?.enabled) {
    const reminder = getToolCallOneLiner(cfg.model?.active || '', cfg);
    const has = msgs.find(m=>m.role==='system' && m.content.includes('tool_call'));
    if (!has) return [{ role: 'system', content: reminder } as Msg, ...msgs];
  }
  return msgs;
}

async function saveSessionDefault() {
  const file = '.plato/session.json';
  try {
    await fs.mkdir('.plato', { recursive: true });
    const data = { history, metrics };
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

function getToolCallOneLiner(modelId: string, cfg?: any): string {
  const id = (modelId || '').toLowerCase();
  const preset = cfg?.toolCallPreset || {};
  // Per-model overrides
  const ov = preset.overrides || {};
  const exactKey = Object.keys(ov).find(k => k.toLowerCase() === id);
  if (exactKey) return ov[exactKey];
  if (preset.messageOverride) return preset.messageOverride;
  // Known model families and exact ids
  const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini', 'o4-mini'];
  const isOpenAI = OPENAI_MODELS.some(m => id === m || id.startsWith(m)) || /\bgpt|\bo[0-9]/.test(id);
  if (isOpenAI) {
    return 'Tool calls: emit a fenced json block only {"tool_call":{"server":"<id>","name":"<tool>","input":{}}} — valid JSON (double quotes), no trailing commas, no prose.';
  }
  if (/claude/.test(id)) {
    return 'Tool calls: output a single fenced json block with {"tool_call":{"server":"<id>","name":"<tool>","input":{}}} only — no extra text inside the block.';
  }
  if (/gemini|google/.test(id)) {
    return 'Tool calls: use a fenced json block containing only {"tool_call":{"server":"<id>","name":"<tool>","input":{}}} — strictly valid JSON, no commentary.';
  }
  return 'For tool calls, output a fenced json block with only {"tool_call":{"server":"<id>","name":"<tool>","input":{}}} (no prose).';
}
