import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import { StyledBox, StyledText } from '../styles/components.js';

export interface SearchResult {
  type: 'message' | 'command' | 'file';
  content: string;
  source: string;
  lineNumber?: number;
  score: number;
  highlights?: [number, number][];
}

interface SearchModeProps {
  isActive: boolean;
  onClose: () => void;
  onSelect: (result: SearchResult) => void;
  searchHistory?: string[];
  conversationHistory?: Array<{ role: string; content: string }>;
  availableCommands?: Array<{ name: string; description: string }>;
}

export const SearchMode: React.FC<SearchModeProps> = ({
  isActive,
  onClose,
  onSelect,
  searchHistory = [],
  conversationHistory = [],
  availableCommands = [],
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchMode, setSearchMode] = useState<'all' | 'messages' | 'commands'>('all');
  const [isSearching, setIsSearching] = useState(false);

  // Perform search when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const searchTimer = setTimeout(() => {
      performSearch(query);
    }, 150); // Debounce search

    return () => clearTimeout(searchTimer);
  }, [query, searchMode]);

  /**
   * Perform search across different sources
   */
  const performSearch = useCallback((searchQuery: string) => {
    setIsSearching(true);
    const lowerQuery = searchQuery.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search in conversation history
    if (searchMode === 'all' || searchMode === 'messages') {
      conversationHistory.forEach((msg, index) => {
        const lowerContent = msg.content.toLowerCase();
        if (lowerContent.includes(lowerQuery)) {
          const score = calculateRelevanceScore(msg.content, searchQuery);
          const highlights = findHighlights(msg.content, searchQuery);
          
          searchResults.push({
            type: 'message',
            content: msg.content,
            source: msg.role,
            lineNumber: index + 1,
            score,
            highlights,
          });
        }
      });
    }

    // Search in commands
    if (searchMode === 'all' || searchMode === 'commands') {
      availableCommands.forEach(cmd => {
        const combinedText = `${cmd.name} ${cmd.description}`.toLowerCase();
        if (combinedText.includes(lowerQuery)) {
          const score = calculateRelevanceScore(combinedText, searchQuery);
          
          searchResults.push({
            type: 'command',
            content: cmd.name,
            source: cmd.description,
            score,
          });
        }
      });
    }

    // Sort by relevance score
    searchResults.sort((a, b) => b.score - a.score);

    // Limit results
    setResults(searchResults.slice(0, 20));
    setSelectedIndex(0);
    setIsSearching(false);
  }, [searchMode, conversationHistory, availableCommands]);

  /**
   * Calculate relevance score for search results
   */
  const calculateRelevanceScore = (text: string, query: string): number => {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    let score = 0;
    
    // Exact match
    if (lowerText === lowerQuery) {
      score += 100;
    }
    
    // Starts with query
    if (lowerText.startsWith(lowerQuery)) {
      score += 50;
    }
    
    // Contains query
    if (lowerText.includes(lowerQuery)) {
      score += 25;
    }
    
    // Word boundaries
    const words = lowerText.split(/\s+/);
    words.forEach(word => {
      if (word === lowerQuery) {
        score += 30;
      } else if (word.startsWith(lowerQuery)) {
        score += 15;
      }
    });
    
    // Frequency
    const matches = lowerText.match(new RegExp(lowerQuery, 'g'));
    if (matches) {
      score += matches.length * 5;
    }
    
    // Recency (if lineNumber is available)
    // Higher line numbers (more recent) get slight boost
    
    return score;
  };

  /**
   * Find highlight positions in text
   */
  const findHighlights = (text: string, query: string): [number, number][] => {
    const highlights: [number, number][] = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    let startIndex = 0;
    let index = lowerText.indexOf(lowerQuery, startIndex);
    
    while (index !== -1 && highlights.length < 5) {
      highlights.push([index, index + query.length]);
      startIndex = index + 1;
      index = lowerText.indexOf(lowerQuery, startIndex);
    }
    
    return highlights;
  };

  /**
   * Handle keyboard navigation
   */
  const handleKeyPress = useCallback((key: string) => {
    switch (key) {
      case 'ArrowUp':
        setSelectedIndex(prev => Math.max(0, prev - 1));
        break;
      case 'ArrowDown':
        setSelectedIndex(prev => Math.min(results.length - 1, prev + 1));
        break;
      case 'Enter':
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        onClose();
        break;
      case 'Tab':
        // Cycle through search modes
        setSearchMode(prev => {
          if (prev === 'all') return 'messages';
          if (prev === 'messages') return 'commands';
          return 'all';
        });
        break;
    }
  }, [results, selectedIndex, onSelect, onClose]);

  /**
   * Format result for display
   */
  const formatResult = (result: SearchResult, isSelected: boolean) => {
    const maxLength = 80;
    let displayText = result.content;
    
    // Truncate long content
    if (displayText.length > maxLength) {
      displayText = displayText.substring(0, maxLength - 3) + '...';
    }
    
    // Add type indicator
    const typeIndicator = {
      message: '💬',
      command: '⌘',
      file: '📄',
    }[result.type] || '•';
    
    return {
      indicator: typeIndicator,
      text: displayText,
      source: result.source,
      isSelected,
    };
  };

  if (!isActive) {
    return null;
  }

  return (
    <StyledBox flexDirection="column" borderStyle="round" padding={1}>
      {/* Search header */}
      <Box marginBottom={1}>
        <StyledText type="primary">
          🔍 Search ({searchMode})
        </StyledText>
        <Text> | </Text>
        <StyledText type="secondary">
          Tab: change mode | ↑↓: navigate | Enter: select | Esc: close
        </StyledText>
      </Box>

      {/* Search input */}
      <Box marginBottom={1}>
        <StyledText type="primary">Query: </StyledText>
        <StyledText type="info">{query || '...'}</StyledText>
        {isSearching && <StyledText type="secondary"> (searching...)</StyledText>}
      </Box>

      {/* Results count */}
      {results.length > 0 && (
        <Box marginBottom={1}>
          <StyledText type="secondary">
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </StyledText>
        </Box>
      )}

      {/* Search results */}
      <Box flexDirection="column">
        {results.length === 0 && query && !isSearching && (
          <StyledText type="secondary">No results found</StyledText>
        )}
        
        {results.map((result, index) => {
          const formatted = formatResult(result, index === selectedIndex);
          return (
            <Box key={index} paddingLeft={formatted.isSelected ? 0 : 2}>
              {formatted.isSelected && (
                <StyledText type="success">▶ </StyledText>
              )}
              <StyledText type="primary">
                {formatted.indicator} {formatted.text}
              </StyledText>
              {result.source && (
                <StyledText type="secondary"> ({result.source})</StyledText>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Search history hint */}
      {searchHistory.length > 0 && !query && (
        <Box marginTop={1}>
          <StyledText type="secondary">
            Recent: {searchHistory.slice(-3).join(', ')}
          </StyledText>
        </Box>
      )}
    </StyledBox>
  );
};