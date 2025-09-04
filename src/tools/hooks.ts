import YAML from 'yaml';
import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';

type HookCmd = { run: string; timeout_ms?: number; when?: 'before'|'after'; required?: boolean };
type HooksCfg = { [evt: string]: HookCmd[] };

export async function runHooks(event: 'pre-prompt'|'post-response'|'on-apply', phase?: 'before'|'after'): Promise<void> {
  const cfg = await loadHooks();
  const cmds = (cfg[event] || []).filter(c => event !== 'on-apply' || !phase || c.when === phase);
  for (const c of cmds) {
    try {
      const [bin, ...args] = c.run.split(/\s+/);
      const p = execa(bin, args, { timeout: c.timeout_ms || 0, stdio: 'inherit' });
      await p;
    } catch (e) {
      if ((c as any).required) throw e;
    }
  }
}

async function loadHooks(): Promise<HooksCfg> {
  const proj = path.join(process.cwd(), '.plato', 'config.yaml');
  const glob = path.join(process.env.HOME || '', '.config', 'plato', 'config.yaml');
  let merged: any = {};
  for (const f of [glob, proj]) {
    try {
      const txt = await fs.readFile(f, 'utf8');
      const y = YAML.parse(txt) || {};
      merged = { ...merged, ...(y || {}) };
    } catch {}
  }
  return (merged.hooks || {}) as HooksCfg;
}

