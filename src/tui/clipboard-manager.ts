/**
 * Clipboard Manager
 * Cross-platform clipboard operations for text selection copy functionality
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Clipboard operation result
 */
export interface ClipboardResult {
  /** Whether operation was successful */
  success: boolean;
  /** Result data (for read operations) */
  data?: string;
  /** Error message if operation failed */
  error?: string;
  /** Time taken for operation */
  duration: number;
  /** Method used for clipboard access */
  method: string;
}

/**
 * Clipboard configuration
 */
export interface ClipboardConfig {
  /** Enable clipboard functionality */
  enabled: boolean;
  /** Preferred clipboard method */
  preferredMethod: 'auto' | 'native' | 'fallback';
  /** Timeout for clipboard operations (ms) */
  operationTimeout: number;
  /** Enable clipboard history */
  enableHistory: boolean;
  /** Maximum history size */
  maxHistorySize: number;
  /** Enable format detection */
  enableFormatDetection: boolean;
  /** Fallback to temporary files */
  fallbackToFiles: boolean;
  /** Debug clipboard operations */
  debug: boolean;
}

/**
 * Clipboard entry for history
 */
export interface ClipboardEntry {
  /** Entry ID */
  id: string;
  /** Content */
  content: string;
  /** Content type */
  type: 'text' | 'selection' | 'rich';
  /** Source of the content */
  source: string;
  /** Timestamp */
  timestamp: number;
  /** Content size */
  size: number;
}

/**
 * Platform-specific clipboard methods
 */
export interface ClipboardMethods {
  /** Copy text to clipboard */
  copy: (text: string) => Promise<ClipboardResult>;
  /** Read text from clipboard */
  paste: () => Promise<ClipboardResult>;
  /** Check if clipboard is available */
  isAvailable: () => Promise<boolean>;
  /** Clear clipboard */
  clear: () => Promise<ClipboardResult>;
}

/**
 * Default clipboard configuration
 */
const DEFAULT_CLIPBOARD_CONFIG: ClipboardConfig = {
  enabled: true,
  preferredMethod: 'auto',
  operationTimeout: 5000,
  enableHistory: true,
  maxHistorySize: 50,
  enableFormatDetection: true,
  fallbackToFiles: true,
  debug: false
};

/**
 * Platform detection utilities
 */
export class PlatformDetector {
  static getPlatform(): 'windows' | 'macos' | 'linux' | 'unknown' {
    const platform = os.platform();
    switch (platform) {
      case 'win32':
        return 'windows';
      case 'darwin':
        return 'macos';
      case 'linux':
        return 'linux';
      default:
        return 'unknown';
    }
  }

  static isWSL(): boolean {
    try {
      return fs.existsSync('/proc/version') && 
             fs.readFileSync('/proc/version', 'utf8').includes('Microsoft');
    } catch {
      return false;
    }
  }

  static isSSH(): boolean {
    return !!(process.env.SSH_CLIENT || process.env.SSH_TTY);
  }

  static isContainer(): boolean {
    try {
      return fs.existsSync('/.dockerenv') ||
             (fs.existsSync('/proc/1/cgroup') && 
              fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker'));
    } catch {
      return false;
    }
  }

  static getEnvironmentInfo(): {
    platform: string;
    isWSL: boolean;
    isSSH: boolean;
    isContainer: boolean;
    hasDisplay: boolean;
  } {
    return {
      platform: this.getPlatform(),
      isWSL: this.isWSL(),
      isSSH: this.isSSH(),
      isContainer: this.isContainer(),
      hasDisplay: !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY)
    };
  }
}

/**
 * Cross-platform clipboard methods
 */
export class ClipboardMethods {
  /**
   * Windows clipboard methods
   */
  static windows(): ClipboardMethods {
    return {
      async copy(text: string): Promise<ClipboardResult> {
        const startTime = Date.now();
        try {
          // Use PowerShell for reliable clipboard access
          const command = `powershell.exe -Command "Set-Clipboard -Value '${text.replace(/'/g, "''")}'`;
          await execAsync(command, { timeout: 5000 });
          
          return {
            success: true,
            duration: Date.now() - startTime,
            method: 'powershell'
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
            method: 'powershell'
          };
        }
      },

      async paste(): Promise<ClipboardResult> {
        const startTime = Date.now();
        try {
          const { stdout } = await execAsync('powershell.exe -Command "Get-Clipboard"', { timeout: 5000 });
          
          return {
            success: true,
            data: stdout.trim(),
            duration: Date.now() - startTime,
            method: 'powershell'
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
            method: 'powershell'
          };
        }
      },

      async isAvailable(): Promise<boolean> {
        try {
          await execAsync('powershell.exe -Command "echo test"', { timeout: 2000 });
          return true;
        } catch {
          return false;
        }
      },

      async clear(): Promise<ClipboardResult> {
        const startTime = Date.now();
        try {
          await execAsync('powershell.exe -Command "Set-Clipboard -Value \'\'"', { timeout: 5000 });
          
          return {
            success: true,
            duration: Date.now() - startTime,
            method: 'powershell'
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
            method: 'powershell'
          };
        }
      }
    };
  }

  /**
   * macOS clipboard methods
   */
  static macos(): ClipboardMethods {
    return {
      async copy(text: string): Promise<ClipboardResult> {
        const startTime = Date.now();
        try {
          const child = spawn('pbcopy');
          child.stdin.write(text);
          child.stdin.end();
          
          await new Promise((resolve, reject) => {
            child.on('close', (code) => {
              if (code === 0) resolve(undefined);
              else reject(new Error(`pbcopy failed with code ${code}`));
            });
          });
          
          return {
            success: true,
            duration: Date.now() - startTime,
            method: 'pbcopy'
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
            method: 'pbcopy'
          };
        }
      },

      async paste(): Promise<ClipboardResult> {
        const startTime = Date.now();
        try {
          const { stdout } = await execAsync('pbpaste', { timeout: 5000 });
          
          return {
            success: true,
            data: stdout,
            duration: Date.now() - startTime,
            method: 'pbpaste'
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
            method: 'pbpaste'
          };
        }
      },

      async isAvailable(): Promise<boolean> {
        try {
          await execAsync('which pbcopy', { timeout: 2000 });
          return true;
        } catch {
          return false;
        }
      },

      async clear(): Promise<ClipboardResult> {
        const startTime = Date.now();
        try {
          const child = spawn('pbcopy');
          child.stdin.write('');
          child.stdin.end();
          
          await new Promise((resolve, reject) => {
            child.on('close', (code) => {
              if (code === 0) resolve(undefined);
              else reject(new Error(`pbcopy failed with code ${code}`));
            });
          });
          
          return {
            success: true,
            duration: Date.now() - startTime,
            method: 'pbcopy'
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
            method: 'pbcopy'
          };
        }
      }
    };
  }

  /**
   * Linux clipboard methods
   */
  static linux(): ClipboardMethods {
    return {
      async copy(text: string): Promise<ClipboardResult> {
        const startTime = Date.now();
        
        // Try multiple clipboard methods
        const methods = ['xclip -selection clipboard', 'xsel --clipboard --input', 'wl-copy'];
        
        for (const method of methods) {
          try {
            const child = spawn(method, { shell: true });
            child.stdin.write(text);
            child.stdin.end();
            
            await new Promise((resolve, reject) => {
              child.on('close', (code) => {
                if (code === 0) resolve(undefined);
                else reject(new Error(`${method} failed with code ${code}`));
              });
            });
            
            return {
              success: true,
              duration: Date.now() - startTime,
              method: method.split(' ')[0]
            };
          } catch {
            continue; // Try next method
          }
        }
        
        return {
          success: false,
          error: 'No clipboard method available (tried xclip, xsel, wl-copy)',
          duration: Date.now() - startTime,
          method: 'none'
        };
      },

      async paste(): Promise<ClipboardResult> {
        const startTime = Date.now();
        
        const methods = ['xclip -selection clipboard -o', 'xsel --clipboard --output', 'wl-paste'];
        
        for (const method of methods) {
          try {
            const { stdout } = await execAsync(method, { timeout: 5000 });
            
            return {
              success: true,
              data: stdout,
              duration: Date.now() - startTime,
              method: method.split(' ')[0]
            };
          } catch {
            continue; // Try next method
          }
        }
        
        return {
          success: false,
          error: 'No clipboard method available for reading',
          duration: Date.now() - startTime,
          method: 'none'
        };
      },

      async isAvailable(): Promise<boolean> {
        const methods = ['xclip', 'xsel', 'wl-copy'];
        
        for (const method of methods) {
          try {
            await execAsync(`which ${method}`, { timeout: 2000 });
            return true;
          } catch {
            continue;
          }
        }
        
        return false;
      },

      async clear(): Promise<ClipboardResult> {
        const startTime = Date.now();
        
        const methods = ['xclip -selection clipboard', 'xsel --clipboard --clear', 'wl-copy'];
        
        for (const method of methods) {
          try {
            if (method.includes('xsel') && method.includes('clear')) {
              await execAsync(method, { timeout: 5000 });
            } else {
              const child = spawn(method, { shell: true });
              child.stdin.write('');
              child.stdin.end();
              
              await new Promise((resolve, reject) => {
                child.on('close', (code) => {
                  if (code === 0) resolve(undefined);
                  else reject(new Error(`${method} failed with code ${code}`));
                });
              });
            }
            
            return {
              success: true,
              duration: Date.now() - startTime,
              method: method.split(' ')[0]
            };
          } catch {
            continue;
          }
        }
        
        return {
          success: false,
          error: 'No clipboard method available for clearing',
          duration: Date.now() - startTime,
          method: 'none'
        };
      }
    };
  }

  /**
   * WSL clipboard methods (uses Windows clipboard through interop)
   */
  static wsl(): ClipboardMethods {
    return {
      async copy(text: string): Promise<ClipboardResult> {
        const startTime = Date.now();
        try {
          const child = spawn('clip.exe');
          child.stdin.write(text);
          child.stdin.end();
          
          await new Promise((resolve, reject) => {
            child.on('close', (code) => {
              if (code === 0) resolve(undefined);
              else reject(new Error(`clip.exe failed with code ${code}`));
            });
          });
          
          return {
            success: true,
            duration: Date.now() - startTime,
            method: 'clip.exe'
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
            method: 'clip.exe'
          };
        }
      },

      async paste(): Promise<ClipboardResult> {
        const startTime = Date.now();
        try {
          const { stdout } = await execAsync('powershell.exe -Command "Get-Clipboard"', { timeout: 5000 });
          
          return {
            success: true,
            data: stdout.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
            duration: Date.now() - startTime,
            method: 'powershell.exe'
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
            method: 'powershell.exe'
          };
        }
      },

      async isAvailable(): Promise<boolean> {
        try {
          await execAsync('which clip.exe', { timeout: 2000 });
          return true;
        } catch {
          return false;
        }
      },

      async clear(): Promise<ClipboardResult> {
        const startTime = Date.now();
        try {
          const child = spawn('clip.exe');
          child.stdin.write('');
          child.stdin.end();
          
          await new Promise((resolve, reject) => {
            child.on('close', (code) => {
              if (code === 0) resolve(undefined);
              else reject(new Error(`clip.exe failed with code ${code}`));
            });
          });
          
          return {
            success: true,
            duration: Date.now() - startTime,
            method: 'clip.exe'
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
            method: 'clip.exe'
          };
        }
      }
    };
  }

  /**
   * Fallback clipboard methods using temporary files
   */
  static fallback(): ClipboardMethods {
    const clipboardFile = path.join(os.tmpdir(), 'plato-clipboard.txt');
    
    return {
      async copy(text: string): Promise<ClipboardResult> {
        const startTime = Date.now();
        try {
          await fs.promises.writeFile(clipboardFile, text, 'utf8');
          
          return {
            success: true,
            duration: Date.now() - startTime,
            method: 'file'
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
            method: 'file'
          };
        }
      },

      async paste(): Promise<ClipboardResult> {
        const startTime = Date.now();
        try {
          const data = await fs.promises.readFile(clipboardFile, 'utf8');
          
          return {
            success: true,
            data,
            duration: Date.now() - startTime,
            method: 'file'
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
            method: 'file'
          };
        }
      },

      async isAvailable(): Promise<boolean> {
        return true; // File system should always be available
      },

      async clear(): Promise<ClipboardResult> {
        const startTime = Date.now();
        try {
          await fs.promises.writeFile(clipboardFile, '', 'utf8');
          
          return {
            success: true,
            duration: Date.now() - startTime,
            method: 'file'
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
            method: 'file'
          };
        }
      }
    };
  }
}

/**
 * Main Clipboard Manager
 * Handles cross-platform clipboard operations with fallbacks
 */
export class ClipboardManager {
  private config: ClipboardConfig;
  private methods: ClipboardMethods;
  private history: ClipboardEntry[] = [];
  private historyMap = new Map<string, ClipboardEntry>();

  constructor(config: Partial<ClipboardConfig> = {}) {
    this.config = { ...DEFAULT_CLIPBOARD_CONFIG, ...config };
    this.methods = this.detectBestMethods();
  }

  /**
   * Detect best clipboard methods for current platform
   */
  private detectBestMethods(): ClipboardMethods {
    const envInfo = PlatformDetector.getEnvironmentInfo();
    
    if (this.config.preferredMethod === 'fallback') {
      return ClipboardMethods.fallback();
    }

    // WSL has special handling
    if (envInfo.isWSL) {
      return ClipboardMethods.wsl();
    }

    // Platform-specific methods
    switch (envInfo.platform) {
      case 'windows':
        return ClipboardMethods.windows();
      case 'macos':
        return ClipboardMethods.macos();
      case 'linux':
        return ClipboardMethods.linux();
      default:
        return ClipboardMethods.fallback();
    }
  }

  /**
   * Copy text to clipboard
   */
  async copyText(text: string, source: string = 'manual'): Promise<ClipboardResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: 'Clipboard functionality is disabled',
        duration: 0,
        method: 'none'
      };
    }

    // Try primary method
    let result = await this.methods.copy(text);
    
    // Fallback if primary method failed and fallback is enabled
    if (!result.success && this.config.fallbackToFiles && this.methods !== ClipboardMethods.fallback()) {
      const fallbackMethods = ClipboardMethods.fallback();
      result = await fallbackMethods.copy(text);
      result.method = `fallback-${result.method}`;
    }

    // Add to history if successful
    if (result.success && this.config.enableHistory) {
      this.addToHistory(text, 'text', source);
    }

    if (this.config.debug) {
      console.debug(`[ClipboardManager] Copy result:`, result);
    }

    return result;
  }

  /**
   * Read text from clipboard
   */
  async pasteText(): Promise<ClipboardResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: 'Clipboard functionality is disabled',
        duration: 0,
        method: 'none'
      };
    }

    // Try primary method
    let result = await this.methods.paste();
    
    // Fallback if primary method failed
    if (!result.success && this.config.fallbackToFiles && this.methods !== ClipboardMethods.fallback()) {
      const fallbackMethods = ClipboardMethods.fallback();
      result = await fallbackMethods.paste();
      result.method = `fallback-${result.method}`;
    }

    if (this.config.debug) {
      console.debug(`[ClipboardManager] Paste result:`, result);
    }

    return result;
  }

  /**
   * Clear clipboard
   */
  async clearClipboard(): Promise<ClipboardResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: 'Clipboard functionality is disabled',
        duration: 0,
        method: 'none'
      };
    }

    const result = await this.methods.clear();
    
    if (this.config.debug) {
      console.debug(`[ClipboardManager] Clear result:`, result);
    }

    return result;
  }

  /**
   * Check if clipboard is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    return await this.methods.isAvailable();
  }

  /**
   * Add entry to clipboard history
   */
  private addToHistory(content: string, type: ClipboardEntry['type'], source: string): void {
    const entry: ClipboardEntry = {
      id: this.generateEntryId(),
      content,
      type,
      source,
      timestamp: Date.now(),
      size: content.length
    };

    // Remove duplicate if exists
    const existingIndex = this.history.findIndex(e => e.content === content);
    if (existingIndex >= 0) {
      this.history.splice(existingIndex, 1);
      this.historyMap.delete(this.history[existingIndex]?.id);
    }

    // Add to beginning
    this.history.unshift(entry);
    this.historyMap.set(entry.id, entry);

    // Trim to max size
    if (this.history.length > this.config.maxHistorySize) {
      const removed = this.history.splice(this.config.maxHistorySize);
      removed.forEach(item => this.historyMap.delete(item.id));
    }
  }

  /**
   * Generate unique entry ID
   */
  private generateEntryId(): string {
    return `clipboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get clipboard history
   */
  getHistory(): ClipboardEntry[] {
    return [...this.history];
  }

  /**
   * Get clipboard entry by ID
   */
  getHistoryEntry(id: string): ClipboardEntry | null {
    return this.historyMap.get(id) || null;
  }

  /**
   * Copy from history entry
   */
  async copyFromHistory(id: string): Promise<ClipboardResult> {
    const entry = this.getHistoryEntry(id);
    if (!entry) {
      return {
        success: false,
        error: 'History entry not found',
        duration: 0,
        method: 'history'
      };
    }

    return await this.copyText(entry.content, 'history');
  }

  /**
   * Clear clipboard history
   */
  clearHistory(): void {
    this.history = [];
    this.historyMap.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ClipboardConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Re-detect methods if preferred method changed
    if (config.preferredMethod) {
      this.methods = this.detectBestMethods();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ClipboardConfig {
    return { ...this.config };
  }

  /**
   * Get environment information
   */
  getEnvironmentInfo(): ReturnType<typeof PlatformDetector.getEnvironmentInfo> {
    return PlatformDetector.getEnvironmentInfo();
  }

  /**
   * Get debug information
   */
  getDebugInfo(): Record<string, any> {
    return {
      config: this.config,
      environmentInfo: this.getEnvironmentInfo(),
      historySize: this.history.length,
      maxHistorySize: this.config.maxHistorySize,
      methodsAvailable: this.methods !== null
    };
  }

  /**
   * Test clipboard functionality
   */
  async testClipboard(): Promise<{
    copyTest: ClipboardResult;
    pasteTest: ClipboardResult;
    clearTest: ClipboardResult;
    available: boolean;
  }> {
    const testText = 'Plato clipboard test';
    
    const available = await this.isAvailable();
    const copyTest = await this.copyText(testText, 'test');
    const pasteTest = await this.pasteText();
    const clearTest = await this.clearClipboard();

    return {
      copyTest,
      pasteTest,
      clearTest,
      available
    };
  }
}