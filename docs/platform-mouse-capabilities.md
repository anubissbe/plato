# Platform Mouse Support Capabilities Documentation

## Overview

This document provides comprehensive documentation of mouse support capabilities across different platforms, terminal emulators, and environments. It serves as a reference for implementing cross-platform mouse functionality in the Plato terminal UI.

## Platform Support Matrix

| Platform | Mouse Support | Protocol | Max Coordinates | Notes |
|----------|--------------|----------|-----------------|-------|
| **Windows** | | | | |
| Windows Terminal | ✅ Full | SGR | 65535×65535 | Best support on Windows |
| ConPTY | ✅ Full | SGR | 65535×65535 | Windows 10+ native |
| Command Prompt | ⚠️ Limited | Legacy | 255×255 | Basic click only |
| PowerShell | ✅ Full | SGR | 65535×65535 | Via Windows Terminal |
| Git Bash | ✅ Full | Xterm | 255×255 | MINGW environment |
| **macOS** | | | | |
| Terminal.app | ✅ Full | SGR | 65535×65535 | Native macOS terminal |
| iTerm2 | ✅ Full | SGR | 65535×65535 | Advanced features, drag & drop |
| Alacritty | ✅ Full | SGR | 65535×65535 | GPU-accelerated |
| Kitty | ✅ Full | SGR/Custom | 65535×65535 | Custom protocol available |
| **Linux** | | | | |
| GNOME Terminal | ✅ Full | SGR | 65535×65535 | Default on GNOME |
| Konsole | ✅ Full | SGR | 65535×65535 | KDE terminal |
| xterm | ✅ Full | Xterm/SGR | 255×255/65535×65535 | Original implementation |
| rxvt-unicode | ✅ Full | Xterm | 255×255 | Lightweight option |
| Linux Console (TTY) | ❌ None | - | - | No mouse in pure TTY |

## Environment-Specific Capabilities

### WSL (Windows Subsystem for Linux)

```typescript
{
  platform: 'linux',
  isWSL: true,
  mouseSupport: true,
  protocol: 'SGR',
  capabilities: {
    click: true,
    doubleClick: true,
    drag: true,
    scroll: true,
    rightClick: true,
    middleClick: true
  },
  limitations: [
    'Clipboard integration requires Windows Terminal',
    'Some legacy Windows console features unavailable'
  ],
  detection: {
    environment: ['WSL_DISTRO_NAME', 'WSL_INTEROP'],
    files: ['/proc/sys/fs/binfmt_misc/WSLInterop']
  }
}
```

### Docker Containers

```typescript
{
  platform: 'linux',
  isDocker: true,
  mouseSupport: true,
  protocol: 'SGR/Xterm',
  capabilities: {
    click: true,
    doubleClick: true,
    drag: true,
    scroll: true,
    rightClick: true,
    middleClick: false // Depends on host
  },
  limitations: [
    'Depends on host terminal capabilities',
    'May require --tty flag for docker run',
    'Performance overhead in some configurations'
  ],
  detection: {
    environment: ['container'],
    files: ['/.dockerenv'],
    cgroup: '/docker/', '/containerd/'
  }
}
```

### SSH Sessions

```typescript
{
  platform: 'varies',
  isSSH: true,
  mouseSupport: true,
  protocol: 'Passthrough',
  capabilities: {
    click: true,
    doubleClick: true,
    drag: true,
    scroll: true,
    rightClick: true,
    middleClick: true
  },
  limitations: [
    'Requires client terminal mouse support',
    'Latency affects drag operations',
    'May need ForwardX11 for some features'
  ],
  detection: {
    environment: ['SSH_CLIENT', 'SSH_TTY', 'SSH_CONNECTION']
  }
}
```

### Terminal Multiplexers

#### tmux

```typescript
{
  multiplexer: 'tmux',
  mouseSupport: true,
  protocol: 'Passthrough with prefix',
  passthroughPrefix: '\x1bPtmux;',
  capabilities: {
    click: true,
    doubleClick: true,
    drag: true,
    scroll: true,
    rightClick: true,
    middleClick: true
  },
  configuration: [
    'set -g mouse on',
    'set -g terminal-overrides "xterm*:XT:smcup@:rmcup@"'
  ],
  limitations: [
    'Requires tmux 2.1+',
    'Copy mode may interfere',
    'Pane switching captures mouse'
  ]
}
```

#### GNU Screen

```typescript
{
  multiplexer: 'screen',
  mouseSupport: 'Limited',
  protocol: 'Xterm',
  capabilities: {
    click: true,
    doubleClick: false,
    drag: false,
    scroll: false,
    rightClick: false,
    middleClick: false
  },
  configuration: [
    'termcapinfo xterm* XT'
  ],
  limitations: [
    'Very limited mouse support',
    'Consider migrating to tmux',
    'No SGR protocol support'
  ]
}
```

## Mouse Protocol Details

### SGR (1006) Protocol

**Most modern and capable protocol**

```
Enable: \x1b[?1003h\x1b[?1006h
Disable: \x1b[?1003l\x1b[?1006l

Format: \x1b[<Btn;X;Y;M/m
- Btn: Button and modifier information
- X,Y: 1-based coordinates (up to 65535)
- M: Press, m: Release

Button Codes:
- 0: Left button
- 1: Middle button
- 2: Right button
- 32: Motion (add to button)
- 64: Wheel up
- 65: Wheel down

Modifiers (add to button):
- 4: Shift
- 8: Alt/Meta
- 16: Control
```

### Xterm (1003) Protocol

**Legacy but widely supported**

```
Enable: \x1b[?1003h
Disable: \x1b[?1003l

Format: \x1b[M<button><x><y>
- button: 32 + button_number + modifiers
- x,y: 32 + coordinate (max 223)

Limitations:
- Max coordinates: 223×223
- Binary protocol (not UTF-8 safe)
- No wheel support in original spec
```

### DEC (1000) Protocol

**Most basic protocol**

```
Enable: \x1b[?1000h
Disable: \x1b[?1000l

Format: \x1b[M<button><x><y>
- Simple click reporting only
- No motion or drag support
- Max coordinates: 223×223
```

## Platform Detection Strategy

```typescript
class PlatformDetector {
  detect(): PlatformInfo {
    const info: PlatformInfo = {
      os: process.platform,
      isWSL: this.detectWSL(),
      isDocker: this.detectDocker(),
      isSSH: this.detectSSH(),
      terminal: this.detectTerminal(),
      mouseCapabilities: this.detectMouseCapabilities()
    };
    
    return info;
  }

  private detectWSL(): boolean {
    return !!(
      process.env.WSL_DISTRO_NAME ||
      process.env.WSL_INTEROP ||
      fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop')
    );
  }

  private detectDocker(): boolean {
    return !!(
      process.env.container ||
      fs.existsSync('/.dockerenv') ||
      this.checkCGroup()
    );
  }

  private detectSSH(): boolean {
    return !!(
      process.env.SSH_CLIENT ||
      process.env.SSH_TTY ||
      process.env.SSH_CONNECTION
    );
  }

  private detectTerminal(): TerminalInfo {
    const term = process.env.TERM || 'unknown';
    const program = process.env.TERM_PROGRAM || '';
    
    return {
      type: term,
      program: program,
      isWindowsTerminal: !!process.env.WT_SESSION,
      isVSCode: !!process.env.TERM_PROGRAM_VERSION,
      tmux: !!process.env.TMUX,
      screen: !!process.env.STY
    };
  }

  private detectMouseCapabilities(): MouseCapabilities {
    const term = process.env.TERM || '';
    
    if (term === 'dumb' || term === 'cons25') {
      return { supported: false, protocol: 'none' };
    }

    if (term.includes('xterm-256color')) {
      return { 
        supported: true, 
        protocol: 'sgr',
        fallback: 'xterm'
      };
    }

    if (term.includes('xterm')) {
      return { 
        supported: true, 
        protocol: 'xterm',
        fallback: 'dec'
      };
    }

    return { 
      supported: true, 
      protocol: 'dec',
      fallback: 'none'
    };
  }
}
```

## Fallback Strategy

### Progressive Enhancement

1. **Try SGR Protocol** (Modern, full-featured)
   - Best coordinate range
   - All mouse events supported
   - UTF-8 safe

2. **Fallback to Xterm** (Legacy but common)
   - Limited coordinates (223×223)
   - Most events supported
   - Wide compatibility

3. **Fallback to DEC** (Minimal)
   - Click only
   - Very limited coordinates
   - Last resort before disabling

4. **Disable Mouse** (Keyboard only)
   - Full keyboard navigation
   - Accessibility focused
   - Always available

### Implementation Example

```typescript
class MouseManager {
  private protocol: MouseProtocol = 'none';
  private enabled: boolean = false;

  async initialize(): Promise<void> {
    const protocols: MouseProtocol[] = ['sgr', 'xterm', 'dec'];
    
    for (const protocol of protocols) {
      if (await this.tryProtocol(protocol)) {
        this.protocol = protocol;
        this.enabled = true;
        return;
      }
    }
    
    // All protocols failed, use keyboard fallback
    console.warn('Mouse support unavailable, using keyboard navigation');
    this.enabled = false;
  }

  private async tryProtocol(protocol: MouseProtocol): Promise<boolean> {
    try {
      const sequence = this.getEnableSequence(protocol);
      await this.writeToTerminal(sequence);
      
      // Test with a timeout
      const response = await this.waitForMouseEvent(100);
      return !!response;
    } catch {
      return false;
    }
  }
}
```

## Best Practices

### Do's
- ✅ Always detect capabilities before enabling
- ✅ Provide keyboard fallbacks for all mouse operations
- ✅ Test in target environments during development
- ✅ Handle coordinate overflow gracefully
- ✅ Respect user's mouse preferences
- ✅ Clean up (disable mouse) on exit

### Don'ts
- ❌ Assume mouse support exists
- ❌ Use platform-specific features without detection
- ❌ Ignore terminal multiplexers
- ❌ Hardcode coordinate limits
- ❌ Break keyboard navigation
- ❌ Leave mouse mode enabled after crash

## Testing Checklist

### Environment Testing
- [ ] Windows Terminal on Windows 10/11
- [ ] Terminal.app on macOS
- [ ] GNOME Terminal on Ubuntu
- [ ] WSL2 with Windows Terminal
- [ ] Docker container (alpine, ubuntu)
- [ ] SSH session (local and remote)
- [ ] tmux session
- [ ] VSCode integrated terminal
- [ ] CI/CD environment (GitHub Actions)

### Feature Testing
- [ ] Left click
- [ ] Right click
- [ ] Middle click
- [ ] Double click
- [ ] Drag selection
- [ ] Scroll wheel
- [ ] Modifier keys (Shift, Ctrl, Alt)
- [ ] High coordinates (>255)
- [ ] Rapid events
- [ ] Clipboard integration

## Troubleshooting Guide

### Common Issues

**Issue**: Mouse events not received
- Check `$TERM` environment variable
- Verify terminal emulator settings
- Test with `cat -v` to see raw input
- Check for terminal multiplexers

**Issue**: Wrong coordinates
- Verify protocol detection
- Check for coordinate overflow
- Account for terminal padding/borders
- Consider DPI scaling on macOS

**Issue**: Clipboard not working
- Platform-specific clipboard commands
- Check for `pbcopy`, `xclip`, `clip.exe`
- Verify permissions in containers
- Test with simple echo pipe

**Issue**: Mouse breaks in SSH
- Ensure client terminal supports mouse
- Check SSH forwarding settings
- Verify both ends have compatible `$TERM`
- Test without terminal multiplexers

## References

- [XTerm Control Sequences](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html)
- [Terminal Mouse Tracking](https://github.com/microsoft/terminal/blob/main/doc/specs/%234999%20-%20Improved%20mouse%20support.md)
- [SGR Mouse Protocol](https://www.xfree86.org/current/ctlseqs.html#Mouse%20Tracking)
- [tmux Mouse Support](https://github.com/tmux/tmux/wiki/FAQ#how-do-i-use-the-mouse)
- [Windows Terminal Documentation](https://docs.microsoft.com/en-us/windows/terminal/)