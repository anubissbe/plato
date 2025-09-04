import { glob } from 'glob';
import fs from 'fs/promises';

export type Finding = { severity: 'low'|'medium'|'high'; message: string };

export interface SecurityIssue {
  file: string;
  line?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  pattern?: string;
}

export function reviewPatch(patch: string): Finding[] {
  const findings: Finding[] = [];
  if (/\.env/i.test(patch)) findings.push({ severity: 'high', message: 'Patch touches .env files' });
  if (/rm\s+-rf\s+/i.test(patch)) findings.push({ severity: 'high', message: 'Patch or scripts include rm -rf' });
  if (/chmod\s+7{3}/i.test(patch)) findings.push({ severity: 'medium', message: 'chmod 777 detected' });
  const secretRegex = /(api[_-]?key|secret|token)\s*[:=]/i;
  if (secretRegex.test(patch)) findings.push({ severity: 'medium', message: 'Potential secret assignment in patch' });
  return findings;
}

export async function runSecurityReview(): Promise<SecurityIssue[]> {
  const issues: SecurityIssue[] = [];
  
  // Get staged files or all project files
  let filesToCheck: string[] = [];
  
  try {
    // Try to get staged files first
    const { execa } = await import('execa');
    const { stdout } = await execa('git', ['diff', '--cached', '--name-only']);
    filesToCheck = stdout.split('\n').filter(f => f);
  } catch {
    // Fallback to all source files
    try {
      filesToCheck = await glob('**/*.{js,ts,jsx,tsx,py,sh,env}', {
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
      });
    } catch {
      filesToCheck = [];
    }
  }
  
  // Security patterns to check
  const patterns = [
    {
      regex: /api[_-]?key\s*[:=]\s*["'][^"']+["']/gi,
      severity: 'critical' as const,
      message: 'Hardcoded API key detected'
    },
    {
      regex: /password\s*[:=]\s*["'][^"']+["']/gi,
      severity: 'critical' as const,
      message: 'Hardcoded password detected'
    },
    {
      regex: /secret\s*[:=]\s*["'][^"']+["']/gi,
      severity: 'high' as const,
      message: 'Hardcoded secret detected'
    },
    {
      regex: /eval\s*\(/g,
      severity: 'high' as const,
      message: 'Use of eval() detected - potential code injection'
    },
    {
      regex: /exec\s*\(/g,
      severity: 'medium' as const,
      message: 'Use of exec() detected - review for command injection'
    },
    {
      regex: /chmod\s+777/g,
      severity: 'medium' as const,
      message: 'Overly permissive chmod 777 detected'
    },
    {
      regex: /rm\s+-rf\s+\//g,
      severity: 'critical' as const,
      message: 'Dangerous rm -rf on root path detected'
    },
    {
      regex: /\$\(.*\)/g,
      severity: 'low' as const,
      message: 'Command substitution detected - review for injection'
    },
    {
      regex: /console\.log\(/g,
      severity: 'low' as const,
      message: 'Console.log found - remove before production'
    }
  ];
  
  // Check each file
  for (const file of filesToCheck) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const lines = content.split('\n');
      
      for (const pattern of patterns) {
        const matches = content.match(pattern.regex);
        if (matches) {
          // Find line numbers for each match
          for (const match of matches) {
            const lineIndex = lines.findIndex(line => line.includes(match));
            issues.push({
              file,
              line: lineIndex >= 0 ? lineIndex + 1 : undefined,
              severity: pattern.severity,
              message: pattern.message,
              pattern: match.substring(0, 50) + (match.length > 50 ? '...' : '')
            });
          }
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }
  
  return issues;
}

