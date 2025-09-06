import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { FileRelevanceScorer } from '../context/relevance-scorer.js';
import { ContentSampler } from '../context/content-sampler.js';
import { SemanticIndex } from '../context/semantic-index.js';
import type { RelevanceScore } from '../context/relevance-scorer.js';

export interface ContextFile {
  path: string;
  relevanceScore: number;
  tokenUsage: number;
  samplingLevel: 'full' | 'summary' | 'minimal';
  status: 'included' | 'suggested' | 'excluded';
  indicators?: string[];
}

export interface ContextPanelProps {
  tokenUsage: number;
  tokenBudget: number;
  fileCount: number;
  relevanceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  files?: ContextFile[];
  budgetBreakdown?: {
    code: number;
    comments: number;
    types: number;
    imports: number;
  };
  optimizationSuggestions?: string[];
  searchQuery?: string;
  focusedIndex?: number;
  showHelp?: boolean;
  onFileToggle?: (path: string) => void;
  onSamplingChange?: (path: string, level: 'full' | 'summary' | 'minimal') => void;
  onOptimize?: () => void;
  onSemanticSearch?: (query: string) => void;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  tokenUsage,
  tokenBudget,
  fileCount,
  relevanceDistribution,
  files = [],
  budgetBreakdown,
  optimizationSuggestions = [],
  searchQuery = '',
  focusedIndex = 0,
  showHelp = false,
  onFileToggle,
  onSamplingChange,
  onOptimize,
  onSemanticSearch,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(focusedIndex);
  const [isSearching, setIsSearching] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  
  const tokenPercentage = Math.round((tokenUsage / tokenBudget) * 100);
  const isWarning = tokenPercentage >= 75;
  const isCritical = tokenPercentage >= 90;

  // Filter files based on search query
  const filteredFiles = files.filter(file => 
    searchQuery === '' || 
    file.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useInput((input, key) => {
    if (isSearching) {
      if (key.return) {
        if (onSemanticSearch) {
          onSemanticSearch(searchInput);
        }
        setIsSearching(false);
        setSearchInput('');
      } else if (key.escape) {
        setIsSearching(false);
        setSearchInput('');
      } else if (key.backspace || key.delete) {
        setSearchInput(prev => prev.slice(0, -1));
      } else if (input && input.length === 1) {
        setSearchInput(prev => prev + input);
      }
      return;
    }

    // Navigation
    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow) {
      setSelectedIndex(Math.min(filteredFiles.length - 1, selectedIndex + 1));
    }

    // Actions
    if (input === ' ' && onFileToggle && filteredFiles[selectedIndex]) {
      onFileToggle(filteredFiles[selectedIndex].path);
    } else if (input === '+' && onSamplingChange && filteredFiles[selectedIndex]) {
      const file = filteredFiles[selectedIndex];
      const nextLevel = file.samplingLevel === 'full' ? 'summary' : 
                       file.samplingLevel === 'summary' ? 'minimal' : 'full';
      onSamplingChange(file.path, nextLevel);
    } else if (input === '-' && onSamplingChange && filteredFiles[selectedIndex]) {
      const file = filteredFiles[selectedIndex];
      const nextLevel = file.samplingLevel === 'minimal' ? 'summary' : 
                       file.samplingLevel === 'summary' ? 'full' : 'minimal';
      onSamplingChange(file.path, nextLevel);
    } else if (input === 'o' && onOptimize) {
      onOptimize();
    } else if (input === '/') {
      setIsSearching(true);
    } else if (input === '?') {
      // Toggle help - would be handled by parent component
    }
  });

  const getRelevanceIndicator = (score: number): string => {
    if (score >= 80) return '🔥';
    if (score >= 60) return '⭐';
    if (score >= 40) return '•';
    return '○';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'included': return 'green';
      case 'suggested': return 'yellow';
      case 'excluded': return 'gray';
      default: return 'white';
    }
  };

  const formatTokens = (tokens: number): string => {
    return tokens.toLocaleString();
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Context Overview */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold underline>Context Overview</Text>
        <Box marginTop={1}>
          <Text>
            Tokens: {isCritical ? '🚨' : isWarning ? '⚠️ ' : ''} 
            <Text color={isCritical ? 'red' : isWarning ? 'yellow' : 'green'}>
              {formatTokens(tokenUsage)} / {formatTokens(tokenBudget)}
            </Text>
            {' '}({tokenPercentage}%)
          </Text>
        </Box>
        <Text>Files: {fileCount}</Text>
        <Box marginTop={1}>
          <Text>Relevance: </Text>
          <Text color="green">High: {relevanceDistribution.high} </Text>
          <Text color="yellow">Medium: {relevanceDistribution.medium} </Text>
          <Text color="gray">Low: {relevanceDistribution.low}</Text>
        </Box>
      </Box>

      {/* Budget Breakdown */}
      {budgetBreakdown && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold underline>Budget Breakdown</Text>
          <Text>Code: {formatTokens(budgetBreakdown.code)} tokens</Text>
          <Text>Comments: {formatTokens(budgetBreakdown.comments)} tokens</Text>
          <Text>Types: {formatTokens(budgetBreakdown.types)} tokens</Text>
          <Text>Imports: {formatTokens(budgetBreakdown.imports)} tokens</Text>
        </Box>
      )}

      {/* Search Bar */}
      {isSearching && (
        <Box marginBottom={1}>
          <Text>Search: {searchInput}_</Text>
        </Box>
      )}

      {/* File List */}
      {filteredFiles.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold underline>Files</Text>
          {filteredFiles.map((file, index) => (
            <Box key={file.path}>
              <Text>
                {index === selectedIndex ? '▶ ' : '  '}
                {getRelevanceIndicator(file.relevanceScore)} 
                <Text color={getStatusColor(file.status)}>
                  {' '}{file.path}
                </Text>
                {' '}({file.relevanceScore}) - {formatTokens(file.tokenUsage)} tokens
                {' '}[{file.samplingLevel}]
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Optimization Suggestions */}
      {optimizationSuggestions.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold underline>Optimization Suggestions</Text>
          {optimizationSuggestions.map((suggestion, index) => (
            <Text key={index}>• {suggestion}</Text>
          ))}
        </Box>
      )}

      {/* Help Text */}
      {showHelp && (
        <Box flexDirection="column" borderStyle="single" padding={1}>
          <Text bold underline>Keyboard Shortcuts</Text>
          <Text>↑/↓: Navigate files</Text>
          <Text>Space: Toggle file inclusion</Text>
          <Text>+/-: Adjust sampling level</Text>
          <Text>o: Optimize context</Text>
          <Text>/: Search files</Text>
          <Text>?: Toggle help</Text>
        </Box>
      )}
    </Box>
  );
};