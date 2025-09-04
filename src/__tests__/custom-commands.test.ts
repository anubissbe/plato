import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { CustomCommandLoader } from '../commands/loader';
import { CustomCommand, CommandNamespace } from '../commands/types';
import { executeCustomCommand } from '../commands/executor';

// Mock fs for controlled testing
jest.mock('fs/promises');

describe('Custom Commands System', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  const testCommandsDir = '.plato/commands';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('CustomCommandLoader', () => {
    describe('directory structure', () => {
      test('should create commands directory if it does not exist', async () => {
        mockFs.access.mockRejectedValue(new Error('ENOENT'));
        mockFs.mkdir.mockResolvedValue(undefined);
        
        const loader = new CustomCommandLoader(testCommandsDir);
        await loader.initialize();
        
        expect(mockFs.mkdir).toHaveBeenCalledWith(
          testCommandsDir,
          { recursive: true }
        );
      });

      test('should not create directory if it already exists', async () => {
        mockFs.access.mockResolvedValue(undefined);
        
        const loader = new CustomCommandLoader(testCommandsDir);
        await loader.initialize();
        
        expect(mockFs.mkdir).not.toHaveBeenCalled();
      });
    });

    describe('command discovery', () => {
      test('should discover markdown files in root directory', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockFs.readdir.mockResolvedValue([
          { name: 'test-command.md', isDirectory: () => false, isFile: () => true } as any,
          { name: 'another.md', isDirectory: () => false, isFile: () => true } as any,
          { name: 'not-markdown.txt', isDirectory: () => false, isFile: () => true } as any,
        ]);
        
        // Mock parseCommand to return valid commands based on filename
        let callCount = 0;
        const commands = ['test-command', 'another'];
        mockFs.readFile.mockImplementation(() => {
          const name = commands[callCount++] || 'default';
          return Promise.resolve(`# ${name}\n\nDescription\n\n## Command\n\`\`\`bash\necho "${name}"\n\`\`\``) as any;
        });
        
        const loader = new CustomCommandLoader(testCommandsDir);
        await loader.initialize();
        const commandList = await loader.discoverCommands();
        
        expect(commandList).toHaveLength(2);
        expect(commandList[0].name).toBe('test-command');
        expect(commandList[1].name).toBe('another');
      });

      test('should discover commands in namespace directories', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockFs.readdir
          .mockResolvedValueOnce([
            { name: 'git', isDirectory: () => true, isFile: () => false } as any,
            { name: 'root.md', isDirectory: () => false, isFile: () => true } as any,
          ])
          .mockResolvedValueOnce([
            { name: 'commit.md', isDirectory: () => false, isFile: () => true } as any,
            { name: 'push.md', isDirectory: () => false, isFile: () => true } as any,
          ]);
        
        // Mock readFile to return valid command markdown based on filename
        let callCount = 0;
        const commandNames = ['root', 'commit', 'push'];
        mockFs.readFile.mockImplementation(() => {
          const name = commandNames[callCount++] || 'default';
          return Promise.resolve(`# ${name}\n\nDescription\n\n## Command\n\`\`\`bash\necho "${name}"\n\`\`\``) as any;
        });
        
        const loader = new CustomCommandLoader(testCommandsDir);
        await loader.initialize();
        const commands = await loader.discoverCommands();
        
        expect(commands).toHaveLength(3);
        expect(commands.map((c: CustomCommand) => c.name)).toContain('root');
        expect(commands.map((c: CustomCommand) => c.name)).toContain('git:commit');
        expect(commands.map((c: CustomCommand) => c.name)).toContain('git:push');
      });

      test('should support nested namespaces', async () => {
        mockFs.access.mockResolvedValue(undefined);
        mockFs.readdir
          .mockResolvedValueOnce([
            { name: 'project', isDirectory: () => true, isFile: () => false } as any,
          ])
          .mockResolvedValueOnce([
            { name: 'backend', isDirectory: () => true, isFile: () => false } as any,
          ])
          .mockResolvedValueOnce([
            { name: 'deploy.md', isDirectory: () => false, isFile: () => true } as any,
          ]);
        
        // Mock readFile for the deploy command
        mockFs.readFile.mockResolvedValue(`# Deploy\n\nDeploy command\n\n## Command\n\`\`\`bash\nnpm run deploy\n\`\`\``);
        
        const loader = new CustomCommandLoader(testCommandsDir);
        await loader.initialize();
        const commands = await loader.discoverCommands();
        
        expect(commands).toHaveLength(1);
        expect(commands[0].name).toBe('project:backend:deploy');
      });
    });

    describe('markdown parsing', () => {
      test('should parse basic command markdown', async () => {
        const markdown = `# Test Command

This is a test command.

## Command
\`\`\`bash
echo "Hello, World!"
\`\`\`
`;
        mockFs.readFile.mockResolvedValue(markdown);
        
        const loader = new CustomCommandLoader(testCommandsDir);
        const command = await loader.parseCommand('test.md');
        
        expect(command).not.toBeNull();
        expect(command!.name).toBe('test');
        expect(command!.description).toBe('This is a test command.');
        expect(command!.script).toBe('echo "Hello, World!"');
      });

      test('should parse command with arguments placeholder', async () => {
        const markdown = `# Git Commit

Commit with message.

## Command
\`\`\`bash
git add .
git commit -m "$ARGUMENTS"
\`\`\`
`;
        mockFs.readFile.mockResolvedValue(markdown);
        
        const loader = new CustomCommandLoader(testCommandsDir);
        const command = await loader.parseCommand('commit.md');
        
        expect(command).not.toBeNull();
        expect(command!.name).toBe('commit');
        expect(command!.script).toContain('$ARGUMENTS');
        expect(command!.hasArguments).toBe(true);
      });

      test('should parse command with metadata', async () => {
        const markdown = `---
name: custom-name
description: Override description
namespace: tools
---

# Test Command

This description will be overridden.

## Command
\`\`\`bash
echo "test"
\`\`\`
`;
        mockFs.readFile.mockResolvedValue(markdown);
        
        const loader = new CustomCommandLoader(testCommandsDir);
        const command = await loader.parseCommand('test.md');
        
        expect(command).not.toBeNull();
        expect(command!.name).toBe('custom-name');
        expect(command!.description).toBe('Override description');
        expect(command!.namespace).toBe('tools');
      });

      test('should handle multi-language code blocks', async () => {
        const markdown = `# Multi Language

## Command
\`\`\`javascript
console.log("JavaScript code")
\`\`\`

\`\`\`bash
echo "Bash code"
\`\`\`
`;
        mockFs.readFile.mockResolvedValue(markdown);
        
        const loader = new CustomCommandLoader(testCommandsDir);
        const command = await loader.parseCommand('multi.md');
        
        // Should use first bash block or first code block
        expect(command).not.toBeNull();
        expect(command!.script).toContain('echo "Bash code"');
      });
    });
  });

  describe('executeCustomCommand', () => {
    test('should execute simple command', async () => {
      const command: CustomCommand = {
        name: 'test',
        description: 'Test command',
        script: 'echo "Hello"',
        hasArguments: false,
      };
      
      const result = await executeCustomCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello');
    });

    test('should substitute $ARGUMENTS placeholder', async () => {
      const command: CustomCommand = {
        name: 'echo-args',
        description: 'Echo arguments',
        script: 'echo "$ARGUMENTS"',
        hasArguments: true,
      };
      
      const result = await executeCustomCommand(command, 'test arguments');
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('test arguments');
    });

    test('should handle command with multiple $ARGUMENTS', async () => {
      const command: CustomCommand = {
        name: 'multi-args',
        description: 'Multiple arguments',
        script: 'echo "First: $ARGUMENTS" && echo "Second: $ARGUMENTS"',
        hasArguments: true,
      };
      
      const result = await executeCustomCommand(command, 'value');
      
      expect(result.success).toBe(true);
      expect(result.output).toMatch(/First: value.*Second: value/s);
    });

    test('should handle command failure gracefully', async () => {
      const command: CustomCommand = {
        name: 'fail',
        description: 'Failing command',
        script: 'exit 1',
        hasArguments: false,
      };
      
      const result = await executeCustomCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should timeout long-running commands', async () => {
      const command: CustomCommand = {
        name: 'timeout',
        description: 'Long command',
        script: 'sleep 30',
        hasArguments: false,
      };
      
      const result = await executeCustomCommand(command, '', { timeout: 100 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    }, 1000);

    test('should preserve environment variables', async () => {
      const command: CustomCommand = {
        name: 'env',
        description: 'Environment test',
        script: 'echo "$HOME"',
        hasArguments: false,
      };
      
      const result = await executeCustomCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.output).toBeTruthy();
    });
  });

  describe('Command Integration', () => {
    test('should integrate with slash command system', async () => {
      const loader = new CustomCommandLoader(testCommandsDir);
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([
        { name: 'deploy.md', isDirectory: () => false, isFile: () => true } as any,
      ]);
      mockFs.readFile.mockResolvedValue(`# Deploy

Deploy the application.

## Command
\`\`\`bash
npm run build
\`\`\`
`);
      
      await loader.initialize();
      const commands = await loader.discoverCommands();
      const slashCommands = loader.toSlashCommands(commands);
      
      expect(slashCommands).toHaveLength(1);
      expect(slashCommands[0].name).toBe('/deploy');
      expect(slashCommands[0].summary).toBeDefined();
    });

    test('should handle namespace in slash commands', async () => {
      const command: CustomCommand = {
        name: 'commit',
        namespace: 'git',
        description: 'Git commit',
        script: 'git commit',
        hasArguments: true,
      };
      
      const loader = new CustomCommandLoader(testCommandsDir);
      const slashCommand = loader.toSlashCommand(command);
      
      expect(slashCommand.name).toBe('/git:commit');
      expect(slashCommand.summary).toBe('Git commit');
    });

    test('should support command aliases', async () => {
      const markdown = `---
name: deploy
aliases: ["d", "dep"]
---

# Deploy Command

## Command
\`\`\`bash
npm run deploy
\`\`\`
`;
      mockFs.readFile.mockResolvedValue(markdown);
      
      const loader = new CustomCommandLoader(testCommandsDir);
      const command = await loader.parseCommand('deploy.md');
      
      expect(command).not.toBeNull();
      expect(command!.aliases).toEqual(['d', 'dep']);
    });
  });

  describe('Command Menu Integration', () => {
    test('should generate menu structure for discovered commands', async () => {
      const commands: CustomCommand[] = [
        { name: 'test', description: 'Test', script: 'test', hasArguments: false },
        { name: 'commit', namespace: 'git', description: 'Commit', script: 'git commit', hasArguments: true },
        { name: 'push', namespace: 'git', description: 'Push', script: 'git push', hasArguments: false },
      ];
      
      const loader = new CustomCommandLoader(testCommandsDir);
      const menu = loader.generateMenu(commands);
      
      expect(menu.root).toHaveLength(1); // 'test' command
      expect(menu.namespaces.get('git')).toHaveLength(2); // 'commit' and 'push'
    });

    test('should sort commands alphabetically in menu', async () => {
      const commands: CustomCommand[] = [
        { name: 'zebra', description: 'Z', script: 'z', hasArguments: false },
        { name: 'alpha', description: 'A', script: 'a', hasArguments: false },
        { name: 'beta', description: 'B', script: 'b', hasArguments: false },
      ];
      
      const loader = new CustomCommandLoader(testCommandsDir);
      const menu = loader.generateMenu(commands);
      
      expect(menu.root[0].name).toBe('alpha');
      expect(menu.root[1].name).toBe('beta');
      expect(menu.root[2].name).toBe('zebra');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed markdown gracefully', async () => {
      const markdown = `This is not proper command markdown`;
      mockFs.readFile.mockResolvedValue(markdown);
      
      const loader = new CustomCommandLoader(testCommandsDir);
      const command = await loader.parseCommand('bad.md');
      
      expect(command).toBeNull();
    });

    test('should handle missing script section', async () => {
      const markdown = `# Command without script

Just a description, no command block.`;
      mockFs.readFile.mockResolvedValue(markdown);
      
      const loader = new CustomCommandLoader(testCommandsDir);
      const command = await loader.parseCommand('noscript.md');
      
      expect(command).toBeNull();
    });

    test('should handle file read errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      
      const loader = new CustomCommandLoader(testCommandsDir);
      const command = await loader.parseCommand('missing.md');
      
      expect(command).toBeNull();
    });
  });
});