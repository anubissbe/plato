import path from 'path';
import fg from 'fast-glob';
import fs from 'fs/promises';
import { loadConfig } from '../config.js';

export async function getRoots(): Promise<string[]> {
  const cfg = await loadConfig();
  return cfg.context?.roots || [process.cwd()];
}

export async function addRoot(root: string): Promise<string[]> {
  const cfg = await loadConfig();
  const roots = Array.from(new Set([...(cfg.context?.roots || []), path.resolve(root)]));
  await writeProjectConfig({ context: { ...(cfg.context||{}), roots } });
  return roots;
}

export async function listCandidates(globs: string[]): Promise<string[]> {
  const roots = await getRoots();
  const candidates: string[] = [];
  for (const root of roots) {
    const files = await fg(globs.length ? globs : ['**/*.{ts,tsx,js,jsx,py,go,rs,java,cs,md}'], { cwd: root, dot: false });
    for (const rel of files) candidates.push(path.resolve(root, rel));
  }
  return Array.from(new Set(candidates)).sort();
}

export async function getSelected(): Promise<string[]> {
  const cfg = await loadConfig();
  return cfg.context?.selected || [];
}

export async function addToSelected(paths: string[]): Promise<string[]> {
  const cfg = await loadConfig();
  const selected = Array.from(new Set([...(cfg.context?.selected || []), ...paths.map(p=>path.resolve(p))]));
  await writeProjectConfig({ context: { ...(cfg.context||{}), selected } });
  return selected;
}

export async function removeFromSelected(paths: string[]): Promise<string[]> {
  const cfg = await loadConfig();
  const rmset = new Set(paths.map(p=>path.resolve(p)));
  const selected = (cfg.context?.selected || []).filter(p=>!rmset.has(path.resolve(p)));
  await writeProjectConfig({ context: { ...(cfg.context||{}), selected } });
  return selected;
}

export async function tokenEstimateForFiles(files: string[]): Promise<{ tokens: number; bytes: number }>{
  let bytes = 0;
  for (const f of files) {
    try { const b = await fs.readFile(f); bytes += b.length; } catch {}
  }
  // crude estimate: 1 token ~ 4 bytes for ASCII-ish code
  const tokens = Math.ceil(bytes / 4);
  return { tokens, bytes };
}

async function writeProjectConfig(partial: any) {
  // naive merge + write to .plato/config.yaml using YAML via config.ts helper would be nicer
  const { paths: p } = await import('../config.js');
  const { default: YAML } = await import('yaml');
  const { PROJECT_DIR, PROJECT_CFG } = (await (await import('../config.js')).paths());
  await fs.mkdir(PROJECT_DIR, { recursive: true });
  let current: any = {};
  try { current = YAML.parse(await fs.readFile(PROJECT_CFG, 'utf8')) || {}; } catch {}
  const next = { ...current, ...partial, context: { ...(current.context||{}), ...(partial.context||{}) } };
  await fs.writeFile(PROJECT_CFG, YAML.stringify(next), 'utf8');
}

