import { exec } from 'child_process';
import { promisify } from 'util';
import {
  CustomCommand,
  CommandExecutionResult,
  CommandExecutionOptions,
} from './types.js';

const execAsync = promisify(exec);

/**
 * Execute a custom command with argument substitution and options
 */
export async function executeCustomCommand(
  command: CustomCommand,
  args: string = '',
  options: CommandExecutionOptions = {}
): Promise<CommandExecutionResult> {
  const {
    timeout = 30000,
    cwd = process.cwd(),
    env = process.env,
    captureOutput = true,
  } = options;

  // Substitute $ARGUMENTS placeholder
  let script = command.script;
  if (command.hasArguments && args) {
    // Replace all occurrences of $ARGUMENTS
    script = script.replace(/\$ARGUMENTS/g, args);
  }

  const startTime = Date.now();

  try {
    const result = await execAsync(script, {
      cwd,
      env: env as any,
      timeout,
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });

    const duration = Date.now() - startTime;

    return {
      success: true,
      output: captureOutput ? result.stdout : undefined,
      exitCode: 0,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Handle timeout specifically
    if (error.killed && error.signal === 'SIGTERM') {
      return {
        success: false,
        error: `Command timed out after ${timeout}ms`,
        exitCode: -1,
        duration,
      };
    }

    return {
      success: false,
      output: captureOutput ? error.stdout : undefined,
      error: error.message || error.toString(),
      exitCode: error.code || 1,
      duration,
    };
  }
}

/**
 * Execute a custom command with streaming output
 */
export async function executeCustomCommandStreaming(
  command: CustomCommand,
  args: string = '',
  onOutput: (chunk: string) => void,
  options: CommandExecutionOptions = {}
): Promise<CommandExecutionResult> {
  const {
    timeout = 30000,
    cwd = process.cwd(),
    env = process.env,
  } = options;

  // Substitute $ARGUMENTS placeholder
  let script = command.script;
  if (command.hasArguments && args) {
    script = script.replace(/\$ARGUMENTS/g, args);
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    let output = '';
    let errorOutput = '';
    let timedOut = false;

    const child = exec(script, {
      cwd,
      env: env as any,
    });

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeout);

    // Handle stdout
    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      onOutput(text);
    });

    // Handle stderr
    child.stderr?.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    // Handle process exit
    child.on('exit', (code, signal) => {
      clearTimeout(timeoutHandle);
      const duration = Date.now() - startTime;

      if (timedOut) {
        resolve({
          success: false,
          error: `Command timed out after ${timeout}ms`,
          exitCode: -1,
          duration,
        });
        return;
      }

      if (code === 0) {
        resolve({
          success: true,
          output,
          exitCode: 0,
          duration,
        });
      } else {
        resolve({
          success: false,
          output,
          error: errorOutput || `Process exited with code ${code}`,
          exitCode: code || 1,
          duration,
        });
      }
    });

    // Handle process error
    child.on('error', (error) => {
      clearTimeout(timeoutHandle);
      const duration = Date.now() - startTime;
      
      resolve({
        success: false,
        error: error.message,
        exitCode: 1,
        duration,
      });
    });
  });
}

/**
 * Validate a command before execution
 */
export function validateCommand(command: CustomCommand, args?: string): string[] {
  const errors: string[] = [];

  if (!command.script) {
    errors.push('Command has no script to execute');
  }

  if (command.hasArguments && !args) {
    // Warning, not an error
    console.warn(`Command "${command.name}" expects arguments but none provided`);
  }

  if (!command.name) {
    errors.push('Command has no name');
  }

  return errors;
}

/**
 * Prepare command environment variables
 */
export function prepareEnvironment(
  command: CustomCommand,
  baseEnv: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  const env: Record<string, string> = {};
  
  // Filter out undefined values from process.env
  Object.entries(baseEnv).forEach(([key, value]) => {
    if (value !== undefined) {
      env[key] = value;
    }
  });
  
  return {
    ...env,
    PLATO_COMMAND: command.name,
    PLATO_COMMAND_FILE: command.filePath || "",
  };

}
/**
 * Parse command arguments from user input
 * Handles quoted strings and escaping
 */
export function parseCommandArguments(input: string): {
  commandName: string;
  args: string;
} {
  const parts = input.trim().split(/\s+/);
  const commandName = parts[0];
  const args = parts.slice(1).join(' ');

  return { commandName, args };
}

/**
 * Create a command runner with default options
 */
export class CommandRunner {
  private defaultOptions: CommandExecutionOptions;

  constructor(defaultOptions: CommandExecutionOptions = {}) {
    this.defaultOptions = defaultOptions;
  }

  async run(
    command: CustomCommand,
    args: string = '',
    options?: CommandExecutionOptions
  ): Promise<CommandExecutionResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const env = prepareEnvironment(command, mergedOptions.env);
    
    return executeCustomCommand(command, args, {
      ...mergedOptions,
      env,
    });
  }

  async runStreaming(
    command: CustomCommand,
    args: string = '',
    onOutput: (chunk: string) => void,
    options?: CommandExecutionOptions
  ): Promise<CommandExecutionResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const env = prepareEnvironment(command, mergedOptions.env);
    
    return executeCustomCommandStreaming(command, args, onOutput, {
      ...mergedOptions,
      env,
    });
  }
}