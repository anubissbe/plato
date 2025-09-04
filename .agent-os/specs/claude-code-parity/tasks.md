# Spec Tasks - Complete Claude Code Parity

## Tasks

- [x] 1. **Implement Core Keyboard Shortcuts & Input Handling** ✅
  - [x] 1.1 Write tests for keyboard event handling (Escape, Ctrl+R, Ctrl+B, etc.)
  - [x] 1.2 Implement Escape key to stop Claude (not exit)
  - [x] 1.3 Add Escape twice for message history navigation
  - [x] 1.4 Implement Ctrl+R for transcript mode
  - [x] 1.5 Add Ctrl+B for background command execution
  - [x] 1.6 Implement Ctrl+V for image paste support
  - [x] 1.7 Fix Shift+Enter for new lines after terminal setup
  - [x] 1.8 Verify all keyboard shortcut tests pass

- [x] 2. **Add Missing Slash Commands** ✅
  - [x] 2.1 Write tests for new slash commands
  - [x] 2.2 Implement `/ide` command for IDE connection
  - [x] 2.3 Add `/install-github-app` for PR review setup
  - [x] 2.4 Implement `/terminal-setup` for terminal configuration
  - [x] 2.5 Enhance `/compact [instructions]` with focus instructions support
  - [x] 2.6 Add `/bug` command (redirect to Plato issues)
  - [x] 2.7 Update `/help` to list all new commands
  - [x] 2.8 Verify all command tests pass

- [x] 3. **Implement Command Line Arguments & Headless Mode** ✅
  - [x] 3.1 Write tests for CLI argument parsing
  - [x] 3.2 Implement `-p "prompt"` for headless mode
  - [x] 3.3 Add `--dangerously-skip-permissions` flag
  - [x] 3.4 Implement `--output-format stream-json` for JSON streaming
  - [x] 3.5 Add `--print` for direct output mode
  - [x] 3.6 Implement piping support (stdin/stdout)
  - [x] 3.7 Add composable command chaining
  - [x] 3.8 Verify all CLI argument tests pass

- [x] 4. **Build Custom Commands System** ✅
  - [x] 4.1 Write tests for custom command loading and execution
  - [x] 4.2 Create `.plato/commands/` directory structure
  - [x] 4.3 Implement markdown file parsing for commands
  - [x] 4.4 Add `$ARGUMENTS` placeholder substitution
  - [x] 4.5 Implement namespace support through directories
  - [x] 4.6 Add command discovery and menu integration
  - [x] 4.7 Create example custom commands
  - [x] 4.8 Verify all custom command tests pass

- [ ] 5. **Complete Memory System Implementation**
  - [ ] 5.1 Write tests for memory persistence
  - [ ] 5.2 Implement PLATO.md loading and saving
  - [ ] 5.3 Create memory management in orchestrator
  - [ ] 5.4 Add auto-load on startup
  - [ ] 5.5 Implement `/memory` command functionality
  - [ ] 5.6 Add project context persistence
  - [ ] 5.7 Ensure Claude Code compatibility
  - [ ] 5.8 Verify all memory tests pass

## Priority Order

1. **Keyboard Shortcuts** (Critical for UX parity)
2. **Command Line Arguments** (Essential for automation)
3. **Missing Commands** (Feature completeness)
4. **Custom Commands** (Power user feature)
5. **Memory System** (Already partially working)

## Success Criteria

- [ ] All keyboard shortcuts match Claude Code exactly
- [ ] All 30+ slash commands present and functional
- [ ] Headless mode works for automation
- [ ] Custom commands load from `.plato/commands/`
- [ ] Memory persists across sessions
- [ ] Side-by-side behavior matches Claude Code
- [ ] All tests pass with >90% coverage