export type OutputFormat = "text" | "json" | "stream-json";

export interface AppConfig {
  githubToken: string | null;
  endpoint: string; // GitHub Models (Azure AI Inference) endpoint
  defaultModel: string; // e.g. "gpt-4o-mini"
}

export function loadConfig(): AppConfig {
  return {
    githubToken: process.env.GITHUB_TOKEN ?? null,
    endpoint: process.env.COPILOT_ENDPOINT ?? "https://models.inference.ai.azure.com",
    defaultModel: process.env.COPILOT_DEFAULT_MODEL ?? "gpt-4o-mini",
  };
}

