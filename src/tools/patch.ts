import { execa } from 'execa';
import fs from 'fs/promises';
import path from 'path';

export type UnifiedDiff = string;

export async function dryRunApply(diff: UnifiedDiff): Promise<{ ok: boolean; conflicts: string[] }>{
  diff = sanitizeDiff(diff);
  await ensureGitRepo();
  const tmp = await writeTemp(diff);
  try {
    await execa('git', ['apply', '--check', tmp]);
    return { ok: true, conflicts: [] };
  } catch (e: any) {
    const msg = e?.stderr || e?.stdout || String(e);
    return { ok: false, conflicts: msg.split('\n').filter(Boolean) };
  } finally { await fs.rm(tmp, { force: true }); }
}

export async function apply(diff: UnifiedDiff): Promise<void> {
  diff = sanitizeDiff(diff);
  await ensureGitRepo();
  const tmp = await writeTemp(diff);
  try {
    await execa('git', ['apply', '--whitespace=nowarn', tmp]);
    await appendJournal({ action: 'apply', diff });
  } finally { await fs.rm(tmp, { force: true }); }
}

export async function revert(diff: UnifiedDiff): Promise<void> {
  diff = sanitizeDiff(diff);
  await ensureGitRepo();
  const tmp = await writeTemp(diff);
  try {
    await execa('git', ['apply', '-R', tmp]);
    await appendJournal({ action: 'revert', diff });
  } finally { await fs.rm(tmp, { force: true }); }
}

export async function revertLast(): Promise<boolean> {
  const j = await readJournal();
  for (let i=j.length-1; i>=0; i--) {
    const entry = j[i];
    if (entry.action === 'apply') {
      await revert(entry.diff);
      j.push({ action: 'revert', diff: entry.diff, at: Date.now() });
      await writeJournal(j);
      return true;
    }
  }
  return false;
}

async function writeTemp(diff: string) {
  const f = path.join(process.cwd(), `.plato/tmp-${Date.now()}.patch`);
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, diff, 'utf8');
  return f;
}

type JournalEntry = { action: 'apply'|'revert'; diff: string; at?: number };
const JOURNAL = path.join(process.cwd(), '.plato/journal.json');

async function appendJournal(entry: JournalEntry) {
  const j = await readJournal();
  j.push({ ...entry, at: Date.now() });
  await writeJournal(j);
}

async function readJournal(): Promise<JournalEntry[]> {
  try {
    const txt = await fs.readFile(JOURNAL, 'utf8');
    return JSON.parse(txt) as JournalEntry[];
  } catch { return []; }
}

async function writeJournal(j: JournalEntry[]) {
  await fs.mkdir(path.dirname(JOURNAL), { recursive: true });
  await fs.writeFile(JOURNAL, JSON.stringify(j, null, 2), 'utf8');
}

async function ensureGitRepo() {
  const { default: simpleGit } = await import('simple-git');
  const git = simpleGit();
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error('Patch operations require a Git repository. Run `git init` first.');
  }
}

function sanitizeDiff(input: string): string {
  let s = input || '';
  // Remove explicit patch markers if present (with optional trailing asterisks)
  s = s.replace(/^\*\*\*\s+Begin Patch.*$/gmi, '');
  s = s.replace(/^\*\*\*\s+End Patch.*$/gmi, '');
  // Remove fenced code block markers like ``` or ```diff
  s = s.replace(/^```.*$/gm, '');
  // Normalize line endings and trim
  s = s.replace(/\r\n?/g, '\n').trim();
  // Ensure traditional unified diff headers use a/ and b/ prefixes for git apply friendliness
  s = s.replace(/^---\s+(?!a\/)(?!\/dev\/null)([^\n]+)$/gm, '--- a/$1');
  s = s.replace(/^\+\+\+\s+(?!b\/)(?!\/dev\/null)([^\n]+)$/gm, '+++ b/$1');
  return s;
}
