# Contributing to oh-my-black

Thank you for your interest in contributing!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/black940514/oh-my-black.git
cd oh-my-black

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Run linter (`npm run lint`)
6. Verify metadata sync (`npm run sync-metadata:verify`)
7. Commit with conventional commits (`feat:`, `fix:`, `docs:`, etc.)
8. Push and create a Pull Request

## Code Style

- TypeScript strict mode
- ESLint configuration in `eslint.config.js`
- 80% test coverage required

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `chore:` Maintenance
- `refactor:` Code refactoring
- `test:` Adding tests

## Metadata Sync

This project uses automated metadata synchronization. Before committing:

```bash
npm run sync-metadata:verify
```

If verification fails:

```bash
npm run sync-metadata
```
