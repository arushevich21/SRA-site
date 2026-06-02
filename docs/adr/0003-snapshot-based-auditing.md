# ADR 0003 — Snapshot-Based Auditing for Standings

**Status:** Accepted

## Context

League standings must be auditable. Race directors need to answer: "What were the standings after Round 3, computed under ruleset v1.2, before Round 4's penalty appeal was resolved?" Recomputing standings on demand from live GridOS data is non-deterministic: GridOS results can be corrected, pagination can change, and the penalty ledger evolves. A recomputed answer today may differ from the answer published last week.

Additionally, the points engine ruleset itself may change between seasons. We need to know which ruleset version produced a given standings table.

## Decision

After each scoring run, we **persist an immutable snapshot**: the adjusted classification (inputs), the ruleset version used, and the resulting standings table (output). The `packages/store` layer owns snapshot storage. The `packages/domain` points engine is a pure function — identical inputs always produce identical outputs — so a stored snapshot is a reproducible audit record.

Standings are **never recomputed silently**. If a penalty is overturned after publication, the operator must explicitly trigger a new scoring run, which produces a new versioned snapshot.

## Consequences

- **Positive:** Full audit trail: every published standings table traces to an exact input snapshot and ruleset version.
- **Positive:** Appeals and retroactive corrections are handled explicitly, not by silently mutating history.
- **Positive:** The domain package can be tested against stored fixtures — CI is deterministic and never calls the live API.
- **Negative:** Storage grows with each scoring run. Snapshots are append-only and must be retained for the season.
- **Negative:** The operator workflow requires an explicit re-score action after corrections, rather than automatic recalculation.
