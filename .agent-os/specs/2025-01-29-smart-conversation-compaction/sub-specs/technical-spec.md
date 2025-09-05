# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-01-29-smart-conversation-compaction/spec.md

> Created: 2025-01-29
> Version: 1.0.0

## Technical Requirements

### Semantic Analysis Engine
- **Algorithm**: Implement TF-IDF scoring with cosine similarity for message relevance
- **Context Window**: Analyze conversation segments in 10-message sliding windows
- **Similarity Threshold**: Messages with >0.7 cosine similarity are candidates for compaction
- **Topic Detection**: Use keyword extraction and clustering to identify conversation threads

### Conversation Thread Detection
- **Thread Identification**: Group related messages using semantic similarity and temporal proximity
- **Topic Boundaries**: Detect topic shifts using semantic distance thresholds (>0.5 change)
- **Thread Persistence**: Maintain thread metadata for cross-session conversation continuity
- **Priority Scoring**: Weight threads by recency, user engagement, and tool usage frequency

### Context Scoring Mechanisms
- **Relevance Score**: Combine recency weight (0.4), semantic importance (0.3), tool usage (0.2), user interaction (0.1)
- **Preservation Rules**: Always preserve last 5 messages, messages with tool calls, and user confirmations
- **Context Thresholds**: 
  - High importance: >0.8 (always preserve)
  - Medium importance: 0.5-0.8 (preserve with context)
  - Low importance: <0.5 (candidate for compaction)

### UI/UX Specifications
- **Transparency Indicators**: Show compaction status with visual markers in conversation history
- **Expandable Summaries**: Implement collapsible summary blocks for compacted content
- **User Control**: Add toggle for automatic vs. manual compaction mode
- **Preview Mode**: Allow users to preview compaction results before applying

### Performance Criteria
- **Processing Time**: Semantic analysis must complete within 200ms for 100-message conversations
- **Memory Efficiency**: Target 40-60% memory reduction while preserving 95% context accuracy
- **Incremental Processing**: Process new messages without reanalyzing entire conversation
- **Background Operation**: Run compaction analysis asynchronously to avoid blocking user interaction

## Approach

### Integration with Existing Infrastructure
- **Orchestrator Enhancement**: Extend `src/runtime/orchestrator.ts` with smart compaction hooks
- **Memory Manager Integration**: Enhance `src/memory/MemoryManager.ts` with semantic analysis capabilities
- **Conversation State**: Modify conversation storage to include compaction metadata and thread information

### Implementation Strategy
1. **Phase 1**: Implement basic semantic similarity scoring using existing conversation data
2. **Phase 2**: Add thread detection and topic boundary identification
3. **Phase 3**: Integrate with UI components for user visibility and control
4. **Phase 4**: Optimize performance and add advanced context preservation rules

### Data Structures
- **Thread Metadata**: Store topic keywords, participant count, tool usage frequency, and temporal bounds
- **Message Annotations**: Add semantic importance scores, thread IDs, and compaction status to message objects
- **Compaction Journal**: Maintain history of compaction decisions for debugging and reversal

## External Dependencies

### Natural Language Processing
- **compromise**: Lightweight NLP library for text analysis and keyword extraction
  - Version: ^14.10.0
  - Purpose: Topic detection and semantic analysis
  - Alternative: natural (if compromise proves insufficient)

### Semantic Similarity
- **ml-distance**: Mathematical distance functions for semantic similarity calculations
  - Version: ^4.0.1
  - Purpose: Cosine similarity and TF-IDF scoring
  - Lightweight alternative to avoid heavy ML dependencies

### Text Processing
- **stopword**: Stop word filtering for improved semantic analysis
  - Version: ^2.0.0
  - Purpose: Remove common words to improve topic detection accuracy

Note: Dependencies chosen for minimal footprint and TypeScript compatibility, avoiding heavy ML frameworks that would impact startup time and memory usage.