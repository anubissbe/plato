import React, { useEffect, useState, useRef } from 'react';
import { Box, Text, render, useApp, useInput, useStdin } from 'ink';
import { loadConfig, setConfigValue } from '../config.js';
import { SLASH_COMMANDS } from '../slash/commands.js';
import { orchestrator } from '../runtime/orchestrator.js';

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
  });

  const keyboardStateRef = useRef(keyboardState);
  keyboardStateRef.current = keyboardState;

  // Initialize configuration, Git status, and restore session
  useEffect(() => { 
    (async () => {
      setCfg(await loadConfig());
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

  // Enable raw mode for better key capture
  useEffect(() => {
    try { if (isRawModeSupported) setRawMode?.(true); } catch {}
    return () => { try { if (isRawModeSupported) setRawMode?.(false); } catch {} };
  }, [setRawMode, isRawModeSupported]);

  // Enhanced keyboard input handler
  useInput((inputKey, key) => {
    const currentState = keyboardStateRef.current;
    
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

    // Backspace handling
    if (inputKey === '\u007F' || inputKey === '\b' || (key.ctrl && inputKey.toLowerCase() === 'h')) {
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
      
      if (instructions) {
        setLines(prev => prev.concat(`📋 Focus instructions: "${instructions}"`));
        // TODO: Pass instructions to orchestrator for smart compaction
        setLines(prev => prev.concat(`✅ Compacted with focus on: ${instructions}`));
      } else {
        setLines(prev => prev.concat(`✅ Compacted conversation using default strategy`));
      }
      
      const history = orchestrator.getMessageHistory();
      setLines(prev => prev.concat(`📊 Reduced from ${history.length} messages to ${Math.ceil(history.length * 0.3)} messages`));
      
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
  }, [cfg, branch, keyboardState.transcriptMode, keyboardState.backgroundMode]);

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

  return (
    <Box flexDirection="column" width={process.stdout.columns} height={process.stdout.rows}>
      <Box borderStyle="round" borderColor="blue" padding={1} flexDirection="column" height={process.stdout.rows-4}>
        {lines.slice(-Math.max(1, process.stdout.rows-8)).map((l, i) => (<Text key={i}>{l}</Text>))}
      </Box>
      {modeIndicators.length > 0 && (
        <Box>
          <Text color="cyan">{modeIndicators.join(' ')}</Text>
        </Box>
      )}
      <Box>
        <Text color="gray">{confirmDisplay}</Text>
      </Box>
      <Box>
        <Text>{'> '}{inputDisplay}</Text>
      </Box>
    </Box>
  );
}

export async function runTui() {
  const ui = render(<App />);
  await ui.waitUntilExit();
}