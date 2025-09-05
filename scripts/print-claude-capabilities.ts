#!/usr/bin/env tsx
import { spawn } from 'node:child_process';

function parseJson(line: string): any | null {
  try {
    // Fast path: trim and basic check
    const t = line.trim();
    if (!t.startsWith('{') || !t.endsWith('}')) return null;
    return JSON.parse(t);
  } catch {
    return null;
  }
}

async function main() {
  const args = [
    '--print',
    '--output-format', 'stream-json',
    '--', '_'
  ];

  const child = spawn('claude', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  let resolved = false;

  const onMessage = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    if (obj.type === 'system' && obj.subtype === 'init') {
      const tools = Array.isArray(obj.tools) ? obj.tools : [];
      const slash = Array.isArray(obj.slash_commands) ? obj.slash_commands : [];
      const mcp_servers = Array.isArray(obj.mcp_servers) ? obj.mcp_servers : [];
      console.log(JSON.stringify({ tools, slash_commands: slash, mcp_servers }, null, 2));
      resolved = true;
      child.kill('SIGTERM');
    }
  };

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    for (const line of chunk.split(/\r?\n/)) {
      const obj = parseJson(line);
      if (obj) onMessage(obj);
      if (resolved) break;
    }
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d) => {
    // Be quiet unless debugging; comment out if you want to see more.
    // process.stderr.write(d);
  });

  child.on('exit', (code) => {
    if (!resolved) {
      console.error('claude exited before emitting system init. Exit code:', code);
      process.exit(code ?? 1);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
