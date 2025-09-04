import fs from 'fs/promises';
import path from 'path';
import {
  CustomCommand,
  CommandMenu,
  CommandLoaderOptions,
  SlashCommand,
  CommandMetadata,
  MarkdownSection,
} from './types.js';

/**
 * CustomCommandLoader - Loads and manages custom commands from markdown files
 */
export class CustomCommandLoader {
  private baseDir: string;
  private options: CommandLoaderOptions;
  private commandCache: Map<string, CustomCommand> = new Map();

  constructor(baseDir: string = '.plato/commands', options: CommandLoaderOptions = {}) {
    this.baseDir = baseDir;
    this.options = {
      extensions: ['.md'],
      maxDepth: 3,
      ...options,
    };
  }

  /**
   * Initialize the command loader and create directory structure if needed
   */
  async initialize(): Promise<void> {
    try {
      await fs.access(this.baseDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(this.baseDir, { recursive: true });
    }
  }

  /**
   * Discover all custom commands in the directory structure
   */
  async discoverCommands(dir: string = this.baseDir, namespace: string[] = [], depth: number = 0): Promise<CustomCommand[]> {
    if (depth > (this.options.maxDepth || 3)) {
      return [];
    }

    const commands: CustomCommand[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Recurse into namespace directories
          const subCommands = await this.discoverCommands(
            fullPath,
            [...namespace, entry.name],
            depth + 1
          );
          commands.push(...subCommands);
        } else if (entry.isFile() && this.isCommandFile(entry.name)) {
          // Parse command file
          const command = await this.parseCommand(fullPath);
          if (command) {
            // Apply namespace from directory structure
            if (namespace.length > 0 && !command.namespace) {
              command.namespace = namespace.join(':');
            }
            // Construct full command name with namespace
            if (command.namespace) {
              command.name = `${command.namespace}:${command.name}`;
            }
            command.filePath = fullPath;
            commands.push(command);
          }
        }
      }
    } catch (error) {
      console.error(`Error discovering commands in ${dir}:`, error);
    }

    return commands;
  }

  /**
   * Parse a markdown file into a CustomCommand
   */
  async parseCommand(filePath: string): Promise<CustomCommand | null> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const fileName = path.basename(filePath, path.extname(filePath));

      // Parse YAML frontmatter if present
      const metadata = this.parseFrontmatter(content);
      const contentWithoutFrontmatter = this.removeFrontmatter(content);

      // Parse markdown sections
      const sections = this.parseMarkdownSections(contentWithoutFrontmatter);

      // Extract command script from code blocks
      const script = this.extractCommandScript(sections, contentWithoutFrontmatter);
      if (!script) {
        return null; // No valid command script found
      }

      // Extract description
      const description = this.extractDescription(sections, contentWithoutFrontmatter);

      // Build command object
      const command: CustomCommand = {
        name: metadata.name || fileName,
        description: metadata.description || description || 'Custom command',
        script,
        hasArguments: script.includes('$ARGUMENTS'),
        namespace: metadata.namespace,
        aliases: this.parseAliases(metadata.aliases),
        metadata,
        filePath,
      };

      return command;
    } catch (error) {
      console.error(`Error parsing command file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Convert CustomCommand to SlashCommand format
   */
  toSlashCommand(command: CustomCommand): SlashCommand {
    // Preserve namespace in the command name
    const fullName = command.namespace ? `${command.namespace}:${command.name}` : command.name;
    const name = `/${fullName}`;
    return {
      name,
      summary: command.description,
    };
  }

  /**
   * Convert array of CustomCommands to SlashCommands
   */
  toSlashCommands(commands: CustomCommand[]): SlashCommand[] {
    return commands.map(cmd => this.toSlashCommand(cmd));
  }

  /**
   * Generate a menu structure from discovered commands
   */
  generateMenu(commands: CustomCommand[]): CommandMenu {
    const menu: CommandMenu = {
      root: [],
      namespaces: new Map(),
    };

    for (const command of commands) {
      if (command.namespace) {
        // Extract the top-level namespace
        const topNamespace = command.namespace.split(':')[0];
        if (!menu.namespaces.has(topNamespace)) {
          menu.namespaces.set(topNamespace, []);
        }
        menu.namespaces.get(topNamespace)!.push(command);
      } else {
        menu.root.push(command);
      }
    }

    // Sort commands alphabetically
    menu.root.sort((a, b) => a.name.localeCompare(b.name));
    menu.namespaces.forEach(commands => {
      commands.sort((a, b) => a.name.localeCompare(b.name));
    });

    return menu;
  }

  // Private helper methods

  private isCommandFile(fileName: string): boolean {
    return this.options.extensions?.some(ext => fileName.endsWith(ext)) || false;
  }

  private parseFrontmatter(content: string): CommandMetadata {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return {};
    }

    const metadata: CommandMetadata = {};
    const lines = frontmatterMatch[1].split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value: any = line.slice(colonIndex + 1).trim();

        // Parse arrays (simple format)
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value
            .slice(1, -1)
            .split(',')
            .map((v: string) => v.trim().replace(/^["']|["']$/g, ''));
        }
        // Parse numbers
        else if (!isNaN(Number(value))) {
          value = Number(value);
        }
        // Remove quotes
        else if ((value.startsWith('"') && value.endsWith('"')) ||
                 (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        metadata[key] = value;
      }
    }

    return metadata;
  }

  private removeFrontmatter(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n?/, '');
  }

  private parseMarkdownSections(content: string): MarkdownSection[] {
    const sections: MarkdownSection[] = [];
    const lines = content.split('\n');
    let currentSection: MarkdownSection | null = null;

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          heading: headingMatch[2],
          level: headingMatch[1].length,
          content: '',
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  private extractCommandScript(sections: MarkdownSection[], content: string): string | null {
    // First, look for a "Command" section
    const commandSection = sections.find(s => 
      s.heading.toLowerCase() === 'command' || 
      s.heading.toLowerCase() === 'script'
    );

    if (commandSection) {
      const script = this.extractCodeBlock(commandSection.content, 'bash') ||
                     this.extractCodeBlock(commandSection.content);
      if (script) return script;
    }

    // Fallback: look for any bash code block in the entire content
    const bashScript = this.extractCodeBlock(content, 'bash');
    if (bashScript) return bashScript;

    // Last resort: look for any code block
    return this.extractCodeBlock(content);
  }

  private extractCodeBlock(content: string, language?: string): string | null {
    const pattern = language
      ? new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``, 'g')
      : /```(?:\w*\n)?([\s\S]*?)\n```/g;

    const matches = Array.from(content.matchAll(pattern));
    
    if (matches.length > 0) {
      // Return the first matching code block
      return matches[0][1].trim();
    }

    return null;
  }

  private extractDescription(sections: MarkdownSection[], content: string): string | null {
    // Look for content after the first heading
    const firstSection = sections.find(s => s.level === 1);
    if (firstSection && firstSection.content) {
      // Get first paragraph (non-empty line)
      const lines = firstSection.content.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        return lines[0].trim();
      }
    }

    // Fallback: get first paragraph from content
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('```')) {
        return trimmed;
      }
    }

    return null;
  }

  private parseAliases(aliases: any): string[] | undefined {
    if (!aliases) return undefined;
    
    if (Array.isArray(aliases)) {
      return aliases.map(a => String(a));
    }
    
    if (typeof aliases === 'string') {
      return [aliases];
    }
    
    return undefined;
  }
}