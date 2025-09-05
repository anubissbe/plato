# Test Directory Structure

This directory contains all tests for Plato V3, organized by test type:

## Directory Organization

- **`unit/`** - Unit tests for individual functions and modules
  - Test pure functions in isolation
  - Mock all external dependencies
  - Target: 90% coverage for utilities

- **`integration/`** - Integration tests for component interactions
  - Test multiple components working together
  - Mock only external services (APIs, filesystem)
  - Target: 70% coverage for integration points

- **`commands/`** - Tests for all 41 slash commands
  - Individual test file per command or command group
  - Validate parsing, execution, and output format
  - Ensure Claude Code parity

- **`e2e/`** - End-to-end tests for complete workflows
  - Test full user journeys (login → edit → save)
  - Use real filesystem with temp directories
  - May take longer than unit tests

- **`parity/`** - Claude Code compatibility tests
  - Compare output formats against expected patterns
  - Test keyboard shortcuts and interactions
  - Use snapshot testing for consistency

- **`helpers/`** - Shared test utilities
  - Mock factories for common objects
  - Test data builders
  - Custom Jest matchers
  - Utility functions for tests

- **`fixtures/`** - Test data and fixtures
  - Sample configuration files
  - Mock API responses
  - Example session data
  - Template files for testing

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test category
npm test -- unit
npm test -- integration
npm test -- commands

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- setup.test
```

## Writing Tests

1. Place unit tests adjacent to source files when appropriate
2. Use descriptive test names that explain the behavior
3. Follow AAA pattern: Arrange, Act, Assert
4. Mock external dependencies consistently
5. Use test utilities from `helpers/` directory

## Coverage Goals

- Overall: 80%+ coverage
- Unit tests: 90%+ for pure functions
- Integration: 70%+ for workflows
- Commands: 100% command coverage (at least 1 test each)
- E2E: Cover critical user paths