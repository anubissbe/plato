import fetch from "cross-fetch";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";
import { ChatChunk, ChatMessage, ChatOptions } from "../types.js";

export interface CopilotProviderOptions {
  endpoint: string; // e.g., https://models.inference.ai.azure.com
  token: string; // GitHub token with Copilot subscription
}

export class CopilotProvider {
  constructor(private cfg: CopilotProviderOptions) {}

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const { model = "gpt-4o-mini" } = opts;
    const res = await fetch(`${this.cfg.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.cfg.token}`,
        "x-ms-model": model,
      },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Copilot API error ${res.status}: ${text}`);
    }
    const data = (await res.json()) as any;
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return content;
  }

  async chatStream(
    messages: ChatMessage[],
    opts: ChatOptions & { stream: true }
  ): Promise<AsyncIterable<ChatChunk>> {
    const { model = "gpt-4o-mini" } = opts;
    const res = await fetch(`${this.cfg.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.cfg.token}`,
        "x-ms-model": model,
      },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.2,
        stream: true,
      }),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`Copilot API error ${res.status}: ${text}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
      // Handler is attached per consumer below
    });

    const self = this;
    async function* stream(): AsyncIterable<ChatChunk> {
      let done = false;
      let queue: ChatChunk[] = [];
      const onEvent = (ev: ParsedEvent | ReconnectInterval) => {
        if (typeof ev === "number") return;
        if (ev.type !== "event") return;
        if (!ev.data) return;
        if (ev.data === "[DONE]") {
          queue.push({ type: "done" });
          return;
        }
        try {
          const json = JSON.parse(ev.data);
          const delta = json?.choices?.[0]?.delta?.content;
          if (delta) queue.push({ type: "text", data: delta });
        } catch (e: any) {
          queue.push({ type: "error", error: e?.message || String(e) });
        }
      };
      (parser as any).onParse = onEvent;
      while (!done) {
        const { value, done: rdone } = await reader.read();
        if (rdone) break;
        const chunk = decoder.decode(value, { stream: true });
        parser.feed(chunk);
        while (queue.length) yield queue.shift()!;
      }
      // flush
      const rest = decoder.decode();
      if (rest) parser.feed(rest);
      while (queue.length) yield queue.shift()!;
      yield { type: "done" };
    }
    return stream();
  }
}

