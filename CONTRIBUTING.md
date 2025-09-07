# Contributing to Plato

Thank you for your interest in contributing to Plato! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and collaborative environment.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in the Issues section
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - System information (OS, Node version, etc.)
   - Relevant logs or screenshots

### Suggesting Features

1. Check existing issues and merge requests for similar suggestions
2. Create a new issue with the `enhancement` label
3. Provide:
   - Clear use case and benefits
   - Proposed implementation approach (if applicable)
   - Any mockups or examples

### Submitting Code

#### Setup Development Environment

```bash
# Clone the repository
git clone https://git.euraika.net/Bert/plato.git
cd plato

# Install dependencies
npm ci

# Run development mode
npm run dev
```

#### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   # Run tests
   npm test
   
   # Type checking
   npm run typecheck
   
   # Linting
   npm run lint
   
   # Format code
   npm run fmt
   ```

4. **Commit your changes**
   - Use clear, descriptive commit messages
   - Follow conventional commits format:
     - `feat:` for new features
     - `fix:` for bug fixes
     - `docs:` for documentation
     - `test:` for test additions/changes
     - `refactor:` for code refactoring
     - `perf:` for performance improvements
     - `chore:` for maintenance tasks

5. **Push and create a merge request**
   ```bash
   git push origin feature/your-feature-name
   ```
   - Provide a clear description of changes
   - Reference any related issues
   - Ensure CI/CD pipeline passes

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Provide proper type annotations
- Avoid `any` types unless absolutely necessary
- Use interfaces over type aliases where appropriate

### React/Ink Components

- Follow React best practices
- Use functional components with hooks
- Keep components focused and reusable
- Add proper TypeScript props interfaces

### Testing

- Write tests for new functionality
- Maintain existing test coverage
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for public APIs
- Update CLAUDE.md for AI-specific guidance
- Include inline comments for complex logic

## Project Structure

```
platoV3/
├── src/
│   ├── cli.ts           # CLI entry point
│   ├── tui/             # Terminal UI components
│   ├── providers/       # Chat providers
│   ├── tools/           # Tool implementations
│   ├── memory/          # Memory system
│   ├── commands/        # Custom commands
│   └── __tests__/       # Test files
├── scripts/             # Utility scripts
├── docs/                # Documentation
└── .agent-os/           # Agent OS specifications
```

## Testing Requirements

- All new features must include tests
- Maintain minimum 80% code coverage
- Test both success and error cases
- Include integration tests for complex features

## Performance Considerations

- Input latency: <50ms
- Panel updates: <100ms
- Memory efficiency for large conversations
- Smooth scrolling at 60fps

## Accessibility

- Maintain WCAG 2.1 AA compliance
- Include proper ARIA labels
- Support keyboard navigation
- Test with screen readers

## Security

- Never commit credentials or tokens
- Validate all user inputs
- Follow secure coding practices
- Report security issues privately

## Questions?

If you have questions about contributing, feel free to:
- Open an issue for discussion
- Check the Wiki for additional documentation
- Review existing merge requests for examples

## License

By contributing to Plato, you agree that your contributions will be subject to the project's proprietary license. The copyright holder retains all rights to contributions.

---

Thank you for contributing to Plato! Your efforts help make this project better for everyone.