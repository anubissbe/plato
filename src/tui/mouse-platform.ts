/**
 * Platform-specific Mouse Support Detection
 * Handles cross-platform mouse capability detection and configuration
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import {
  PlatformMouseCapabilities,
  MouseProtocolConfig,
  MouseCoordinates,
  MOUSE_SEQUENCES
} from './mouse-types.js';

const execAsync = promisify(exec);

/**
 * Platform detection and mouse capability management
 */
export class MousePlatformDetector {
  private static instance: MousePlatformDetector;
  private capabilities: PlatformMouseCapabilities | null = null;
  private detectionPromise: Promise<PlatformMouseCapabilities> | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): MousePlatformDetector {
    if (!MousePlatformDetector.instance) {
      MousePlatformDetector.instance = new MousePlatformDetector();
    }
    return MousePlatformDetector.instance;
  }

  /**
   * Detect platform capabilities (async, cached)
   */
  async detectCapabilities(): Promise<PlatformMouseCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    if (this.detectionPromise) {
      return this.detectionPromise;
    }

    this.detectionPromise = this.performDetection();
    this.capabilities = await this.detectionPromise;
    return this.capabilities;
  }

  /**
   * Get cached capabilities (sync)
   */
  getCapabilities(): PlatformMouseCapabilities | null {
    return this.capabilities;
  }

  /**
   * Get optimal mouse protocol for current platform
   */
  async getOptimalProtocol(): Promise<MouseProtocolConfig> {
    const capabilities = await this.detectCapabilities();
    
    // Prefer SGR mode if supported
    if (capabilities.supportedProtocols.includes('sgr')) {
      return {
        mode: 'sgr',
        enableTracking: true,
        enableButtons: true,
        enableMotion: capabilities.supportLevel === 'full',
        enableFocus: capabilities.supportLevel === 'full'
      };
    }

    // Fall back to UTF-8 if available
    if (capabilities.supportedProtocols.includes('utf8')) {
      return {
        mode: 'utf8',
        enableTracking: true,
        enableButtons: true,
        enableMotion: false, // UTF-8 has coordinate limits
        enableFocus: false
      };
    }

    // Last resort: urxvt
    return {
      mode: 'urxvt',
      enableTracking: true,
      enableButtons: capabilities.supportLevel !== 'minimal',
      enableMotion: false,
      enableFocus: false
    };
  }

  /**
   * Configure terminal for mouse support
   */
  async configureMouseSupport(): Promise<boolean> {
    try {
      const capabilities = await this.detectCapabilities();
      const protocol = await this.getOptimalProtocol();

      // Don't configure if no support
      if (capabilities.supportLevel === 'none') {
        return false;
      }

      // Enable mouse tracking
      if (protocol.enableTracking) {
        process.stdout.write(MOUSE_SEQUENCES.ENABLE_TRACKING);
      }

      // Enable button tracking
      if (protocol.enableButtons) {
        process.stdout.write(MOUSE_SEQUENCES.ENABLE_BUTTONS);
      }

      // Configure protocol mode
      switch (protocol.mode) {
        case 'sgr':
          process.stdout.write(MOUSE_SEQUENCES.ENABLE_SGR);
          break;
        case 'utf8':
          process.stdout.write(MOUSE_SEQUENCES.ENABLE_UTF8);
          break;
        case 'urxvt':
          process.stdout.write(MOUSE_SEQUENCES.ENABLE_URXVT);
          break;
      }

      // Enable focus events if supported
      if (protocol.enableFocus) {
        process.stdout.write(MOUSE_SEQUENCES.ENABLE_FOCUS);
      }

      return true;
    } catch (error) {
      console.error('[MousePlatform] Failed to configure mouse support:', error);
      return false;
    }
  }

  /**
   * Disable mouse support
   */
  async disableMouseSupport(): Promise<void> {
    try {
      // Disable all mouse tracking
      process.stdout.write(MOUSE_SEQUENCES.DISABLE_TRACKING);
      process.stdout.write(MOUSE_SEQUENCES.DISABLE_BUTTONS);
      process.stdout.write(MOUSE_SEQUENCES.DISABLE_SGR);
      process.stdout.write(MOUSE_SEQUENCES.DISABLE_UTF8);
      process.stdout.write(MOUSE_SEQUENCES.DISABLE_URXVT);
      process.stdout.write(MOUSE_SEQUENCES.DISABLE_FOCUS);
    } catch (error) {
      console.error('[MousePlatform] Failed to disable mouse support:', error);
    }
  }

  /**
   * Test mouse functionality
   */
  async testMouseFunctionality(): Promise<boolean> {
    const capabilities = await this.detectCapabilities();
    return capabilities.supportLevel !== 'none';
  }

  /**
   * Get platform-specific recommendations
   */
  async getPlatformRecommendations(): Promise<string[]> {
    const capabilities = await this.detectCapabilities();
    const recommendations: string[] = [];

    if (capabilities.isWSL) {
      recommendations.push('WSL detected: Mouse support may be limited in some terminals');
      recommendations.push('Recommend using Windows Terminal or VS Code integrated terminal');
    }

    if (capabilities.isContainer) {
      recommendations.push('Container detected: Mouse support depends on host terminal');
      recommendations.push('Ensure container has appropriate terminal capabilities');
    }

    if (capabilities.supportLevel === 'minimal') {
      recommendations.push('Limited mouse support: Only basic click events available');
    } else if (capabilities.supportLevel === 'none') {
      recommendations.push('No mouse support detected: Terminal may not support mouse events');
      recommendations.push('Try a modern terminal emulator like Windows Terminal, iTerm2, or GNOME Terminal');
    }

    if (capabilities.platform === 'unknown') {
      recommendations.push('Unknown platform: Mouse support may be unpredictable');
    }

    return recommendations;
  }

  /**
   * Perform actual capability detection
   */
  private async performDetection(): Promise<PlatformMouseCapabilities> {
    const platform = this.detectPlatform();
    const isWSL = await this.detectWSL();
    const isContainer = await this.detectContainer();
    
    // Get terminal capabilities
    const terminalInfo = await this.getTerminalInfo();
    const supportedProtocols = this.detectSupportedProtocols(terminalInfo);
    const maxCoordinates = this.getMaxCoordinates(terminalInfo);
    const supportLevel = this.determineSupportLevel(platform, isWSL, isContainer, terminalInfo);

    return {
      platform,
      isWSL,
      isContainer,
      supportedProtocols,
      maxCoordinates,
      supportLevel
    };
  }

  /**
   * Detect operating system platform
   */
  private detectPlatform(): PlatformMouseCapabilities['platform'] {
    const platform = process.platform;
    switch (platform) {
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
   * Detect if running in WSL
   */
  private async detectWSL(): Promise<boolean> {
    try {
      // Check for WSL-specific environment variables
      if (process.env.WSL_DISTRO_NAME || process.env.WSLENV) {
        return true;
      }

      // Check /proc/version for Microsoft WSL signature
      if (process.platform === 'linux') {
        const { stdout } = await execAsync('cat /proc/version 2>/dev/null || echo ""');
        return stdout.toLowerCase().includes('microsoft') || stdout.toLowerCase().includes('wsl');
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Detect if running in container
   */
  private async detectContainer(): Promise<boolean> {
    try {
      // Check for Docker/.dockerenv
      const { stdout: dockerCheck } = await execAsync('test -f /.dockerenv && echo "docker" || echo ""');
      if (dockerCheck.trim() === 'docker') return true;

      // Check for other container indicators
      if (process.env.KUBERNETES_SERVICE_HOST || 
          process.env.container || 
          process.env.DOCKER_CONTAINER) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get terminal information
   */
  private async getTerminalInfo(): Promise<Record<string, string>> {
    const info: Record<string, string> = {};

    try {
      // Get basic terminal info
      info.TERM = process.env.TERM || '';
      info.TERM_PROGRAM = process.env.TERM_PROGRAM || '';
      info.COLORTERM = process.env.COLORTERM || '';
      info.TERMINFO = process.env.TERMINFO || '';

      // Try to get terminal capabilities via tput/infocmp
      try {
        const { stdout: tputOutput } = await execAsync('tput longname 2>/dev/null || echo ""');
        if (tputOutput.trim()) {
          info.TERMINAL_NAME = tputOutput.trim();
        }
      } catch {
        // Ignore tput failures
      }

      return info;
    } catch {
      return info;
    }
  }

  /**
   * Detect supported mouse protocols
   */
  private detectSupportedProtocols(terminalInfo: Record<string, string>): MouseProtocolConfig['mode'][] {
    const protocols: MouseProtocolConfig['mode'][] = [];
    
    const term = terminalInfo.TERM?.toLowerCase() || '';
    const termProgram = terminalInfo.TERM_PROGRAM?.toLowerCase() || '';

    // Modern terminals generally support SGR
    if (term.includes('xterm') || 
        term.includes('screen') ||
        termProgram.includes('vscode') ||
        termProgram.includes('iterm') ||
        termProgram.includes('terminal') ||
        termProgram.includes('windows terminal')) {
      protocols.push('sgr');
    }

    // Most terminals support UTF-8 encoding
    if (term.includes('xterm') || 
        term.includes('screen') ||
        term.includes('tmux')) {
      protocols.push('utf8');
    }

    // urxvt and compatible terminals
    if (term.includes('rxvt') || 
        term.includes('urxvt') ||
        protocols.length === 0) { // Fallback
      protocols.push('urxvt');
    }

    // Ensure we always have at least urxvt as fallback
    if (protocols.length === 0) {
      protocols.push('urxvt');
    }

    return protocols;
  }

  /**
   * Get maximum coordinate values for the terminal
   */
  private getMaxCoordinates(terminalInfo: Record<string, string>): MouseCoordinates {
    const term = terminalInfo.TERM?.toLowerCase() || '';
    
    // UTF-8 mouse protocol has coordinate limits
    if (term.includes('utf8') || term.includes('unicode')) {
      return { x: 223, y: 223 };
    }

    // SGR mode supports much larger coordinates
    return { x: 9999, y: 9999 };
  }

  /**
   * Determine overall support level
   */
  private determineSupportLevel(
    platform: PlatformMouseCapabilities['platform'],
    isWSL: boolean,
    isContainer: boolean,
    terminalInfo: Record<string, string>
  ): PlatformMouseCapabilities['supportLevel'] {
    const term = terminalInfo.TERM?.toLowerCase() || '';
    const termProgram = terminalInfo.TERM_PROGRAM?.toLowerCase() || '';

    // No terminal info usually means no support
    if (!term && !termProgram) {
      return 'none';
    }

    // Known good terminals
    if (termProgram.includes('vscode') ||
        termProgram.includes('iterm2') ||
        termProgram.includes('windows terminal') ||
        term.includes('xterm-256color')) {
      return isContainer ? 'partial' : 'full';
    }

    // WSL may have limitations
    if (isWSL) {
      return termProgram.includes('windows terminal') ? 'partial' : 'minimal';
    }

    // Container environments
    if (isContainer) {
      return 'partial';
    }

    // Basic terminal support
    if (term.includes('xterm') || term.includes('screen')) {
      return 'partial';
    }

    // Very basic terminals
    if (term.includes('dumb') || term.includes('unknown')) {
      return 'none';
    }

    // Default to minimal for unknown configurations
    return 'minimal';
  }
}