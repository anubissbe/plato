import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import YAML from 'yaml';

export type Config = {
  provider?: {
    active?: 'copilot';
    copilot?: {
      client_id?: string;
      headers?: Record<string, string>;
      base_url?: string;
      chat_path?: string;
    }
  };
  model?: { active?: string };
  statusline?: { format?: string };
  editing?: { autoApply?: 'on'|'off' };
  privacy?: { redact?: boolean; prompt_on_large_payloads?: boolean; max_payload_mb?: number };
  context?: {
    roots?: string[];
    selected?: string[];
  }
  toolCallPreset?: {
    enabled?: boolean;
    strictOnly?: boolean;        // if true, accept only fenced JSON tool_call schema
    allowHeuristics?: boolean;   // if true, allow legacy heuristics when strictOnly is false
    messageOverride?: string;    // custom one-liner message
    overrides?: Record<string, string>; // per-model overrides by model id
  }
};

const HOME = os.homedir();
const GLOBAL_DIR = path.join(HOME, '.config', 'plato');
const GLOBAL_CFG = path.join(GLOBAL_DIR, 'config.yaml');
const PROJECT_DIR = path.join(process.cwd(), '.plato');
const PROJECT_CFG = path.join(PROJECT_DIR, 'config.yaml');

let cached: Config | null = null;

export async function ensureConfigLoaded() {
  if (!cached) await loadConfig();
}

export async function loadConfig(): Promise<Config> {
  const [g, p] = await Promise.all([
    readYamlSafe(GLOBAL_CFG),
    readYamlSafe(PROJECT_CFG),
  ]);
  cached = mergeConfig(g || {}, p || {});
  if (!cached.provider) cached.provider = { active: 'copilot', copilot: {} };
  if (!cached.provider.copilot) cached.provider.copilot = {};
  if (!cached.provider.copilot.base_url) cached.provider.copilot.base_url = 'https://api.githubcopilot.com';
  if (!cached.provider.copilot.chat_path) cached.provider.copilot.chat_path = '/v1/chat/completions';
  if (!cached.model) cached.model = { active: 'gpt-4o' };
  else if (!cached.model.active) cached.model.active = 'gpt-4o';
  if (!cached.editing) cached.editing = { autoApply: 'off' };
  if (!cached.context) cached.context = { roots: [process.cwd()], selected: [] };
  if (!cached.toolCallPreset) cached.toolCallPreset = { enabled: true, strictOnly: true };
  return cached;
}

export async function setConfigValue(key: string, value: string) {
  await fs.mkdir(GLOBAL_DIR, { recursive: true });
  const current = (await readYamlSafe(GLOBAL_CFG)) || {};
  // naive dotless setter for top-level keys
  (current as any)[key] = tryParse(value);
  await fs.writeFile(GLOBAL_CFG, YAML.stringify(current), 'utf8');
  cached = null;
}

function tryParse(v: string) {
  try { return JSON.parse(v); } catch { return v; }
}

function mergeConfig(a: Config, b: Config): Config {
  return {
    ...a,
    ...b,
    provider: { ...(a.provider||{}), ...(b.provider||{}) },
    model: { ...(a.model||{}), ...(b.model||{}) },
    statusline: { ...(a.statusline||{}), ...(b.statusline||{}) },
    privacy: { ...(a.privacy||{}), ...(b.privacy||{}) },
  };
}

async function readYamlSafe(file: string) {
  try {
    const txt = await fs.readFile(file, 'utf8');
    return YAML.parse(txt) || {};
  } catch (e: any) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

export function paths() {
  return { GLOBAL_DIR, GLOBAL_CFG, PROJECT_DIR, PROJECT_CFG };
}
