# Contributing to SRA Control Center

## Setup

1. Clone the repository and `cd` into it.
2. Install [pnpm](https://pnpm.io/) v9+ and [Node.js](https://nodejs.org/) v20+.
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Copy the environment template and fill in your values:
   ```bash
   cp .env.example .env
   ```
5. Run the test suite to confirm everything works:
   ```bash
   pnpm test
   ```

## Prerequisite: gitleaks

This project uses [gitleaks](https://github.com/gitleaks/gitleaks) as a pre-commit hook to prevent secrets from being committed. Install it before making commits.

- **macOS:** `brew install gitleaks`
- **Windows:** `choco install gitleaks` or download from the [releases page](https://github.com/gitleaks/gitleaks/releases)
- **Linux:** download from the [releases page](https://github.com/gitleaks/gitleaks/releases) and add to your PATH

After installing, the pre-commit hook scans staged files automatically on every commit. If you trigger a false positive, see the [gitleaks docs](https://github.com/gitleaks/gitleaks#configuration) for `.gitleaksignore` usage.

## Workflow

- **Branch:** create a short-lived feature branch from `main` (`feat/my-thing`, `fix/bug-name`).
- **Commit:** use [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `chore:`, `docs:`, `test:`.
- **PR:** open a pull request against `main`. Fill in the PR template.
- **Merge:** squash-merge only. No direct pushes to `main`.

## Commit message examples

```
feat(domain): add penalty ledger state machine
fix(api): handle 429 rate-limit from GridOS
chore: update vitest to 2.1.0
docs(adr): add ADR-0004 for Discord integration
test(domain): add fixtures for consecutive-race PP accrual
```

## Test-first on domain

The `packages/domain` package is pure (no network, no DB). All new domain logic must have tests before or alongside the implementation. Use hand-authored fixtures in `fixtures/` — CI never calls the live GridOS API.

## Secrets discipline

- The GridOS API key **never** goes in the repo, Slack, or Discord.
- Use `.env` (git-ignored). Never commit `.env` — only `.env.example`.
- If you accidentally stage a secret, `git restore --staged <file>` before committing.
- gitleaks blocks commits containing detected secrets, but prevention is better than detection.
