import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text } from 'ink';
import { StyledBox, StyledText } from '../styles/components.js';
import { SLASH_COMMANDS } from '../slash/commands.js';

export interface Command {
  id: string;
  name: string;
  description?: string;
  category?: string;
  keywords?: string[];
  handler: (args?: string) => void | Promise<void>;
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute?: (command: Command, args?: string) => void;
  additionalCommands?: Command[];
  recentCommands?: string[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onExecute,
  additionalCommands = [],
  recentCommands = [],
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [commandArgs, setCommandArgs] = useState('');
  const [showingDetails, setShowingDetails] = useState(false);

  // Combine slash commands with additional commands
  const allCommands = useMemo(() => {
    const slashCommands: Command[] = SLASH_COMMANDS.map(cmd => ({
      id: cmd.name,
      name: cmd.name,
      description: cmd.summary,
      category: 'Slash Commands',
      handler: () => {}, // Placeholder, actual handler will be called through onExecute
    }));

    return [...slashCommands, ...additionalCommands];
  }, [additionalCommands]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show recent commands if no query
      if (recentCommands.length > 0) {
        return allCommands.filter(cmd => 
          recentCommands.includes(cmd.id)
        );
      }
      return allCommands;
    }

    const lowerQuery = query.toLowerCase();
    
    return allCommands.filter(cmd => {
      // Check name
      if (cmd.name.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      // Check description
      if (cmd.description?.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      // Check keywords
      if (cmd.keywords?.some(keyword => 
        keyword.toLowerCase().includes(lowerQuery)
      )) {
        return true;
      }
      
      // Check category
      if (cmd.category?.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      return false;
    }).sort((a, b) => {
      // Sort by relevance
      const aNameMatch = a.name.toLowerCase().startsWith(lowerQuery);
      const bNameMatch = b.name.toLowerCase().startsWith(lowerQuery);
      
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      
      return a.name.localeCompare(b.name);
    });
  }, [query, allCommands, recentCommands]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    
    filteredCommands.forEach(cmd => {
      const category = cmd.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(cmd);
    });
    
    return groups;
  }, [filteredCommands]);

  // Reset selection when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Handle keyboard navigation
  const handleKeyPress = useCallback((key: string) => {
    switch (key) {
      case 'ArrowUp':
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        break;
        
      case 'ArrowDown':
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        break;
        
      case 'Enter':
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
        
      case 'Escape':
        onClose();
        break;
        
      case 'Tab':
        // Toggle details view
        setShowingDetails(prev => !prev);
        break;
        
      case 'PageUp':
        setSelectedIndex(Math.max(0, selectedIndex - 5));
        break;
        
      case 'PageDown':
        setSelectedIndex(Math.min(
          filteredCommands.length - 1, 
          selectedIndex + 5
        ));
        break;
        
      case 'Home':
        setSelectedIndex(0);
        break;
        
      case 'End':
        setSelectedIndex(filteredCommands.length - 1);
        break;
    }
  }, [filteredCommands, selectedIndex, onClose]);

  /**
   * Execute selected command
   */
  const executeCommand = (command: Command) => {
    // Extract arguments from query if present
    const args = query.startsWith(command.name) 
      ? query.substring(command.name.length).trim()
      : commandArgs.trim();
    
    if (onExecute) {
      onExecute(command, args);
    } else {
      command.handler(args);
    }
    
    onClose();
  };

  /**
   * Format command for display
   */
  const formatCommand = (command: Command, isSelected: boolean, index: number) => {
    const maxNameLength = 20;
    const maxDescLength = 50;
    
    let name = command.name;
    if (name.length > maxNameLength) {
      name = name.substring(0, maxNameLength - 3) + '...';
    }
    
    let description = command.description || '';
    if (description.length > maxDescLength) {
      description = description.substring(0, maxDescLength - 3) + '...';
    }
    
    return {
      name,
      description,
      shortcut: command.shortcut,
      isSelected,
      index: index + 1,
    };
  };

  if (!isOpen) {
    return null;
  }

  return (
    <StyledBox 
      flexDirection="column" 
      borderStyle="double" 
      padding={1}
      width="80%"
      minHeight={10}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <StyledText type="primary">⌘ Command Palette</StyledText>
        <Text> | </Text>
        <StyledText type="secondary">
          {filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}
        </StyledText>
      </Box>

      {/* Search input */}
      <Box marginBottom={1}>
        <StyledText type="primary">Search: </StyledText>
        <StyledText type="info">{query || '...'}</StyledText>
      </Box>

      {/* Command arguments (if needed) */}
      {filteredCommands[selectedIndex]?.name.startsWith('/') && (
        <Box marginBottom={1}>
          <StyledText type="secondary">Args: </StyledText>
          <StyledText type="info">{commandArgs || 'none'}</StyledText>
        </Box>
      )}

      {/* Commands list */}
      <Box flexDirection="column" height={15}>
        {Object.entries(groupedCommands).map(([category, commands]) => (
          <Box key={category} flexDirection="column" marginBottom={1}>
            {/* Category header */}
            <Box marginBottom={0}>
              <StyledText type="secondary">── {category} ──</StyledText>
            </Box>
            
            {/* Commands in category */}
            {commands.map((cmd, idx) => {
              const globalIndex = filteredCommands.indexOf(cmd);
              const formatted = formatCommand(cmd, globalIndex === selectedIndex, globalIndex);
              
              return (
                <Box key={cmd.id} paddingLeft={formatted.isSelected ? 0 : 2}>
                  {formatted.isSelected && (
                    <StyledText type="success">▶ </StyledText>
                  )}
                  
                  <Box width={25}>
                    <StyledText type={formatted.isSelected ? 'success' : 'primary'}>
                      {formatted.name}
                    </StyledText>
                  </Box>
                  
                  <StyledText type="secondary">
                    {formatted.description}
                  </StyledText>
                  
                  {formatted.shortcut && (
                    <StyledText type="info"> [{formatted.shortcut}]</StyledText>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
        
        {filteredCommands.length === 0 && (
          <StyledText type="secondary">No commands found</StyledText>
        )}
      </Box>

      {/* Footer with shortcuts */}
      <Box marginTop={1} justifyContent="space-between">
        <StyledText type="secondary">
          ↑↓ Navigate | Enter: Execute | Tab: Details | Esc: Close
        </StyledText>
      </Box>

      {/* Details panel (if showing) */}
      {showingDetails && filteredCommands[selectedIndex] && (
        <Box marginTop={1} flexDirection="column" borderStyle="single" padding={1}>
          <StyledText type="primary">
            {filteredCommands[selectedIndex].name}
          </StyledText>
          <StyledText type="secondary">
            {filteredCommands[selectedIndex].description}
          </StyledText>
          {filteredCommands[selectedIndex].shortcut && (
            <StyledText type="info">
              Shortcut: {filteredCommands[selectedIndex].shortcut}
            </StyledText>
          )}
          {filteredCommands[selectedIndex].keywords && (
            <StyledText type="secondary">
              Keywords: {filteredCommands[selectedIndex].keywords.join(', ')}
            </StyledText>
          )}
        </Box>
      )}
    </StyledBox>
  );
};