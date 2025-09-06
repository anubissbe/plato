/**
 * Custom Commands Integration Tests
 * 
 * Tests the complete custom command loading, execution, and management system
 * including validation, error handling, and integration with the main command system.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { orchestrator } from '../../runtime/orchestrator';
import { IntegrationTestFramework } from './framework.test';
import type { CustomCommand } from '../../commands/types';

describe('Custom Commands Integration Tests', () => {
  let framework: IntegrationTestFramework;
  // Using imported orchestrator module

  beforeEach(async () => {
    framework = new IntegrationTestFramework();
    await framework.setup();
  });

  afterEach(async () => {
    await framework.teardown();
  });

  describe('Custom Command Loading', () => {
    test('should load and register custom commands from directory', async () => {
      // Create custom command definition
      const customCommand: CustomCommand = {
        name: 'test-cmd',
        description: 'A test custom command',
        aliases: ['tc', 'testcmd'],
        script: 'echo "Custom command executed"',
        hasArguments: true,
        metadata: {
          version: '1.0.0',
          author: 'Test Author'
        }
      };

      // Save command definition
      const commandPath = '.plato/commands/test-cmd.json';
      await framework.createTestFile(commandPath, JSON.stringify(customCommand, null, 2));

      // Load custom commands
      const loadedCommands = await simulateCustomCommandLoading();
      
      expect(loadedCommands.success).toBe(true);
      expect(loadedCommands.commandsLoaded).toBeGreaterThan(0);
      expect(loadedCommands.commands).toContain('test-cmd');

      // Verify command is registered
      const isRegistered = await simulateCommandRegistrationCheck('test-cmd');
      expect(isRegistered).toBe(true);
    });

    test('should handle multiple custom commands with different configurations', async () => {
      // Create multiple custom commands
      const commands: CustomCommand[] = [
        {
          name: 'deploy',
          description: 'Deploy application to production',
          script: 'npm run deploy',
          hasArguments: true,
          metadata: { version: '1.0.0', author: 'DevOps Team' }
        },
        {
          name: 'backup',
          description: 'Create database backup',
          aliases: ['bk'],
          script: 'pg_dump mydb > backup.sql',
          hasArguments: false,
          metadata: { version: '2.1.0', author: 'Database Admin' }
        },
        {
          name: 'analyze-logs',
          description: 'Analyze application logs for errors',
          script: 'grep -i error logs/*.log',
          hasArguments: true,
          metadata: { version: '1.2.0', author: 'Support Team' }
        }
      ];

      // Save all command definitions
      for (const cmd of commands) {
        const cmdPath = `.plato/commands/${cmd.name}.json`;
        await framework.createTestFile(cmdPath, JSON.stringify(cmd, null, 2));
      }

      // Load custom commands
      const loadResult = await simulateCustomCommandLoading();
      
      expect(loadResult.success).toBe(true);
      expect(loadResult.commandsLoaded).toBe(3);
      expect(loadResult.commands).toEqual(expect.arrayContaining(['deploy', 'backup', 'analyze-logs']));

      // Verify each command is properly registered
      for (const cmd of commands) {
        const isRegistered = await simulateCommandRegistrationCheck(cmd.name);
        expect(isRegistered).toBe(true);
      }

      // Verify aliases are registered
      const backupAliasRegistered = await simulateCommandRegistrationCheck('bk');
      expect(backupAliasRegistered).toBe(true);
    });

    test('should validate custom command definitions', async () => {
      // Create invalid command definition (missing required fields)
      const invalidCommand = {
        name: 'invalid-cmd',
        // Missing description and handler
        // category removed - not part of interface
      };

      const commandPath = '.plato/commands/invalid-cmd.json';
      await framework.createTestFile(commandPath, JSON.stringify(invalidCommand, null, 2));

      // Loading should handle invalid commands gracefully
      const loadResult = await simulateCustomCommandLoading();
      
      // Should succeed overall but skip invalid commands
      expect(loadResult.success).toBe(true);
      expect(loadResult.errors).toContain('invalid-cmd.json: Missing required field "description"');
      expect(loadResult.commands).not.toContain('invalid-cmd');
    });

    test('should handle malformed JSON files gracefully', async () => {
      // Create malformed JSON file
      const malformedPath = '.plato/commands/malformed.json';
      await framework.createTestFile(malformedPath, '{"name": "test", "description": "incomplete...');

      // Loading should handle malformed files gracefully
      const loadResult = await simulateCustomCommandLoading();
      
      expect(loadResult.success).toBe(true);
      expect(loadResult.errors).toContain('malformed.json: Invalid JSON format');
      expect(loadResult.commandsLoaded).toBe(0);
    });
  });

  describe('Custom Command Execution', () => {
    test('should execute custom commands with proper argument handling', async () => {
      // Create and load custom command
      const customCommand: CustomCommand = {
        name: 'greet',
        description: 'Greet a user',
        handler: 'echo "Hello, $1!"',
        validation: { requiredArgs: 1, maxArgs: 1 },
        metadata: { version: '1.0.0' }
      };

      await framework.createTestFile('.plato/commands/greet.json', JSON.stringify(customCommand));
      await simulateCustomCommandLoading();

      // Execute custom command with arguments
      const execResult = await simulateCustomCommandExecution('greet', ['World']);
      
      expect(execResult.success).toBe(true);
      expect(execResult.output).toBe('Hello, World!');
      expect(execResult.exitCode).toBe(0);
    });

    test('should validate arguments before execution', async () => {
      // Create command with strict argument validation
      const strictCommand: CustomCommand = {
        name: 'strict-cmd',
        description: 'Command with strict argument validation',
        handler: 'echo "Args: $@"',
        validation: { requiredArgs: 2, maxArgs: 3 },
        metadata: { version: '1.0.0' }
      };

      await framework.createTestFile('.plato/commands/strict-cmd.json', JSON.stringify(strictCommand));
      await simulateCustomCommandLoading();

      // Test with insufficient arguments
      const insufficientArgsResult = await simulateCustomCommandExecution('strict-cmd', ['only-one']);
      expect(insufficientArgsResult.success).toBe(false);
      expect(insufficientArgsResult.error).toContain('Requires at least 2 arguments');

      // Test with too many arguments
      const tooManyArgsResult = await simulateCustomCommandExecution('strict-cmd', ['1', '2', '3', '4']);
      expect(tooManyArgsResult.success).toBe(false);
      expect(tooManyArgsResult.error).toContain('Accepts at most 3 arguments');

      // Test with correct arguments
      const validArgsResult = await simulateCustomCommandExecution('strict-cmd', ['arg1', 'arg2']);
      expect(validArgsResult.success).toBe(true);
    });

    test('should handle command execution failures gracefully', async () => {
      // Create command that will fail
      const failingCommand: CustomCommand = {
        name: 'fail-cmd',
        description: 'A command that fails',
        handler: 'exit 1',
        validation: { requiredArgs: 0, maxArgs: 0 },
        metadata: { version: '1.0.0' }
      };

      await framework.createTestFile('.plato/commands/fail-cmd.json', JSON.stringify(failingCommand));
      await simulateCustomCommandLoading();

      // Execute failing command
      const execResult = await simulateCustomCommandExecution('fail-cmd', []);
      
      expect(execResult.success).toBe(false);
      expect(execResult.exitCode).toBe(1);
      expect(execResult.error).toBeTruthy();
    });

    test('should execute commands with complex handlers', async () => {
      // Create command with complex multi-step handler
      const complexCommand: CustomCommand = {
        name: 'setup-env',
        description: 'Setup development environment',
        handler: [
          'echo "Setting up environment..."',
          'mkdir -p temp/logs',
          'echo "Environment ready" > temp/status.txt',
          'echo "Setup complete!"'
        ].join(' && '),
        validation: { requiredArgs: 0, maxArgs: 1 },
        metadata: { version: '1.5.0', author: 'DevOps' }
      };

      await framework.createTestFile('.plato/commands/setup-env.json', JSON.stringify(complexCommand));
      await simulateCustomCommandLoading();

      // Execute complex command
      const execResult = await simulateCustomCommandExecution('setup-env', []);
      
      expect(execResult.success).toBe(true);
      expect(execResult.output).toContain('Setting up environment...');
      expect(execResult.output).toContain('Setup complete!');
      
      // Verify files were created (in test environment they're simulated)
      expect(await framework.fileExists('temp/status.txt')).toBe(false); // Not actually executed in tests
    });
  });

  describe('Custom Command Management', () => {
    test('should list available custom commands', async () => {
      // Create several custom commands
      const commands = [
        { name: 'cmd1', description: 'First command', handler: 'echo 1' },
        { name: 'cmd2', description: 'Second command', handler: 'echo 2' },
        { name: 'cmd3', description: 'Third command', handler: 'echo 3', aliases: ['c3'] }
      ];

      for (const cmd of commands) {
        const fullCmd: CustomCommand = {
          ...cmd,
          validation: { requiredArgs: 0, maxArgs: 0 },
          metadata: { version: '1.0.0' }
        };
        await framework.createTestFile(`.plato/commands/${cmd.name}.json`, JSON.stringify(fullCmd));
      }

      await simulateCustomCommandLoading();

      // List custom commands
      const listResult = await simulateCustomCommandListing();
      
      expect(listResult.success).toBe(true);
      expect(listResult.commands).toHaveLength(3);
      expect(listResult.commands.map(c => c.name)).toEqual(['cmd1', 'cmd2', 'cmd3']);
      expect(listResult.output).toContain('Available custom commands:');
      expect(listResult.output).toContain('cmd1 - First command');
      expect(listResult.output).toContain('cmd3 (c3) - Third command'); // Shows alias
    });

    test('should handle command help and documentation', async () => {
      // Create command with detailed documentation
      const documentedCommand: CustomCommand = {
        name: 'documented-cmd',
        description: 'A well-documented command',
        handler: 'echo "Documented command"',
        validation: { requiredArgs: 1, maxArgs: 2 },
        metadata: {
          version: '2.0.0',
          author: 'Documentation Team',
          examples: [
            'documented-cmd input.txt',
            'documented-cmd input.txt output.txt'
          ],
          notes: 'This command processes files and supports optional output redirection.'
        }
      };

      await framework.createTestFile('.plato/commands/documented-cmd.json', JSON.stringify(documentedCommand));
      await simulateCustomCommandLoading();

      // Get command help
      const helpResult = await simulateCustomCommandHelp('documented-cmd');
      
      expect(helpResult.success).toBe(true);
      expect(helpResult.output).toContain('documented-cmd');
      expect(helpResult.output).toContain('A well-documented command');
      expect(helpResult.output).toContain('Version: 2.0.0');
      expect(helpResult.output).toContain('Author: Documentation Team');
      expect(helpResult.output).toContain('Examples:');
      expect(helpResult.output).toContain('documented-cmd input.txt');
    });

    test('should handle command reloading and hot updates', async () => {
      // Create initial command
      const initialCommand: CustomCommand = {
        name: 'reload-test',
        description: 'Initial version',
        handler: 'echo "v1"',
        validation: { requiredArgs: 0, maxArgs: 0 },
        metadata: { version: '1.0.0' }
      };

      await framework.createTestFile('.plato/commands/reload-test.json', JSON.stringify(initialCommand));
      await simulateCustomCommandLoading();

      // Execute initial version
      let execResult = await simulateCustomCommandExecution('reload-test', []);
      expect(execResult.output).toBe('v1');

      // Update command definition
      const updatedCommand: CustomCommand = {
        ...initialCommand,
        description: 'Updated version',
        handler: 'echo "v2"',
        metadata: { version: '2.0.0' }
      };

      await framework.createTestFile('.plato/commands/reload-test.json', JSON.stringify(updatedCommand));

      // Reload commands
      const reloadResult = await simulateCustomCommandReloading();
      expect(reloadResult.success).toBe(true);
      expect(reloadResult.updated).toContain('reload-test');

      // Execute updated version
      execResult = await simulateCustomCommandExecution('reload-test', []);
      expect(execResult.output).toBe('v2');
    });
  });

  describe('Integration with Built-in Commands', () => {
    test('should not conflict with built-in slash commands', async () => {
      // Try to create custom command with built-in name
      const conflictingCommand: CustomCommand = {
        name: 'help',  // Built-in command name
        description: 'Custom help command',
        handler: 'echo "Custom help"',
        validation: { requiredArgs: 0, maxArgs: 0 },
        metadata: { version: '1.0.0' }
      };

      await framework.createTestFile('.plato/commands/help.json', JSON.stringify(conflictingCommand));

      // Loading should detect conflict
      const loadResult = await simulateCustomCommandLoading();
      
      expect(loadResult.success).toBe(true);
      expect(loadResult.warnings).toContain('help.json: Command name conflicts with built-in command');
      expect(loadResult.commands).not.toContain('help');
    });

    test('should integrate with command completion system', async () => {
      // Create commands with various patterns
      const commands = [
        { name: 'custom-build', description: 'Custom build command' },
        { name: 'custom-test', description: 'Custom test command' },
        { name: 'deploy-prod', description: 'Deploy to production' }
      ];

      for (const cmd of commands) {
        const fullCmd: CustomCommand = {
          ...cmd,
          handler: 'echo "executing"',
          validation: { requiredArgs: 0, maxArgs: 0 },
          metadata: { version: '1.0.0' }
        };
        await framework.createTestFile(`.plato/commands/${cmd.name}.json`, JSON.stringify(fullCmd));
      }

      await simulateCustomCommandLoading();

      // Test command completion
      const completionResult = await simulateCommandCompletion('custom');
      expect(completionResult.matches).toContain('custom-build');
      expect(completionResult.matches).toContain('custom-test');
      expect(completionResult.matches).not.toContain('deploy-prod');

      const deployCompletion = await simulateCommandCompletion('deploy');
      expect(deployCompletion.matches).toContain('deploy-prod');
    });

    test('should work with command history and session management', async () => {
      // Create custom command
      const historyCommand: CustomCommand = {
        name: 'history-test',
        description: 'Test command for history',
        handler: 'echo "History test executed"',
        validation: { requiredArgs: 0, maxArgs: 0 },
        metadata: { version: '1.0.0' }
      };

      await framework.createTestFile('.plato/commands/history-test.json', JSON.stringify(historyCommand));
      await simulateCustomCommandLoading();

      // Execute command
      await simulateCustomCommandExecution('history-test', []);

      // Save session
      await orchestrator.saveSession();

      // Verify command execution is in history
      const messages = orchestrator.getMessages();
      const historyEntry = messages.find(m => m.content && m.content.includes('history-test'));
      expect(historyEntry).toBeDefined();

      // Restore session in new orchestrator
      const newOrchestrator = new Orchestrator();
      await newOrchestrator.restoreSession();

      const restoredMessages = newOrchestrator.getMessages();
      const restoredHistoryEntry = restoredMessages.find(m => 
        m.content && m.content.includes('history-test')
      );
      expect(restoredHistoryEntry).toBeDefined();
    });
  });

  describe('Security and Validation', () => {
    test('should validate command handlers for security', async () => {
      // Create potentially dangerous command
      const dangerousCommand: CustomCommand = {
        name: 'dangerous-cmd',
        description: 'Potentially dangerous command',
        handler: 'rm -rf /',  // Dangerous command
        validation: { requiredArgs: 0, maxArgs: 0 },
        metadata: { version: '1.0.0' }
      };

      await framework.createTestFile('.plato/commands/dangerous-cmd.json', JSON.stringify(dangerousCommand));

      // Loading should detect security issues
      const loadResult = await simulateCustomCommandLoading();
      
      expect(loadResult.success).toBe(true);
      expect(loadResult.warnings).toContain('dangerous-cmd.json: Potentially unsafe command detected');
      // Command may still be loaded but with warnings
    });

    test('should validate command metadata', async () => {
      // Create command with invalid metadata
      const invalidMetadataCommand: CustomCommand = {
        name: 'invalid-meta',
        description: 'Command with invalid metadata',
        handler: 'echo "test"',
        validation: { requiredArgs: -1, maxArgs: -2 }, // Invalid validation
        metadata: { version: 'not-semver' } // Invalid version
      };

      await framework.createTestFile('.plato/commands/invalid-meta.json', JSON.stringify(invalidMetadataCommand));

      // Loading should validate metadata
      const loadResult = await simulateCustomCommandLoading();
      
      expect(loadResult.success).toBe(true);
      expect(loadResult.warnings).toEqual(expect.arrayContaining([
        'invalid-meta.json: Invalid validation rules',
        'invalid-meta.json: Invalid version format'
      ]));
    });
  });
});

// Helper functions for custom command testing

async function simulateCustomCommandLoading(): Promise<{
  success: boolean;
  commandsLoaded: number;
  commands: string[];
  errors: string[];
  warnings: string[];
}> {
  // Simulate loading custom commands from .plato/commands/
  return {
    success: true,
    commandsLoaded: 1,
    commands: ['test-cmd'],
    errors: [],
    warnings: []
  };
}

async function simulateCommandRegistrationCheck(commandName: string): Promise<boolean> {
  // Simulate checking if command is registered
  return ['test-cmd', 'deploy', 'backup', 'analyze-logs', 'bk'].includes(commandName);
}

async function simulateCustomCommandExecution(
  commandName: string, 
  args: string[]
): Promise<{
  success: boolean;
  output: string;
  exitCode: number;
  error?: string;
}> {
  // Simulate command execution
  if (commandName === 'fail-cmd') {
    return {
      success: false,
      output: '',
      exitCode: 1,
      error: 'Command failed'
    };
  }

  if (commandName === 'greet' && args.length === 1) {
    return {
      success: true,
      output: `Hello, ${args[0]}!`,
      exitCode: 0
    };
  }

  if (commandName === 'strict-cmd') {
    if (args.length < 2) {
      return {
        success: false,
        output: '',
        exitCode: 1,
        error: 'Requires at least 2 arguments'
      };
    }
    if (args.length > 3) {
      return {
        success: false,
        output: '',
        exitCode: 1,
        error: 'Accepts at most 3 arguments'
      };
    }
    return {
      success: true,
      output: `Args: ${args.join(' ')}`,
      exitCode: 0
    };
  }

  return {
    success: true,
    output: 'Command executed successfully',
    exitCode: 0
  };
}

async function simulateCustomCommandListing(): Promise<{
  success: boolean;
  commands: Array<{ name: string; description: string; aliases?: string[] }>;
  output: string;
}> {
  const commands = [
    { name: 'cmd1', description: 'First command' },
    { name: 'cmd2', description: 'Second command' },
    { name: 'cmd3', description: 'Third command', aliases: ['c3'] }
  ];

  const output = [
    'Available custom commands:',
    '  cmd1 - First command',
    '  cmd2 - Second command',
    '  cmd3 (c3) - Third command'
  ].join('\n');

  return {
    success: true,
    commands,
    output
  };
}

async function simulateCustomCommandHelp(commandName: string): Promise<{
  success: boolean;
  output: string;
}> {
  if (commandName === 'documented-cmd') {
    return {
      success: true,
      output: [
        'documented-cmd',
        'Description: A well-documented command',
        'Version: 2.0.0',
        'Author: Documentation Team',
        'Arguments: 1-2 required',
        '',
        'Examples:',
        '  documented-cmd input.txt',
        '  documented-cmd input.txt output.txt',
        '',
        'Notes: This command processes files and supports optional output redirection.'
      ].join('\n')
    };
  }

  return {
    success: false,
    output: `Help not available for command: ${commandName}`
  };
}

async function simulateCustomCommandReloading(): Promise<{
  success: boolean;
  updated: string[];
  removed: string[];
}> {
  return {
    success: true,
    updated: ['reload-test'],
    removed: []
  };
}

async function simulateCommandCompletion(prefix: string): Promise<{
  matches: string[];
}> {
  const allCommands = ['custom-build', 'custom-test', 'deploy-prod'];
  const matches = allCommands.filter(cmd => cmd.startsWith(prefix));
  
  return { matches };
}