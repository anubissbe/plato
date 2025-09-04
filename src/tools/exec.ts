import { execa } from 'execa';

export async function run(cmd: string, opts: { cwd?: string } = {}) {
  const [bin, ...args] = cmd.split(/\s+/);
  const child = execa(bin, args, { cwd: opts.cwd, stdio: 'pipe' });
  return child;
}
