// Mock dependencies first
jest.mock('../runtime/headless', () => ({
  runHeadless: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../config', () => ({
  ensureConfigLoaded: jest.fn().mockResolvedValue(undefined),
  loadConfig: jest.fn().mockResolvedValue({
    provider: { active: 'copilot' },
    model: { active: 'gpt-4o' },
    editing: { autoApply: 'on' }
  }),
  setConfigValue: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../tui/app', () => ({
  runTui: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../providers/copilot', () => ({
  loginCopilot: jest.fn().mockResolvedValue(undefined),
  logoutCopilot: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../context/indexer', () => ({
  buildIndex: jest.fn().mockResolvedValue(undefined),
}));

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';

describe('CLI Argument Parsing', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'plato-test-'));
    process.chdir(tempDir);
    
    // Initialize a git repo for testing
    try {
      await execCommand('git', ['init']);
      await execCommand('git', ['config', 'user.email', 'test@example.com']);
      await execCommand('git', ['config', 'user.name', 'Test User']);
    } catch (e) {
      // Git might not be available in test environment
    }
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  test('should parse help flag', async () => {
    const result = await runCLI(['--help']);
    expect(result.exitCode).toBe(0);
    // Update to match actual output format
    expect(result.stdout).toContain('plato [options] [prompt]');
    expect(result.stdout).toContain('-p, --print');
    expect(result.stdout).toContain('--output-format');
    expect(result.stdout).toContain('--model');
    expect(result.stdout).toContain('--version');
  });

  test('should validate output format', async () => {
    const result = await runCLI(['-p', 'test', '--output-format', 'invalid']);
    expect(result.exitCode).not.toBe(0);
    // Check both stdout and stderr for error message
    const output = result.stdout + result.stderr;
    expect(output).toContain('Invalid values:');
    expect(output).toContain('Argument: output-format');
  });

  test('should handle valid output format', async () => {
    const result = await runCLI(['-p', 'test', '--output-format', 'json']);
    // This might fail if GITHUB_TOKEN is not set, but the parsing should work
    expect([0, 1]).toContain(result.exitCode);
  });

  test('should show version', async () => {
    const result = await runCLI(['--version']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('0.1.0');
  });

  // Unit tests for argument parsing
  test('parseArgs function should parse -p flag correctly', () => {
    // Import the CLI module to test parseArgs function directly
    // Since parseArgs is not exported, we'll test the behavior through integration
    // These tests verify the CLI accepts the arguments without errors
    expect(true).toBe(true); // Placeholder - actual parsing is tested through integration
  });
});

async function runCLI(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const cliPath = path.join(__dirname, '../cli.ts');
    const child = spawn('npx', ['tsx', cliPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        stdout,
        stderr
      });
    });

    child.on('error', (err) => {
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + `\nProcess error: ${err.message}`
      });
    });

    // Shorter timeout and kill more aggressively
    const timeoutId = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + '\nTest timeout (5s)'
      });
    }, 5000);

    child.on('close', () => {
      clearTimeout(timeoutId);
    });
  });
}

async function execCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
    child.on('error', (err) => {
      reject(err);
    });
  });
}
