import { chatCompletions, chatStream } from '../providers/chat_fallback.js';
import { dryRunApply, apply as applyPatch } from '../tools/patch.js';
import { reviewPatch } from '../policies/security.js';
import { checkPermission } from '../tools/permissions.js';
import { runHooks } from '../tools/hooks.js';
import fs from 'fs/promises';
import path from 'path';
import { callTool } from '../integrations/mcp.js';
import { loadConfig } from '../config.js';
import { MemoryManager } from '../memory/manager.js';
import type { MemoryEntry } from '../memory/types.js';
import { SemanticAnalyzer } from '../context/semantic-analyzer.js';
import { ContextPersistenceManager } from '../context/session-persistence.js';
import { createDefaultAnalyticsService, AnalyticsService } from '../services/analytics.js';
import { 
  emitTurnStart, 
  emitTurnEnd, 
  emitStreamStart, 
  emitStreamEnd,
  emitTokenUpdate,
  emitCostUpdate,
  emitToolStart,
  emitToolEnd,
  emitPatchExtract,
  emitPatchApplyStart,
  emitPatchApplyEnd,
  emitResponseTime,
  emitMemoryUpdate,
  emitError,
  StreamProgressTracker
} from './status-events.js';

export type Msg = { role: 'system'|'user'|'assistant'|'tool', content: string };
const history: Msg[] = [
  { role: 'system', content: [
    'You are Plato, an expert coding assistant. Keep answers concise and propose safe diffs.',
    '',
    'Tool calls: When you want Plato to run an external MCP tool, emit exactly one fenced JSON code block with the following format and nothing else in the block:',
    '```json',
    '{"tool_call": {"server": "<server-id>", "name": "<tool-name>", "input": { /* arguments */ }}}',
    '```',
    'Rules:',
    '- Do not include prose in the code block, only valid JSON.',
    '- Use keys exactly: server, name, input. Do not add extra keys.',
    '- After Plato runs the tool, it will provide results and you will continue the answer.',
    '',
    'Patches: When proposing file changes, output unified diffs wrapped in *** Begin Patch / *** End Patch blocks.'
  ].join('\n') }
];

/**
 * Real-time cost tracking for streaming responses
 * Estimates token usage and costs as content streams in
 */
class RealTimeCostTracker {
  private estimatedOutputTokens = 0;
  private inputTokens = 0;
  private sessionId: string;
  private startTime: number;
  private lastCostEmit = 0;
  private readonly EMIT_INTERVAL_MS = 250; // Emit cost updates every 250ms
  private readonly TOKENS_PER_CHAR_ESTIMATE = 0.25; // Rough estimation: 4 chars per token

  constructor(sessionId: string, inputTokens: number) {
    this.sessionId = sessionId;
    this.inputTokens = inputTokens;
    this.startTime = Date.now();
  }

  addChunk(text: string): void {
    // Estimate output tokens from the text chunk
    const chunkTokens = Math.ceil(text.length * this.TOKENS_PER_CHAR_ESTIMATE);
    this.estimatedOutputTokens += chunkTokens;

    // Throttle cost emissions to avoid flooding
    const now = Date.now();
    if (now - this.lastCostEmit >= this.EMIT_INTERVAL_MS) {
      this.emitRealTimeCost();
      this.lastCostEmit = now;
    }
  }

  private emitRealTimeCost(): void {
    try {
      const service = getAnalyticsServiceInstance();
      const estimatedCost = service.calculateCost(
        'copilot',
        'gpt-3.5-turbo',
        this.inputTokens,
        this.estimatedOutputTokens
      );

      // Emit a custom event for real-time cost updates
      emitCostUpdate(this.inputTokens, this.estimatedOutputTokens, {
        estimatedCost,
        sessionId: this.sessionId,
        isRealTime: true
      });
    } catch (error) {
      // Silently handle errors to avoid disrupting streaming
      console.debug('Real-time cost calculation failed:', error);
    }
  }

  finalize(actualOutputTokens: number): void {
    // Final cost update with actual token counts
    try {
      const service = getAnalyticsServiceInstance();
      const actualCost = service.calculateCost(
        'copilot',
        'gpt-3.5-turbo',
        this.inputTokens,
        actualOutputTokens
      );

      emitCostUpdate(this.inputTokens, actualOutputTokens, {
        actualCost,
        sessionId: this.sessionId,
        isRealTime: false,
        duration: Date.now() - this.startTime
      });
    } catch (error) {
      console.debug('Final cost calculation failed:', error);
    }
  }

  getEstimatedCost(): number {
    try {
      const service = getAnalyticsServiceInstance();
      return service.calculateCost('copilot', 'gpt-3.5-turbo', this.inputTokens, this.estimatedOutputTokens);
    } catch {
      return 0;
    }
  }
}

/**
 * Estimate input tokens from messages
 * Uses a rough approximation based on character count
 */
async function estimateInputTokens(messages: Msg[]): Promise<number> {
  const totalChars = messages.reduce((acc, msg) => acc + msg.content.length, 0);
  return Math.ceil(totalChars * 0.25); // Rough estimation: 4 characters per token
}

const metrics = {
  inputTokens: 0,
  outputTokens: 0,
  durationMs: 0,
  turns: 0,
};

let pendingPatch: string | null = null;
let saveTimer: NodeJS.Timeout | null = null;
let streamCancellation: AbortController | null = null;

// Enhanced mode state
let transcriptMode: boolean = false;
let backgroundMode: boolean = false;

// Memory manager instance
let memoryManager: MemoryManager | null = null;

// Context persistence manager instance
let contextPersistenceManager: ContextPersistenceManager | null = null;

// Semantic analyzer instance
const semanticAnalyzer = new SemanticAnalyzer();

// Analytics service instance
let analyticsService: AnalyticsService | null = null;

// Current session ID for cost tracking
let currentSessionId: string = generateSessionId();

type OrchestratorEvent = { type: 'tool-start'|'tool-end'|'info'; message: string };

// Generate a unique session ID
function generateSessionId(): string {
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Initialize cost analytics for the new session (async, non-blocking)
  initializeSessionCostAnalyticsInternal(sessionId).catch(error => {
    console.debug('Failed to initialize session cost analytics:', error);
  });
  
  return sessionId;
}

// Internal helper for session cost analytics initialization
async function initializeSessionCostAnalyticsInternal(sessionId: string): Promise<void> {
  try {
    const contextManager = await ensureContextPersistenceManager();
    
    // Try to restore existing cost analytics first
    const existingCostAnalytics = await contextManager.getSessionCostAnalytics();
    
    if (existingCostAnalytics) {
      // If we have existing cost analytics, continue with that context
      console.log(`Continuing session with existing cost context: $${existingCostAnalytics.totalCost.toFixed(4)} total cost`);
      
      // Update session ID to current session
      existingCostAnalytics.sessionId = sessionId;
      
      // Try to restore to memory system as well
      try {
        const memoryManager = await ensureMemoryManager();
        await memoryManager.updateSessionCostAnalytics(sessionId, {
          totalCost: existingCostAnalytics.totalCost,
          totalInputTokens: existingCostAnalytics.totalInputTokens,
          totalOutputTokens: existingCostAnalytics.totalOutputTokens,
          interactionCount: existingCostAnalytics.interactionCount
        });
      } catch (memError) {
        console.debug('Failed to sync cost analytics to memory system:', memError);
      }
    } else {
      // No existing cost analytics, initialize fresh
      await contextManager.initializeSessionCostAnalytics(sessionId);
    }
  } catch (error) {
    // Silent failure - don't interrupt session creation
    console.debug('Session cost analytics initialization failed:', error);
  }
}

// Initialize analytics service on first use
async function ensureAnalyticsService(): Promise<AnalyticsService> {
  if (!analyticsService) {
    analyticsService = await createDefaultAnalyticsService();
    await analyticsService.initialize();
  }
  return analyticsService;
}

/**
 * Get analytics service instance synchronously (for real-time use)
 */
function getAnalyticsServiceInstance(): AnalyticsService {
  if (!analyticsService) {
    // Create with default options synchronously (fallback)
    const { AnalyticsService } = require('../services/analytics.js');
    analyticsService = new AnalyticsService(undefined, {
      dataDir: '.plato/analytics',
      autoSave: true,
      retentionMonths: 6
    });
    // Initialize asynchronously in background
    analyticsService?.initialize().catch((error: any) => {
      console.warn('Failed to initialize analytics service:', error);
    });
  }
  return analyticsService!; // We just created it above, so it's not null
}

/**
 * Get current session ID
 */
function getCurrentSessionId(): string {
  return currentSessionId;
}

// Record cost metrics for an interaction
async function recordCostMetrics(inputTokens: number, outputTokens: number, duration: number): Promise<void> {
  try {
    const analytics = await ensureAnalyticsService();
    
    // Get current provider and model from config or defaults
    const config = await loadConfig();
    const provider = 'copilot'; // Default provider for Plato
    const model = typeof config.model === 'string' ? config.model : (config.model?.active || 'gpt-3.5-turbo');
    
    await analytics.recordInteraction({
      sessionId: currentSessionId,
      model,
      inputTokens,
      outputTokens,
      provider,
      duration
    });

    // Update session persistence with cost analytics data
    await updateSessionCostData(inputTokens, outputTokens);
    
    // Update memory system with cost analytics data
    await updateMemoryCostAnalytics(
      currentSessionId,
      inputTokens,
      outputTokens,
      model,
      provider,
      undefined, // command - could be passed from context if available
      duration
    );
  } catch (error) {
    // Log but don't throw - analytics failures shouldn't break main functionality
    console.warn('Analytics recording failed:', error);
  }
}

// Update memory system with cost analytics data
async function updateMemoryCostAnalytics(
  sessionId: string,
  inputTokens: number,
  outputTokens: number,
  model: string = 'default',
  provider: 'copilot' | 'openai' | 'claude' = 'copilot',
  command?: string,
  duration?: number
): Promise<void> {
  try {
    const analytics = await ensureAnalyticsService();
    const cost = analytics.calculateCost(provider, model, inputTokens, outputTokens);
    
    // Get memory manager
    const memoryManager = await ensureMemoryManager();
    
    // Calculate session totals by getting all session memories with cost
    const sessionMemories = await memoryManager.getSessionMemoriesWithCost(sessionId);
    const currentTotalCost = sessionMemories.reduce((sum, m) => sum + (m.costMetadata?.cost || 0), 0) + cost;
    const currentTotalInputTokens = sessionMemories.reduce((sum, m) => sum + (m.costMetadata?.inputTokens || 0), 0) + inputTokens;
    const currentTotalOutputTokens = sessionMemories.reduce((sum, m) => sum + (m.costMetadata?.outputTokens || 0), 0) + outputTokens;
    const currentInteractionCount = sessionMemories.length + 1;

    // Build model breakdown
    const modelBreakdown: Record<string, { cost: number; tokens: number; interactions: number }> = {};
    for (const memory of sessionMemories) {
      if (memory.costMetadata) {
        const memModel = memory.costMetadata.model;
        if (!modelBreakdown[memModel]) {
          modelBreakdown[memModel] = { cost: 0, tokens: 0, interactions: 0 };
        }
        modelBreakdown[memModel].cost += memory.costMetadata.cost;
        modelBreakdown[memModel].tokens += memory.costMetadata.inputTokens + memory.costMetadata.outputTokens;
        modelBreakdown[memModel].interactions++;
      }
    }

    // Add current interaction to breakdown
    if (!modelBreakdown[model]) {
      modelBreakdown[model] = { cost: 0, tokens: 0, interactions: 0 };
    }
    modelBreakdown[model].cost += cost;
    modelBreakdown[model].tokens += inputTokens + outputTokens;
    modelBreakdown[model].interactions++;

    // Update session cost analytics in memory system
    await memoryManager.updateSessionCostAnalytics(sessionId, {
      totalCost: currentTotalCost,
      totalInputTokens: currentTotalInputTokens,
      totalOutputTokens: currentTotalOutputTokens,
      interactionCount: currentInteractionCount,
      modelBreakdown
    });

    console.debug(`Updated memory cost analytics: Session ${sessionId}, Total cost: $${currentTotalCost.toFixed(4)}`);
  } catch (error) {
    console.debug('Failed to update memory cost analytics:', error);
  }
}

// Update session persistence with cost data
async function updateSessionCostData(inputTokens: number, outputTokens: number): Promise<void> {
  try {
    const analytics = await ensureAnalyticsService();
    const contextManager = await ensureContextPersistenceManager();
    
    // Get current session cost breakdown
    const sessionCost = await analytics.getCurrentSessionCost(currentSessionId);
    const sessionBreakdown = await analytics.getSessionBreakdown(currentSessionId);
    
    if (sessionBreakdown) {
      // Get the raw session metrics to calculate separate token counts
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfDay = today.getTime();
      const endOfDay = startOfDay + (24 * 60 * 60 * 1000) - 1;
      
      const analyticsManager = analytics.getAnalyticsManager();
      const sessionMetrics = await analyticsManager.getMetrics(startOfDay, endOfDay, {
        sessionId: currentSessionId
      });
      
      // Calculate separate input and output tokens
      const totalInputTokens = sessionMetrics.reduce((sum, m) => sum + m.inputTokens, 0);
      const totalOutputTokens = sessionMetrics.reduce((sum, m) => sum + m.outputTokens, 0);
      
      // Update session persistence with aggregated cost data
      await contextManager.updateSessionCostAnalytics(currentSessionId, {
        totalCost: sessionCost,
        totalInputTokens,
        totalOutputTokens,
        interactionCount: sessionBreakdown.interactions || 0
      });
    }
  } catch (error) {
    console.debug('Failed to update session cost data:', error);
    // Don't throw - this is supplementary functionality
  }
}

// Initialize memory manager on first use
async function ensureMemoryManager(): Promise<MemoryManager> {
  if (!memoryManager) {
    memoryManager = new MemoryManager({
      memoryDir: '.plato/memory',
      platoFile: 'PLATO.md',
      maxEntries: 1000,
      autoLoad: true,
      autoSave: true,
      autoSaveInterval: 30000
    });
    await memoryManager.initialize();
  }
  return memoryManager;
}

// Initialize context persistence manager on first use
async function ensureContextPersistenceManager(): Promise<ContextPersistenceManager> {
  if (!contextPersistenceManager) {
    contextPersistenceManager = new ContextPersistenceManager({
      sessionPath: '.plato/session.json',
      memoryPath: '.plato/memory',
      autoSave: true,
      autoSaveInterval: 30000,
      maxHistoryEntries: 50
    });
  }
  return contextPersistenceManager;
}

export const orchestrator = {
  async respond(input: string, onEvent?: (e: OrchestratorEvent)=>void): Promise<string> {
    await runHooks('pre-prompt');
    history.push({ role: 'user', content: input });
    const t0 = Date.now();
    const msgs = await prepareMessages(history);
    const { content, usage } = await chatCompletions(msgs);
    const dt = Date.now() - t0;
    metrics.durationMs += dt;
    metrics.turns += 1;
    if (usage) {
      const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
      const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
      metrics.inputTokens += inputTokens;
      metrics.outputTokens += outputTokens;
      
      // Record cost metrics asynchronously
      recordCostMetrics(inputTokens, outputTokens, dt).catch(error => {
        console.warn('Failed to record cost metrics:', error);
      });
    }
    const assistant = content || '(no content)';
    history.push({ role: 'assistant', content: assistant });
    await runHooks('post-response');
    // Extract pending patch blocks if present
    pendingPatch = extractPatch(assistant) || null;
    await maybeAutoApply(pendingPatch, onEvent);
    await maybeBridgeTool(assistant, onEvent);
    await saveSessionDefault();
    return assistant;
  },
  async respondStream(input: string, onDelta: (text: string)=>void, onEvent?: (e: OrchestratorEvent)=>void): Promise<string> {
    await runHooks('pre-prompt');
    
    // Emit turn start event
    emitTurnStart('user', input);
    
    history.push({ role: 'user', content: input });
    
    // Create cancellation token for this stream
    streamCancellation = new AbortController();
    
    const t0 = Date.now();
    const msgs = await prepareMessages(history);
    
    // Create stream progress tracker
    const streamTracker = new StreamProgressTracker();
    
    // Create real-time cost tracker
    const sessionId = getCurrentSessionId();
    const estimatedInputTokens = await estimateInputTokens(msgs);
    const costTracker = new RealTimeCostTracker(sessionId, estimatedInputTokens);
    
    try {
      // Emit stream start event
      emitStreamStart();
      streamTracker.reset();
      
      const { content, usage } = await chatStream(msgs, {}, (d) => { 
        if (streamCancellation?.signal.aborted) return;
        onDelta(d);
        streamTracker.addChunk(d);
        costTracker.addChunk(d); // Add real-time cost tracking
        saveSessionDebounced().catch(()=>{}); 
      });
      
      // Emit stream end event
      streamTracker.end();
      
      const dt = Date.now() - t0;
      
      // Emit response time
      emitResponseTime(dt);
      
      metrics.durationMs += dt;
      metrics.turns += 1;
      
      if (usage) {
        const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
        const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
        metrics.inputTokens += inputTokens;
        metrics.outputTokens += outputTokens;
        
        // Emit token update
        emitTokenUpdate(inputTokens, outputTokens);
        
        // Finalize real-time cost tracking with actual token counts
        costTracker.finalize(outputTokens);
        
        // Record cost metrics asynchronously
        recordCostMetrics(inputTokens, outputTokens, dt).catch(error => {
          console.warn('Failed to record cost metrics:', error);
        });
      }
      
      // Emit memory update periodically
      emitMemoryUpdate();
      
      const assistant = content || '(no content)';
      history.push({ role: 'assistant', content: assistant });
      
      // Emit turn end event
      emitTurnEnd('assistant', assistant);
      
      await runHooks('post-response');
      pendingPatch = extractPatch(assistant) || null;
      
      // Emit patch extract event
      emitPatchExtract(!!pendingPatch);
      
      await maybeAutoApply(pendingPatch, onEvent);
      await maybeBridgeTool(assistant, onEvent);
      await saveSessionDefault();
      
      // Add to transcript if enabled
      if (transcriptMode) {
        // Get cost info from analytics for the memory entry
        const config = await loadConfig();
        const provider = 'copilot';
        const model = typeof config.model === 'string' ? config.model : (config.model?.active || 'gpt-3.5-turbo');
        const analytics = await ensureAnalyticsService();
        
        // Use the last recorded token metrics for this interaction
        const lastInputTokens = usage ? (usage.prompt_tokens ?? usage.input_tokens ?? 0) : 0;
        const lastOutputTokens = usage ? (usage.completion_tokens ?? usage.output_tokens ?? 0) : 0;
        const cost = analytics.calculateCost(provider, model, lastInputTokens, lastOutputTokens);
        
        await this.addMemory('transcript', `User: ${input}\nAssistant: ${assistant}`, {
          cost,
          inputTokens: lastInputTokens,
          outputTokens: lastOutputTokens,
          model,
          provider,
          sessionId: currentSessionId,
          duration: dt
        });
      }
      
      return assistant;
    } catch (e: any) {
      if (e.name === 'AbortError' || streamCancellation?.signal.aborted) {
        onEvent?.({ type: 'info', message: 'Operation cancelled' });
        streamTracker.end();
        return '(cancelled)';
      }
      emitError(e.message, e.code);
      throw e;
    } finally {
      streamCancellation = null;
    }
  },
  getMetrics() { return { ...metrics }; },
  getHistory() { return [...history]; },
  compactHistory(keep: number) { if (keep > 0 && history.length > keep) history.splice(0, history.length - keep); },
  compactHistoryWithFocus(instructions?: string): { originalLength: number; newLength: number } {
    const originalLength = history.length;
    if (originalLength <= 5) return { originalLength, newLength: originalLength }; // Keep minimal history
    
    // Smart compaction strategy based on instructions
    const systemMessages = history.filter(m => m.role === 'system');
    const userMessages = history.filter(m => m.role === 'user');
    const assistantMessages = history.filter(m => m.role === 'assistant');
    const toolMessages = history.filter(m => m.role === 'tool');
    
    let keep = Math.ceil(originalLength * 0.3); // Default 30% retention
    
    if (instructions) {
      const focusKeywords = instructions.toLowerCase();
      
      // Adjust retention based on focus instructions
      if (focusKeywords.includes('error') || focusKeywords.includes('debug')) {
        // Keep more messages for error context
        keep = Math.ceil(originalLength * 0.5);
      } else if (focusKeywords.includes('recent') || focusKeywords.includes('latest')) {
        // Keep fewer, more recent messages
        keep = Math.ceil(originalLength * 0.2);
      } else if (focusKeywords.includes('context') || focusKeywords.includes('history')) {
        // Keep more for context preservation
        keep = Math.ceil(originalLength * 0.6);
      }
      
      // Filter messages based on focus content
      const relevantMessages = history.filter(msg => {
        const content = msg.content.toLowerCase();
        return focusKeywords.split(' ').some(keyword => 
          keyword.length > 2 && content.includes(keyword.toLowerCase())
        );
      });
      
      if (relevantMessages.length > 0) {
        // Prioritize relevant messages but ensure we have recent context
        const recentMessages = history.slice(-Math.max(5, Math.ceil(keep / 2)));
        const uniqueMessages = [...new Set([...relevantMessages, ...recentMessages])];
        history.splice(0, history.length, ...systemMessages.slice(0, 1), ...uniqueMessages.slice(-keep));
      } else {
        // Fallback to simple compaction
        this.compactHistory(keep);
      }
    } else {
      // Default compaction strategy - keep system messages and recent conversation
      this.compactHistory(keep);
    }
    
    return { originalLength, newLength: history.length };
  },
  
  /**
   * Enhanced compaction using semantic analysis for intelligent content preservation
   */
  compactHistoryWithSemanticAnalysis(targetRetention: number = 0.4): { 
    originalLength: number; 
    newLength: number; 
    preservationScore: number;
    removedTopics: string[];
    preservedTopics: string[];
  } {
    const originalLength = history.length;
    if (originalLength <= 5) {
      return { 
        originalLength, 
        newLength: originalLength, 
        preservationScore: 1.0,
        removedTopics: [],
        preservedTopics: []
      };
    }

    // Analyze conversation semantics
    const importanceScores = semanticAnalyzer.scoreImportance(history);
    const topics = semanticAnalyzer.identifyTopics(history);
    const breakpoints = semanticAnalyzer.detectBreakpoints(history);
    const topicClusters = semanticAnalyzer.clusterByTopic(history);

    // Calculate how many messages to keep
    const targetKeep = Math.max(5, Math.ceil(originalLength * targetRetention));
    
    // Always preserve system messages
    const systemMessages = history.filter((msg, index) => {
      if (msg.role === 'system') return { msg, index, score: 1.0 };
      return null;
    }).filter(Boolean);

    // Score and rank non-system messages
    const rankedMessages = history
      .map((msg, index) => ({ msg, index, score: importanceScores[index] }))
      .filter(item => item.msg.role !== 'system')
      .sort((a, b) => b.score - a.score);

    // Ensure conversation coherence by preserving message sequences
    const selectedIndices = new Set<number>();
    
    // Add high-importance messages
    const highImportanceThreshold = Math.max(0.6, 
      rankedMessages.length > 0 ? rankedMessages[Math.floor(rankedMessages.length * 0.3)]?.score || 0.6 : 0.6
    );
    
    rankedMessages
      .filter(item => item.score >= highImportanceThreshold)
      .slice(0, Math.ceil(targetKeep * 0.6)) // Use 60% of budget for high importance
      .forEach(item => selectedIndices.add(item.index));

    // Add recent messages to maintain current context
    const recentCount = Math.min(Math.ceil(targetKeep * 0.3), 10);
    for (let i = Math.max(0, history.length - recentCount); i < history.length; i++) {
      selectedIndices.add(i);
    }

    // Fill remaining budget with semantically important messages
    const remainingBudget = targetKeep - selectedIndices.size;
    if (remainingBudget > 0) {
      rankedMessages
        .filter(item => !selectedIndices.has(item.index))
        .slice(0, remainingBudget)
        .forEach(item => selectedIndices.add(item.index));
    }

    // Ensure conversation flow by adding bridging messages
    const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < sortedIndices.length; i++) {
      const gap = sortedIndices[i] - sortedIndices[i-1];
      if (gap > 3) { // If gap is too large, add bridging message
        gaps.push({
          start: sortedIndices[i-1],
          end: sortedIndices[i],
          size: gap
        });
      }
    }

    // Add bridging messages for the largest gaps
    gaps
      .sort((a, b) => b.size - a.size)
      .slice(0, Math.min(3, Math.floor(targetKeep * 0.1))) // Use up to 10% budget for bridging
      .forEach(gap => {
        const bridgeIndex = Math.floor((gap.start + gap.end) / 2);
        selectedIndices.add(bridgeIndex);
      });

    // Build final message list
    const finalIndices = Array.from(selectedIndices).sort((a, b) => a - b);
    const preservedMessages = finalIndices.map(i => history[i]);
    
    // Analyze what topics were preserved vs removed
    const preservedTopicClusters = semanticAnalyzer.clusterByTopic(preservedMessages);
    const preservedTopics = Array.from(preservedTopicClusters.keys());
    const removedTopics = topics.filter(topic => !preservedTopics.includes(topic));

    // Calculate preservation score (percentage of important content preserved)
    const totalImportanceScore = importanceScores.reduce((sum, score) => sum + score, 0);
    const preservedImportanceScore = finalIndices.reduce((sum, index) => sum + importanceScores[index], 0);
    const preservationScore = totalImportanceScore > 0 ? preservedImportanceScore / totalImportanceScore : 1.0;

    // Update history
    history.splice(0, history.length, ...preservedMessages);

    return {
      originalLength,
      newLength: history.length,
      preservationScore,
      removedTopics,
      preservedTopics
    };
  },
  async getMemory(): Promise<string[]> { 
    try {
      const manager = await ensureMemoryManager();
      const memories = await manager.getAllMemories();
      return memories
        .slice(-100) // Return last 100 memories
        .map(mem => `[${mem.timestamp}] ${mem.type}: ${mem.content}`);
    } catch {
      return [];
    }
  },
  async clearMemory(): Promise<void> {
    try {
      const manager = await ensureMemoryManager();
      await manager.clearAllMemories();
    } catch {
      // Ignore errors
    }
  },
  async addMemory(type: MemoryEntry['type'], content: string, costMetadata?: MemoryEntry['costMetadata']): Promise<string> {
    try {
      const manager = await ensureMemoryManager();
      const timestamp = new Date().toISOString();
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      await manager.addMemory({
        id,
        type,
        content,
        timestamp,
        tags: [],
        costMetadata
      });
      
      return id;
    } catch (error) {
      console.debug('Failed to add memory:', error);
      return '';
    }
  },
  async getProjectContext(): Promise<string> {
    try {
      const manager = await ensureMemoryManager();
      return await manager.getProjectContext();
    } catch {
      return '';
    }
  },
  async updateProjectContext(content: string): Promise<void> {
    try {
      const manager = await ensureMemoryManager();
      await manager.updateProjectContext(content);
    } catch {
      // Ignore errors
    }
  },
  async saveSession(): Promise<void> {
    try {
      const manager = await ensureMemoryManager();
      await manager.saveSession({
        startTime: new Date().toISOString(),
        commands: history.filter(m => m.role === 'user').map(m => m.content).slice(-100),
        context: history.slice(-10).map(m => `${m.role}: ${m.content.substring(0, 200)}...`).join('\n')
      });
    } catch {
      // Ignore errors
    }
  },
  async restoreSession(): Promise<void> {
    try {
      const manager = await ensureMemoryManager();
      const session = await manager.restoreSession();
      if (session) {
        // Restore last context if available
        if (session.context) {
          let contextMessage = `[Restored session context from ${session.startTime}`;
          
          // Add cost analytics information if available
          if (session.costAnalytics) {
            contextMessage += `, Cost: $${session.costAnalytics.totalCost.toFixed(4)} ` +
                             `(${session.costAnalytics.interactionCount} interactions)`;
          }
          
          contextMessage += ']';
          history.push({ role: 'system', content: contextMessage });
        }
        
        // Restore cost analytics to the memory system session
        if (session.costAnalytics) {
          // Ensure current session ID matches or update the cost analytics
          const costAnalytics = { ...session.costAnalytics };
          costAnalytics.sessionId = currentSessionId;
          
          // Update memory system with restored cost analytics
          await manager.updateSessionCostAnalytics(currentSessionId, {
            totalCost: costAnalytics.totalCost,
            totalInputTokens: costAnalytics.totalInputTokens,
            totalOutputTokens: costAnalytics.totalOutputTokens,
            interactionCount: costAnalytics.interactionCount,
            modelBreakdown: costAnalytics.modelBreakdown
          });
          
          console.log(`Restored memory cost analytics: $${costAnalytics.totalCost.toFixed(4)} total cost`);
        }
      }
      
      // Also restore context state
      await restoreContextState();
      
      // Restore cost analytics for the current session
      await restoreCostAnalytics(currentSessionId);
    } catch (error) {
      console.debug('Session restoration error:', error);
    }
  },
  getPendingPatch() { return pendingPatch; },
  clearPendingPatch() { pendingPatch = null; },
  async exportJSON(file?: string): Promise<void> {
    const { getSelected } = await import('../context/context.js');
    const data = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      messages: history,
      metrics: metrics,
      context: await getSelected(),
      config: await loadConfig()
    };
    const json = JSON.stringify(data, null, 2);
    if (file) {
      await fs.writeFile(file, json, 'utf8');
    } else {
      console.log(json);
    }
  },
  async exportMarkdown(file?: string): Promise<void> {
    let md = '# Plato Conversation\n\n';
    md += `Date: ${new Date().toISOString()}\n\n`;
    for (const msg of history) {
      if (msg.role === 'user') {
        md += `## User\n${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        md += `## Assistant\n${msg.content}\n\n`;
      } else if (msg.role === 'tool') {
        md += `> Tool Result:\n> ${msg.content.replace(/\n/g, '\n> ')}\n\n`;
      }
    }
    if (file) {
      await fs.writeFile(file, md, 'utf8');
    } else {
      console.log(md);
    }
  },
  async exportToClipboard(): Promise<void> {
    // dynamic import via eval to avoid type resolution at build time
    const mod: any = await (new Function('m','return import(m)'))('clipboardy').catch(()=>null);
    let md = '# Plato Conversation\n\n';
    md += `Date: ${new Date().toISOString()}\n\n`;
    for (const msg of history) {
      if (msg.role === 'user') md += `## User\n${msg.content}\n\n`;
      else if (msg.role === 'assistant') md += `## Assistant\n${msg.content}\n\n`;
      else if (msg.role === 'tool') md += `> Tool Result:\n> ${msg.content.replace(/\n/g, '\n> ')}\n\n`;
    }
    if (mod?.clipboard?.write) await mod.clipboard.write(md);
    else console.log(md);
  },
  async importJSON(file: string) {
    const txt = await fs.readFile(file, 'utf8');
    const data = JSON.parse(txt);
    if (Array.isArray(data.history)) {
      history.splice(0, history.length, ...data.history);
    }
    if (data.metrics && typeof data.metrics === 'object') {
      Object.assign(metrics, data.metrics);
    }
  },

  // Keyboard shortcut support methods
  cancelStream() {
    if (streamCancellation) {
      streamCancellation.abort();
      streamCancellation = null;
    }
  },

  isTranscriptMode() {
    return transcriptMode;
  },

  async setTranscriptMode(enabled: boolean) {
    transcriptMode = enabled;
    await this.addMemory('mode_change', `Transcript mode ${enabled ? 'enabled' : 'disabled'}`);
  },

  async setBackgroundMode(enabled: boolean) {
    backgroundMode = enabled;
    await this.addMemory('mode_change', `Background mode ${enabled ? 'enabled' : 'disabled'}`);
  },

  isBackgroundMode() {
    return backgroundMode;
  },

  getMessageHistory(): Array<{ role: string; content: string }> {
    return history
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({ role: msg.role, content: msg.content }));
  },

  getSelectedHistoryMessage(index: number): { role: string; content: string } | null {
    const userMessages = history.filter(msg => msg.role === 'user');
    if (index >= 0 && index < userMessages.length) {
      return userMessages[index];
    }
    return null;
  },

  async selectHistoryMessage(index: number): Promise<string | null> {
    const message = this.getSelectedHistoryMessage(index);
    if (message) {
      await this.addMemory('history_selection', `Selected message: ${message.content.substring(0, 100)}`);
      return message.content;
    }
    return null;
  },

  /**
   * Update memory system with cost metadata
   */
  async updateMemoryCostAnalytics(
    sessionId: string,
    inputTokens: number,
    outputTokens: number,
    model: string = 'default',
    provider: 'copilot' | 'openai' | 'claude' = 'copilot',
    command?: string,
    duration?: number
  ): Promise<void> {
    try {
      const analytics = await ensureAnalyticsService();
      const cost = analytics.calculateCost(provider, model, inputTokens, outputTokens);
      
      // Get memory manager
      const memoryManager = await ensureMemoryManager();
      
      // Calculate session totals by getting all session memories with cost
      const sessionMemories = await memoryManager.getSessionMemoriesWithCost(sessionId);
      const currentTotalCost = sessionMemories.reduce((sum, m) => sum + (m.costMetadata?.cost || 0), 0) + cost;
      const currentTotalInputTokens = sessionMemories.reduce((sum, m) => sum + (m.costMetadata?.inputTokens || 0), 0) + inputTokens;
      const currentTotalOutputTokens = sessionMemories.reduce((sum, m) => sum + (m.costMetadata?.outputTokens || 0), 0) + outputTokens;
      const currentInteractionCount = sessionMemories.length + 1;

      // Build model breakdown
      const modelBreakdown: Record<string, { cost: number; tokens: number; interactions: number }> = {};
      for (const memory of sessionMemories) {
        if (memory.costMetadata) {
          const memModel = memory.costMetadata.model;
          if (!modelBreakdown[memModel]) {
            modelBreakdown[memModel] = { cost: 0, tokens: 0, interactions: 0 };
          }
          modelBreakdown[memModel].cost += memory.costMetadata.cost;
          modelBreakdown[memModel].tokens += memory.costMetadata.inputTokens + memory.costMetadata.outputTokens;
          modelBreakdown[memModel].interactions++;
        }
      }

      // Add current interaction to breakdown
      if (!modelBreakdown[model]) {
        modelBreakdown[model] = { cost: 0, tokens: 0, interactions: 0 };
      }
      modelBreakdown[model].cost += cost;
      modelBreakdown[model].tokens += inputTokens + outputTokens;
      modelBreakdown[model].interactions++;

      // Update session cost analytics in memory system
      await memoryManager.updateSessionCostAnalytics(sessionId, {
        totalCost: currentTotalCost,
        totalInputTokens: currentTotalInputTokens,
        totalOutputTokens: currentTotalOutputTokens,
        interactionCount: currentInteractionCount,
        modelBreakdown
      });

      console.debug(`Updated memory cost analytics: Session ${sessionId}, Total cost: $${currentTotalCost.toFixed(4)}`);
    } catch (error) {
      console.debug('Failed to update memory cost analytics:', error);
    }
  },

  /**
   * Get session cost analytics from memory
   */
  async getMemorySessionCostAnalytics(sessionId: string): Promise<any> {
    try {
      const memoryManager = await ensureMemoryManager();
      return await memoryManager.getSessionCostAnalytics(sessionId);
    } catch (error) {
      console.debug('Failed to get memory session cost analytics:', error);
      return null;
    }
  },

  /**
   * Manually restore cost analytics for the current session
   */
  async restoreSessionCostAnalytics(): Promise<boolean> {
    try {
      await restoreCostAnalytics(currentSessionId);
      return true;
    } catch (error) {
      console.debug('Failed to restore session cost analytics:', error);
      return false;
    }
  },

  /**
   * Get current session cost context summary
   */
  async getCurrentSessionCostContext(): Promise<{
    sessionId: string;
    hasMemoryCostData: boolean;
    hasContextCostData: boolean;
    summary: string | null;
  }> {
    try {
      const memoryManager = await ensureMemoryManager();
      const contextManager = await ensureContextPersistenceManager();
      
      const memoryCostAnalytics = await memoryManager.getSessionCostAnalytics(currentSessionId);
      const contextCostAnalytics = await contextManager.getSessionCostAnalytics();
      
      let summary = null;
      if (memoryCostAnalytics || contextCostAnalytics) {
        const analytics = memoryCostAnalytics || contextCostAnalytics;
        summary = `$${analytics!.totalCost.toFixed(4)} total cost, ${analytics!.interactionCount} interactions`;
      }
      
      return {
        sessionId: currentSessionId,
        hasMemoryCostData: !!memoryCostAnalytics,
        hasContextCostData: !!contextCostAnalytics,
        summary
      };
    } catch (error) {
      console.debug('Failed to get session cost context:', error);
      return {
        sessionId: currentSessionId,
        hasMemoryCostData: false,
        hasContextCostData: false,
        summary: null
      };
    }
  },

  clearHistorySelection() {
    // No persistent state to clear for now
  },

  async pasteImageFromClipboard(): Promise<{ success: boolean; message: string }> {
    try {
      // Try to detect clipboard content - this is a placeholder implementation
      // In a real implementation, this would use platform-specific APIs
      const { execSync } = await import('child_process');
      
      // Platform-specific clipboard image detection
      let hasImage = false;
      let imagePath = '';
      
      if (process.platform === 'darwin') {
        // macOS - check for image in clipboard
        try {
          const result = execSync('osascript -e "get the clipboard" 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
          hasImage = result.includes('missing value') === false;
        } catch {
          hasImage = false;
        }
      } else if (process.platform === 'win32') {
        // Windows - PowerShell clipboard check
        try {
          const result = execSync('powershell.exe -Command "Get-Clipboard -Format Image" 2>$null', { encoding: 'utf8', timeout: 5000 });
          hasImage = result.trim().length > 0;
        } catch {
          hasImage = false;
        }
      } else {
        // Linux - xclip check
        try {
          const result = execSync('xclip -selection clipboard -t image/png -o 2>/dev/null | wc -c', { encoding: 'utf8', timeout: 5000 });
          hasImage = parseInt(result.trim()) > 0;
        } catch {
          hasImage = false;
        }
      }

      if (!hasImage) {
        return {
          success: false,
          message: 'No image found in clipboard'
        };
      }

      // Save clipboard image to temp file
      const tmpDir = await fs.mkdtemp(path.join(process.cwd(), '.plato/tmp-'));
      imagePath = path.join(tmpDir, 'clipboard-image.png');
      
      if (process.platform === 'darwin') {
        execSync(`osascript -e 'tell application "System Events" to write (the clipboard as «class PNGf») to (open for access file "${imagePath}" with write permission)' && echo "Image saved"`, { timeout: 10000 });
      } else if (process.platform === 'win32') {
        execSync(`powershell.exe -Command "Get-Clipboard -Format Image | ForEach-Object { $_.Save('${imagePath.replace(/\\/g, '\\\\')}') }"`, { timeout: 10000 });
      } else {
        execSync(`xclip -selection clipboard -t image/png -o > "${imagePath}"`, { timeout: 10000 });
      }

      // Verify the image was saved
      const stats = await fs.stat(imagePath);
      if (stats.size > 0) {
        await this.addMemory('image_paste', `Image pasted from clipboard: ${imagePath} (${stats.size} bytes)`);
        
        // Add image context to conversation
        history.push({ 
          role: 'user', 
          content: `[Image pasted from clipboard: ${imagePath}]` 
        });
        
        return {
          success: true,
          message: `Image pasted successfully (${Math.round(stats.size / 1024)}KB)`
        };
      } else {
        return {
          success: false,
          message: 'Failed to save clipboard image'
        };
      }

    } catch (e: any) {
      await this.addMemory('image_paste_error', `Clipboard paste failed: ${e?.message || e}`);
      return {
        success: false,
        message: `Clipboard access failed: ${e?.message || 'Unknown error'}`
      };
    }
  },
  
  // Context Configuration Export/Import
  async exportContextConfiguration(file?: string): Promise<void> {
    try {
      const contextManager = await ensureContextPersistenceManager();
      
      // Get current context state for export
      const { SemanticIndex } = await import('../context/semantic-index.js');
      const { FileRelevanceScorer } = await import('../context/relevance-scorer.js');
      const { ContentSampler } = await import('../context/content-sampler.js');
      const { getSelected } = await import('../context/context.js');
      
      const index = new SemanticIndex();
      const scorer = new FileRelevanceScorer(index);
      const sampler = new ContentSampler(index);
      const currentFiles = await getSelected();
      
      const contextState = {
        index,
        scorer,
        sampler,
        currentFiles,
        userPreferences: {
          maxFiles: 100,
          relevanceThreshold: 50,
          autoSave: true
        },
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: metrics.turns,
          inputTokens: metrics.inputTokens,
          outputTokens: metrics.outputTokens,
          durationMs: metrics.durationMs
        }
      };
      
      const exportData = await contextManager.exportConfiguration(contextState);
      const json = JSON.stringify(exportData, null, 2);
      
      if (file) {
        await fs.writeFile(file, json, 'utf8');
      } else {
        console.log(json);
      }
    } catch (error: any) {
      throw new Error(`Failed to export context configuration: ${error?.message || error}`);
    }
  },
  
  async importContextConfiguration(file: string): Promise<void> {
    try {
      const contextManager = await ensureContextPersistenceManager();
      
      // Read and parse the export file
      const txt = await fs.readFile(file, 'utf8');
      const exportData = JSON.parse(txt);
      
      // Import the configuration
      const restoredState = await contextManager.importConfiguration(exportData);
      
      // Merge with current session
      const { getSelected } = await import('../context/context.js');
      const currentFiles = await getSelected();
      
      const currentState = {
        currentFiles,
        userPreferences: {},
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 0
        }
      };
      
      // Use smart resume to merge imported and current state
      const mergedState = await contextManager.smartResume(
        restoredState,
        currentState,
        {
          preferSaved: true,      // Prefer imported configuration
          mergeFiles: true,       // Merge file lists
          validateState: true     // Validate merged state
        }
      );
      
      // Add import notice to history
      history.push({
        role: 'system',
        content: `[Context configuration imported: ${mergedState.currentFiles.length} files, ` +
                 `exported at ${exportData.exportedAt}]`
      });
      
    } catch (error: any) {
      throw new Error(`Failed to import context configuration: ${error?.message || error}`);
    }
  },
  
  async getContextHistory(): Promise<Array<{ id: string; timestamp: Date; reason: string; description?: string }>> {
    try {
      const contextManager = await ensureContextPersistenceManager();
      return await contextManager.getContextHistory();
    } catch (error) {
      return [];
    }
  },
  
  async rollbackContextToSnapshot(snapshotId: string): Promise<void> {
    try {
      const contextManager = await ensureContextPersistenceManager();
      const memoryManager = await ensureMemoryManager();
      
      // Get the snapshot from memory
      const memories = await memoryManager.getAllMemories();
      const snapshot = memories.find(m => m.id === snapshotId);
      
      if (!snapshot) {
        throw new Error(`Context snapshot not found: ${snapshotId}`);
      }
      
      let snapshotContent;
      try {
        snapshotContent = JSON.parse(snapshot.content);
      } catch {
        throw new Error(`Invalid snapshot format: ${snapshotId}`);
      }
      
      if (!snapshotContent.snapshot) {
        throw new Error(`Snapshot data not found: ${snapshotId}`);
      }
      
      // Restore the snapshot
      const restoredState = await contextManager.deserializeContextState(snapshotContent.snapshot);
      
      // Create a rollback history entry
      await contextManager.createHistorySnapshot(
        restoredState,
        'rollback',
        `Rolled back to snapshot: ${snapshotContent.reason || 'Unknown'}`
      );
      
      // Add rollback notice to history
      history.push({
        role: 'system',
        content: `[Context rolled back to snapshot from ${snapshot.timestamp}]`
      });
      
    } catch (error: any) {
      throw new Error(`Failed to rollback context: ${error?.message || error}`);
    }
  },

  /**
   * Add a message to the conversation history
   */
  addMessage(message: Msg): void {
    history.push(message);
  },

  /**
   * Get all messages in the conversation
   */
  getMessages(): Msg[] {
    return [...history];
  },

  /**
   * Update token usage metrics
   */
  updateTokenMetrics(inputTokens: number, outputTokens: number): void {
    metrics.inputTokens += inputTokens;
    metrics.outputTokens += outputTokens;
  },

  /**
   * Get the analytics service instance
   */
  getAnalyticsService() {
    return getAnalyticsServiceInstance();
  },

  /**
   * Get current session cost
   */
  async getCurrentSessionCost(): Promise<number> {
    try {
      const service = getAnalyticsServiceInstance();
      return await service.getCurrentSessionCost(getCurrentSessionId());
    } catch (error) {
      console.warn('Failed to get current session cost:', error);
      return 0;
    }
  },

  /**
   * Get today's total cost
   */
  async getTodayTotalCost(): Promise<number> {
    try {
      const service = getAnalyticsServiceInstance();
      return await service.getTodayTotalCost();
    } catch (error) {
      console.warn('Failed to get today\'s total cost:', error);
      return 0;
    }
  },

  /**
   * Get detailed session cost breakdown
   */
  async getSessionBreakdown(sessionId?: string): Promise<any> {
    try {
      const service = getAnalyticsServiceInstance();
      const id = sessionId || getCurrentSessionId();
      return await service.getSessionBreakdown(id);
    } catch (error) {
      console.warn('Failed to get session breakdown:', error);
      return null;
    }
  },

  /**
   * Get analytics batch performance statistics
   */
  getBatchPerformanceStats() {
    try {
      const service = getAnalyticsServiceInstance();
      return service.getBatchStats();
    } catch (error) {
      console.warn('Failed to get batch stats:', error);
      return null;
    }
  },

  /**
   * Get session cost analytics from session persistence
   */
  async getSessionCostAnalytics() {
    try {
      const contextManager = await ensureContextPersistenceManager();
      return await contextManager.getSessionCostAnalytics();
    } catch (error) {
      console.warn('Failed to get session cost analytics:', error);
      return null;
    }
  },

  /**
   * Initialize cost analytics for current session
   */
  async initializeSessionCostAnalytics() {
    try {
      const contextManager = await ensureContextPersistenceManager();
      await contextManager.initializeSessionCostAnalytics(currentSessionId);
    } catch (error) {
      console.warn('Failed to initialize session cost analytics:', error);
    }
  }
};

function extractPatch(text: string): string | null {
  const m = text.match(/\*\*\* Begin Patch[\s\S]*?\*\*\* End Patch/);
  return m ? m[0] : null;
}

function parseToolCall(text: string, strict = true): null | { server: string; name: string; input: any } {
  // Preferred: explicit tool_call wrapper in fenced JSON
  const fences = Array.from(text.matchAll(/```(?:json)?\n([\s\S]*?)\n```/g));
  for (const m of fences) {
    try {
      const obj = JSON.parse(m[1]);
      const tc = obj.tool_call || obj["tool_call"];
      if (tc && typeof tc === 'object') {
        const server = tc.server;
        const name = tc.name;
        const input = tc.input ?? {};
        if (server && name) return { server, name, input };
      }
      if (!strict) {
        const server = obj.server || obj.mcp_server || obj.provider;
        const name = obj.name || obj.tool || obj.tool_name;
        const input = obj.input || obj.arguments || obj.params || {};
        if (server && name) return { server, name, input };
      }
    } catch {}
  }
  if (!strict) {
  // Inline JSON containing tool_call
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      const tc = (obj as any).tool_call || (obj as any)["tool_call"];
      if (tc && typeof tc === 'object') {
        const server = tc.server;
        const name = tc.name;
        const input = tc.input ?? {};
        if (server && name) return { server, name, input };
      } else {
        const server = (obj as any).server || (obj as any).mcp_server || (obj as any).provider;
        const name = (obj as any).name || (obj as any).tool || (obj as any).tool_name;
        const input = (obj as any).input || (obj as any).arguments || (obj as any).params || {};
        if (server && name) return { server, name, input };
      }
    } catch {}
  }
  const slash = text.match(/\/mcp\s+run\s+(\S+)\s+(\S+)\s+([\s\S]+)/);
  if (slash) {
    try {
      const input = JSON.parse(slash[3]);
      return { server: slash[1], name: slash[2], input } as any;
    } catch {}
  }
  }
  return null;
}

async function maybeBridgeTool(content: string, onEvent?: (e: OrchestratorEvent)=>void): Promise<void> {
  const cfg = await loadConfig();
  if (cfg.toolCallPreset?.enabled === false) return;
  // Use strict JSON block detection matching Claude Code
  const toolCallRegex = /```json\s*\n\s*\{\s*"tool_call"\s*:\s*\{[\s\S]*?\}\s*\}\s*\n\s*```/;
  const match = content.match(toolCallRegex);
  if (!match) return;
  const jsonBlock = match[0];
  const jsonStr = jsonBlock.replace(/```json\s*\n/, '').replace(/\n\s*```/, '');
  let toolCall: any;
  try {
    // Parse with timeout protection
    const parsePromise = new Promise((resolve, reject) => {
      try { const parsed = JSON.parse(jsonStr); resolve(parsed); } catch (e) { reject(e); }
    });
    toolCall = await Promise.race([
      parsePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Tool call parse timeout')), 30000))
    ]);
  } catch (e: any) {
    console.error('Failed to parse tool call:', e.message);
    return;
  }
  if (!toolCall?.tool_call?.server || !toolCall?.tool_call?.name) {
    console.error('Invalid tool call format: missing server or name');
    return;
  }
  const { server, name, input = {} } = toolCall.tool_call;
  const decision = await checkPermission({ tool: 'mcp', command: `${server}:${name}` });
  if (decision !== 'allow') { onEvent?.({ type: 'info', message: `Tool call requires permission: ${server}:${name} => ${decision}` }); return; }
  
  // Emit tool start event
  emitToolStart(name, server, input);
  
  onEvent?.({ type: 'tool-start', message: `Running ${name}...` });
  try {
    const result = await callTool(server, name, input);
    history.push({ role: 'tool', content: JSON.stringify(result) });
    
    // Emit tool success event
    emitToolEnd(name, true);
    
    onEvent?.({ type: 'tool-end', message: 'Tool completed' });
  } catch (e: any) {
    const error = `Tool failed: ${e?.message || e}`;
    history.push({ role: 'tool', content: error });
    
    // Emit tool failure event
    emitToolEnd(name, false, e?.message || String(e));
    
    onEvent?.({ type: 'tool-end', message: error });
  }
}

function parseAllToolCalls(text: string, strict = true): { server: string; name: string; input: any }[] {
  const out: { server: string; name: string; input: any }[] = [];
  const fences = Array.from(text.matchAll(/```(?:json)?\n([\s\S]*?)\n```/g));
  for (const m of fences) {
    try {
      const obj = JSON.parse(m[1]);
      const tc = (obj as any).tool_call || (obj as any)["tool_call"];
      if (tc && typeof tc === 'object' && tc.server && tc.name) out.push({ server: tc.server, name: tc.name, input: tc.input ?? {} });
      else if (!strict) {
        const server = (obj as any).server || (obj as any).mcp_server || (obj as any).provider;
        const name = (obj as any).name || (obj as any).tool || (obj as any).tool_name;
        const input = (obj as any).input || (obj as any).arguments || (obj as any).params || {};
        if (server && name) out.push({ server, name, input });
      }
    } catch {}
  }
  if (!out.length) {
    const single = parseToolCall(text, strict);
    if (single) out.push(single);
  }
  return out;
}

async function prepareMessages(msgs: Msg[]) {
  const cfg = await loadConfig();
  if (cfg.toolCallPreset?.enabled) {
    const reminder = getToolCallOneLiner(cfg.model?.active || '', cfg);
    const has = msgs.find(m=>m.role==='system' && m.content.includes('tool_call'));
    if (!has) return [{ role: 'system', content: reminder } as Msg, ...msgs];
  }
  return msgs;
}

async function saveSessionDefault() {
  const file = '.plato/session.json';
  try {
    await fs.mkdir('.plato', { recursive: true });
    const data = { history, metrics };
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
    
    // Also save context state through persistence manager
    await saveContextState();
  } catch {}
}

async function saveContextState() {
  try {
    const contextManager = await ensureContextPersistenceManager();
    
    // Import the context components we need
    const { SemanticIndex } = await import('../context/semantic-index.js');
    const { FileRelevanceScorer } = await import('../context/relevance-scorer.js');
    const { ContentSampler } = await import('../context/content-sampler.js');
    const { getSelected } = await import('../context/context.js');
    
    // Create context components if they don't exist
    const index = new SemanticIndex();
    const scorer = new FileRelevanceScorer(index);
    const sampler = new ContentSampler(index);
    const currentFiles = await getSelected();
    
    // Gather current context state
    const contextState = {
      index,
      scorer,
      sampler,
      currentFiles,
      userPreferences: {
        maxFiles: 100,
        relevanceThreshold: 50,
        autoSave: true
      },
      sessionMetadata: {
        startTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        totalQueries: metrics.turns,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        durationMs: metrics.durationMs
      }
    };
    
    // Save to session.json structure
    await contextManager.saveToSession(contextState);
    
    // Create history snapshot
    await contextManager.createHistorySnapshot(
      contextState, 
      'automatic_save',
      `Session saved with ${metrics.turns} turns`
    );
  } catch (error) {
    // Silently handle errors to avoid disrupting session save
  }
}

// Restore cost analytics from previous sessions
async function restoreCostAnalytics(sessionId: string): Promise<void> {
  try {
    // Try to restore from memory system first
    const memoryManager = await ensureMemoryManager();
    const memoryCostAnalytics = await memoryManager.getSessionCostAnalytics(sessionId);
    
    // Try to restore from context persistence
    const contextManager = await ensureContextPersistenceManager();
    const contextCostAnalytics = await contextManager.getSessionCostAnalytics();
    
    // Use the most recent/complete cost analytics
    let costAnalytics = memoryCostAnalytics || contextCostAnalytics;
    
    if (costAnalytics) {
      // Ensure analytics service is initialized with restored data
      const analytics = await ensureAnalyticsService();
      
      // Log restoration
      console.log(`Restored cost analytics from ${memoryCostAnalytics ? 'memory' : 'context'}: ` +
                  `$${costAnalytics.totalCost.toFixed(4)} total cost, ` +
                  `${costAnalytics.interactionCount} interactions`);
      
      // Add restoration message to history
      history.push({
        role: 'system',
        content: `[Cost analytics restored: $${costAnalytics.totalCost.toFixed(4)} total cost, ` +
                 `${costAnalytics.interactionCount} previous interactions]`
      });
    }
  } catch (error) {
    console.debug('Failed to restore cost analytics:', error);
  }
}

async function restoreContextState() {
  try {
    const contextManager = await ensureContextPersistenceManager();
    
    // Try to load context state from session.json
    const savedState = await contextManager.loadFromSession();
    if (savedState) {
      // Get current context state for smart merging
      const { getSelected } = await import('../context/context.js');
      const currentFiles = await getSelected();
      
      // Create a minimal current state
      const currentState = {
        currentFiles,
        userPreferences: {},
        sessionMetadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          totalQueries: 0
        }
      };
      
      // Use smart resume to merge saved and current context
      const mergedState = await contextManager.smartResume(
        savedState,
        currentState,
        {
          preferSaved: true,      // Prefer saved preferences and metadata
          mergeFiles: true,       // Merge file lists intelligently  
          validateState: true     // Validate merged state
        }
      );
      
      // Apply merged preferences to current session
      if (mergedState.userPreferences) {
        // In future iterations, we can apply user preferences to active components
        // For now, we've successfully restored and merged the context
      }
      
      // Add restoration notice to history
      if (mergedState.sessionMetadata?.startTime) {
        let restorationMessage = `[Context restored: ${mergedState.currentFiles.length} files, ` +
                                `${mergedState.sessionMetadata.totalQueries || 0} previous queries`;
        
        // Add cost information if available
        if (mergedState.sessionMetadata.costAnalytics) {
          const costAnalytics = mergedState.sessionMetadata.costAnalytics;
          restorationMessage += `, Total cost: $${costAnalytics.totalCost.toFixed(4)} ` +
                               `(${costAnalytics.interactionCount} interactions)`;
        }
        
        restorationMessage += ']';
        
        history.push({
          role: 'system',
          content: restorationMessage
        });
      }
      
      // Restore cost analytics to current session if available
      if (mergedState.sessionMetadata?.costAnalytics) {
        console.log(`Restored session cost analytics: $${mergedState.sessionMetadata.costAnalytics.totalCost.toFixed(4)} total cost`);
      }
    }
  } catch (error) {
    // Silently handle errors to avoid disrupting session restore
  }
}

async function saveSessionDebounced() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await saveSessionDefault();
  }, 2000);
}

process.on('SIGINT', async () => {
  await saveSessionDefault();
  process.exit(0);
});

async function maybeAutoApply(patch: string | null, onEvent?: (e: OrchestratorEvent)=>void) {
  if (!patch) return;
  const cfg = await loadConfig();
  if (cfg.editing?.autoApply !== 'on') return;
  // Security review
  const issues = reviewPatch(patch);
  const high = issues.find(i=>i.severity==='high');
  if (high) { onEvent?.({ type: 'info', message: `auto-apply blocked by security review: ${high.message}` }); return; }
  // Permissions
  const decision = await checkPermission({ tool: 'fs_patch', path: '*' });
  if (decision !== 'allow') { onEvent?.({ type: 'info', message: `auto-apply requires permission: fs_patch => ${decision}` }); return; }
  // Dry-run
  const dry = await dryRunApply(patch);
  if (!dry.ok) { onEvent?.({ type: 'info', message: `auto-apply check failed: ${dry.conflicts.slice(0,2).join(' | ')}` }); return; }
  // Announce actions (Claude-style) and apply
  const details = parseDiffDetails(patch);
  
  // Emit patch apply start event
  emitPatchApplyStart(details.length);
  
  for (const d of details) {
    onEvent?.({ type: 'info', message: `● Write(${d.file})` });
  }
  try {
    await applyPatch(patch);
    
    // Emit patch apply success event
    emitPatchApplyEnd(true);
    
    if (details.length === 1 && details[0].newFile) {
      onEvent?.({ type: 'info', message: `● I'll create a file called ${details[0].file}.` });
    }
    for (const d of details) {
      onEvent?.({ type: 'info', message: `  ⎿  Wrote ${d.addedLines} lines to ${d.file}` });
      if (d.newFile && d.preview.length) {
        for (const line of d.preview.slice(0, 10)) onEvent?.({ type: 'info', message: `     ${line}` });
      }
    }
    if (details.length) onEvent?.({ type: 'info', message: `
● Done! ${details.length===1 ? `Created ${details[0].file}` : 'Applied changes.'}` });
    pendingPatch = null;
  } catch (e: any) {
    // Emit patch apply failure event
    emitPatchApplyEnd(false, e?.message || String(e));
    
    onEvent?.({ type: 'info', message: `auto-apply error: ${e?.message || e}` });
  }
}

function parseDiffDetails(patch: string): { file: string; addedLines: number; newFile: boolean; preview: string[] }[] {
  const out: { file: string; addedLines: number; newFile: boolean; preview: string[] }[] = [];
  // sanitize similar to patch.ts
  const m = patch.match(/\*\*\* Begin Patch[\s\S]*?\n([\s\S]*?)\n\*\*\* End Patch/);
  let s = m ? m[1] : patch;
  s = s.replace(/^```.*$/gm, '').trim();
  const sections = s.split(/^diff --git .*$/m).filter(Boolean);
  if (sections.length) {
    for (const sec of sections) collect(sec, out);
  } else {
    collect(s, out);
  }
  return out;
  function collect(text: string, acc: any[]) {
    const lines = text.split(/\r?\n/);
    let plus = 0;
    let file = '';
    let newFile = false;
    const preview: string[] = [];
    for (let i=0;i<lines.length;i++) {
      const l = lines[i];
      if (l.startsWith('+++ ')) {
        const p = l.replace(/^\+\+\+\s+/, '');
        file = p.replace(/^b\//,'');
      }
      if (l.startsWith('--- ')) {
        if (/\/dev\/null/.test(l)) newFile = true;
      }
      if (l.startsWith('+') && !l.startsWith('+++')) {
        plus++;
        if (newFile) preview.push(l.slice(1));
      }
    }
    if (file) acc.push({ file, addedLines: plus, newFile, preview });
  }
}

function getToolCallOneLiner(modelId: string, cfg?: any): string {
  const id = (modelId || '').toLowerCase();
  const preset = cfg?.toolCallPreset || {};
  // Per-model overrides
  const ov = preset.overrides || {};
  const exactKey = Object.keys(ov).find(k => k.toLowerCase() === id);
  if (exactKey) return ov[exactKey];
  if (preset.messageOverride) return preset.messageOverride;
  // Known model families and exact ids
  const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini', 'o4-mini'];
  const isOpenAI = OPENAI_MODELS.some(m => id === m || id.startsWith(m)) || /\bgpt|\bo[0-9]/.test(id);
  if (isOpenAI) {
    return 'Tool calls: emit a fenced json block only {"tool_call":{"server":"<id>","name":"<tool>","input":{}}} — valid JSON (double quotes), no trailing commas, no prose.';
  }
  if (/claude/.test(id)) {
    return 'Tool calls: output a single fenced json block with {"tool_call":{"server":"<id>","name":"<tool>","input":{}}} only — no extra text inside the block.';
  }
  if (/gemini|google/.test(id)) {
    return 'Tool calls: use a fenced json block containing only {"tool_call":{"server":"<id>","name":"<tool>","input":{}}} — strictly valid JSON, no commentary.';
  }
  return 'For tool calls, output a fenced json block with only {"tool_call":{"server":"<id>","name":"<tool>","input":{}}} (no prose).';
}
