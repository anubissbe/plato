/**
 * Status Event Integration for Orchestrator
 * Emits status events during orchestrator operations
 */

import { EventEmitter } from 'events';

// Global event emitter for status events
export const statusEventEmitter = new EventEmitter();

// Event types
export interface StatusEvents {
  // Conversation events
  'turn:start': { role: 'user' | 'assistant'; message: string };
  'turn:end': { role: 'user' | 'assistant'; response: string };
  
  // Streaming events
  'stream:start': void;
  'stream:chunk': { text: string; charactersStreamed: number };
  'stream:end': { totalCharacters: number };
  
  // Token events
  'tokens:update': { input: number; output: number };
  
  // Tool call events
  'tool:start': { tool: string; server: string; params: any };
  'tool:end': { tool: string; success: boolean; error?: string };
  
  // Patch events
  'patch:extract': { hasPatches: boolean };
  'patch:apply:start': { patchCount: number };
  'patch:apply:end': { success: boolean; error?: string };
  
  // Performance events
  'response:time': { durationMs: number };
  
  // Memory events
  'memory:update': { heapUsed: number; heapTotal: number };
  
  // Error events
  'error': { message: string; code?: string };
}

// Helper functions to emit typed events
export function emitStatusEvent<K extends keyof StatusEvents>(
  event: K,
  data: StatusEvents[K]
): void {
  statusEventEmitter.emit(event, data);
}

// Orchestrator integration helpers
export function emitTurnStart(role: 'user' | 'assistant', message: string): void {
  emitStatusEvent('turn:start', { role, message });
}

export function emitTurnEnd(role: 'user' | 'assistant', response: string): void {
  emitStatusEvent('turn:end', { role, response });
}

export function emitStreamStart(): void {
  emitStatusEvent('stream:start', undefined as any);
}

export function emitStreamChunk(text: string, charactersStreamed: number): void {
  emitStatusEvent('stream:chunk', { text, charactersStreamed });
}

export function emitStreamEnd(totalCharacters: number): void {
  emitStatusEvent('stream:end', { totalCharacters });
}

export function emitTokenUpdate(input: number, output: number): void {
  emitStatusEvent('tokens:update', { input, output });
}

export function emitToolStart(tool: string, server: string, params: any): void {
  emitStatusEvent('tool:start', { tool, server, params });
}

export function emitToolEnd(tool: string, success: boolean, error?: string): void {
  emitStatusEvent('tool:end', { tool, success, error });
}

export function emitPatchExtract(hasPatches: boolean): void {
  emitStatusEvent('patch:extract', { hasPatches });
}

export function emitPatchApplyStart(patchCount: number): void {
  emitStatusEvent('patch:apply:start', { patchCount });
}

export function emitPatchApplyEnd(success: boolean, error?: string): void {
  emitStatusEvent('patch:apply:end', { success, error });
}

export function emitResponseTime(durationMs: number): void {
  emitStatusEvent('response:time', { durationMs });
}

export function emitMemoryUpdate(): void {
  const mem = process.memoryUsage();
  emitStatusEvent('memory:update', { 
    heapUsed: mem.heapUsed, 
    heapTotal: mem.heapTotal 
  });
}

export function emitError(message: string, code?: string): void {
  emitStatusEvent('error', { message, code });
}

// Utility to track stream progress
export class StreamProgressTracker {
  private charactersStreamed = 0;
  
  reset(): void {
    this.charactersStreamed = 0;
  }
  
  addChunk(text: string): void {
    this.charactersStreamed += text.length;
    emitStreamChunk(text, this.charactersStreamed);
  }
  
  end(): void {
    emitStreamEnd(this.charactersStreamed);
  }
  
  getTotal(): number {
    return this.charactersStreamed;
  }
}