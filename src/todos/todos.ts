import fg from 'fast-glob';
import fs from 'fs/promises';
import path from 'path';

export type Todo = { id: string; file: string; line: number; text: string; done?: boolean };

const DB = path.join(process.cwd(), '.plato/todos.json');

export async function scanTodos(roots: string[]): Promise<Todo[]> {
  const todos: Todo[] = [];
  for (const root of roots) {
    const files = await fg(['**/*.{ts,tsx,js,jsx,py,go,rs,java,cs,md}'], { cwd: root, dot: false });
    for (const rel of files) {
      const abs = path.join(root, rel);
      try {
        const txt = await fs.readFile(abs, 'utf8');
        const lines = txt.split(/\r?\n/);
        lines.forEach((l, i) => {
          const m = l.match(/TODO\s*:\s*(.*)/i);
          if (m) todos.push({ id: `${abs}:${i+1}`, file: abs, line: i+1, text: m[1].trim() });
        });
      } catch {}
    }
  }
  await saveTodos(todos);
  return todos;
}

export async function loadTodos(): Promise<Todo[]> {
  try {
    return JSON.parse(await fs.readFile(DB, 'utf8')) as Todo[];
  } catch { return []; }
}

export async function saveTodos(list: Todo[]) {
  await fs.mkdir(path.dirname(DB), { recursive: true });
  await fs.writeFile(DB, JSON.stringify(list, null, 2), 'utf8');
}

export async function markDone(id: string) {
  const list = await loadTodos();
  const idx = list.findIndex(t => t.id === id);
  if (idx >= 0) list[idx].done = true;
  await saveTodos(list);
}

