# ADR 0001 — Normalized View Models

**Status:** Accepted

## Context

SimGrid's GridOS API returns race results, entries, and driver data in its own payload shape, tied to SimGrid's internal data model. If every package manipulates raw GridOS payloads directly, a shape change in the GridOS API (a field rename, a restructured nested object, a new pagination scheme) requires changes across the entire codebase. Additionally, the domain logic (points engine, penalty ledger) would become coupled to a third-party API contract we do not control.

## Decision

We introduce **Normalized View Models** (NVMs) — our internal TypeScript interfaces — defined in `packages/shared-types`. The `packages/simgrid-client` package is the only module that consumes raw GridOS payloads. It translates them into NVMs at the boundary and returns NVMs to all callers. No other package ever sees a raw GridOS payload.

This is an application of the **Anti-Corruption Layer** pattern (DDD).

## Consequences

- **Positive:** GridOS API changes are isolated to `simgrid-client`. Domain logic, the API layer, and the cockpit all depend on stable internal types.
- **Positive:** Domain logic (`packages/domain`) can be tested purely against NVMs using hand-authored fixtures, with no live API dependency.
- **Positive:** `packages/shared-types` becomes the explicit, reviewable contract for the whole system. CODEOWNERS enforcement ensures changes are deliberate.
- **Negative:** An additional translation step exists at the simgrid-client boundary. This must be maintained as GridOS evolves.
- **Negative:** Divergence between NVMs and GridOS payloads must be caught by integration tests or by updating simgrid-client when GridOS changes.
