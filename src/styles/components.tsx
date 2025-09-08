// Styled components for TUI using the style manager

import React from 'react';
import { Text, Box } from 'ink';
import Spinner from 'ink-spinner';
import type { TextProps, BoxProps } from 'ink';
import { getStyleManager } from './manager.js';
import type { OutputStyleTheme } from './types.js';

export interface StyledTextProps extends Omit<TextProps, 'color'> {
  type?: keyof OutputStyleTheme;
  children?: React.ReactNode;
}

export interface StyledBoxProps {
  noBorder?: boolean;
  children?: React.ReactNode;
  flexDirection?: BoxProps['flexDirection'];
  height?: BoxProps['height'];
  width?: BoxProps['width'];
  padding?: BoxProps['padding'];
  margin?: BoxProps['margin'];
  borderStyle?: BoxProps['borderStyle'];
  minHeight?: BoxProps['minHeight'];
  minWidth?: BoxProps['minWidth'];
  alignItems?: BoxProps['alignItems'];
  justifyContent?: BoxProps['justifyContent'];
}

export const StyledText: React.FC<StyledTextProps> = ({ type = 'primary', children, ...props }) => {
  const manager = getStyleManager();
  const style = manager.getStyle();
  const color = style.theme[type] || style.theme.primary;
  
  return (
    <Text 
      color={color}
      bold={style.formatting.bold && props.bold !== false}
      italic={style.formatting.italic && props.italic !== false}
      underline={style.formatting.underline && props.underline !== false}
      {...props}
    >
      {children}
    </Text>
  );
};

export const StyledBox: React.FC<StyledBoxProps> = ({ 
  noBorder, 
  children, 
  flexDirection,
  height,
  width,
  padding,
  margin,
  borderStyle,
  minHeight,
  minWidth,
  alignItems,
  justifyContent
}) => {
  const manager = getStyleManager();
  const style = manager.getStyle();
  
  const borderProps = noBorder || style.formatting.borderStyle === 'none' 
    ? {} 
    : {
        borderStyle: borderStyle || style.formatting.borderStyle,
        borderColor: style.theme.border
      };
  
  return (
    <Box 
      {...borderProps}
      padding={padding !== undefined ? padding : style.formatting.padding}
      margin={margin !== undefined ? margin : style.formatting.margin}
      flexDirection={flexDirection}
      height={height}
      width={width}
      minHeight={minHeight}
      minWidth={minWidth}
      alignItems={alignItems}
      justifyContent={justifyContent}
    >
      {children}
    </Box>
  );
};

export const StyledSpinner: React.FC<{ text?: string }> = ({ text }) => {
  const manager = getStyleManager();
  const style = manager.getStyle();
  
  return (
    <StyledText type="spinner">
      <Spinner type="dots" />
      {text && ` ${text}`}
    </StyledText>
  );
};

export const FileWriteMessage: React.FC<{ file: string; lines?: number; success?: boolean }> = ({ 
  file, 
  lines, 
  success 
}) => {
  const manager = getStyleManager();
  const message = manager.formatComponent('fileWrite', { file, lines, success });
  
  return (
    <StyledText type={success ? 'success' : 'info'}>
      {message}
    </StyledText>
  );
};

export const ErrorMessage: React.FC<{ message: string }> = ({ message }) => {
  const manager = getStyleManager();
  const formatted = manager.formatComponent('error', { message });
  
  return (
    <StyledText type="error">
      {formatted}
    </StyledText>
  );
};

export const ToolCallMessage: React.FC<{ name: string; args?: string }> = ({ name, args }) => {
  const manager = getStyleManager();
  const formatted = manager.formatComponent('toolCall', { name, args: args || '' });
  
  return (
    <StyledText type="info">
      {formatted}
    </StyledText>
  );
};

export const WelcomeMessage: React.FC<{ name?: string }> = ({ name = 'Plato' }) => {
  const manager = getStyleManager();
  const style = manager.getStyle();
  const text = style.components.welcome.text.replace('{name}', name);
  
  return (
    <StyledText type="primary" bold>
      {style.formatting.showIcons && style.components.welcome.icon && 
        `${style.components.welcome.icon} `}
      {text}
    </StyledText>
  );
};

export const StatusLine: React.FC<{ mode?: string; context?: string; session?: string; tokens?: number }> = ({ 
  mode = 'ready', 
  context = '', 
  session = '',
  tokens 
}) => {
  const manager = getStyleManager();
  const style = manager.getStyle();
  
  let format = style.components.statusLine.format;
  
  // Add timestamp if needed
  const timestamp = style.formatting.showTimestamps 
    ? new Date().toISOString().split('T')[1].split('.')[0]
    : '';
  
  // Replace placeholders
  format = format.replace('{mode}', mode);
  format = format.replace('{context}', context || 'no context');
  format = format.replace('{session}', session || 'no session');
  format = format.replace('{tokens}', tokens ? `${tokens} tokens` : '');
  format = format.replace('{timestamp}', timestamp);
  
  // Clean up empty placeholders
  format = format.replace(/\s*\|\s*(?=\|)|(?<=\|)\s*\|\s*/g, '');
  format = format.replace(/\s*\|\s*$/, '');
  format = format.replace(/^\s*\|\s*/, '');
  
  return (
    <StyledText type="secondary">
      {format}
    </StyledText>
  );
};