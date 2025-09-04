import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

interface BashSession {
  id: string;
  pid: number;
  process: ChildProcess;
  created: Date;
  cwd: string;
}

const sessions = new Map<string, BashSession>();

export async function handleBashCommand(command: string): Promise<string[]> {
  const parts = command.split(/\s+/);
  const subcommand = parts[1] || 'list';
  
  switch (subcommand) {
    case 'list':
      return listSessions();
    
    case 'new':
      return createSession();
    
    case 'kill':
      const id = parts[2];
      if (!id) return ['Usage: /bashes kill <id>'];
      return killSession(id);
    
    default:
      return ['Usage: /bashes [list|new|kill <id>]'];
  }
}

function listSessions(): string[] {
  if (sessions.size === 0) {
    return ['No active bash sessions'];
  }
  
  const lines = ['Active bash sessions:'];
  for (const [id, session] of sessions) {
    lines.push(`  ${id.slice(0, 8)} - PID: ${session.pid} - Created: ${session.created.toLocaleString()}`);
  }
  return lines;
}

async function createSession(): Promise<string[]> {
  const id = randomUUID();
  const shell = process.env.SHELL || 'bash';
  
  const proc = spawn(shell, ['-i'], {
    cwd: process.cwd(),
    env: { ...process.env, PS1: `[${id.slice(0, 8)}]$ ` }
  });
  
  const session: BashSession = {
    id,
    pid: proc.pid!,
    process: proc,
    created: new Date(),
    cwd: process.cwd()
  };
  
  sessions.set(id, session);
  
  // Log output to file
  const logPath = path.join('.plato', 'bashes', `${id}.log`);
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const logStream = await fs.open(logPath, 'w');
  
  proc.stdout?.on('data', (data) => {
    logStream.write(data);
  });
  
  proc.stderr?.on('data', (data) => {
    logStream.write(data);
  });
  
  proc.on('exit', () => {
    sessions.delete(id);
    logStream.close();
  });
  
  return [`Created bash session: ${id.slice(0, 8)}`];
}

function killSession(id: string): string[] {
  const fullId = Array.from(sessions.keys()).find(k => k.startsWith(id));
  if (!fullId) {
    return [`No session found with ID: ${id}`];
  }
  
  const session = sessions.get(fullId)!;
  session.process.kill();
  sessions.delete(fullId);
  
  return [`Killed session: ${fullId.slice(0, 8)}`];
}

export function killAllSessions() {
  for (const session of sessions.values()) {
    session.process.kill();
  }
  sessions.clear();
}

// Clean up on exit
process.on('exit', killAllSessions);
process.on('SIGINT', killAllSessions);
process.on('SIGTERM', killAllSessions);
