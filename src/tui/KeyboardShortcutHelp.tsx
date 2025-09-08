import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { StyledBox, StyledText } from '../styles/components.js';
import { keyboardShortcuts } from './keyboard-shortcuts.js';

interface KeyboardShortcutHelpProps {
  isVisible: boolean;
  onClose: () => void;
  customShortcuts?: Array<{
    key: string;
    description: string;
    category?: string;
  }>;
}

export const KeyboardShortcutHelp: React.FC<KeyboardShortcutHelpProps> = ({
  isVisible,
  onClose,
  customShortcuts = [],
}) => {
  // Get all registered shortcuts
  const shortcuts = useMemo(() => {
    const registered = keyboardShortcuts.getShortcuts();
    
    // Group by category
    const grouped: Record<string, Array<{
      key: string;
      description: string;
      name: string;
    }>> = {};
    
    registered.forEach(shortcut => {
      const category = shortcut.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      
      // Format key bindings
      const bindings = Array.isArray(shortcut.binding) 
        ? shortcut.binding 
        : [shortcut.binding];
      
      const keyStrings = bindings.map(binding => {
        if (binding.sequence) {
          return binding.sequence.join(' ');
        }
        
        const parts: string[] = [];
        if (binding.modifiers?.ctrl) parts.push('Ctrl');
        if (binding.modifiers?.alt) parts.push('Alt');
        if (binding.modifiers?.shift) parts.push('Shift');
        if (binding.modifiers?.meta) parts.push('Meta');
        parts.push(binding.key);
        
        return parts.join('+');
      });
      
      grouped[category].push({
        key: keyStrings.join(' or '),
        description: shortcut.description || shortcut.name,
        name: shortcut.name,
      });
    });
    
    // Add custom shortcuts
    customShortcuts.forEach(shortcut => {
      const category = shortcut.category || 'Custom';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      
      grouped[category].push({
        key: shortcut.key,
        description: shortcut.description,
        name: shortcut.description,
      });
    });
    
    return grouped;
  }, [customShortcuts]);

  // Default shortcuts that are always available
  const defaultShortcuts = useMemo(() => ({
    'Navigation': [
      { key: '↑/↓', description: 'Navigate up/down in lists' },
      { key: 'Tab', description: 'Cycle through options' },
      { key: 'Enter', description: 'Select/Confirm' },
      { key: 'Escape', description: 'Cancel/Close' },
      { key: 'Page Up/Down', description: 'Navigate pages' },
      { key: 'Home/End', description: 'Jump to start/end' },
    ],
    'Text Input': [
      { key: 'Ctrl+A', description: 'Select all' },
      { key: 'Ctrl+C', description: 'Copy (in some contexts)' },
      { key: 'Ctrl+V', description: 'Paste (in some contexts)' },
      { key: 'Ctrl+Z', description: 'Undo (where supported)' },
      { key: 'Shift+Enter', description: 'New line in multi-line input' },
      { key: 'Backspace', description: 'Delete character' },
    ],
    'Application': [
      { key: 'Ctrl+C', description: 'Cancel operation' },
      { key: 'Ctrl+D', description: 'Exit application' },
      { key: 'Ctrl+R', description: 'Toggle transcript mode' },
      { key: 'Ctrl+B', description: 'Background execution mode' },
      { key: 'Double Escape', description: 'Show message history' },
    ],
  }), []);

  if (!isVisible) {
    return null;
  }

  const allShortcuts = { ...defaultShortcuts, ...shortcuts };
  const categories = Object.keys(allShortcuts);

  return (
    <Box 
      flexDirection="column" 
      borderStyle="bold" 
      padding={1}
      width="90%"
      minHeight={20}
    >
      {/* Header */}
      <Box marginBottom={1} justifyContent="center">
        <StyledText type="primary">⌨️  Keyboard Shortcuts</StyledText>
      </Box>
      
      <Box marginBottom={1} justifyContent="center">
        <StyledText type="secondary">Press F1 or Escape to close</StyledText>
      </Box>

      {/* Shortcuts by category */}
      <Box flexDirection="row" flexWrap="wrap">
        {categories.map((category, catIndex) => (
          <Box 
            key={category} 
            flexDirection="column" 
            marginRight={2} 
            marginBottom={1}
            width="45%"
          >
            {/* Category header */}
            <Box marginBottom={0}>
              <StyledText type="info">
                ═══ {category} ═══
              </StyledText>
            </Box>
            
            {/* Shortcuts in category */}
            {(allShortcuts as any)[category].map((shortcut: any, idx: number) => (
              <Box key={idx} paddingLeft={1}>
                <Box width={20}>
                  <StyledText type="primary">
                    {shortcut.key}
                  </StyledText>
                </Box>
                <StyledText type="secondary">
                  {shortcut.description}
                </StyledText>
              </Box>
            ))}
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Box marginTop={1} flexDirection="column">
        <Box>
          <StyledText type="secondary">
            ───────────────────────────────────────────
          </StyledText>
        </Box>
        <Box>
          <StyledText type="info">
            💡 Tip: Customize shortcuts in settings or use /shortcuts command
          </StyledText>
        </Box>
      </Box>
    </Box>
  );
};