import type { ChatMessage } from "./types.js";

export class Session {
  private history: ChatMessage[] = [];

  constructor(systemPrompt?: string) {
    if (systemPrompt) this.system(systemPrompt);
  }

  system(content: string) {
    this.history.push({ role: "system", content });
  }

  user(content: string) {
    this.history.push({ role: "user", content });
  }

  assistant(content: string) {
    this.history.push({ role: "assistant", content });
  }

  getMessages(): ChatMessage[] {
    return this.history.slice();
  }
}

