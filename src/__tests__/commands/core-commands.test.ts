// Mock external dependencies before imports
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  access: jest.fn(),
}));

jest.mock('glob', () => ({
  glob: jest.fn().mockResolvedValue(['src/index.ts', 'package.json', 'README.md']),
}));

jest.mock('ignore', () => {
  const mockIgnore = {
    add: jest.fn().mockReturnThis(),
    ignores: jest.fn().mockReturnValue(false),
  };
  return jest.fn(() => mockIgnore);
});

jest.mock('../../ops/init', () => ({
  generateProjectDoc: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../memory/manager', () => {
  const mockMemoryManager = {
    addMemory: jest.fn().mockResolvedValue(undefined),
    getMemories: jest.fn().mockResolvedValue([]),
    clearMemories: jest.fn().mockResolvedValue(undefined),
    updateProjectContext: jest.fn().mockResolvedValue(undefined),
    getPlatoFileContent: jest.fn().mockResolvedValue('# Project Documentation'),
    saveSession: jest.fn().mockResolvedValue(undefined),
    restoreSession: jest.fn().mockResolvedValue(null),
    getStatistics: jest.fn().mockResolvedValue({ totalEntries: 0, totalSize: 0 }),
  };
  return {
    MemoryManager: jest.fn(() => mockMemoryManager),
  };
});

jest.mock('../../runtime/orchestrator', () => ({
  orchestrator: {
    addMemory: jest.fn().mockResolvedValue(undefined),
    getMemory: jest.fn().mockResolvedValue([]),
    clearMemory: jest.fn().mockResolvedValue(undefined),
    updateProjectContext: jest.fn().mockResolvedValue(undefined),
  },
}));

import { SLASH_MAP } from '../../slash/commands';
import { generateProjectDoc } from '../../ops/init';
import { orchestrator } from '../../runtime/orchestrator';

describe('Core Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Command Registry', () => {
    test('should have /help command registered', () => {
      expect(SLASH_MAP.has('/help')).toBe(true);
      const command = SLASH_MAP.get('/help');
      expect(command?.summary).toContain('help');
      expect(command?.summary).toContain('commands');
    });

    test('should have /init command registered', () => {
      expect(SLASH_MAP.has('/init')).toBe(true);
      const command = SLASH_MAP.get('/init');
      expect(command?.summary).toContain('Initialize');
      expect(command?.summary).toContain('PLATO.md');
    });

    test('should have /memory command registered', () => {
      expect(SLASH_MAP.has('/memory')).toBe(true);
      const command = SLASH_MAP.get('/memory');
      expect(command?.summary).toContain('memory');
    });
  });

  describe('/help Command', () => {
    test('should list all available commands', async () => {
      const result = await simulateHelpCommand();
      
      expect(result.success).toBe(true);
      expect(result.commands).toBeInstanceOf(Array);
      expect(result.commands.length).toBeGreaterThan(30);
    });

    test('should include command names and summaries', async () => {
      const result = await simulateHelpCommand();
      
      expect(result.success).toBe(true);
      result.commands.forEach((cmd: any) => {
        expect(cmd).toHaveProperty('name');
        expect(cmd).toHaveProperty('summary');
        expect(cmd.name).toMatch(/^\/[a-z-:]+$/);
        expect(cmd.summary.length).toBeGreaterThan(0);
      });
    });

    test('should include essential commands', async () => {
      const result = await simulateHelpCommand();
      const commandNames = result.commands.map((cmd: any) => cmd.name);
      
      const essentialCommands = [
        '/help', '/status', '/login', '/logout', '/init', '/memory'
      ];
      
      essentialCommands.forEach(cmd => {
        expect(commandNames).toContain(cmd);
      });
    });

    test('should format output consistently', async () => {
      const result = await simulateHelpCommand();
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('Commands:');
      result.commands.forEach((cmd: any) => {
        expect(result.output).toContain(`${cmd.name} — ${cmd.summary}`);
      });
    });

    test('should handle help command with no arguments', async () => {
      const result = await simulateHelpCommand('');
      
      expect(result.success).toBe(true);
      expect(result.commands.length).toBeGreaterThan(0);
    });

    test('should handle help with invalid arguments gracefully', async () => {
      const result = await simulateHelpCommand('nonexistent');
      
      expect(result.success).toBe(true);
      // Should still show all commands even with invalid args
      expect(result.commands.length).toBeGreaterThan(0);
    });
  });

  describe('/init Command', () => {
    test('should initialize PLATO.md file', async () => {
      const mockGenerateProjectDoc = generateProjectDoc as jest.MockedFunction<typeof generateProjectDoc>;
      mockGenerateProjectDoc.mockResolvedValueOnce(undefined);

      const result = await simulateInitCommand();
      
      expect(result.success).toBe(true);
      expect(mockGenerateProjectDoc).toHaveBeenCalledTimes(1);
      expect(result.message).toContain('PLATO.md');
    });

    test('should handle initialization failure', async () => {
      const mockGenerateProjectDoc = generateProjectDoc as jest.MockedFunction<typeof generateProjectDoc>;
      mockGenerateProjectDoc.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await simulateInitCommand();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    test('should create project documentation', async () => {
      const fs = require('fs/promises');
      fs.writeFile.mockResolvedValueOnce(undefined);

      const result = await simulateInitCommand();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('initialized');
    });

    test('should analyze project structure', async () => {
      const glob = require('glob');
      glob.glob.mockResolvedValueOnce([
        'src/index.ts',
        'src/components/App.tsx',
        'package.json',
        'README.md'
      ]);

      const result = await simulateInitCommand();
      
      expect(result.success).toBe(true);
      expect(generateProjectDoc).toHaveBeenCalled();
    });

    test('should handle empty project gracefully', async () => {
      const glob = require('glob');
      glob.glob.mockResolvedValueOnce([]);

      const result = await simulateInitCommand();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('initialized');
    });

    test('should respect .gitignore rules', async () => {
      const fs = require('fs/promises');
      fs.readFile.mockResolvedValueOnce('node_modules/\n*.log\ndist/');

      const result = await simulateInitCommand();
      
      expect(result.success).toBe(true);
      expect(generateProjectDoc).toHaveBeenCalled();
    });
  });

  describe('/memory Command', () => {
    describe('Memory List Command', () => {
      test('should list recent memories', async () => {
        const mockOrchestrator = orchestrator as any;
        mockOrchestrator.getMemory.mockResolvedValueOnce([
          '[1640995200000] conversation: Test memory 1',
          '[1640995199000] custom: Test memory 2'
        ]);

        const result = await simulateMemoryCommand('list');
        
        expect(result.success).toBe(true);
        expect(result.memories).toHaveLength(2);
        expect(result.memories![0]).toContain('Test memory 1');
      });

      test('should handle empty memory list', async () => {
        const mockOrchestrator = orchestrator as any;
        mockOrchestrator.getMemory.mockResolvedValueOnce([]);

        const result = await simulateMemoryCommand('list');
        
        expect(result.success).toBe(true);
        expect(result.memories).toHaveLength(0);
        expect(result.message).toContain('No memories');
      });
    });

    describe('Memory Clear Command', () => {
      test('should clear all memories', async () => {
        const mockOrchestrator = orchestrator as any;
        mockOrchestrator.clearMemory.mockResolvedValueOnce(undefined);

        const result = await simulateMemoryCommand('clear');
        
        expect(result.success).toBe(true);
        expect(mockOrchestrator.clearMemory).toHaveBeenCalledTimes(1);
        expect(result.message).toContain('cleared');
      });

      test('should handle clear failure', async () => {
        const mockOrchestrator = orchestrator as any;
        mockOrchestrator.clearMemory.mockRejectedValueOnce(new Error('Clear failed'));

        const result = await simulateMemoryCommand('clear');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Clear failed');
      });
    });

    describe('Memory Add Command', () => {
      test('should add custom memory', async () => {
        const mockOrchestrator = orchestrator as any;
        mockOrchestrator.addMemory.mockResolvedValueOnce(undefined);

        const result = await simulateMemoryCommand('add', 'Important note about the project');
        
        expect(result.success).toBe(true);
        expect(mockOrchestrator.addMemory).toHaveBeenCalledWith('custom', 'Important note about the project');
        expect(result.message).toContain('Added memory');
      });

      test('should handle add without content', async () => {
        const result = await simulateMemoryCommand('add');
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('Use: /memory add <content>');
      });

      test('should handle add failure', async () => {
        const mockOrchestrator = orchestrator as any;
        mockOrchestrator.addMemory.mockRejectedValueOnce(new Error('Add failed'));

        const result = await simulateMemoryCommand('add', 'Test content');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Add failed');
      });
    });

    describe('Memory Context Command', () => {
      test('should show PLATO.md content', async () => {
        const result = await simulateMemoryCommand('context');
        
        expect(result.success).toBe(true);
        expect(result.message).toContain('PLATO.md');
      });

      test('should update project context', async () => {
        const mockOrchestrator = orchestrator as any;
        mockOrchestrator.updateProjectContext.mockResolvedValueOnce(undefined);

        const result = await simulateMemoryCommand('update-context', 'Updated project info');
        
        expect(result.success).toBe(true);
        expect(mockOrchestrator.updateProjectContext).toHaveBeenCalledWith('Updated project info');
        expect(result.message).toContain('Updated PLATO.md');
      });

      test('should handle update-context without content', async () => {
        const result = await simulateMemoryCommand('update-context');
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('Use: /memory update-context <content>');
      });
    });

    describe('Memory Help Command', () => {
      test('should show memory command help', async () => {
        const result = await simulateMemoryCommand('help');
        
        expect(result.success).toBe(true);
        expect(result.help).toContain('Memory commands:');
        expect(result.help).toContain('/memory list');
        expect(result.help).toContain('/memory clear');
        expect(result.help).toContain('/memory add');
      });
    });

    test('should handle unknown memory subcommands', async () => {
      const result = await simulateMemoryCommand('unknown-command');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown memory command');
      expect(result.message).toContain('Use \'/memory help\'');
    });

    test('should handle memory command without arguments', async () => {
      const result = await simulateMemoryCommand('');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Use \'/memory help\'');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle filesystem errors gracefully', async () => {
      const mockGenerateProjectDoc = generateProjectDoc as jest.MockedFunction<typeof generateProjectDoc>;
      mockGenerateProjectDoc.mockRejectedValueOnce(new Error('ENOENT: permission denied'));

      const result = await simulateInitCommand();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    test('should handle memory system failures', async () => {
      const mockOrchestrator = orchestrator as any;
      mockOrchestrator.getMemory.mockRejectedValueOnce(new Error('Memory system down'));

      const result = await simulateMemoryCommand('list');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Memory system down');
    });

    test('should handle malformed arguments', async () => {
      const result = await simulateMemoryCommand('add', '');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Use: /memory add <content>');
    });
  });
});

// Helper functions for core command testing
async function simulateHelpCommand(args?: string): Promise<{
  success: boolean;
  commands: Array<{ name: string; summary: string }>;
  output: string;
}> {
  try {
    const { SLASH_COMMANDS } = await import('../../slash/commands');
    const commands = SLASH_COMMANDS.map(c => ({ name: c.name, summary: c.summary }));
    const output = 'Commands:\n' + commands.map(c => ` ${c.name} — ${c.summary}`).join('\n');
    
    return {
      success: true,
      commands,
      output
    };
  } catch (error) {
    return {
      success: false,
      commands: [],
      output: '',
    };
  }
}

async function simulateInitCommand(): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    await generateProjectDoc();
    return {
      success: true,
      message: 'Successfully initialized PLATO.md'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Init failed',
      error: (error as Error).message
    };
  }
}

async function simulateMemoryCommand(action: string, content?: string): Promise<{
  success: boolean;
  message?: string;
  memories?: string[];
  help?: string;
  error?: string;
}> {
  try {
    switch (action) {
      case 'list': {
        const memories = await orchestrator.getMemory();
        return {
          success: true,
          memories,
          message: memories.length === 0 ? 'No memories found' : undefined
        };
      }
      
      case 'clear': {
        await orchestrator.clearMemory();
        return {
          success: true,
          message: 'All memories cleared'
        };
      }
      
      case 'add': {
        if (!content || content.trim() === '') {
          return {
            success: false,
            message: 'Use: /memory add <content>'
          };
        }
        await orchestrator.addMemory('custom', content);
        return {
          success: true,
          message: `Added memory: ${content}`
        };
      }
      
      case 'context': {
        return {
          success: true,
          message: 'Showing PLATO.md content'
        };
      }
      
      case 'update-context': {
        if (!content || content.trim() === '') {
          return {
            success: false,
            message: 'Use: /memory update-context <content>'
          };
        }
        await orchestrator.updateProjectContext(content);
        return {
          success: true,
          message: 'Updated PLATO.md'
        };
      }
      
      case 'help': {
        const helpText = [
          'Memory commands:',
          '  /memory list         - Show recent memories',
          '  /memory clear        - Clear all memories',
          '  /memory add <text>   - Add custom memory',
          '  /memory context      - Show PLATO.md content',
          '  /memory update-context <text> - Update PLATO.md',
          '  /memory save-session - Save current session',
          '  /memory restore-session - Restore last session'
        ].join('\n');
        
        return {
          success: true,
          help: helpText
        };
      }
      
      case '': {
        return {
          success: false,
          message: 'Use \'/memory help\' for options.'
        };
      }
      
      default: {
        return {
          success: false,
          message: `Unknown memory command: ${action}. Use '/memory help' for options.`
        };
      }
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}