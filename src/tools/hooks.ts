import YAML from 'yaml';
import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';

type HookCmd = { run: string; timeout_ms?: number; when?: 'before'|'after'; required?: boolean };
type HooksCfg = { [evt: string]: HookCmd[] };

interface Hook {
  name: string;
  type: 'pre-prompt' | 'post-response' | 'pre-apply' | 'post-apply';
  command: string;
  timeout?: number;
}

export async function manageHooks(command: string): Promise<string[]> {
  const parts = command.split(/\s+/);
  const subcommand = parts[1] || 'list';
  
  switch (subcommand) {
    case 'list':
      return listHooks();
    
    case 'add':
      if (parts.length < 4) {
        return ['Usage: /hooks add <type> <command>'];
      }
      return addHook(parts[2] as any, parts.slice(3).join(' '));
    
    case 'remove':
      if (!parts[2]) {
        return ['Usage: /hooks remove <name>'];
      }
      return removeHook(parts[2]);
    
    case 'test':
      if (!parts[2]) {
        return ['Usage: /hooks test <name>'];
      }
      return testHook(parts[2]);
    
    default:
      return ['Usage: /hooks [list|add <type> <command>|remove <name>|test <name>]'];
  }
}

async function loadHooks(): Promise<Hook[]> {
  try {
    const content = await fs.readFile('.plato/hooks.yaml', 'utf8');
    return YAML.parse(content)?.hooks || [];
  } catch {
    return [];
  }
}

async function saveHooks(hooks: Hook[]): Promise<void> {
  await fs.mkdir('.plato', { recursive: true });
  await fs.writeFile('.plato/hooks.yaml', YAML.stringify({ hooks }), 'utf8');
}

async function listHooks(): Promise<string[]> {
  const hooks = await loadHooks();
  if (hooks.length === 0) {
    return ['No hooks configured'];
  }
  
  return [
    'Configured hooks:',
    ...hooks.map(h => `  ${h.name} (${h.type}): ${h.command}`)
  ];
}

async function addHook(type: Hook['type'], command: string): Promise<string[]> {
  const hooks = await loadHooks();
  const name = `hook_${Date.now()}`;
  
  hooks.push({
    name,
    type,
    command,
    timeout: 5000
  });
  
  await saveHooks(hooks);
  return [`Added hook: ${name}`];
}

async function removeHook(name: string): Promise<string[]> {
  const hooks = await loadHooks();
  const filtered = hooks.filter(h => h.name !== name);
  
  if (filtered.length === hooks.length) {
    return [`Hook not found: ${name}`];
  }
  
  await saveHooks(filtered);
  return [`Removed hook: ${name}`];
}

async function testHook(name: string): Promise<string[]> {
  const hooks = await loadHooks();
  const hook = hooks.find(h => h.name === name);
  
  if (!hook) {
    return [`Hook not found: ${name}`];
  }
  
  try {
    const { execa } = await import('execa');
    const result = await execa('sh', ['-c', hook.command], {
      timeout: hook.timeout || 5000
    });
    return [`Hook test succeeded:`, result.stdout || '(no output)'];
  } catch (e: any) {
    return [`Hook test failed: ${e?.message || e}`];
  }
}

// Update existing runHooks to show spinner
export async function runHooks(event: 'pre-prompt'|'post-response'|'on-apply', phase?: 'before'|'after'): Promise<void> {
  const hooks = await loadHooks();
  // Map legacy phases to new types if present
  const type = event === 'on-apply' ? (phase === 'before' ? 'pre-apply' : 'post-apply') : (event as any);
  const relevant = hooks.filter(h => h.type === type || (phase && h.type === `${event}-${phase}` as any));
  
  for (const hook of relevant) {
    process.stdout.write(`⏳ Running hook: ${hook.name}...`);
    try {
      const { execa } = await import('execa');
      await execa('sh', ['-c', hook.command], {
        timeout: hook.timeout || 5000
      });
      process.stdout.write('\r✅\n');
    } catch {
      process.stdout.write('\r❌\n');
    }
  }
}
