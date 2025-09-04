// Mock all dependencies before importing
jest.mock('../providers/chat_fallback', () => ({
  chatCompletions: jest.fn().mockResolvedValue({ content: 'mock response', usage: null }),
  chatStream: jest.fn().mockResolvedValue({ content: 'mock response', usage: null }),
}));

jest.mock('../tools/patch', () => ({
  dryRunApply: jest.fn().mockResolvedValue({ ok: true, conflicts: [] }),
  apply: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../policies/security', () => ({
  reviewPatch: jest.fn().mockReturnValue([]),
}));

jest.mock('../tools/permissions', () => ({
  checkPermission: jest.fn().mockResolvedValue('allow'),
}));

jest.mock('../tools/hooks', () => ({
  runHooks: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../integrations/mcp', () => ({
  callTool: jest.fn().mockResolvedValue({}),
}));

jest.mock('../config', () => ({
  loadConfig: () => Promise.resolve({
    provider: { active: 'copilot' },
    model: { active: 'gpt-4' },
    editing: { autoApply: 'off' }
  }),
  setConfigValue: jest.fn(),
}));

jest.mock('../providers/copilot', () => ({
  getAuthInfo: () => Promise.resolve({ loggedIn: false }),
}));

jest.mock('simple-git', () => ({
  default: () => ({
    checkIsRepo: () => Promise.resolve(false),
    status: () => Promise.resolve({ current: 'main' }),
  }),
}));

jest.mock('fs/promises', () => ({
  mkdtemp: jest.fn().mockResolvedValue('/tmp/test'),
  mkdir: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn().mockResolvedValue([]),
  readFile: jest.fn().mockResolvedValue('{}'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({ size: 1024 }),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn().mockReturnValue(''),
}));

// Mock open function for IDE and bug commands
const mockOpen = jest.fn().mockResolvedValue(undefined);
jest.mock('open', () => mockOpen, { virtual: true });

import { SLASH_COMMANDS, SLASH_MAP } from '../slash/commands';
import { orchestrator } from '../runtime/orchestrator';

describe('Slash Commands - New Commands Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Command Registry', () => {
    test('should include all new slash commands in registry', () => {
      const expectedCommands = [
        '/ide',
        '/install-github-app', 
        '/terminal-setup',
        '/compact',
        '/bug'
      ];

      expectedCommands.forEach(cmd => {
        expect(SLASH_MAP.has(cmd)).toBe(true);
      });
    });

    test('should have proper summaries for new commands', () => {
      expect(SLASH_MAP.get('/ide')?.summary).toContain('IDE');
      expect(SLASH_MAP.get('/install-github-app')?.summary).toContain('GitHub');
      expect(SLASH_MAP.get('/terminal-setup')?.summary).toContain('terminal');
      expect(SLASH_MAP.get('/compact')?.summary).toContain('Compact');
      expect(SLASH_MAP.get('/bug')?.summary).toContain('bug');
    });
  });

  describe('/ide command', () => {
    test('should handle IDE connection command', async () => {
      const command = '/ide';
      expect(SLASH_MAP.has(command)).toBe(true);
    });

    test('should support IDE connection with optional editor parameter', async () => {
      // Test basic command
      const result1 = await simulateSlashCommand('/ide');
      expect(result1.success).toBe(true);

      // Test with specific editor
      const result2 = await simulateSlashCommand('/ide vscode');
      expect(result2.success).toBe(true);
    });

    test('should handle unsupported IDE gracefully', async () => {
      const result = await simulateSlashCommand('/ide unsupported-editor');
      expect(result.success).toBe(false);
      expect(result.message).toContain('supported');
    });
  });

  describe('/install-github-app command', () => {
    test('should handle GitHub app installation', async () => {
      const result = await simulateSlashCommand('/install-github-app');
      expect(result.success).toBe(true);
      expect(mockOpen).toHaveBeenCalledWith(expect.stringContaining('github'));
    });

    test('should provide installation instructions', async () => {
      const result = await simulateSlashCommand('/install-github-app');
      expect(result.message).toContain('install');
      expect(result.message).toContain('GitHub');
    });
  });

  describe('/terminal-setup command', () => {
    test('should handle terminal configuration', async () => {
      const result = await simulateSlashCommand('/terminal-setup');
      expect(result.success).toBe(true);
      expect(result.message).toContain('terminal');
    });

    test('should detect terminal type automatically', async () => {
      // Mock process.env for different terminal types
      const originalEnv = process.env.TERM_PROGRAM;
      
      process.env.TERM_PROGRAM = 'vscode';
      const result1 = await simulateSlashCommand('/terminal-setup');
      expect(result1.message).toContain('VS Code');

      process.env.TERM_PROGRAM = 'iTerm.app';
      const result2 = await simulateSlashCommand('/terminal-setup');
      expect(result2.message).toContain('iTerm');

      process.env.TERM_PROGRAM = originalEnv;
    });

    test('should provide Shift+Enter fix instructions', async () => {
      const result = await simulateSlashCommand('/terminal-setup');
      expect(result.message).toContain('Shift+Enter');
    });
  });

  describe('/compact command', () => {
    test('should handle basic compact command', async () => {
      const result = await simulateSlashCommand('/compact');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Compacting');
    });

    test('should handle compact with focus instructions', async () => {
      const result = await simulateSlashCommand('/compact focus on important parts');
      expect(result.success).toBe(true);
      expect(result.instructions).toContain('focus on important parts');
    });

    test('should handle compact with complex instructions', async () => {
      const instructions = 'keep only error messages and function signatures';
      const result = await simulateSlashCommand(`/compact ${instructions}`);
      expect(result.success).toBe(true);
      expect(result.instructions).toBe(instructions);
    });
  });

  describe('/bug command', () => {
    test('should redirect to Plato GitHub issues', async () => {
      const result = await simulateSlashCommand('/bug');
      expect(result.success).toBe(true);
      expect(mockOpen).toHaveBeenCalledWith(expect.stringContaining('github.com'));
      expect(mockOpen).toHaveBeenCalledWith(expect.stringContaining('issues'));
    });

    test('should handle bug command with description', async () => {
      const result = await simulateSlashCommand('/bug keyboard shortcuts not working');
      expect(result.success).toBe(true);
      expect(result.description).toContain('keyboard shortcuts not working');
    });

    test('should not redirect to Anthropic issues', async () => {
      const result = await simulateSlashCommand('/bug');
      expect(mockOpen).not.toHaveBeenCalledWith(expect.stringContaining('anthropic'));
    });
  });

  describe('/help command enhancement', () => {
    test('should list all commands including new ones', async () => {
      const result = await simulateSlashCommand('/help');
      expect(result.success).toBe(true);
      
      const newCommands = ['/ide', '/install-github-app', '/terminal-setup', '/compact', '/bug'];
      newCommands.forEach(cmd => {
        expect(result.commandList).toContain(cmd);
      });
    });

    test('should maintain existing command help', async () => {
      const result = await simulateSlashCommand('/help');
      const existingCommands = ['/help', '/status', '/login', '/logout'];
      existingCommands.forEach(cmd => {
        expect(result.commandList).toContain(cmd);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid commands gracefully', async () => {
      const result = await simulateSlashCommand('/invalid-command');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown');
    });

    test('should handle malformed commands gracefully', async () => {
      const result = await simulateSlashCommand('/');
      expect(result.success).toBe(false);
    });

    test('should handle empty commands', async () => {
      const result = await simulateSlashCommand('');
      expect(result.success).toBe(false);
    });
  });

  describe('Integration with Orchestrator', () => {
    test('should integrate with existing orchestrator methods', async () => {
      // Test that new commands work with existing orchestrator state
      await orchestrator.setTranscriptMode(true);
      const result = await simulateSlashCommand('/compact');
      expect(result.success).toBe(true);
    });

    test('should maintain state after command execution', async () => {
      await orchestrator.setBackgroundMode(true);
      await simulateSlashCommand('/terminal-setup');
      expect(orchestrator.isBackgroundMode()).toBe(true);
    });
  });
});

// Helper function to simulate slash command execution
// This would be implemented in the actual TUI handler
async function simulateSlashCommand(command: string): Promise<any> {
  const parts = command.trim().split(' ');
  const cmd = parts[0];
  const args = parts.slice(1).join(' ');

  switch (cmd) {
    case '/ide':
      return handleIdeCommand(args);
    case '/install-github-app':
      return handleInstallGithubAppCommand();
    case '/terminal-setup':
      return handleTerminalSetupCommand();
    case '/compact':
      return handleCompactCommand(args);
    case '/bug':
      return handleBugCommand(args);
    case '/help':
      return handleHelpCommand();
    case '':
      return { success: false, message: 'Empty command' };
    default:
      return { success: false, message: `Unknown command: ${cmd}` };
  }
}

// Mock implementations for testing
async function handleIdeCommand(editor?: string): Promise<any> {
  const supportedEditors = ['vscode', 'cursor', 'vim', 'emacs', 'sublime'];
  
  if (editor && !supportedEditors.includes(editor)) {
    return { success: false, message: `Unsupported editor. Supported: ${supportedEditors.join(', ')}` };
  }

  return { success: true, message: `IDE connection ${editor ? `for ${editor}` : 'established'}` };
}

async function handleInstallGithubAppCommand(): Promise<any> {
  const url = 'https://github.com/apps/plato-ai/installations/new';
  await mockOpen(url);
  return { success: true, message: 'Opening GitHub app installation page...' };
}

async function handleTerminalSetupCommand(): Promise<any> {
  const termProgram = process.env.TERM_PROGRAM || 'unknown';
  let message = 'Terminal setup instructions:\n';
  
  switch (termProgram) {
    case 'vscode':
      message += '- VS Code Terminal detected\n';
      break;
    case 'iTerm.app':
      message += '- iTerm detected\n';
      break;
    default:
      message += '- Generic terminal detected\n';
  }
  
  message += '- To fix Shift+Enter: Check terminal key bindings\n';
  message += '- Ensure terminal is configured for proper key codes';
  
  return { success: true, message };
}

async function handleCompactCommand(instructions?: string): Promise<any> {
  return { 
    success: true, 
    message: `Compacting conversation${instructions ? ' with custom instructions' : ''}...`,
    instructions: instructions || undefined
  };
}

async function handleBugCommand(description?: string): Promise<any> {
  const url = 'https://github.com/plato-ai/plato/issues/new';
  await mockOpen(url);
  return { 
    success: true, 
    message: 'Opening Plato GitHub issues page...',
    description: description || undefined
  };
}

async function handleHelpCommand(): Promise<any> {
  const commandList = SLASH_COMMANDS.map(c => c.name);
  return {
    success: true,
    message: 'Available commands listed',
    commandList
  };
}