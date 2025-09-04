export type Finding = { severity: 'low'|'medium'|'high'; message: string };

export function reviewPatch(patch: string): Finding[] {
  const findings: Finding[] = [];
  if (/\.env/i.test(patch)) findings.push({ severity: 'high', message: 'Patch touches .env files' });
  if (/rm\s+-rf\s+/i.test(patch)) findings.push({ severity: 'high', message: 'Patch or scripts include rm -rf' });
  if (/chmod\s+7{3}/i.test(patch)) findings.push({ severity: 'medium', message: 'chmod 777 detected' });
  const secretRegex = /(api[_-]?key|secret|token)\s*[:=]/i;
  if (secretRegex.test(patch)) findings.push({ severity: 'medium', message: 'Potential secret assignment in patch' });
  return findings;
}

