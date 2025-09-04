import { CustomCommandLoader } from './loader.js';
import { CustomCommand, SlashCommand } from './types.js';
import { executeCustomCommand, executeCustomCommandStreaming } from './executor.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Global custom command loader instance
 */
let commandLoader: CustomCommandLoader | null = null;
let customCommands: CustomCommand[] = [];
let lastLoadTime: number = 0;
const CACHE_DURATION = 60000; // 1 minute cache

/**
 * Initialize the custom command system
 */
export async function initializeCustomCommands(baseDir?: string): Promise<void> {
  const dir = baseDir || path.join(process.cwd(), '.plato/commands');
  commandLoader = new CustomCommandLoader(dir);
  await commandLoader.initialize();
  await reloadCustomCommands();
}

/**
 * Reload custom commands from disk
 */
export async function reloadCustomCommands(): Promise<void> {
  if (!commandLoader) {
    await initializeCustomCommands();
    return;
  }

  customCommands = await commandLoader.discoverCommands();
  lastLoadTime = Date.now();
}

/**
 * Get all custom commands, with caching
 */
export async function getCustomCommands(forceReload: boolean = false): Promise<CustomCommand[]> {
  if (!commandLoader) {
    await initializeCustomCommands();
  }

  // Check if cache is stale or forced reload
  if (forceReload || Date.now() - lastLoadTime > CACHE_DURATION) {
    await reloadCustomCommands();
  }

  return customCommands;
}

/**
 * Get all custom commands as slash commands
 */
export async function getCustomSlashCommands(): Promise<SlashCommand[]> {
  const commands = await getCustomCommands();
  return commands.map(cmd => ({
    name: `/${cmd.name}`,
    summary: cmd.description,
  }));
}

/**
 * Find a custom command by name (with namespace support)
 */
export async function findCustomCommand(name: string): Promise<CustomCommand | null> {
  const commands = await getCustomCommands();
  
  // Remove leading slash if present
  const commandName = name.startsWith('/') ? name.slice(1) : name;
  
  // Exact match
  const exact = commands.find(c => c.name === commandName);
  if (exact) return exact;
  
  // Check aliases
  for (const cmd of commands) {
    if (cmd.aliases?.includes(commandName)) {
      return cmd;
    }
  }
  
  return null;
}

/**
 * Execute a custom command by name with arguments
 */
export async function runCustomCommand(
  commandName: string,
  args: string = '',
  streaming: boolean = false,
  onOutput?: (chunk: string) => void
): Promise<{ success: boolean; output?: string; error?: string }> {
  const command = await findCustomCommand(commandName);
  
  if (!command) {
    return {
      success: false,
      error: `Custom command not found: ${commandName}`,
    };
  }

  try {
    if (streaming && onOutput) {
      const result = await executeCustomCommandStreaming(command, args, onOutput);
      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    } else {
      const result = await executeCustomCommand(command, args);
      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || error.toString(),
    };
  }
}

/**
 * Get command suggestions for autocomplete
 */
export async function getCommandSuggestions(prefix: string): Promise<string[]> {
  const commands = await getCustomCommands();
  const normalizedPrefix = prefix.startsWith('/') ? prefix.slice(1) : prefix;
  
  const suggestions: string[] = [];
  
  for (const cmd of commands) {
    // Check main name
    if (cmd.name.startsWith(normalizedPrefix)) {
      suggestions.push(`/${cmd.name}`);
    }
    
    // Check aliases
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        if (alias.startsWith(normalizedPrefix)) {
          suggestions.push(`/${alias}`);
        }
      }
    }
  }
  
  return suggestions.sort();
}

/**
 * Get all commands grouped by namespace (for help display)
 */
export async function getCommandsByNamespace(): Promise<Map<string, CustomCommand[]>> {
  const commands = await getCustomCommands();
  const grouped = new Map<string, CustomCommand[]>();
  
  // Root commands (no namespace)
  grouped.set('', []);
  
  for (const cmd of commands) {
    if (cmd.namespace) {
      const topNamespace = cmd.namespace.split(':')[0];
      if (!grouped.has(topNamespace)) {
        grouped.set(topNamespace, []);
      }
      grouped.get(topNamespace)!.push(cmd);
    } else {
      grouped.get('')!.push(cmd);
    }
  }
  
  return grouped;
}

/**
 * Create a new custom command from template
 */
export async function createCustomCommand(
  name: string,
  description: string,
  script: string,
  namespace?: string
): Promise<void> {
  const baseDir = path.join(process.cwd(), '.plato/commands');
  
  // Determine file path based on namespace
  let filePath: string;
  if (namespace) {
    const namespacePath = namespace.split(':').join(path.sep);
    const dir = path.join(baseDir, namespacePath);
    await fs.mkdir(dir, { recursive: true });
    filePath = path.join(dir, `${name}.md`);
  } else {
    await fs.mkdir(baseDir, { recursive: true });
    filePath = path.join(baseDir, `${name}.md`);
  }
  
  // Generate markdown content
  const content = `# ${name}

${description}

## Command
\`\`\`bash
${script}
\`\`\`
`;
  
  await fs.writeFile(filePath, content, 'utf8');
  
  // Reload commands to include the new one
  await reloadCustomCommands();
}

/**
 * List all custom command files
 */
export async function listCustomCommandFiles(): Promise<string[]> {
  const baseDir = path.join(process.cwd(), '.plato/commands');
  const files: string[] = [];
  
  async function scanDir(dir: string, prefix: string = ''): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        
        if (entry.isDirectory()) {
          await scanDir(fullPath, relativePath);
        } else if (entry.name.endsWith('.md')) {
          files.push(relativePath);
        }
      }
    } catch {
      // Directory doesn't exist yet
    }
  }
  
  await scanDir(baseDir);
  return files.sort();
}

/**
 * Check if custom commands are available
 */
export async function hasCustomCommands(): Promise<boolean> {
  const commands = await getCustomCommands();
  return commands.length > 0;
}

/**
 * Export all custom commands and integration functions
 */
export {
  CustomCommand,
  SlashCommand,
  CustomCommandLoader,
} from './types.js';