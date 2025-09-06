/**
 * Platform-Specific Mouse Event Compatibility Tests
 * Testing mouse support across different platforms and terminal environments
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { platform } from 'os';
import { execSync } from 'child_process';

interface PlatformCapabilities {
  platform: string;
  isWSL: boolean;
  isDocker: boolean;
  isSSH: boolean;
  terminalType: string;
  hasMouseSupport: boolean;
  mouseProtocol: 'xterm' | 'sgr' | 'dec' | 'none';
  maxCoordinates: { x: number; y: number };
  supportedEvents: string[];
}

interface MouseEventTestCase {
  name: string;
  platform: string;
  environment: string;
  inputSequence: string;
  expectedEvent: {
    type: string;
    x: number;
    y: number;
    button?: string;
    modifiers?: string[];
  };
  shouldWork: boolean;
}

describe('Platform Mouse Compatibility Tests', () => {
  let originalPlatform: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalPlatform = process.platform;
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env = originalEnv;
  });

  describe('Platform Detection', () => {
    it('detects Windows platform correctly', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const capabilities = detectPlatformCapabilities();
      
      expect(capabilities.platform).toBe('win32');
      expect(capabilities.hasMouseSupport).toBe(true);
      expect(capabilities.mouseProtocol).toBe('sgr');
    });

    it('detects macOS platform correctly', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      const capabilities = detectPlatformCapabilities();
      
      expect(capabilities.platform).toBe('darwin');
      expect(capabilities.hasMouseSupport).toBe(true);
      expect(capabilities.mouseProtocol).toBe('sgr');
    });

    it('detects Linux platform correctly', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      const capabilities = detectPlatformCapabilities();
      
      expect(capabilities.platform).toBe('linux');
      expect(capabilities.hasMouseSupport).toBe(true);
      expect(['xterm', 'sgr']).toContain(capabilities.mouseProtocol);
    });

    it('detects WSL environment', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.WSL_DISTRO_NAME = 'Ubuntu';
      
      const capabilities = detectPlatformCapabilities();
      
      expect(capabilities.isWSL).toBe(true);
      expect(capabilities.hasMouseSupport).toBe(true);
      expect(capabilities.mouseProtocol).toBe('sgr');
    });

    it('detects Docker environment', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.container = 'docker';
      
      const capabilities = detectPlatformCapabilities();
      
      expect(capabilities.isDocker).toBe(true);
      expect(capabilities.hasMouseSupport).toBe(true);
      expect(capabilities.terminalType).toContain('xterm');
    });

    it('detects SSH session', () => {
      process.env.SSH_CLIENT = '192.168.1.100 12345 22';
      process.env.SSH_TTY = '/dev/pts/0';
      
      const capabilities = detectPlatformCapabilities();
      
      expect(capabilities.isSSH).toBe(true);
      expect(capabilities.hasMouseSupport).toBe(true);
    });
  });

  describe('Mouse Event Parsing Per Platform', () => {
    const testCases: MouseEventTestCase[] = [
      {
        name: 'Windows Terminal - Left Click',
        platform: 'win32',
        environment: 'windows-terminal',
        inputSequence: '\x1b[<0;10;5M',
        expectedEvent: {
          type: 'mousedown',
          x: 10,
          y: 5,
          button: 'left'
        },
        shouldWork: true
      },
      {
        name: 'macOS Terminal.app - Right Click',
        platform: 'darwin',
        environment: 'terminal-app',
        inputSequence: '\x1b[<2;20;10M',
        expectedEvent: {
          type: 'mousedown',
          x: 20,
          y: 10,
          button: 'right'
        },
        shouldWork: true
      },
      {
        name: 'Linux xterm - Mouse Move',
        platform: 'linux',
        environment: 'xterm',
        inputSequence: '\x1b[<32;15;8M',
        expectedEvent: {
          type: 'mousemove',
          x: 15,
          y: 8
        },
        shouldWork: true
      },
      {
        name: 'WSL - Scroll Up',
        platform: 'linux',
        environment: 'wsl',
        inputSequence: '\x1b[<64;10;5M',
        expectedEvent: {
          type: 'wheel',
          x: 10,
          y: 5,
          button: 'wheelup'
        },
        shouldWork: true
      },
      {
        name: 'Docker - Middle Click',
        platform: 'linux',
        environment: 'docker',
        inputSequence: '\x1b[<1;30;15M',
        expectedEvent: {
          type: 'mousedown',
          x: 30,
          y: 15,
          button: 'middle'
        },
        shouldWork: true
      },
      {
        name: 'SSH - Mouse Release',
        platform: 'linux',
        environment: 'ssh',
        inputSequence: '\x1b[<0;25;20m',
        expectedEvent: {
          type: 'mouseup',
          x: 25,
          y: 20,
          button: 'left'
        },
        shouldWork: true
      },
      {
        name: 'Legacy Terminal - DEC Protocol',
        platform: 'linux',
        environment: 'legacy',
        inputSequence: '\x1b[M !#',
        expectedEvent: {
          type: 'mousedown',
          x: 1,
          y: 3,
          button: 'left'
        },
        shouldWork: false // Legacy protocol has limitations
      }
    ];

    testCases.forEach(testCase => {
      it(`parses ${testCase.name}`, () => {
        const event = parseMouseEvent(testCase.inputSequence, testCase.environment);
        
        if (testCase.shouldWork) {
          expect(event).toBeTruthy();
          expect(event.type).toBe(testCase.expectedEvent.type);
          expect(event.x).toBe(testCase.expectedEvent.x);
          expect(event.y).toBe(testCase.expectedEvent.y);
          if (testCase.expectedEvent.button) {
            expect(event.button).toBe(testCase.expectedEvent.button);
          }
        } else {
          expect(event).toBeNull();
        }
      });
    });
  });

  describe('Terminal Capability Detection', () => {
    it('detects SGR mouse protocol support', () => {
      process.env.TERM = 'xterm-256color';
      const supports = detectMouseProtocolSupport('sgr');
      expect(supports).toBe(true);
    });

    it('detects lack of mouse support in dumb terminals', () => {
      process.env.TERM = 'dumb';
      const supports = detectMouseProtocolSupport('any');
      expect(supports).toBe(false);
    });

    it('detects coordinate limit for DEC protocol', () => {
      const limits = getMouseCoordinateLimits('dec');
      expect(limits.x).toBe(223);
      expect(limits.y).toBe(223);
    });

    it('detects coordinate limit for SGR protocol', () => {
      const limits = getMouseCoordinateLimits('sgr');
      expect(limits.x).toBe(65535);
      expect(limits.y).toBe(65535);
    });
  });

  describe('Environment-Specific Behavior', () => {
    it('handles Windows ConPTY correctly', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.WT_SESSION = 'some-guid';
      
      const handler = createPlatformMouseHandler();
      expect(handler.protocol).toBe('sgr');
      expect(handler.enableSequence).toBe('\x1b[?1003h\x1b[?1006h');
    });

    it('handles macOS iTerm2 correctly', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      process.env.TERM_PROGRAM = 'iTerm.app';
      
      const handler = createPlatformMouseHandler();
      expect(handler.protocol).toBe('sgr');
      expect(handler.supportsDragAndDrop).toBe(true);
    });

    it('handles Linux GNOME Terminal correctly', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.GNOME_TERMINAL_SERVICE = ':1.123';
      
      const handler = createPlatformMouseHandler();
      expect(handler.protocol).toBe('sgr');
      expect(handler.supportsMouseReporting).toBe(true);
    });

    it('handles tmux sessions correctly', () => {
      process.env.TMUX = '/tmp/tmux-1000/default,12345,0';
      
      const handler = createPlatformMouseHandler();
      expect(handler.requiresPassthrough).toBe(true);
      expect(handler.passthroughPrefix).toBe('\x1bPtmux;');
    });

    it('handles screen sessions correctly', () => {
      process.env.STY = '12345.pts-0.hostname';
      
      const handler = createPlatformMouseHandler();
      expect(handler.requiresPassthrough).toBe(true);
      expect(handler.protocol).toBe('xterm');
    });
  });

  describe('Fallback Mechanisms', () => {
    it('falls back to xterm protocol when SGR fails', () => {
      const handler = createPlatformMouseHandler();
      const fallback = handler.getFallbackProtocol('sgr');
      
      expect(fallback).toBe('xterm');
    });

    it('falls back to DEC protocol when xterm fails', () => {
      const handler = createPlatformMouseHandler();
      const fallback = handler.getFallbackProtocol('xterm');
      
      expect(fallback).toBe('dec');
    });

    it('disables mouse when all protocols fail', () => {
      const handler = createPlatformMouseHandler();
      const fallback = handler.getFallbackProtocol('dec');
      
      expect(fallback).toBe('none');
    });

    it('provides keyboard navigation fallback', () => {
      const handler = createPlatformMouseHandler();
      handler.disableMouse();
      
      expect(handler.isMouseEnabled).toBe(false);
      expect(handler.keyboardFallback).toBe(true);
    });
  });

  describe('Cross-Platform Coordinate Mapping', () => {
    it('maps coordinates correctly on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const mapped = mapPlatformCoordinates(10, 5, 'win32');
      
      expect(mapped.x).toBe(10);
      expect(mapped.y).toBe(5);
    });

    it('handles high DPI scaling on macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      process.env.DISPLAY_SCALE = '2';
      
      const mapped = mapPlatformCoordinates(20, 10, 'darwin');
      
      expect(mapped.x).toBe(10); // Scaled down by 2
      expect(mapped.y).toBe(5);  // Scaled down by 2
    });

    it('handles coordinate overflow on legacy terminals', () => {
      const mapped = mapPlatformCoordinates(300, 300, 'dec');
      
      expect(mapped.x).toBe(223); // DEC protocol max
      expect(mapped.y).toBe(223); // DEC protocol max
    });
  });
});

// Helper functions for testing

function detectPlatformCapabilities(): PlatformCapabilities {
  const caps: PlatformCapabilities = {
    platform: process.platform,
    isWSL: false,
    isDocker: false,
    isSSH: false,
    terminalType: process.env.TERM || 'unknown',
    hasMouseSupport: true,
    mouseProtocol: 'sgr',
    maxCoordinates: { x: 65535, y: 65535 },
    supportedEvents: []
  };

  // WSL detection
  caps.isWSL = !!process.env.WSL_DISTRO_NAME || 
               !!process.env.WSL_INTEROP ||
               checkFileExists('/proc/sys/fs/binfmt_misc/WSLInterop');

  // Docker detection
  caps.isDocker = !!process.env.container || 
                  checkFileExists('/.dockerenv') ||
                  checkCGroup();

  // SSH detection
  caps.isSSH = !!process.env.SSH_CLIENT || !!process.env.SSH_TTY;

  // Determine mouse protocol
  if (process.env.TERM === 'dumb') {
    caps.hasMouseSupport = false;
    caps.mouseProtocol = 'none';
  } else if (process.env.TERM?.includes('xterm')) {
    caps.mouseProtocol = 'sgr';
  } else if (process.env.TERM?.includes('screen')) {
    caps.mouseProtocol = 'xterm';
  }

  // Set coordinate limits based on protocol
  switch (caps.mouseProtocol) {
    case 'dec':
      caps.maxCoordinates = { x: 223, y: 223 };
      break;
    case 'xterm':
      caps.maxCoordinates = { x: 255, y: 255 };
      break;
    case 'sgr':
      caps.maxCoordinates = { x: 65535, y: 65535 };
      break;
  }

  // Supported events
  if (caps.hasMouseSupport) {
    caps.supportedEvents = [
      'mousedown', 'mouseup', 'mousemove',
      'wheel', 'click', 'dblclick'
    ];
  }

  return caps;
}

function parseMouseEvent(sequence: string, environment: string): any {
  // SGR protocol parsing
  const sgrMatch = sequence.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
  if (sgrMatch) {
    const [, button, x, y, release] = sgrMatch;
    return {
      type: release === 'm' ? 'mouseup' : 
            parseInt(button) & 32 ? 'mousemove' : 'mousedown',
      x: parseInt(x),
      y: parseInt(y),
      button: getButtonFromCode(parseInt(button))
    };
  }

  // DEC protocol parsing
  const decMatch = sequence.match(/\x1b\[M(.)(.)(.)/);
  if (decMatch && environment !== 'legacy') {
    const button = decMatch[1].charCodeAt(0) - 32;
    const x = decMatch[2].charCodeAt(0) - 32;
    const y = decMatch[3].charCodeAt(0) - 32;
    
    return {
      type: button & 3 ? 'mouseup' : 'mousedown',
      x: x,
      y: y,
      button: getButtonFromCode(button)
    };
  }

  return null;
}

function getButtonFromCode(code: number): string {
  if (code & 64) return 'wheelup';
  if (code & 65) return 'wheeldown';
  
  const buttonCode = code & 3;
  switch (buttonCode) {
    case 0: return 'left';
    case 1: return 'middle';
    case 2: return 'right';
    default: return 'unknown';
  }
}

function detectMouseProtocolSupport(protocol: string): boolean {
  const term = process.env.TERM || '';
  
  if (term === 'dumb' || term === 'cons25') {
    return false;
  }

  if (protocol === 'any') {
    return term.includes('xterm') || 
           term.includes('screen') || 
           term.includes('tmux') ||
           term.includes('rxvt');
  }

  if (protocol === 'sgr') {
    return term.includes('xterm') && !term.includes('xterm-old');
  }

  if (protocol === 'xterm') {
    return term.includes('xterm') || term.includes('screen');
  }

  if (protocol === 'dec') {
    return true; // Most terminals support basic DEC protocol
  }

  return false;
}

function getMouseCoordinateLimits(protocol: string): { x: number; y: number } {
  switch (protocol) {
    case 'dec':
      return { x: 223, y: 223 }; // 255 - 32
    case 'xterm':
      return { x: 255, y: 255 };
    case 'sgr':
      return { x: 65535, y: 65535 };
    default:
      return { x: 0, y: 0 };
  }
}

function createPlatformMouseHandler(): any {
  const caps = detectPlatformCapabilities();
  
  return {
    protocol: caps.mouseProtocol,
    enableSequence: getEnableSequence(caps.mouseProtocol),
    disableSequence: getDisableSequence(caps.mouseProtocol),
    supportsDragAndDrop: caps.platform === 'darwin' && process.env.TERM_PROGRAM === 'iTerm.app',
    supportsMouseReporting: caps.hasMouseSupport,
    requiresPassthrough: !!process.env.TMUX || !!process.env.STY,
    passthroughPrefix: process.env.TMUX ? '\x1bPtmux;' : '',
    isMouseEnabled: caps.hasMouseSupport,
    keyboardFallback: !caps.hasMouseSupport,
    
    getFallbackProtocol(current: string): string {
      const fallbacks: { [key: string]: string } = {
        'sgr': 'xterm',
        'xterm': 'dec',
        'dec': 'none'
      };
      return fallbacks[current] || 'none';
    },
    
    disableMouse(): void {
      this.isMouseEnabled = false;
      this.keyboardFallback = true;
    }
  };
}

function getEnableSequence(protocol: string): string {
  switch (protocol) {
    case 'sgr':
      return '\x1b[?1003h\x1b[?1006h'; // Enable mouse tracking + SGR mode
    case 'xterm':
      return '\x1b[?1003h'; // Enable mouse tracking
    case 'dec':
      return '\x1b[?1000h'; // Enable basic mouse mode
    default:
      return '';
  }
}

function getDisableSequence(protocol: string): string {
  switch (protocol) {
    case 'sgr':
      return '\x1b[?1003l\x1b[?1006l';
    case 'xterm':
      return '\x1b[?1003l';
    case 'dec':
      return '\x1b[?1000l';
    default:
      return '';
  }
}

function mapPlatformCoordinates(x: number, y: number, platformOrProtocol: string): { x: number; y: number } {
  // Handle high DPI scaling on macOS
  if (platformOrProtocol === 'darwin' && process.env.DISPLAY_SCALE) {
    const scale = parseFloat(process.env.DISPLAY_SCALE);
    return { x: Math.floor(x / scale), y: Math.floor(y / scale) };
  }

  // Handle DEC protocol coordinate limits
  if (platformOrProtocol === 'dec') {
    const limits = getMouseCoordinateLimits('dec');
    return {
      x: Math.min(x, limits.x),
      y: Math.min(y, limits.y)
    };
  }

  return { x, y };
}

function checkFileExists(path: string): boolean {
  try {
    const fs = require('fs');
    return fs.existsSync(path);
  } catch {
    return false;
  }
}

function checkCGroup(): boolean {
  try {
    const fs = require('fs');
    const cgroup = fs.readFileSync('/proc/self/cgroup', 'utf8');
    return cgroup.includes('docker') || cgroup.includes('containerd');
  } catch {
    return false;
  }
}