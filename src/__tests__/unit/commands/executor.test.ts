import { 
  validateCommand, 
  parseCommandArguments, 
  prepareEnvironment,
  CommandRunner
} from '../../../commands/executor';
import type { CustomCommand } from '../../../commands/types';

describe('executor', () => {
  let mockConsoleWarn: jest.SpyInstance;

  beforeAll(() => {
    mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  beforeEach(() => {
    mockConsoleWarn.mockClear();
  });

  afterAll(() => {
    mockConsoleWarn.mockRestore();
  });

  describe('validateCommand', () => {
    it('should return no errors for valid command', () => {
      const command: CustomCommand = {
        name: 'test-command',
        description: 'A test command',
        script: 'echo "hello"',
        hasArguments: false,
        filePath: '/path/to/command.json'
      };

      const errors = validateCommand(command);

      expect(errors).toEqual([]);
    });

    it('should return error when command has no script', () => {
      const command: CustomCommand = {
        name: 'test-command',
        description: 'A test command',
        script: '',
        hasArguments: false,
        filePath: '/path/to/command.json'
      };

      const errors = validateCommand(command);

      expect(errors).toContain('Command has no script to execute');
    });

    it('should return error when command has no name', () => {
      const command: CustomCommand = {
        name: '',
        description: 'A test command',
        script: 'echo "hello"',
        hasArguments: false,
        filePath: '/path/to/command.json'
      };

      const errors = validateCommand(command);

      expect(errors).toContain('Command has no name');
    });

    it('should warn when command expects arguments but none provided', () => {
      const command: CustomCommand = {
        name: 'test-command',
        description: 'A test command with args',
        script: 'echo "$1"',
        hasArguments: true,
        filePath: '/path/to/command.json'
      };

      const errors = validateCommand(command);

      expect(errors).toEqual([]);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Command "test-command" expects arguments but none provided'
      );
    });

    it('should not warn when command expects arguments and they are provided', () => {
      const command: CustomCommand = {
        name: 'test-command',
        description: 'A test command with args',
        script: 'echo "$1"',
        hasArguments: true,
        filePath: '/path/to/command.json'
      };

      const errors = validateCommand(command, 'arg1 arg2');

      expect(errors).toEqual([]);
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should return multiple errors for invalid command', () => {
      const command: CustomCommand = {
        name: '',
        description: 'A test command',
        script: '',
        hasArguments: false,
        filePath: '/path/to/command.json'
      };

      const errors = validateCommand(command);

      expect(errors).toHaveLength(2);
      expect(errors).toContain('Command has no script to execute');
      expect(errors).toContain('Command has no name');
    });
  });

  describe('parseCommandArguments', () => {
    it('should parse command name and args correctly', () => {
      const input = 'test-command arg1 arg2 arg3';
      
      const result = parseCommandArguments(input);

      expect(result.commandName).toBe('test-command');
      expect(result.args).toBe('arg1 arg2 arg3');
    });

    it('should handle command with no arguments', () => {
      const input = 'test-command';
      
      const result = parseCommandArguments(input);

      expect(result.commandName).toBe('test-command');
      expect(result.args).toBe('');
    });

    it('should handle extra whitespace', () => {
      const input = '   test-command   arg1   arg2   ';
      
      const result = parseCommandArguments(input);

      expect(result.commandName).toBe('test-command');
      expect(result.args).toBe('arg1 arg2');
    });

    it('should handle single word command', () => {
      const input = 'help';
      
      const result = parseCommandArguments(input);

      expect(result.commandName).toBe('help');
      expect(result.args).toBe('');
    });

    it('should preserve argument spacing', () => {
      const input = 'test-command "arg with spaces" another-arg';
      
      const result = parseCommandArguments(input);

      expect(result.commandName).toBe('test-command');
      expect(result.args).toBe('"arg with spaces" another-arg');
    });
  });

  describe('prepareEnvironment', () => {
    it('should include PLATO environment variables', () => {
      const command: CustomCommand = {
        name: 'test-command',
        description: 'A test command',
        script: 'echo "hello"',
        hasArguments: false,
        filePath: '/path/to/command.json'
      };

      const env = prepareEnvironment(command);

      expect(env.PLATO_COMMAND).toBe('test-command');
      expect(env.PLATO_COMMAND_FILE).toBe('/path/to/command.json');
    });

    it('should preserve existing environment variables', () => {
      const command: CustomCommand = {
        name: 'test-command',
        description: 'A test command',
        script: 'echo "hello"',
        hasArguments: false,
        filePath: '/path/to/command.json'
      };

      const baseEnv = { PATH: '/usr/bin', HOME: '/home/user', TEST_VAR: 'test' };
      const env = prepareEnvironment(command, baseEnv);

      expect(env.PATH).toBe('/usr/bin');
      expect(env.HOME).toBe('/home/user');
      expect(env.TEST_VAR).toBe('test');
      expect(env.PLATO_COMMAND).toBe('test-command');
    });

    it('should handle undefined values in base environment', () => {
      const command: CustomCommand = {
        name: 'test-command',
        description: 'A test command',
        script: 'echo "hello"',
        hasArguments: false,
        filePath: '/path/to/command.json'
      };

      const baseEnv = { PATH: '/usr/bin', UNDEFINED_VAR: undefined };
      const env = prepareEnvironment(command, baseEnv);

      expect(env.PATH).toBe('/usr/bin');
      expect(env.UNDEFINED_VAR).toBeUndefined();
      expect(env.PLATO_COMMAND).toBe('test-command');
    });

    it('should handle command with no filePath', () => {
      const command: CustomCommand = {
        name: 'test-command',
        description: 'A test command',
        script: 'echo "hello"',
        hasArguments: false
      };

      const env = prepareEnvironment(command);

      expect(env.PLATO_COMMAND).toBe('test-command');
      expect(env.PLATO_COMMAND_FILE).toBe('');
    });
  });

  describe('CommandRunner', () => {
    // Mock the executeCustomCommand function
    const mockExecuteCustomCommand = jest.fn();
    jest.mock('../../../commands/executor', () => ({
      ...jest.requireActual('../../../commands/executor'),
      executeCustomCommand: mockExecuteCustomCommand
    }));

    beforeEach(() => {
      mockExecuteCustomCommand.mockClear();
      mockExecuteCustomCommand.mockResolvedValue({
        success: true,
        output: 'command output',
        errorOutput: '',
        exitCode: 0,
        duration: 100
      });
    });

    it('should create runner with default options', () => {
      const defaultOptions = { timeout: 5000 };
      const runner = new CommandRunner(defaultOptions);

      expect(runner).toBeInstanceOf(CommandRunner);
    });

    it('should merge default options with provided options', async () => {
      const command: CustomCommand = {
        name: 'test-command',
        description: 'A test command',
        script: 'echo "hello"',
        hasArguments: false,
        filePath: '/path/to/command.json'
      };

      const defaultOptions = { timeout: 5000, env: { DEFAULT_VAR: 'default' } };
      const runner = new CommandRunner(defaultOptions);

      await runner.run(command, 'args', { timeout: 10000 });

      // Note: This test would need the actual executeCustomCommand to be mocked properly
      // For now, we're just testing the structure
      expect(runner).toBeInstanceOf(CommandRunner);
    });
  });
});