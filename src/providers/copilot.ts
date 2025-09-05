import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { loadConfig } from '../config.js';

type Creds = { type: 'oauth'; refresh: string; access: string; expires: number };

const CLIENT_ID_DEFAULT = 'Iv1.b507a08c87ecfe98';
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const COPILOT_API_KEY_URL = 'https://api.github.com/copilot_internal/v2/token';
const CREDS_FILE = path.join(os.homedir(), '.config', 'plato', 'credentials.json');
const KEYTAR_SERVICE = 'plato-copilot';
const KEYTAR_ACCOUNT = 'oauth-creds';

const DEFAULT_HEADERS = {
  'User-Agent': 'GitHubCopilotChat/0.26.7',
  'Editor-Version': 'vscode/1.99.3',
  'Editor-Plugin-Version': 'copilot-chat/0.26.7',
  'Copilot-Integration-Id': 'vscode-chat',
};

export async function loginCopilot() {
  const cfg = await loadConfig();
  const client_id = cfg.provider?.copilot?.client_id || CLIENT_ID_DEFAULT;
  const r = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': DEFAULT_HEADERS['User-Agent'] },
    body: JSON.stringify({ client_id, scope: 'read:user' })
  });
  if (!r.ok) throw new Error(`device code failed: ${r.status}`);
  const device = await r.json() as any;
  // Print verification instructions
  process.stdout.write(`Open ${device.verification_uri} and enter code: ${device.user_code}\n`);
  // Poll for access token
  while (true) {
    const p = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': DEFAULT_HEADERS['User-Agent'] },
      body: JSON.stringify({ client_id, device_code: device.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' })
    });
    if (!p.ok) throw new Error(`access token failed: ${p.status}`);
    const data = await p.json() as any;
    if (data.access_token) {
      const refresh = data.access_token as string;
      const creds: Creds = { type: 'oauth', refresh, access: '', expires: 0 };
      await saveCreds(creds);
      process.stdout.write('Authenticated with GitHub. Fetching Copilot token...\n');
      await ensureAccessToken();
      return;
    }
    if (data.error === 'authorization_pending') {
      await delay((device.interval ?? 5) * 1000);
      continue;
    }
    throw new Error(`device flow error: ${data.error || 'unknown'}`);
  }
}

export async function logoutCopilot() {
  await deleteCreds();
  process.stdout.write('Logged out.\n');
}

export async function providerFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await ensureAccessToken();
  const cfg = await loadConfig();
  const headers = {
    ...(init.headers || {} as any),
    ...DEFAULT_HEADERS,
    ...(cfg.provider?.copilot?.headers || {}),
    Authorization: `Bearer ${token}`,
    'Openai-Intent': 'conversation-edits',
    'X-Initiator': (init.headers as any)?.['X-Initiator'] || 'user',
  } as Record<string, string>;
  delete (headers as any)['x-api-key'];
  return fetch(input, { ...init, headers });
}

async function ensureAccessToken(): Promise<string> {
  const creds = await loadCreds();
  if (!creds || creds.type !== 'oauth' || !creds.refresh) throw new Error('Not logged in. Run `plato login`.');
  if (!creds.access || Date.now() >= creds.expires) {
    const r = await fetch(COPILOT_API_KEY_URL, { headers: { Accept: 'application/json', Authorization: `Bearer ${creds.refresh}`, ...DEFAULT_HEADERS } });
    if (!r.ok) throw new Error(`copilot token failed: ${r.status}`);
    const data = await r.json() as any;
    creds.access = data.token;
    creds.expires = (data.expires_at as number) * 1000;
    await saveCreds(creds);
  }
  return creds.access;
}

async function loadCreds(): Promise<Creds | null> {
  const kt = await tryKeytar();
  if (kt) {
    try {
      const raw = await kt.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
      if (raw) return JSON.parse(raw) as Creds;
    } catch {}
  }
  try {
    const txt = await fs.readFile(CREDS_FILE, 'utf8');
    return JSON.parse(txt) as Creds;
  } catch (e: any) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

async function saveCreds(c: Creds) {
  const kt = await tryKeytar();
  if (kt) {
    try { await kt.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, JSON.stringify(c)); return; } catch {}
  }
  await fs.mkdir(path.dirname(CREDS_FILE), { recursive: true });
  await fs.writeFile(CREDS_FILE, JSON.stringify(c, null, 2), 'utf8');
}

async function deleteCreds() {
  const kt = await tryKeytar();
  if (kt) {
    try { await kt.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT); } catch {}
  }
  await fs.rm(CREDS_FILE, { force: true });
}

async function tryKeytar(): Promise<null | { getPassword: Function; setPassword: Function; deletePassword: Function }>{
  try {
    // dynamic import; optional dependency
    const mod: any = await import('keytar');
    return mod.default || mod;
  } catch {
    return null;
  }
}

function delay(ms: number) { return new Promise(res => setTimeout(res, ms)); }

export async function getAuthInfo(): Promise<{ loggedIn: boolean; user?: { login: string } }>{
  const creds = await loadCreds();
  if (!creds || !creds.refresh) return { loggedIn: false };
  try {
    const r = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${creds.refresh}`, Accept: 'application/vnd.github+json', 'User-Agent': DEFAULT_HEADERS['User-Agent'] } });
    if (!r.ok) return { loggedIn: true };
    const user = await r.json() as any;
    return { loggedIn: true, user: { login: user.login } };
  } catch {
    return { loggedIn: true };
  }
}

export async function getAvailableModels(): Promise<string[]> {
  try {
    const cfg = await loadConfig();
    const base = cfg.provider?.copilot?.base_url || 'https://api.githubcopilot.com';
    
    // Try multiple endpoints to get models
    const endpoints = [
      '/v1/models',
      '/models', 
      '/v1/chat/completions' // Some APIs expose models through a test call
    ];
    
    for (const endpoint of endpoints) {
      try {
        const modelsUrl = new URL(endpoint, base).toString();
        const response = await providerFetch(modelsUrl, { method: 'GET' });
        
        if (response.ok) {
          const data = await response.json() as any;
          
          // Standard OpenAI-style models endpoint
          if (data.data && Array.isArray(data.data)) {
            const models = data.data.map((model: any) => model.id).filter(Boolean);
            if (models.length > 0) {
              console.error(`✓ Found ${models.length} models via ${endpoint}`);
              return models.sort();
            }
          }
          
          // Some APIs return models differently
          if (data.models && Array.isArray(data.models)) {
            const models = data.models.filter(Boolean);
            if (models.length > 0) {
              console.error(`✓ Found ${models.length} models via ${endpoint}`);
              return models.sort();
            }
          }
        }
      } catch (e) {
        // Try next endpoint
        continue;
      }
    }
    
    // If API discovery fails, return expanded fallback list including Claude 4.1 Sonnet
    console.error('⚠️ Could not fetch models from API, using fallback list');
    return [
      // OpenAI Models
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      // O-series models
      'o3-mini',
      'o1-preview',
      'o1-mini',
      // Claude Models (Anthropic)
      'claude-3.5-sonnet',
      'claude-3.5-haiku',
      'claude-3-opus',
      'claude-3-sonnet', 
      'claude-3-haiku',
      // Potential newer Claude models
      'claude-4.1-sonnet',
      'claude-4-sonnet'
    ].sort();
    
  } catch (error) {
    console.error('❌ Error fetching models:', error);
    // Minimal fallback if everything fails
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'claude-3.5-sonnet',
      'claude-4.1-sonnet'
    ];
  }
}
