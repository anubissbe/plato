export type Role = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatOptions {
  model?: string;
  stream?: boolean;
}

export interface ChatChunk {
  type: "text" | "done" | "error";
  data?: string;
  error?: string;
}

