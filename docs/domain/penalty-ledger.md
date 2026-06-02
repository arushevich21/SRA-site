# Penalty Ledger

A per-driver license ledger over a rolling window. Inputs are the stewards' rulings (human decisions captured via the overrides layer). The ledger does not make rulings; it tracks consequences.

## Known rules to encode

- **Warnings:** 2 warnings within a span of 2 races → 1 penalty point (pp).
- **PP lifespan:** 8-race rolling window, carrying across seasons.
- **Consecutive-race accrual:** 2 pp infractions in the same or consecutive races → +1 additional pp.
- **Thresholds, each administered once per season:** 4pp = qualifying ban, 6pp = pit-lane start, 8pp = race ban, 10pp = season ban. PP are NOT cleared after a penalty is served.
- **Serving:** a future-race penalty stays active for 2 races; cleared if the driver skips 2 races; does not roll into the next season; must be served *in attendance* (skipping a race ≠ serving). Stacked bans are served across multiple races.
- **Lap-1 incidents:** escalate the penalty one tier; classified `L1AUTO`.
- **Returning position:** downgrades the time penalty, retains any pp, removes the extra warning.
- **Season-ban return / probation:** ban in the first 4 races → minimum 2 races out and stay out until pp < 10, then probation; probation = must not accumulate 3pp in the first 4 races back, else another season ban.
- **Qualifying penalties (separate track):** 2 qualifying warnings in a season → qualifying ban next race; no pp applied.

## Output

Each driver's current pp total, active bans, and eligibility flags for upcoming races (feeds eligibility checks in `domain`).

> Everything in Rules & Regs Section 5 (overlap, defending, blue flags, rejoins) and the steward's tier decision itself is **human judgment — not modeled here**. The app records and applies those rulings; it never computes them.
