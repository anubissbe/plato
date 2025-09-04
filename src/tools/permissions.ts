import YAML from 'yaml';
import fs from 'fs/promises';
import path from 'path';

export type Rule = {
  match: { tool?: string; path?: string; command?: string };
  action: 'allow' | 'deny' | 'confirm';
};

export type Permissions = {
  defaults?: Record<string, 'allow'|'deny'|'confirm'>;
  rules?: Rule[];
};

export async function loadPermissions(): Promise<Permissions> {
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
  return (merged.permissions || {}) as Permissions;
}

export type PermissionQuery = { tool: string; path?: string; command?: string };

export async function checkPermission(q: PermissionQuery): Promise<'allow'|'deny'|'confirm'> {
  const p = await loadPermissions();
  const rules = p.rules || [];
  for (const r of rules) {
    if (r.match.tool && r.match.tool !== q.tool) continue;
    if (r.match.path && q.path && !matchGlob(q.path, r.match.path)) continue;
    if (r.match.command && q.command && !new RegExp(r.match.command).test(q.command)) continue;
    return r.action;
  }
  const def = p.defaults?.[q.tool];
  return def || 'allow';
}

function matchGlob(target: string, glob: string): boolean {
  // very naive glob: supports '**' anywhere and '*' wildcard
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
  const re = new RegExp('^' + esc + '$');
  return re.test(target);
}

// UI helpers: modify project permissions and save
export async function savePermissions(next: Permissions): Promise<void> {
  const proj = path.join(process.cwd(), '.plato', 'config.yaml');
  let current: any = {};
  try { current = YAML.parse(await fs.readFile(proj, 'utf8')) || {}; } catch {}
  current.permissions = next;
  await fs.mkdir(path.dirname(proj), { recursive: true });
  await fs.writeFile(proj, YAML.stringify(current), 'utf8');
}

export async function getProjectPermissions(): Promise<Permissions> {
  let current: any = {};
  try { current = YAML.parse(await fs.readFile(path.join(process.cwd(), '.plato', 'config.yaml'), 'utf8')) || {}; } catch {}
  return (current.permissions || {}) as Permissions;
}

export async function setDefault(tool: string, action: 'allow'|'deny'|'confirm') {
  const p = await getProjectPermissions();
  const next: Permissions = { ...p, defaults: { ...(p.defaults||{}), [tool]: action } };
  await savePermissions(next);
}

export async function addPermissionRule(rule: Rule) {
  const p = await getProjectPermissions();
  const next: Permissions = { ...p, rules: [ ...(p.rules||[]), rule ] };
  await savePermissions(next);
}

export async function removePermissionRule(index: number) {
  const p = await getProjectPermissions();
  const rules = (p.rules||[]).slice();
  if (index < 0 || index >= rules.length) return;
  rules.splice(index, 1);
  await savePermissions({ ...p, rules });
}
