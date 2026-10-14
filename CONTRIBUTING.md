# Contributing to Shard.js

Thank you for your interest in contributing to Shard.js! This document outlines the development workflow, coding guidelines, and pull request process.

---

## 1. Project Philosophy & Core Constraints

- **Zero External Discord Wrappers**: Shard.js is a completely standalone framework. No dependencies on `discord.js`, `@discordjs/*`, or `discord-api-types` at runtime.
- **Node.js Standards**: Use modern Web Standards (`fetch`, `Request`, `Response`, `Headers`) and Node.js built-ins (`node:http`, `node:crypto`, `node:zlib`).
- **Strict TypeScript**: Avoid `any` where possible; ensure strict type safety across all packages.
- **Security First**: Validate all user and gateway input, sanitize child process arguments, enforce rate limits, and use constant-time operations for secrets.

---

## 2. Development Setup

### Prerequisites

- **Node.js**: >= 18.0.0 (LTS 20 or 22 recommended)
- **pnpm**: >= 9 (or managed via Corepack)

```bash
# Clone repository
git clone https://github.com/Shard-js/Framework.git
cd Framework

# Install dependencies with pnpm
pnpm install

# Build all workspace packages
pnpm run build

# Run test suite
pnpm run test

# Run type checking across the entire monorepo
pnpm run typecheck
```

---

## 3. Monorepo Workflow

Shard.js uses **Turborepo** for workspace orchestration:

- `pnpm run build`: Builds all packages via `tsup`.
- `pnpm run dev`: Watches and rebuilds packages on change.
- `pnpm run typecheck`: Runs `tsc --noEmit` across all workspace packages.
- `pnpm run test`: Runs the Vitest test suite.

---

## 4. Coding & Commit Standards

### Conventional Commits

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat(scope): ...` for new features
- `fix(scope): ...` for bug fixes
- `docs(scope): ...` for documentation changes
- `test(scope): ...` for adding or updating tests
- `refactor(scope): ...` for code refactoring

### Regression Testing

Every bug fix or feature PR **must** include regression tests in the respective `packages/<package>/test/` directory.

---

## 5. Security & Vulnerability Reporting

If you discover a security vulnerability within Shard.js, please do not file a public issue. Follow GitHub's Private Vulnerability Reporting or contact the maintainers directly.
