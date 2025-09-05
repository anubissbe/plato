# Testing Strategy

This document outlines the testing strategy for achieving comprehensive test coverage in Plato V3.

## Test Organization

### Directory Structure
```
src/
├── __tests__/
│   ├── unit/           # Pure function tests
│   ├── integration/    # Component interaction tests
│   ├── commands/       # Slash command tests
│   ├── e2e/           # End-to-end workflows
│   ├── parity/        # Claude Code compatibility
│   └── helpers/       # Test utilities and mocks
├── providers/
│   └── __tests__/     # Provider-specific tests
├── tui/
│   └── __tests__/     # TUI component tests
└── tools/
    └── __tests__/     # Tool-specific tests
```

## Priority Testing Areas

### Phase 1: Critical Path (Week 1)
1. **Authentication Flow** - Login/logout with Copilot
2. **Core Commands** - /help, /status, /init, /memory
3. **File Operations** - Write, edit, patch application
4. **Session Management** - Save/restore functionality

### Phase 2: Command Coverage (Week 2)
5. **All 41 Commands** - Individual command tests
6. **Command Parsing** - Argument handling and validation
7. **Error Handling** - Invalid commands and edge cases
8. **Permission System** - Allow/deny rules

### Phase 3: Integration & E2E (Week 3)
9. **MCP Integration** - Tool-call bridge testing
10. **Custom Commands** - .plato/commands/ loading
11. **Keyboard Shortcuts** - Escape, Ctrl+R, etc.
12. **Complete Workflows** - Real user scenarios

## Mock Strategy

### What to Mock
- **Always Mock**:
  - GitHub Copilot API responses
  - File system operations (using mock-fs)
  - Network requests (using nock)
  - Time/date functions
  - Process.exit and console methods

### What Not to Mock
- **Never Mock**:
  - Pure utility functions
  - Data transformations
  - Internal module interactions (in integration tests)
  - React Ink components (in component tests)

## Test Data Management

### Fixtures
Create reusable test fixtures in `__tests__/fixtures/`:
- Sample session files
- Mock API responses
- Example command outputs
- PLATO.md templates

### Builders
Implement builder pattern for complex objects:
```typescript
class SessionBuilder {
  withMessages(messages: Message[]): this
  withModel(model: string): this
  build(): Session
}
```

## Coverage Strategy

### Coverage Targets by Module
- **Core Modules** (90%+): parsers, validators, formatters
- **Commands** (85%+): All command handlers
- **Providers** (80%+): API integration layer
- **TUI** (70%+): UI components and interactions
- **Tools** (75%+): Tool implementations

### Excluded from Coverage
- Type definition files (*.d.ts)
- Test files themselves
- Build configuration
- Scripts directory

## Testing Best Practices

### Test Naming
```typescript
describe('CommandParser', () => {
  describe('parse', () => {
    it('should parse slash command with arguments', () => {})
    it('should handle missing command gracefully', () => {})
    it('should validate command permissions', () => {})
  })
})
```

### Assertion Patterns
- Use specific matchers: `toHaveBeenCalledWith` over `toHaveBeenCalled`
- Test both success and failure paths
- Validate error messages, not just error throwing
- Use snapshot testing sparingly (only for stable output)

### Performance Considerations
- Keep unit tests under 50ms each
- Use `beforeAll` for expensive setup
- Parallelize test execution with `--maxWorkers`
- Skip slow E2E tests in watch mode

## Continuous Integration

### PR Validation
```yaml
on: [pull_request]
jobs:
  test:
    strategy:
      matrix:
        node: [18, 20, 22]
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test -- --coverage
      - run: npm run lint
      - run: npm run typecheck
```

### Coverage Reporting
- Generate coverage reports in CI
- Fail if coverage drops below 80%
- Comment PR with coverage delta
- Upload to coverage service (Codecov/Coveralls)

## Migration Plan

### Incremental Testing
1. Start with new features (test-first)
2. Add tests when fixing bugs
3. Backfill critical path tests
4. Gradually increase coverage

### Testing Checklist for PRs
- [ ] New code has corresponding tests
- [ ] All tests pass locally
- [ ] Coverage hasn't decreased
- [ ] Test names clearly describe behavior
- [ ] No `.only` or `.skip` in tests

## Success Metrics

### Quantitative
- 80%+ overall code coverage achieved
- All 41 commands have tests
- Test suite runs in < 60 seconds
- Zero flaky tests

### Qualitative  
- Developers confident in making changes
- Bugs caught before production
- Easy to add tests for new features
- Clear test failure messages