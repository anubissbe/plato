import { execaSync } from 'execa';
import { loadConfig } from '../config.js';

export async function runDoctor(): Promise<string[]> {
  const out: string[] = [];
  function ok(label: string, detail?: string) { out.push(`ok: ${label}${detail?` — ${detail}`:''}`); }
  function err(label: string, e: any) { out.push(`err: ${label} — ${e?.message || e}`); }

  try { const v = execaSync('git', ['--version']); ok('git', v.stdout); } catch (e) { err('git', e); }
  try { const v = execaSync('rg', ['--version']); ok('rg', v.stdout); } catch (e) { err('rg', e); }
  const cfg = await loadConfig();
  const base = cfg.provider?.copilot?.base_url || 'https://api.githubcopilot.com';
  try {
    const r = await fetch(base, { method: 'HEAD' });
    ok('copilot base', `${r.status}`);
  } catch (e) { err('copilot base', e); }
  try {
    const { getAuthInfo } = await import('../providers/copilot.js');
    const auth = await getAuthInfo();
    ok('copilot auth', auth.loggedIn ? (auth.user?.login || 'logged-in') : 'logged-out');
  } catch (e) { err('copilot auth', e); }
  return out;
}
