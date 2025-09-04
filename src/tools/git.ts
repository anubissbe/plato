import simpleGit from 'simple-git';

export const git = simpleGit();

export async function status() {
  return git.status();
}

export async function diff() {
  return git.diff();
}

export async function commit(message: string) {
  await git.add('-A');
  return git.commit(message);
}

