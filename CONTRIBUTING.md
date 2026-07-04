# Contributing to Guiguzi

Thank you for your interest in contributing to Guiguzi!

## Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** >= 9

## Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/your-org/guiguzi.git
   cd guiguzi
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

## Development

Build all packages:

```bash
pnpm build
```

Run all tests:

```bash
pnpm test
```

Run linting:

```bash
pnpm lint
```

Run type checking:

```bash
pnpm typecheck
```

Run in development mode (watch):

```bash
pnpm dev
```

## Pull Request Process

1. Fork the repository and create your branch from `main`.
2. Make your changes and ensure all tests pass (`pnpm test`).
3. Run linting and type checking (`pnpm lint && pnpm typecheck`).
4. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/).
5. Push to your fork and open a pull request against `main`.
6. Wait for CI to pass and request a review.

## Code Style

- TypeScript is used throughout the monorepo.
- Follow the existing code style and conventions.
- Keep packages focused and avoid circular dependencies.

## Reporting Issues

Open an issue on GitHub with a clear description, reproduction steps, and expected behavior.
