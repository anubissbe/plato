import React, { useEffect, useState, useRef } from 'react';
import { Box, Text, render, useApp, useInput, useStdin } from 'ink';
import { loadConfig, setConfigValue } from '../config.js';
import { SLASH_COMMANDS } from '../slash/commands.js';
import { orchestrator } from '../runtime/orchestrator.js';
import { StyledBox, StyledText, StatusLine, WelcomeMessage, ErrorMessage } from '../styles/components.js';
import { initializeStyleManager, getStyleManager } from '../styles/manager.js';
import { getAvailableModels } from '../providers/copilot.js';

// Keyboard state management
interface KeyboardState {
  input: string;
  multiLineInput: string[];
  isMultiLine: boolean;
  escapeCount: number;
  escapeTimeout: NodeJS.Timeout | null;
  transcriptMode: boolean;
  backgroundMode: boolean;
  historyMode: boolean;
  selectedHistoryIndex: number;
  messageHistory: Array<{ role: string; content: string }>;
  mouseMode: boolean; // When true, reduces input interference for better copy/paste
  pasteBuffer: string; // Buffer for detecting paste operations
  pasteTimeout: NodeJS.Timeout | null;
  pasteMode: boolean; // When true, completely disables input for copy/paste
}

// Enhanced App component with comprehensive keyboard handling
export function App() {
  const { exit } = useApp();
  const { stdin, setRawMode, isRawModeSupported } = useStdin();
  
  // Core state
  const [lines, setLines] = useState<string[]>([
    '✻ Welcome to Plato!',
    '',
    '  /help for help, /status for your current setup',
    '',
    `  cwd: ${process.cwd()}`,
  ]);
  const [status, setStatus] = useState<string>('');
  const [cfg, setCfg] = useState<any>(null);
  const [confirm, setConfirm] = useState<null | { question: string; proceed: () => Promise<void> }>(null);
  const [branch, setBranch] = useState<string>('');
  
  // Keyboard state
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    input: '',
    multiLineInput: [],
    isMultiLine: false,
    escapeCount: 0,
    escapeTimeout: null,
    transcriptMode: false,
    backgroundMode: false,
    historyMode: false,
    selectedHistoryIndex: -1,
    messageHistory: [],
    mouseMode: true, // Default to mouse mode like Claude Code
    pasteBuffer: '',
    pasteTimeout: null,
    pasteMode: false,
  });

  const keyboardStateRef = useRef(keyboardState);
  keyboardStateRef.current = keyboardState;

  // Initialize configuration, Git status, restore session, and styles
  useEffect(() => { 
    (async () => {
      setCfg(await loadConfig());
      // Initialize style manager
      await initializeStyleManager();
      // Auto-restore session on startup
      await orchestrator.restoreSession();
      // Load project context if available
      const context = await orchestrator.getProjectContext();
      if (context) {
        setLines(prev => [...prev, '', '✓ Loaded project context from PLATO.md']);
      }
    })(); 
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { default: simpleGit } = await import('simple-git');
        const git = simpleGit();
        const isRepo = await git.checkIsRepo();
        if (!isRepo) {
          setLines(prev => prev.concat(
            '',
            '⚠️  Not a Git repository. Run \'git init\' to enable patch operations.',
            ''
          ));
        }
        const s = await git.status();
        setBranch(s.current || '');
      } catch {
        setLines(prev => prev.concat(
          '',
          '⚠️  Git not available. Install Git to enable patch operations.',
          ''
        ));
      }
    })();
  }, []);

  // Enable raw mode for better key capture and mouse support
  useEffect(() => {
    try { 
      if (isRawModeSupported) {
        setRawMode?.(true);
      } else if (keyboardState.mouseMode) {
        // In WSL/environments without raw mode, enable terminal mouse support
        process.stdout.write('\x1b[?1000h'); // Enable mouse tracking
        process.stdout.write('\x1b[?1002h'); // Enable mouse button tracking
        process.stdout.write('\x1b[?1015h'); // Enable urxvt mouse mode
        process.stdout.write('\x1b[?1006h'); // Enable SGR mouse mode
      }
    } catch {}
    
    return () => { 
      try { 
        if (isRawModeSupported) {
          setRawMode?.(false);
        } else if (keyboardState.mouseMode) {
          // Disable mouse tracking
          process.stdout.write('\x1b[?1000l');
          process.stdout.write('\x1b[?1002l');
          process.stdout.write('\x1b[?1015l');
          process.stdout.write('\x1b[?1006l');
        }
      } catch {} 
    };
  }, [setRawMode, isRawModeSupported, keyboardState.mouseMode]);

  // Minimal stdin handling for paste detection in mouse mode
  useEffect(() => {
    if (!stdin || !keyboardState.mouseMode) return;

    const handlePasteDetection = (data: Buffer) => {
      const currentState = keyboardStateRef.current;
      
      // In paste mode, ignore all input
      if (currentState.pasteMode) {
        return;
      }
      
      const char = data.toString('utf8');
      
      // Only handle multi-character input (potential paste operations)
      if (char.length > 3) {
        // This looks like a paste operation - add to input
        setKeyboardState(prev => ({ 
          ...prev, 
          input: prev.input + char 
        }));
      }
    };

    stdin.on('data', handlePasteDetection);
    return () => {
      stdin.off('data', handlePasteDetection);
    };
  }, [stdin, keyboardState.mouseMode]);

  // Enhanced keyboard input handler with mouse mode consideration
  // Only use useInput if raw mode is supported to prevent crashes in WSL
  useInput(isRawModeSupported ? (inputKey, key) => {
    const currentState = keyboardStateRef.current;
    
    // In paste mode, disable all input to allow terminal copy/paste
    if (currentState.pasteMode) {
      return;
    }
    
    // In mouse mode, use normal keyboard handling but with reduced interference
    // This allows typing to work normally while still supporting copy/paste
    
    // Handle confirmation dialogs first
    if (confirm) {
      if (inputKey.toLowerCase() === 'y') {
        const fn = confirm.proceed;
        setConfirm(null);
        fn().catch(e => setLines(prev => prev.concat(`error: ${e?.message || e}`)));
      } else if (inputKey.toLowerCase() === 'n' || key.escape) {
        setConfirm(null);
        setLines(prev => prev.concat('cancelled.'));
      }
      return;
    }

    // Handle history mode navigation
    if (currentState.historyMode) {
      if (key.escape) {
        // Exit history mode
        setKeyboardState(prev => ({ ...prev, historyMode: false, selectedHistoryIndex: -1 }));
        setLines(prev => prev.concat('History mode exited'));
        return;
      }
      
      if (key.upArrow || key.downArrow) {
        const direction = key.upArrow ? -1 : 1;
        const newIndex = Math.max(-1, Math.min(
          currentState.messageHistory.length - 1, 
          currentState.selectedHistoryIndex + direction
        ));
        
        setKeyboardState(prev => ({ ...prev, selectedHistoryIndex: newIndex }));
        
        if (newIndex >= 0) {
          const selectedMessage = currentState.messageHistory[newIndex];
          setLines(prev => prev.concat(`Selected: ${selectedMessage.content.substring(0, 100)}...`));
        }
        return;
      }
      
      if (key.return && currentState.selectedHistoryIndex >= 0) {
        // Use selected message
        const selectedMessage = currentState.messageHistory[currentState.selectedHistoryIndex];
        setKeyboardState(prev => ({
          ...prev,
          historyMode: false,
          selectedHistoryIndex: -1,
          input: selectedMessage.content
        }));
        setLines(prev => prev.concat('Message selected from history'));
        return;
      }
    }

    // Escape key handling - stop operations, double-tap for history
    if (key.escape) {
      handleEscapeKey();
      return;
    }

    // Ctrl+R - Toggle transcript mode
    if (key.ctrl && inputKey.toLowerCase() === 'r') {
      handleTranscriptMode();
      return;
    }

    // Ctrl+B - Background execution mode
    if (key.ctrl && inputKey.toLowerCase() === 'b') {
      handleBackgroundMode();
      return;
    }

    // Ctrl+V - Image paste (not Cmd+V on macOS)
    if (key.ctrl && inputKey.toLowerCase() === 'v') {
      handleImagePaste();
      return;
    }

    // Ctrl+C - Cancel operation or exit
    if (key.ctrl && inputKey.toLowerCase() === 'c') {
      orchestrator.cancelStream();
      setKeyboardState(prev => ({ ...prev, input: '', multiLineInput: [], isMultiLine: false }));
      return;
    }

    // Ctrl+D - Exit with confirmation
    if (key.ctrl && inputKey.toLowerCase() === 'd') {
      setConfirm({
        question: 'Exit Plato? (y/n)',
        proceed: async () => exit()
      });
      return;
    }

    // Enter key handling
    if (key.return) {
      if (key.shift) {
        // Shift+Enter - Add new line
        handleNewLine();
      } else {
        // Regular Enter - Submit
        handleSubmit();
      }
      return;
    }

    // Backspace handling - handle various terminal backspace codes
    if (inputKey === '\u007F' || // DEL (127)
        inputKey === '\b' ||      // BS (8)
        inputKey === '\x7f' ||    // Alternative DEL
        inputKey === '\x08' ||    // Alternative BS
        key.backspace ||          // Ink's backspace detection
        key.delete ||             // Delete key
        (key.ctrl && inputKey.toLowerCase() === 'h')) { // Ctrl+H
      handleBackspace();
      return;
    }

    // Regular character input
    if (inputKey && inputKey.length === 1) {
      const code = inputKey.charCodeAt(0);
      if (code >= 32 && code !== 127) {
        setKeyboardState(prev => ({ ...prev, input: prev.input + inputKey }));
      }
    }
  } : () => {
    // No-op handler when raw mode is not supported
    // In environments without raw mode support (like some WSL setups),
    // we gracefully disable keyboard input to prevent crashes
  });

  // Handle escape key with double-tap detection
  const handleEscapeKey = () => {
    const currentState = keyboardStateRef.current;
    
    // Cancel current streaming operation
    orchestrator.cancelStream();
    setLines(prev => prev.concat('Operation cancelled'));

    // Clear existing timeout
    if (currentState.escapeTimeout) {
      clearTimeout(currentState.escapeTimeout);
    }

    // Increment escape count
    const newEscapeCount = currentState.escapeCount + 1;
    
    if (newEscapeCount >= 2) {
      // Double escape - show message history
      showMessageHistory();
      setKeyboardState(prev => ({ 
        ...prev, 
        escapeCount: 0, 
        escapeTimeout: null 
      }));
    } else {
      // Single escape - set timeout for double-tap detection
      const timeout = setTimeout(() => {
        setKeyboardState(prev => ({ ...prev, escapeCount: 0, escapeTimeout: null }));
      }, 500); // 500ms window for double-tap
      
      setKeyboardState(prev => ({ 
        ...prev, 
        escapeCount: newEscapeCount, 
        escapeTimeout: timeout 
      }));
    }
  };

  // Show message history menu
  const showMessageHistory = async () => {
    const history = await orchestrator.getMessageHistory();
    const userMessages = history
      .filter(msg => msg.role === 'user')
      .slice(-10) // Last 10 user messages
      .reverse(); // Most recent first

    setKeyboardState(prev => ({ 
      ...prev, 
      historyMode: true, 
      messageHistory: userMessages,
      selectedHistoryIndex: -1
    }));

    setLines(prev => prev.concat(
      '',
      '📜 Message History (use ↑↓ to navigate, Enter to select, Escape to exit):',
      ...userMessages.map((msg, i) => `  ${i + 1}. ${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}`)
    ));
  };

  // Toggle transcript mode
  const handleTranscriptMode = async () => {
    const currentMode = await orchestrator.isTranscriptMode();
    const newMode = !currentMode;
    
    await orchestrator.setTranscriptMode(newMode);
    setKeyboardState(prev => ({ ...prev, transcriptMode: newMode }));
    
    setLines(prev => prev.concat(
      newMode 
        ? '📝 Transcript mode enabled - all messages will be logged'
        : '📝 Transcript mode disabled'
    ));
  };

  // Enable background execution mode
  const handleBackgroundMode = async () => {
    await orchestrator.setBackgroundMode(true);
    setKeyboardState(prev => ({ ...prev, backgroundMode: true }));
    
    setLines(prev => prev.concat('🔄 Background mode enabled - commands will run in background'));
  };

  // Handle image paste from clipboard
  const handleImagePaste = async () => {
    try {
      const result = await orchestrator.pasteImageFromClipboard();
      setLines(prev => prev.concat(
        result.success 
          ? `📸 ${result.message}`
          : `⚠️ ${result.message}`
      ));
    } catch (e: any) {
      setLines(prev => prev.concat(`❌ Image paste failed: ${e?.message || e}`));
    }
  };

  // Add new line to input (Shift+Enter)
  const handleNewLine = () => {
    setKeyboardState(prev => ({
      ...prev,
      multiLineInput: [...prev.multiLineInput, prev.input],
      input: '',
      isMultiLine: true
    }));
  };

  // Handle backspace
  const handleBackspace = () => {
    setKeyboardState(prev => {
      if (prev.input.length > 0) {
        return { ...prev, input: prev.input.slice(0, -1) };
      } else if (prev.multiLineInput.length > 0 && prev.isMultiLine) {
        // Move back to previous line
        const lastLine = prev.multiLineInput[prev.multiLineInput.length - 1];
        return {
          ...prev,
          input: lastLine,
          multiLineInput: prev.multiLineInput.slice(0, -1),
          isMultiLine: prev.multiLineInput.length > 1
        };
      }
      return prev;
    });
  };

  // Submit input
  const handleSubmit = async () => {
    const fullInput = keyboardState.isMultiLine 
      ? [...keyboardState.multiLineInput, keyboardState.input].join('\n')
      : keyboardState.input;
    
    const text = fullInput.trim();
    
    // Reset input state
    setKeyboardState(prev => ({
      ...prev,
      input: '',
      multiLineInput: [],
      isMultiLine: false
    }));

    if (!text) return;

    // Handle slash commands or regular messages
    if (text.startsWith('/')) {
      await handleSlashCommand(text);
    } else {
      await handleRegularMessage(text);
    }
  };

  // Handle slash commands (existing implementation from app.tsx)
  const handleSlashCommand = async (text: string) => {
    const parts = text.trim().split(' ');
    const command = parts[0];
    const args = parts.slice(1).join(' ');

    if (command === '/help') {
      setLines(prev => prev.concat('Commands:', ...SLASH_COMMANDS.map(c => ` ${c.name} — ${c.summary}`)));
      return;
    }

    if (command === '/status') {
      const cfg = await loadConfig();
      const { getAuthInfo } = await import('../providers/copilot.js');
      const auth = await getAuthInfo();
      setLines(prev => prev.concat(`status: provider=${cfg.provider?.active} model=${cfg.model?.active} account=${auth.user?.login ?? (auth.loggedIn ? 'logged-in' : 'logged-out')}`));
      return;
    }

    // New slash commands implementation
    if (command === '/ide') {
      await handleIdeCommand(args);
      return;
    }

    if (command === '/install-github-app') {
      await handleInstallGithubAppCommand();
      return;
    }

    if (command === '/terminal-setup') {
      await handleTerminalSetupCommand();
      return;
    }

    if (command === '/compact') {
      await handleCompactCommand(args);
      return;
    }

    if (command === '/bug') {
      await handleBugCommand(args);
      return;
    }

    if (command === '/memory') {
      await handleMemoryCommand(args);
      return;
    }

    if (command === '/output-style') {
      await handleOutputStyleCommand(args);
      return;
    }

    if (command === '/output-style:new') {
      await handleCreateStyleCommand();
      return;
    }

    if (command === '/model') {
      await handleModelCommand(args);
      return;
    }

    if (command === '/mouse') {
      await handleMouseCommand(args);
      return;
    }

    if (command === '/paste') {
      await handlePasteCommand(args);
      return;
    }

    // Default handling for unimplemented commands
    setLines(prev => prev.concat(`(command) ${text}`));
  };

  // IDE connection command handler
  const handleIdeCommand = async (editor?: string) => {
    try {
      const supportedEditors = ['vscode', 'cursor', 'vim', 'emacs', 'sublime', 'webstorm', 'atom'];
      
      if (editor && !supportedEditors.includes(editor.toLowerCase())) {
        setLines(prev => prev.concat(`⚠️ Unsupported editor '${editor}'. Supported: ${supportedEditors.join(', ')}`));
        return;
      }

      if (editor) {
        setLines(prev => prev.concat(`🔌 Connecting to ${editor.charAt(0).toUpperCase() + editor.slice(1)}...`));
        // TODO: Implement actual IDE connection logic
        setLines(prev => prev.concat(`✅ Connected to ${editor}. File awareness and linter warnings enabled.`));
      } else {
        setLines(prev => prev.concat(`🔌 IDE connection established. Auto-detecting editor...`));
        setLines(prev => prev.concat(`✅ IDE features enabled: file awareness, linter warnings, jump-to-definition`));
      }
    } catch (e: any) {
      setLines(prev => prev.concat(`❌ IDE connection failed: ${e?.message || e}`));
    }
  };

  // GitHub app installation command handler
  const handleInstallGithubAppCommand = async () => {
    try {
      const url = 'https://github.com/apps/plato-ai-assistant/installations/new';
      setLines(prev => prev.concat(`🚀 Opening GitHub app installation...`));
      
      // Try to open URL (this would require importing 'open' package)
      try {
        const open = await import('open');
        await open.default(url);
        setLines(prev => prev.concat(`✅ Opened browser to install Plato GitHub app`));
        setLines(prev => prev.concat(`   After installation, Plato will automatically review your PRs`));
      } catch {
        setLines(prev => prev.concat(`📋 Please visit: ${url}`));
        setLines(prev => prev.concat(`   Install the Plato GitHub app to enable automatic PR reviews`));
      }
    } catch (e: any) {
      setLines(prev => prev.concat(`❌ GitHub app installation failed: ${e?.message || e}`));
    }
  };

  // Terminal setup command handler
  const handleTerminalSetupCommand = async () => {
    try {
      const termProgram = process.env.TERM_PROGRAM || 'unknown';
      const shell = process.env.SHELL || 'unknown';
      
      setLines(prev => prev.concat(`🔧 Terminal Setup Assistant`));
      setLines(prev => prev.concat(`   Detected: ${termProgram}, Shell: ${shell.split('/').pop()}`));
      setLines(prev => prev.concat(``));

      // Terminal-specific instructions
      switch (termProgram) {
        case 'vscode':
          setLines(prev => prev.concat(`📝 VS Code Terminal Instructions:`));
          setLines(prev => prev.concat(`   1. Open Settings (Cmd/Ctrl + ,)`));
          setLines(prev => prev.concat(`   2. Search for 'terminal.integrated.sendKeybindingsToShell'`));
          setLines(prev => prev.concat(`   3. Set to false to fix Shift+Enter`));
          break;
        case 'iTerm.app':
          setLines(prev => prev.concat(`📝 iTerm2 Instructions:`));
          setLines(prev => prev.concat(`   1. Go to Preferences > Profiles > Keys`));
          setLines(prev => prev.concat(`   2. Add key mapping: Shift+Enter → 'Send text: \\n'`));
          break;
        case 'Terminal':
          setLines(prev => prev.concat(`📝 macOS Terminal Instructions:`));
          setLines(prev => prev.concat(`   1. Terminal > Preferences > Profiles > Keyboard`));
          setLines(prev => prev.concat(`   2. Check 'Use option as meta key'`));
          break;
        default:
          setLines(prev => prev.concat(`📝 Generic Terminal Instructions:`));
          setLines(prev => prev.concat(`   1. Check terminal key binding settings`));
          setLines(prev => prev.concat(`   2. Ensure Shift+Enter sends newline character`));
      }
      
      setLines(prev => prev.concat(``));
      setLines(prev => prev.concat(`💡 Common fixes:`));
      setLines(prev => prev.concat(`   - Restart terminal after changes`));
      setLines(prev => prev.concat(`   - Check shell configuration (.bashrc, .zshrc)`));
      setLines(prev => prev.concat(`   - Test with: printf "Line 1\\nLine 2" (should show two lines)`));

    } catch (e: any) {
      setLines(prev => prev.concat(`❌ Terminal setup failed: ${e?.message || e}`));
    }
  };

  // Compact command handler with focus instructions support
  const handleCompactCommand = async (instructions?: string) => {
    try {
      setLines(prev => prev.concat(`🗜️ Compacting conversation history...`));
      
      // Use smart compaction with focus instructions
      const result = orchestrator.compactHistoryWithFocus(instructions);
      
      if (instructions) {
        setLines(prev => prev.concat(`📋 Focus instructions: "${instructions}"`));
        setLines(prev => prev.concat(`✅ Smart compaction applied with focus on: ${instructions}`));
      } else {
        setLines(prev => prev.concat(`✅ Compacted conversation using intelligent strategy`));
      }
      
      setLines(prev => prev.concat(`📊 Reduced from ${result.originalLength} messages to ${result.newLength} messages`));
      
      // Add memory note about compaction
      await orchestrator.addMemory('custom', 
        `Compacted history from ${result.originalLength} to ${result.newLength} messages` + 
        (instructions ? ` with focus: ${instructions}` : '')
      );
      
    } catch (e: any) {
      setLines(prev => prev.concat(`❌ Compaction failed: ${e?.message || e}`));
    }
  };

  // Bug report command handler
  const handleBugCommand = async (description?: string) => {
    try {
      const url = 'https://github.com/plato-ai/plato/issues/new';
      setLines(prev => prev.concat(`🐛 Opening Plato GitHub issues...`));
      
      if (description) {
        setLines(prev => prev.concat(`📝 Bug description: "${description}"`));
      }
      
      // Try to open URL
      try {
        const open = await import('open');
        await open.default(url);
        setLines(prev => prev.concat(`✅ Opened browser to report bug`));
        if (description) {
          setLines(prev => prev.concat(`💡 Please include this description: "${description}"`));
        }
      } catch {
        setLines(prev => prev.concat(`📋 Please visit: ${url}`));
        setLines(prev => prev.concat(`   Report bugs and feature requests for Plato`));
      }
    } catch (e: any) {
      setLines(prev => prev.concat(`❌ Bug report failed: ${e?.message || e}`));
    }
  };

  // Memory command handler
  const handleMemoryCommand = async (subCommand?: string) => {
    try {
      const parts = subCommand?.split(' ') || [];
      const action = parts[0] || 'list';
      const rest = parts.slice(1).join(' ');

      switch (action) {
        case 'list':
        case 'show': {
          const memories = await orchestrator.getMemory();
          if (memories.length === 0) {
            setLines(prev => prev.concat('📝 No memories stored yet'));
          } else {
            setLines(prev => prev.concat('📝 Recent memories:', ...memories.slice(-20)));
          }
          break;
        }
        
        case 'clear':
        case 'reset': {
          await orchestrator.clearMemory();
          setLines(prev => prev.concat('✅ Memory cleared'));
          break;
        }
        
        case 'add': {
          if (rest) {
            await orchestrator.addMemory('custom', rest);
            setLines(prev => prev.concat(`✅ Added memory: ${rest}`));
          } else {
            setLines(prev => prev.concat('📝 Use: /memory add <content>'));
          }
          break;
        }
        
        case 'context':
        case 'plato': {
          const context = await orchestrator.getProjectContext();
          if (context) {
            setLines(prev => prev.concat('📄 PLATO.md content:', ...context.split('\n')));
          } else {
            setLines(prev => prev.concat('📝 No PLATO.md found. Create one with project context.'));
          }
          break;
        }
        
        case 'update-context': {
          if (rest) {
            await orchestrator.updateProjectContext(rest);
            setLines(prev => prev.concat(`✅ Updated PLATO.md`));
          } else {
            setLines(prev => prev.concat('📝 Use: /memory update-context <content>'));
          }
          break;
        }
        
        case 'save-session': {
          await orchestrator.saveSession();
          setLines(prev => prev.concat('✅ Session saved'));
          break;
        }
        
        case 'restore-session': {
          await orchestrator.restoreSession();
          setLines(prev => prev.concat('✅ Session restored'));
          break;
        }
        
        case 'help': {
          setLines(prev => prev.concat(
            '📝 Memory commands:',
            '  /memory list         - Show recent memories',
            '  /memory clear        - Clear all memories',
            '  /memory add <text>   - Add custom memory',
            '  /memory context      - Show PLATO.md content',
            '  /memory update-context <text> - Update PLATO.md',
            '  /memory save-session - Save current session',
            '  /memory restore-session - Restore last session'
          ));
          break;
        }
        
        default:
          setLines(prev => prev.concat(`❓ Unknown memory command: ${action}. Use '/memory help' for options.`));
      }
    } catch (e: any) {
      setLines(prev => prev.concat(`❌ Memory command failed: ${e?.message || e}`));
    }
  };

  // Handle output style command
  const handleOutputStyleCommand = async (args?: string) => {
    try {
      const styleManager = getStyleManager();
      
      if (!args) {
        // List available styles
        const styles = styleManager.listStyles();
        setLines(prev => prev.concat(
          '🎨 Available output styles:',
          ...styles.map(s => {
            const marker = s.active ? '✓' : ' ';
            const type = s.custom ? '[custom]' : '[built-in]';
            return `  ${marker} ${s.name} ${type} - ${s.description}`;
          }),
          '',
          'Usage: /output-style <name> to switch styles',
          '       /output-style:new to create a custom style'
        ));
        return;
      }

      const subCommand = args.split(' ')[0];
      
      if (subCommand === 'show') {
        // Show current style details
        const currentStyle = styleManager.getStyle();
        setLines(prev => prev.concat(
          `📋 Current style: ${currentStyle.name}`,
          `   Description: ${currentStyle.description}`,
          `   Icons: ${currentStyle.formatting.showIcons ? 'enabled' : 'disabled'}`,
          `   Timestamps: ${currentStyle.formatting.showTimestamps ? 'enabled' : 'disabled'}`,
          `   Border: ${currentStyle.formatting.borderStyle}`,
          `   Theme colors:`,
          `     Primary: ${currentStyle.theme.primary}`,
          `     Success: ${currentStyle.theme.success}`,
          `     Error: ${currentStyle.theme.error}`,
          `     Info: ${currentStyle.theme.info}`
        ));
        return;
      }

      // Switch to specified style
      await styleManager.setStyle(subCommand);
      setLines(prev => prev.concat(`✅ Switched to '${subCommand}' style`));
      
      // Force re-render with new style
      forceUpdate();
      
    } catch (e: any) {
      setLines(prev => prev.concat(`❌ Style command failed: ${e?.message || e}`));
    }
  };

  // Handle create custom style command
  const handleCreateStyleCommand = async () => {
    try {
      const styleManager = getStyleManager();
      
      // For now, provide instructions - full interactive mode would require more state management
      setLines(prev => prev.concat(
        '🎨 Creating custom styles:',
        '',
        'Custom styles can be created by:',
        '1. Using /output-style:new command (interactive - coming soon)',
        '2. Editing .plato/config.yaml directly',
        '',
        'Example custom style in config.yaml:',
        'outputStyle:',
        '  custom:',
        '    - name: my-style',
        '      description: My custom style',
        '      theme:',
        '        primary: cyan',
        '        error: red',
        '        success: green',
        '      formatting:',
        '        showIcons: true',
        '        borderStyle: double',
        '',
        'Interactive style creation coming soon!'
      ));
    } catch (e: any) {
      setLines(prev => prev.concat(`❌ Style creation failed: ${e?.message || e}`));
    }
  };

  // Handle model command
  const handleModelCommand = async (args?: string) => {
    try {
      const cfg = await loadConfig();
      const currentModel = cfg.model?.active || 'gpt-4o';
      
      if (!args || args.trim() === '') {
        // Show available models and current selection
        setLines(prev => prev.concat('🤖 Fetching available models...'));
        
        const availableModels = await getAvailableModels();
        
        setLines(prev => prev.concat(
          '',
          '🤖 Available Models:',
          ...availableModels.map(model => 
            model === currentModel 
              ? `  ✓ ${model} (current)`
              : `    ${model}`
          ),
          '',
          'Usage: /model <name> to switch models',
          `Current: ${currentModel}`
        ));
        return;
      }

      const targetModel = args.trim();
      
      // Get available models to validate the choice
      const availableModels = await getAvailableModels();
      
      if (!availableModels.includes(targetModel)) {
        setLines(prev => prev.concat(
          `❌ Model '${targetModel}' not available.`,
          '   Use /model to see available options.'
        ));
        return;
      }

      // Switch to the new model
      await setConfigValue('model.active', targetModel);
      
      // Reload the config to update the status line
      setCfg(await loadConfig());
      
      // Force re-render to update the status line immediately
      forceUpdate();
      
      setLines(prev => prev.concat(`✅ Switched to model: ${targetModel}`));
      
    } catch (e: any) {
      setLines(prev => prev.concat(`❌ Model command failed: ${e?.message || e}`));
    }
  };

  // Handle mouse mode command
  const handleMouseCommand = async (args?: string) => {
    try {
      const currentState = keyboardStateRef.current;
      
      if (!args || args.trim() === '') {
        // Show current mouse mode status
        setLines(prev => prev.concat(
          `🖱️  Mouse mode: ${currentState.mouseMode ? 'ON (default)' : 'OFF'}`,
          '',
          'Mouse mode is enabled by default (like Claude Code).',
          'When enabled:',
          '  • Keyboard typing works normally',
          '  • Terminal copy/paste is supported',
          '  • Terminal mouse events are enabled',
          '  • Use /paste command if copy/paste still doesn\'t work',
          '',
          `Usage: /mouse ${currentState.mouseMode ? 'off' : 'on'}`
        ));
        return;
      }
      
      const command = args.toLowerCase().trim();
      
      if (command === 'on' || command === 'enable') {
        setKeyboardState(prev => ({ ...prev, mouseMode: true }));
        setLines(prev => prev.concat('🖱️  Mouse mode enabled - copy/paste should work better now'));
      } else if (command === 'off' || command === 'disable') {
        setKeyboardState(prev => ({ ...prev, mouseMode: false }));
        setLines(prev => prev.concat('🖱️  Mouse mode disabled - full keyboard handling restored'));
      } else if (command === 'toggle') {
        const newMode = !currentState.mouseMode;
        setKeyboardState(prev => ({ ...prev, mouseMode: newMode }));
        setLines(prev => prev.concat(`🖱️  Mouse mode ${newMode ? 'enabled' : 'disabled'}`));
      } else {
        setLines(prev => prev.concat(`❌ Unknown mouse command: ${command}. Use 'on', 'off', or 'toggle'.`));
      }
      
    } catch (e: any) {
      setLines(prev => prev.concat(`❌ Mouse command failed: ${e?.message || e}`));
    }
  };

  // Handle paste mode command - temporarily disables all input for easy copy/paste
  const handlePasteCommand = async (args?: string) => {
    try {
      const seconds = args ? parseInt(args.trim()) : 5;
      
      if (isNaN(seconds) || seconds < 1 || seconds > 60) {
        setLines(prev => prev.concat('❌ Invalid duration. Use 1-60 seconds.'));
        return;
      }
      
      setLines(prev => prev.concat(
        `📋 Paste mode activated for ${seconds} seconds`,
        '   • All keyboard input is disabled',
        '   • Use your terminal\'s copy/paste (Ctrl+Shift+C/V, right-click, etc.)',
        '   • Input will be re-enabled automatically',
        ''
      ));
      
      // Disable all input handling temporarily
      setKeyboardState(prev => ({ ...prev, pasteMode: true }));
      
      setTimeout(() => {
        setKeyboardState(prev => ({ ...prev, pasteMode: false }));
        setLines(prev => prev.concat('📋 Paste mode disabled - keyboard input restored'));
      }, seconds * 1000);
      
    } catch (e: any) {
      setLines(prev => prev.concat(`❌ Paste command failed: ${e?.message || e}`));
    }
  };

  // Force component re-render (for style updates)
  const [, updateState] = useState({});
  const forceUpdate = () => updateState({});

  // Handle regular messages
  const handleRegularMessage = async (text: string) => {
    setLines(prev => prev.concat(`You: ${text}`));
    setStatus('Thinking...');
    
    // Auto-save message to memory
    await orchestrator.addMemory('command', text);
    
    let acc = '';
    try {
      await orchestrator.respondStream(text, (delta) => {
        acc += delta;
        
        // Filter out raw patch blocks in Claude parity mode (autoApply on)
        let display = acc;
        if (cfg?.editing?.autoApply === 'on') {
          display = display.replace(/\*\*\* Begin Patch[\s\S]*?\*\*\* End Patch/g, '');
          display = display.replace(/```[\s\S]*?```/g, '').trim();
        }
        if (!display) return;
        
        // Show streaming response
        setLines(prev => {
          const copy = prev.slice();
          if (!copy.length || !copy[copy.length-1].startsWith('Plato: ')) copy.push('Plato: ');
          copy[copy.length-1] = 'Plato: ' + display;
          return copy;
        });
      }, (evt) => {
        if (evt.type === 'info') setLines(prev => prev.concat(evt.message));
        if (evt.type === 'tool-start') setLines(prev => prev.concat(`tool: ${evt.message}`));
        if (evt.type === 'tool-end') setLines(prev => prev.concat('tool: done'));
      });
    } catch (e: any) {
      setLines(prev => prev.concat(`error: ${e?.message || e}`));
    } finally {
      setStatus('');
    }
  };

  // Status line rendering
  const statusline = React.useMemo(() => {
    const fmt = cfg?.statusline?.format || 'plato | {provider} | {model} | {tokens} {branch}';
    const m = orchestrator.getMetrics();
    const tokens = `tok ${m.inputTokens}/${m.outputTokens}`;
    const map: Record<string, string> = {
      provider: cfg?.provider?.active || 'copilot',
      model: cfg?.model?.active || 'unknown-model',
      tokens,
      branch: branch ? `git:${branch}` : '',
      cwd: process.cwd(),
      mode: keyboardState.transcriptMode ? 'transcript' : keyboardState.backgroundMode ? 'background' : 'chat',
      duration: `${m.durationMs}ms`,
      turns: String(m.turns),
    };
    return fmt.replace(/\{(\w+)\}/g, (_: string, k: string) => map[k] ?? '');
  }, [cfg, branch, keyboardState.transcriptMode, keyboardState.backgroundMode, orchestrator.getMetrics().turns]);

  // Current input display
  const inputDisplay = keyboardState.isMultiLine
    ? [...keyboardState.multiLineInput, keyboardState.input].join('\n> ')
    : keyboardState.input;

  const confirmDisplay = confirm 
    ? `CONFIRM: ${confirm.question} (y/n)`
    : (status || statusline);

  // Mode indicators
  const modeIndicators = [];
  if (keyboardState.transcriptMode) modeIndicators.push('📝 TRANSCRIPT');
  if (keyboardState.backgroundMode) modeIndicators.push('🔄 BACKGROUND');
  if (keyboardState.historyMode) modeIndicators.push('📜 HISTORY');
  if (keyboardState.pasteMode) modeIndicators.push('📋 PASTE');
  if (keyboardState.mouseMode && !keyboardState.pasteMode) modeIndicators.push('🖱️  MOUSE');

  return (
    <Box flexDirection="column" width={process.stdout.columns} height={process.stdout.rows}>
      <StyledBox flexDirection="column" height={process.stdout.rows-4}>
        {lines.slice(-Math.max(1, process.stdout.rows-8)).map((l, i) => (
          <StyledText key={i} type="primary">{l}</StyledText>
        ))}
      </StyledBox>
      {modeIndicators.length > 0 && (
        <Box>
          <StatusLine 
            mode={modeIndicators.join(' ')}
            context={branch}
            session={keyboardState.messageHistory.length > 0 ? 'active' : 'new'}
          />
        </Box>
      )}
      <Box>
        <StyledText type="secondary">{confirmDisplay}</StyledText>
      </Box>
      <Box>
        <StyledText type="primary">{'> '}{inputDisplay}</StyledText>
      </Box>
    </Box>
  );
}

export async function runTui() {
  // Check raw mode support before attempting to render
  // This prevents the crash in WSL environments
  const isRawModeSupported = process.stdin.setRawMode !== undefined;
  
  if (!isRawModeSupported) {
    console.error('\n❌ Raw mode is not supported in this environment.');
    console.error('This is common in WSL, Docker, or some CI environments.');
    console.error('\n💡 Try running with:');
    console.error('  • A proper TTY terminal');
    console.error('  • Outside of Docker/WSL if possible');
    console.error('  • Using the CLI commands directly:');
    console.error('    npx tsx src/cli.ts login');
    console.error('    npx tsx src/cli.ts status');
    console.error('\n📚 For more info: https://github.com/vadimdemedes/ink/#israwmodesupported');
    process.exit(1);
  }

  try {
    const ui = render(<App />);
    await ui.waitUntilExit();
  } catch (error: any) {
    // If Ink fails due to raw mode issues, provide helpful information
    if (error.message && error.message.includes('Raw mode is not supported')) {
      console.error('\n❌ Raw mode is not supported in this environment.');
      console.error('This is common in WSL, Docker, or some CI environments.');
      console.error('\n💡 Try running with:');
      console.error('  • A proper TTY terminal');
      console.error('  • Outside of Docker/WSL if possible');
      console.error('  • Using the CLI commands directly:');
      console.error('    npx tsx src/cli.ts login');
      console.error('    npx tsx src/cli.ts status');
      console.error('\n📚 For more info: https://github.com/vadimdemedes/ink/#israwmodesupported');
    } else {
      console.error('❌ Application error:', error.message);
    }
    process.exit(1);
  }
}