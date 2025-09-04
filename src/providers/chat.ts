import { loadConfig } from '../config.js';
import { providerFetch } from './copilot.js';

export type ChatMessage = { role: 'system'|'user'|'assistant'|'tool'; content: string };

export async function chatCompletions(messages: ChatMessage[], opts?: { model?: string, temperature?: number, initiator?: 'user'|'agent' }): Promise<{ content: string, usage?: any }>{
  const cfg = await loadConfig();
  const base = cfg.provider!.copilot!.base_url!;
  const path = cfg.provider!.copilot!.chat_path!;
  const url = new URL(path, base).toString();
  const model = opts?.model || cfg.model?.active || 'gpt-4o';
  const payloadMsgs = messages.map(m => m.role === 'tool' ? ({ role: 'assistant', content: m.content }) : m);
  const body = { model, messages: payloadMsgs, temperature: opts?.temperature ?? 0.2, stream: false } as any;
  const r = await providerFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Initiator': opts?.initiator || 'user' }, body: JSON.stringify(body) });
  if (!r.ok) {
    const txt = await r.text().catch(()=>'');
    throw new Error(`chat failed: ${r.status} ${txt}`);
  }
  const data = await r.json() as any;
  const content = data?.choices?.[0]?.message?.content ?? '';
  return { content, usage: data.usage };
}

export async function chatStream(
  messages: ChatMessage[],
  opts: { model?: string, temperature?: number, initiator?: 'user'|'agent' } = {},
  onDelta?: (text: string) => void,
): Promise<{ content: string; usage?: any }>{
  const cfg = await loadConfig();
  const base = cfg.provider!.copilot!.base_url!;
  const path = cfg.provider!.copilot!.chat_path!;
  const url = new URL(path, base).toString();
  const model = opts?.model || cfg.model?.active || 'gpt-4o';
  const payloadMsgs = messages.map(m => m.role === 'tool' ? ({ role: 'assistant', content: m.content }) : m);
  const body = { model, messages: payloadMsgs, temperature: opts?.temperature ?? 0.2, stream: true } as any;
  const r = await providerFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Initiator': opts?.initiator || 'user' }, body: JSON.stringify(body) });
  if (!r.ok || !r.body) {
    const txt = await r.text().catch(()=>'');
    throw new Error(`chat stream failed: ${r.status} ${txt}`);
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let usage: any = undefined;
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Parse SSE: lines starting with "data: ", JSON chunks, terminated by [DONE]
    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() || '';
    for (const chunk of parts) {
      const lines = chunk.split(/\n/).filter(l=>l.startsWith('data:'));
      for (const line of lines) {
        const data = line.replace(/^data:\s*/, '');
        if (data === '[DONE]') break;
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content ?? '';
          if (delta) {
            content += delta;
            onDelta?.(delta);
          }
          if (json?.usage) usage = json.usage;
        } catch {}
      }
    }
  }
  return { content, usage };
}
