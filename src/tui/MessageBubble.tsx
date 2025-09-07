import React from 'react';
import { Box, Text } from 'ink';

export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'streaming' | 'complete' | 'error' | 'pending';

export interface MessageMetadata {
  model?: string;
  tokens?: number;
  toolCalls?: string[];
  [key: string]: any;
}

export interface MessageBubbleProps {
  role: MessageRole;
  content: string;
  timestamp: Date;
  status?: MessageStatus;
  metadata?: MessageMetadata;
}

export interface CodeBlock {
  language: string;
  code: string;
  startLine?: number;
  endLine?: number;
}

export class MessageBubble {
  public role: MessageRole;
  public content: string;
  public timestamp: Date;
  public status?: MessageStatus;
  public metadata?: MessageMetadata;

  constructor(props: MessageBubbleProps) {
    this.role = props.role;
    this.content = props.content;
    this.timestamp = props.timestamp;
    this.status = props.status;
    this.metadata = props.metadata;
  }

  getRoleIndicator(): string {
    switch (this.role) {
      case 'user':
        return '👤';
      case 'assistant':
        return '🤖';
      case 'system':
        return '⚙️';
    }
  }

  getRoleColor(): string {
    switch (this.role) {
      case 'user':
        return 'blue';
      case 'assistant':
        return 'green';
      case 'system':
        return 'yellow';
    }
  }

  getFormattedTime(): string {
    const hours = this.timestamp.getHours().toString().padStart(2, '0');
    const minutes = this.timestamp.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  getRelativeTime(): string {
    const now = new Date();
    const diff = now.getTime() - this.timestamp.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    if (seconds > 0) return `${seconds}s ago`;
    return 'just now';
  }

  getContentLines(): string[] {
    return this.content.split('\n');
  }

  getTruncatedContent(maxLength: number): string {
    if (this.content.length <= maxLength) {
      return this.content;
    }
    return this.content.substring(0, maxLength) + '...';
  }

  hasCodeBlocks(): boolean {
    return this.content.includes('```');
  }

  getCodeBlocks(): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(this.content)) !== null) {
      blocks.push({
        language: match[1] || 'plaintext',
        code: match[2].trim(),
      });
    }

    return blocks;
  }

  getStatusIndicator(): string {
    switch (this.status) {
      case 'streaming':
        return '⏳';
      case 'complete':
        return '✅';
      case 'error':
        return '❌';
      case 'pending':
        return '⏸️';
      default:
        return '';
    }
  }

  getFormattedMetadata(): string {
    if (!this.metadata) return '';

    const parts: string[] = [];
    
    if (this.metadata.model) {
      parts.push(`Model: ${this.metadata.model}`);
    }
    if (this.metadata.tokens) {
      parts.push(`Tokens: ${this.metadata.tokens}`);
    }
    if (this.metadata.toolCalls && this.metadata.toolCalls.length > 0) {
      parts.push(`Tools: ${this.metadata.toolCalls.join(', ')}`);
    }

    return parts.join(' | ');
  }
}

export const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({
  role,
  content,
  timestamp,
  status,
  metadata,
}) => {
  const bubble = new MessageBubble({ role, content, timestamp, status, metadata });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={bubble.getRoleColor()}>
          {bubble.getRoleIndicator()} {role.charAt(0).toUpperCase() + role.slice(1)}
        </Text>
        <Text dimColor> · {bubble.getFormattedTime()}</Text>
        {status && <Text> {bubble.getStatusIndicator()}</Text>}
      </Box>
      <Box marginLeft={2} flexDirection="column">
        {bubble.getContentLines().map((line, index) => (
          <Text key={index}>{line}</Text>
        ))}
      </Box>
      {metadata && (
        <Box marginLeft={2}>
          <Text dimColor>{bubble.getFormattedMetadata()}</Text>
        </Box>
      )}
    </Box>
  );
};

export default MessageBubbleComponent;