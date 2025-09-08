# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-08-cost-tracking-analytics/spec.md

> Created: 2025-09-08
> Version: 1.0.0

## Technical Requirements

### Core Analytics System

**Analytics Service (`src/services/analytics.ts`)**
- Track cost metrics in real-time during conversations
- Persist historical data with 6-month retention policy
- Provide aggregation functions (daily, weekly, monthly views)
- Handle data compaction for long-term storage efficiency
- Export functionality for CSV/JSON formats

**Performance Requirements**
- Analytics queries: <200ms response time
- Real-time cost updates: <50ms latency
- Data export: <2s for 30-day periods
- Memory footprint: <10MB for 6-month dataset
- Storage optimization: Auto-compact data older than 30 days

### Data Models

**Cost Tracking Schema**
```typescript
interface CostMetric {
  timestamp: number;
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  provider: 'copilot' | 'openai' | 'claude';
  command?: string;
  duration: number;
}

interface AnalyticsSummary {
  period: 'day' | 'week' | 'month';
  startDate: number;
  endDate: number;
  totalCost: number;
  totalTokens: number;
  sessionCount: number;
  avgCostPerSession: number;
  modelBreakdown: Record<string, {cost: number, tokens: number}>;
}
```

**Storage Structure**
- Location: `.plato/analytics/`
- Format: JSON files partitioned by month (`2025-09.json`)
- Index file: `analytics-index.json` for quick lookups
- Session mapping: Link analytics to conversation sessions

### Architecture Integration

**Runtime Orchestrator Enhancement (`src/runtime/orchestrator.ts`)**
- Extend existing token tracking to include cost calculation
- Real-time cost updates during streaming responses
- Integration with analytics service for data persistence
- Batch updates for performance optimization

**TUI Status Line Updates (`src/tui/components/status-line.tsx`)**
- Add real-time cost display alongside token count
- Format: "Tokens: 1,234 | Cost: $0.12 | Session: $1.45"
- Color coding: Green (<$1), Yellow ($1-5), Red (>$5)
- Toggle visibility with existing status line controls

**Analytics Command (`src/commands/analytics.ts`)**
- Implement `/analytics` slash command
- Subcommands: `view`, `export`, `reset`, `summary`
- Interactive table display using existing TUI components
- Date range filtering and model-specific views

### Implementation Details

**Cost Calculation Engine**
```typescript
class CostCalculator {
  private static readonly PRICING = {
    'copilot': { input: 0.000002, output: 0.000008 },
    'gpt-4': { input: 0.00003, output: 0.00006 },
    'claude-3': { input: 0.000015, output: 0.000075 }
  };

  calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number;
  updatePricing(provider: string, pricing: TokenPricing): void;
}
```

**Analytics Data Manager**
```typescript
class AnalyticsManager {
  private dataStore: Map<string, CostMetric[]>;
  
  async recordMetric(metric: CostMetric): Promise<void>;
  async getMetrics(startDate: number, endDate: number): Promise<CostMetric[]>;
  async getSummary(period: 'day' | 'week' | 'month'): Promise<AnalyticsSummary>;
  async exportData(format: 'csv' | 'json', dateRange?: [number, number]): Promise<string>;
  async cleanup(): Promise<void>; // Remove data older than 6 months
}
```

**Session Integration**
- Link analytics to existing session persistence in `.plato/session.json`
- Track session-level cost summaries
- Restore cost context on `/resume` command
- Update memory system to include cost metadata

### User Interface Components

**Analytics Display Table**
```typescript
interface AnalyticsTableProps {
  metrics: CostMetric[];
  groupBy: 'session' | 'day' | 'model';
  showDetails: boolean;
}
```

**Export Dialog**
- Date range picker using existing TUI prompt system
- Format selection (CSV/JSON)
- Progress indicator for large exports
- File save location confirmation

**Status Line Enhancement**
- Real-time cost counter with session total
- Configurable cost alerts/warnings
- Integration with existing mouse mode support
- Keyboard shortcuts for quick analytics access

### External Dependencies

**No New Dependencies Required**
- Leverage existing TypeScript infrastructure
- Use built-in Node.js `fs` for file operations
- Extend current React+Ink components
- Utilize existing session management system

### Integration Points

**Existing Systems Enhancement**
- `src/providers/`: Add cost tracking to all provider implementations
- `src/memory/`: Include cost metadata in conversation memory
- `src/config/`: Add analytics configuration options
- `src/tui/`: Extend status display and add analytics views

**File System Structure**
```
.plato/
├── analytics/
│   ├── analytics-index.json
│   ├── 2025-09.json
│   └── 2025-10.json
├── session.json (enhanced with cost data)
└── config.json (analytics preferences)
```

### Performance Optimizations

**Data Management**
- Lazy loading of historical data
- In-memory caching for current session
- Batch writes every 10 metrics or 30 seconds
- Background cleanup of old data files

**Query Optimization**
- Pre-computed monthly summaries
- Indexed access by date ranges
- Streaming exports for large datasets
- Async data loading with progress indicators

### Testing Strategy

**Unit Tests**
- Cost calculation accuracy
- Data persistence and retrieval
- Export format validation
- Performance benchmarks

**Integration Tests**
- End-to-end cost tracking flow
- TUI component rendering
- Session restoration with cost data
- Multi-provider cost tracking

### Security Considerations

**Data Privacy**
- Local storage only (no external transmission)
- User consent for data collection
- Secure deletion of exported files
- No sensitive conversation content in analytics

**Access Control**
- File permissions on analytics directory
- Optional analytics disable flag
- User-controlled data retention period

### Migration Strategy

**Existing Users**
- Automatic creation of analytics directory
- Retroactive cost calculation for current session
- Opt-in analytics collection with user prompt
- Backward compatibility with existing session files

**Future Extensibility**
- Plugin architecture for custom cost providers
- API endpoints for external analytics tools
- Integration hooks for third-party monitoring
- Configurable cost alert thresholds