# ADR 0002 — Monorepo with pnpm Workspaces

**Status:** Accepted

## Context

The SRA Control Center system consists of multiple distinct concerns: a GridOS API client, shared type definitions, pure domain logic, a persistence layer, a backend API, and a frontend cockpit. These could be separate repositories, a single application, or a monorepo.

## Decision

We use a **single pnpm monorepo** with workspace packages under `packages/` and `apps/`. TypeScript project references (`tsc --build`) provide incremental compilation across packages.

## Consequences

- **Positive:** A single import (`@sra/shared-types`) provides the type contract to every package without publishing to npm or managing inter-repo versioning.
- **Positive:** Atomic commits span multiple packages — a breaking type change in `shared-types` and the corresponding fix in `domain` land in one PR.
- **Positive:** A single `pnpm install` at the root gives all collaborators a working environment.
- **Positive:** CI is a single workflow that lints, typechecks, and tests everything in one run.
- **Negative:** The monorepo grows in complexity as packages are added; disciplined CODEOWNERS enforcement is needed to prevent cross-package coupling.
- **Negative:** `tsc --build` with project references requires all `tsconfig.json` files to declare `composite: true` and explicit `references` arrays.
