import fg from 'fast-glob';
import path from 'path';
import fs from 'fs/promises';
import ignore from 'ignore';

export async function buildIndex(opts: { roots: string[] }) {
  const entries: { path: string; size: number }[] = [];
  for (const root of opts.roots) {
    const ig = ignore();
    for (const file of ['.gitignore', '.platoignore']) {
      try {
        const txt = await fs.readFile(path.join(root, file), 'utf8');
        ig.add(txt);
      } catch {}
    }
    const files = await fg(['**/*'], { cwd: root, dot: false, followSymbolicLinks: false });
    for (const rel of files) {
      const abs = path.join(root, rel);
      if (ig.ignores(rel)) continue;
      try {
        const st = await fs.stat(abs);
        if (!st.isFile()) continue;
        entries.push({ path: abs, size: st.size });
      } catch {}
    }
  }
  return entries;
}

