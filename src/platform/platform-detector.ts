/**
 * Task 4.3: Platform Detection and Capability Detection System
 * Advanced platform detection with comprehensive capability analysis
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import { PlatformMouseCapabilities, MouseCoordinates } from '../tui/mouse-types.js';

const execAsync = promisify(exec);

export interface PlatformCapabilities {
  /** Operating system platform */
  platform: 'windows' | 'darwin' | 'linux' | 'unknown';
  /** Platform version/release */
  platformVersion: string;
  /** CPU architecture */
  architecture: string;
  /** Node.js version */
  nodeVersion: string;
  /** Environment type (WSL, container, native) */
  environment: PlatformEnvironment;
  /** Terminal capabilities */
  terminal: TerminalCapabilities;
  /** Mouse support capabilities */
  mouse: PlatformMouseCapabilities;
  /** Performance characteristics */
  performance: PerformanceCapabilities;
  /** Feature availability */
  features: FeatureAvailability;
}

export interface PlatformEnvironment {
  isWSL: boolean;
  isContainer: boolean;
  isCI: boolean;
  isRemote: boolean;
  containerType?: 'docker' | 'podman' | 'kubernetes' | 'unknown';
  wslVersion?: '1' | '2';
  remoteType?: 'ssh' | 'vscode' | 'unknown';
}

export interface TerminalCapabilities {
  /** Terminal emulator name */
  name: string;
  /** Terminal type (TERM env var) */
  type: string;
  /** Color support level */
  colorDepth: number;
  /** Unicode support */
  supportsUnicode: boolean;
  /** Terminal dimensions */
  dimensions: { width: number; height: number };
  /** Advanced features */
  features: {
    /** Mouse event support */
    mouse: boolean;
    /** True color (24-bit) support */
    trueColor: boolean;
    /** Hyperlink support */
    hyperlinks: boolean;
    /** Image display support */
    images: boolean;
    /** Sixel graphics support */
    sixel: boolean;
  };
}

export interface PerformanceCapabilities {
  /** CPU core count */
  cpuCores: number;
  /** Available memory (MB) */
  memoryMB: number;
  /** Platform performance tier */
  tier: 'high' | 'medium' | 'low';
  /** I/O performance characteristics */
  io: {
    /** Filesystem type */
    fsType: string;
    /** Estimated throughput */
    throughputMBps: number;
  };
}

export interface FeatureAvailability {
  /** Native binaries availability */
  nativeBinaries: Record<string, boolean>;
  /** System capabilities */
  systemFeatures: {
    /** Process spawning */
    processSpawn: boolean;
    /** File system access */
    fileSystem: boolean;
    /** Network access */
    network: boolean;
    /** Clipboard access */
    clipboard: boolean;
  };
  /** Security constraints */
  security: {
    /** SELinux status */
    selinux: boolean;
    /** AppArmor status */
    apparmor: boolean;
    /** Restricted environment */
    restricted: boolean;
  };
}

/**
 * Comprehensive platform detection and capability analysis system
 */
export class PlatformDetector {
  private static instance: PlatformDetector;
  private capabilities: PlatformCapabilities | null = null;
  private detectionPromise: Promise<PlatformCapabilities> | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): PlatformDetector {
    if (!PlatformDetector.instance) {
      PlatformDetector.instance = new PlatformDetector();
    }
    return PlatformDetector.instance;
  }

  /**
   * Detect all platform capabilities (async, cached)
   */
  async detectCapabilities(): Promise<PlatformCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    if (this.detectionPromise) {
      return this.detectionPromise;
    }

    this.detectionPromise = this.performFullDetection();
    this.capabilities = await this.detectionPromise;
    return this.capabilities;
  }

  /**
   * Get cached capabilities (sync)
   */
  getCapabilities(): PlatformCapabilities | null {
    return this.capabilities;
  }

  /**
   * Quick platform check for critical decisions
   */
  async quickPlatformCheck(): Promise<{
    platform: string;
    canRunMouse: boolean;
    performanceTier: 'high' | 'medium' | 'low';
    hasRestrictions: boolean;
  }> {
    const platform = process.platform;
    const isWSL = await this.detectWSL();
    const isContainer = await this.detectContainer();
    const isCI = this.detectCI();

    return {
      platform,
      canRunMouse: !isCI && process.stdout.isTTY,
      performanceTier: isContainer || isWSL ? 'medium' : 'high',
      hasRestrictions: isContainer || isCI || isWSL
    };
  }

  /**
   * Detect platform-specific optimizations
   */
  async getOptimizationRecommendations(): Promise<{
    concurrency: number;
    memoryLimit: number;
    ioStrategy: 'sync' | 'async' | 'buffered';
    cachingStrategy: 'aggressive' | 'moderate' | 'minimal';
  }> {
    const capabilities = await this.detectCapabilities();

    return {
      concurrency: Math.max(1, Math.floor(capabilities.performance.cpuCores * 0.75)),
      memoryLimit: Math.floor(capabilities.performance.memoryMB * 0.8),
      ioStrategy: capabilities.environment.isContainer ? 'buffered' : 'async',
      cachingStrategy: capabilities.performance.tier === 'high' ? 'aggressive' : 'moderate'
    };
  }

  /**
   * Check if specific feature is supported
   */
  async supportsFeature(feature: keyof FeatureAvailability['systemFeatures']): Promise<boolean> {
    const capabilities = await this.detectCapabilities();
    return capabilities.features.systemFeatures[feature];
  }

  /**
   * Get platform-specific error handling strategy
   */
  async getErrorHandlingStrategy(): Promise<{
    retryCount: number;
    retryDelay: number;
    gracefulDegradation: boolean;
    verboseLogging: boolean;
  }> {
    const capabilities = await this.detectCapabilities();
    const isRestricted = capabilities.environment.isContainer || 
                        capabilities.environment.isCI ||
                        capabilities.features.security.restricted;

    return {
      retryCount: isRestricted ? 2 : 3,
      retryDelay: capabilities.performance.tier === 'low' ? 1000 : 500,
      gracefulDegradation: isRestricted,
      verboseLogging: capabilities.environment.isCI
    };
  }

  /**
   * Perform comprehensive platform detection
   */
  private async performFullDetection(): Promise<PlatformCapabilities> {
    const [
      platform,
      platformVersion,
      architecture,
      environment,
      terminal,
      mouse,
      performance,
      features
    ] = await Promise.all([
      this.detectPlatform(),
      this.detectPlatformVersion(),
      this.detectArchitecture(),
      this.detectEnvironment(),
      this.detectTerminalCapabilities(),
      this.detectMouseCapabilities(),
      this.detectPerformanceCapabilities(),
      this.detectFeatureAvailability()
    ]);

    return {
      platform,
      platformVersion,
      architecture,
      nodeVersion: process.version,
      environment,
      terminal,
      mouse,
      performance,
      features
    };
  }

  /**
   * Detect operating system platform
   */
  private async detectPlatform(): Promise<PlatformCapabilities['platform']> {
    switch (process.platform) {
      case 'win32':
        return 'windows';
      case 'darwin':
        return 'darwin';
      case 'linux':
        return 'linux';
      default:
        return 'unknown';
    }
  }

  /**
   * Detect platform version
   */
  private async detectPlatformVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('uname -r 2>/dev/null || ver 2>/dev/null || echo "unknown"');
      return stdout.trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Detect CPU architecture
   */
  private async detectArchitecture(): Promise<string> {
    return process.arch;
  }

  /**
   * Detect environment type (WSL, container, etc.)
   */
  private async detectEnvironment(): Promise<PlatformEnvironment> {
    const [isWSL, isContainer, isCI, isRemote] = await Promise.all([
      this.detectWSL(),
      this.detectContainer(),
      Promise.resolve(this.detectCI()),
      this.detectRemote()
    ]);

    const environment: PlatformEnvironment = {
      isWSL,
      isContainer,
      isCI,
      isRemote
    };

    // Detect specific container type
    if (isContainer) {
      environment.containerType = await this.detectContainerType();
    }

    // Detect WSL version
    if (isWSL) {
      environment.wslVersion = await this.detectWSLVersion();
    }

    // Detect remote type
    if (isRemote) {
      environment.remoteType = await this.detectRemoteType();
    }

    return environment;
  }

  /**
   * Detect if running in WSL
   */
  private async detectWSL(): Promise<boolean> {
    try {
      // Check environment variables
      if (process.env.WSL_DISTRO_NAME || process.env.WSLENV) {
        return true;
      }

      // Check /proc/version for WSL signature
      if (process.platform === 'linux' && existsSync('/proc/version')) {
        const version = readFileSync('/proc/version', 'utf8');
        return version.toLowerCase().includes('microsoft') || 
               version.toLowerCase().includes('wsl');
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Detect WSL version
   */
  private async detectWSLVersion(): Promise<'1' | '2'> {
    try {
      const { stdout } = await execAsync('wsl.exe --status 2>/dev/null || echo ""');
      return stdout.includes('WSL 2') ? '2' : '1';
    } catch {
      return '2'; // Default to WSL2 assumption
    }
  }

  /**
   * Detect if running in container
   */
  private async detectContainer(): Promise<boolean> {
    try {
      // Check for container-specific files
      if (existsSync('/.dockerenv') || existsSync('/run/.containerenv')) {
        return true;
      }

      // Check environment variables
      if (process.env.KUBERNETES_SERVICE_HOST || 
          process.env.container || 
          process.env.DOCKER_CONTAINER) {
        return true;
      }

      // Check cgroup for container indicators
      if (existsSync('/proc/1/cgroup')) {
        const cgroup = readFileSync('/proc/1/cgroup', 'utf8');
        return cgroup.includes('docker') || 
               cgroup.includes('containerd') || 
               cgroup.includes('kubepods');
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Detect container type
   */
  private async detectContainerType(): Promise<PlatformEnvironment['containerType']> {
    try {
      if (existsSync('/.dockerenv')) return 'docker';
      if (existsSync('/run/.containerenv')) return 'podman';
      if (process.env.KUBERNETES_SERVICE_HOST) return 'kubernetes';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Detect CI environment
   */
  private detectCI(): boolean {
    return !!(
      process.env.CI ||
      process.env.CONTINUOUS_INTEGRATION ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.JENKINS_URL ||
      process.env.BUILDKITE
    );
  }

  /**
   * Detect remote environment
   */
  private async detectRemote(): Promise<boolean> {
    return !!(
      process.env.SSH_CLIENT ||
      process.env.SSH_TTY ||
      process.env.VSCODE_REMOTE ||
      process.env.REMOTE_CONTAINERS
    );
  }

  /**
   * Detect remote type
   */
  private async detectRemoteType(): Promise<PlatformEnvironment['remoteType']> {
    if (process.env.VSCODE_REMOTE || process.env.REMOTE_CONTAINERS) return 'vscode';
    if (process.env.SSH_CLIENT || process.env.SSH_TTY) return 'ssh';
    return 'unknown';
  }

  /**
   * Detect terminal capabilities
   */
  private async detectTerminalCapabilities(): Promise<TerminalCapabilities> {
    const name = process.env.TERM_PROGRAM || 'unknown';
    const type = process.env.TERM || 'unknown';
    const colorDepth = this.detectColorDepth();
    const supportsUnicode = this.detectUnicodeSupport();
    const dimensions = {
      width: process.stdout.columns || 80,
      height: process.stdout.rows || 24
    };

    const features = {
      mouse: await this.detectMouseSupport(),
      trueColor: this.detectTrueColorSupport(),
      hyperlinks: this.detectHyperlinkSupport(),
      images: this.detectImageSupport(),
      sixel: this.detectSixelSupport()
    };

    return {
      name,
      type,
      colorDepth,
      supportsUnicode,
      dimensions,
      features
    };
  }

  /**
   * Detect color depth
   */
  private detectColorDepth(): number {
    const colorterm = process.env.COLORTERM;
    const term = process.env.TERM || '';

    if (colorterm === 'truecolor' || colorterm === '24bit') return 24;
    if (term.includes('256color')) return 8;
    if (term.includes('color')) return 4;
    return 1;
  }

  /**
   * Detect Unicode support
   */
  private detectUnicodeSupport(): boolean {
    const lang = process.env.LANG || process.env.LC_ALL || '';
    return lang.toLowerCase().includes('utf') || 
           lang.toLowerCase().includes('unicode');
  }

  /**
   * Detect mouse support
   */
  private async detectMouseSupport(): Promise<boolean> {
    if (!process.stdout.isTTY) return false;
    
    const term = process.env.TERM || '';
    const termProgram = process.env.TERM_PROGRAM || '';

    // Known terminals with mouse support
    return term.includes('xterm') ||
           term.includes('screen') ||
           termProgram.includes('vscode') ||
           termProgram.includes('iterm') ||
           termProgram.includes('terminal');
  }

  /**
   * Detect true color support
   */
  private detectTrueColorSupport(): boolean {
    return process.env.COLORTERM === 'truecolor' ||
           process.env.COLORTERM === '24bit';
  }

  /**
   * Detect hyperlink support
   */
  private detectHyperlinkSupport(): boolean {
    const termProgram = process.env.TERM_PROGRAM || '';
    return termProgram.includes('vscode') ||
           termProgram.includes('iterm2') ||
           termProgram.includes('terminal');
  }

  /**
   * Detect image support
   */
  private detectImageSupport(): boolean {
    const termProgram = process.env.TERM_PROGRAM || '';
    return termProgram.includes('iterm2') ||
           termProgram.includes('kitty');
  }

  /**
   * Detect Sixel support
   */
  private detectSixelSupport(): boolean {
    const term = process.env.TERM || '';
    return term.includes('xterm') && 
           !process.env.TERM_PROGRAM; // Native xterm
  }

  /**
   * Detect mouse capabilities using existing system
   */
  private async detectMouseCapabilities(): Promise<PlatformMouseCapabilities> {
    // Import here to avoid circular dependencies
    const { MousePlatformDetector } = await import('../tui/mouse-platform.js');
    const mouseDetector = MousePlatformDetector.getInstance();
    return await mouseDetector.detectCapabilities();
  }

  /**
   * Detect performance capabilities
   */
  private async detectPerformanceCapabilities(): Promise<PerformanceCapabilities> {
    const cpuCores = require('os').cpus().length;
    const memoryBytes = require('os').totalmem();
    const memoryMB = Math.floor(memoryBytes / (1024 * 1024));

    // Determine performance tier
    let tier: PerformanceCapabilities['tier'] = 'medium';
    if (cpuCores >= 8 && memoryMB >= 8192) {
      tier = 'high';
    } else if (cpuCores <= 2 || memoryMB <= 2048) {
      tier = 'low';
    }

    const io = await this.detectIOCapabilities();

    return {
      cpuCores,
      memoryMB,
      tier,
      io
    };
  }

  /**
   * Detect I/O capabilities
   */
  private async detectIOCapabilities(): Promise<PerformanceCapabilities['io']> {
    try {
      // Try to detect filesystem type
      const { stdout } = await execAsync('df -T . 2>/dev/null | tail -1 | awk \'{print $2}\' || echo "unknown"');
      const fsType = stdout.trim();

      // Estimate throughput based on filesystem type
      let throughputMBps = 100; // Default estimate
      switch (fsType) {
        case 'ext4':
        case 'xfs':
        case 'btrfs':
          throughputMBps = 200;
          break;
        case 'zfs':
          throughputMBps = 150;
          break;
        case 'tmpfs':
          throughputMBps = 1000;
          break;
        case 'nfs':
          throughputMBps = 50;
          break;
      }

      return { fsType, throughputMBps };
    } catch {
      return { fsType: 'unknown', throughputMBps: 100 };
    }
  }

  /**
   * Detect feature availability
   */
  private async detectFeatureAvailability(): Promise<FeatureAvailability> {
    const nativeBinaries = await this.detectNativeBinaries();
    const systemFeatures = await this.detectSystemFeatures();
    const security = await this.detectSecurityConstraints();

    return {
      nativeBinaries,
      systemFeatures,
      security
    };
  }

  /**
   * Detect available native binaries
   */
  private async detectNativeBinaries(): Promise<Record<string, boolean>> {
    const binaries = ['git', 'curl', 'wget', 'grep', 'sed', 'awk', 'tar', 'zip', 'unzip'];
    const results: Record<string, boolean> = {};

    await Promise.all(
      binaries.map(async (binary) => {
        try {
          await execAsync(`which ${binary} 2>/dev/null`);
          results[binary] = true;
        } catch {
          results[binary] = false;
        }
      })
    );

    return results;
  }

  /**
   * Detect system features
   */
  private async detectSystemFeatures(): Promise<FeatureAvailability['systemFeatures']> {
    return {
      processSpawn: true, // Node.js always supports this
      fileSystem: existsSync('/') || existsSync('C:\\'),
      network: !process.env.OFFLINE && !process.env.NO_NETWORK,
      clipboard: await this.detectClipboardSupport()
    };
  }

  /**
   * Detect clipboard support
   */
  private async detectClipboardSupport(): Promise<boolean> {
    try {
      const platform = process.platform;
      if (platform === 'darwin') {
        await execAsync('which pbcopy');
        return true;
      } else if (platform === 'win32') {
        return true; // Windows has built-in clipboard
      } else {
        await execAsync('which xclip || which xsel');
        return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * Detect security constraints
   */
  private async detectSecurityConstraints(): Promise<FeatureAvailability['security']> {
    const selinux = await this.detectSELinux();
    const apparmor = await this.detectAppArmor();
    const restricted = await this.detectRestrictedEnvironment();

    return {
      selinux,
      apparmor,
      restricted
    };
  }

  /**
   * Detect SELinux
   */
  private async detectSELinux(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('getenforce 2>/dev/null || echo "Disabled"');
      return !stdout.trim().toLowerCase().includes('disabled');
    } catch {
      return false;
    }
  }

  /**
   * Detect AppArmor
   */
  private async detectAppArmor(): Promise<boolean> {
    try {
      await execAsync('aa-status 2>/dev/null');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect restricted environment
   */
  private async detectRestrictedEnvironment(): Promise<boolean> {
    const environment = await this.detectEnvironment();
    return environment.isContainer || 
           environment.isCI || 
           !process.stdout.isTTY ||
           process.env.SANDBOXED === 'true';
  }
}