# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-05-comprehensive-test-coverage/spec.md

## Technical Requirements

### Testing Framework Setup
- **Test Runner**: Jest 29+ with TypeScript support via ts-jest
- **Assertion Library**: Built-in Jest matchers with extended matchers from jest-extended
- **Mocking**: Jest mock functions and manual mocks for complex modules
- **Coverage Tool**: Jest's built-in coverage with istanbul reporter
- **Test Structure**: Organize tests in `src/__tests__/` mirroring source structure

### Test Categories & Implementation

#### Unit Tests (40% of suite)
- Test pure functions in isolation
- Mock all external dependencies and side effects
- Focus on: parsers, validators, formatters, utility functions
- File naming: `*.test.ts` adjacent to source files
- Coverage target: 90% for utility modules

#### Integration Tests (25% of suite)
- Test component interactions without external services
- Mock only external APIs (GitHub Copilot, filesystem)
- Focus on: orchestrator flows, command processing, session management
- File location: `src/__tests__/integration/`
- Coverage target: 70% for integration points

#### Command Tests (20% of suite)
- Test all 41 slash commands individually
- Validate command parsing, execution, and output format
- Mock provider responses but test full command flow
- File location: `src/__tests__/commands/`
- Special focus on parity commands: /init, /memory, /agents

#### End-to-End Tests (10% of suite)
- Test complete user workflows
- Use test fixtures and temp directories
- Scenarios: login→edit→save, session→restore, custom commands
- File location: `src/__tests__/e2e/`
- Runtime: May exceed unit test time limits

#### Parity Validation Tests (5% of suite)
- Compare output formats against Claude Code templates
- Test keyboard shortcuts and special key sequences
- Validate error message formats
- File location: `src/__tests__/parity/`
- Use snapshot testing for output comparison

### Test Infrastructure

#### Test Utilities
- Create `src/__tests__/helpers/` directory for:
  - Mock factories for common objects
  - Test data builders
  - Custom Jest matchers
  - Terminal output capture utilities

#### Environment Setup
- Test environment: node
- Setup files for global mocks
- Separate jest configs for unit vs integration tests
- Environment variables for test mode detection

#### CI/CD Integration
- GitHub Actions workflow in `.github/workflows/test.yml`
- Matrix testing: Node 18, 20, 22 × Ubuntu, macOS, Windows
- Coverage reporting to Codecov or similar service
- Required checks before PR merge

### Performance Requirements
- Unit tests: < 10 seconds total
- Integration tests: < 20 seconds total  
- Command tests: < 15 seconds total
- E2E tests: < 10 seconds total
- Full suite: < 60 seconds on modern hardware

### Quality Gates
- Minimum 80% overall code coverage
- No test may be skipped or marked as todo
- All tests must pass before merge
- New features require corresponding tests

## External Dependencies

### Testing Libraries
- **jest** (^29.0.0) - Test runner and assertion framework
- **@types/jest** (^29.0.0) - TypeScript definitions
- **ts-jest** (^29.0.0) - TypeScript preprocessor for Jest
- **jest-extended** (^4.0.0) - Additional Jest matchers
- **Justification**: Jest is the de facto standard for React/TypeScript testing with excellent TS support

### Testing Utilities  
- **mock-fs** (^5.0.0) - Mock filesystem for testing file operations
- **Justification**: Needed to test file operations without touching real filesystem
- **nock** (^13.0.0) - HTTP mocking for API tests
- **Justification**: Mock GitHub Copilot API responses without network calls
- **ink-testing-library** (^3.0.0) - Testing utilities for Ink components
- **Justification**: Specialized testing for React Ink terminal UI components