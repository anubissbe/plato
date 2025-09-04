import { execa } from 'execa';

type Session = { name: string; cwd: string; proc: any; log: string[] };
const sessions = new Map<string, Session>();

export function listSessions() {
  return Array.from(sessions.values()).map(s => ({ name: s.name, cwd: s.cwd, running: !s.proc.killed }));
}

export async function newSession(name: string, cwd = process.cwd()) {
  if (sessions.has(name)) throw new Error(`session exists: ${name}`);
  const proc = execa(process.env.SHELL || 'bash', ['-lc', 'echo $SHELL session started'], { cwd });
  const log: string[] = [];
  proc.stdout?.on('data', (d) => log.push(String(d)));
  proc.stderr?.on('data', (d) => log.push(String(d)));
  sessions.set(name, { name, cwd, proc, log });
}

export async function killSession(name: string) {
  const s = sessions.get(name);
  if (!s) return false;
  s.proc.kill('SIGTERM');
  sessions.delete(name);
  return true;
}

export async function runInSession(name: string, cmd: string) {
  const s = sessions.get(name);
  if (!s) throw new Error(`no session: ${name}`);
  const child = execa(process.env.SHELL || 'bash', ['-lc', cmd], { cwd: s.cwd });
  child.stdout?.on('data', (d) => s.log.push(String(d)));
  child.stderr?.on('data', (d) => s.log.push(String(d)));
  const res = await child;
  return res.exitCode;
}

export function getLog(name: string) {
  const s = sessions.get(name);
  return s ? s.log.slice(-200) : [];
}
