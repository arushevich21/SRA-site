# Points Engine — GT3 Team Series

> Deterministic per-driver and per-team championship scoring. Pure function: adjusted
> classification in → standings out. No I/O. Lives in `packages/domain`.
>
> All rules below are ratified. Two items remain genuinely open but are **non-blocking**
> (flagged inline): the ultimate-tie fallback and mid-season roster changes.

## Pipeline position

Consumes the **adjusted** classification (after steward penalties / DQs are applied via
the ledger + overrides), never raw SimGrid finishing order.

```
adjusted classification (per round, per division/split)
  → driver round scores
  → driver season totals (with per-driver drop)
  → team season totals (sum of the two drivers' season totals)
  → tiebreakers
  → standings → audit snapshot (+ ruleset version)
```

## Inputs (per round, per division/split)

- Ordered finishing classification: driver → finishing position.
- Best-qualifying-lap setter for the split.
- Fastest-race-lap setter for the split.
- Team roster: which two drivers belong to which team.

## Position points (P1–P40)

| Pos | Pts | Pos | Pts | Pos | Pts | Pos | Pts |
|----:|----:|----:|----:|----:|----:|----:|----:|
| 1  | 110 | 11 | 57 | 21 | 33 | 31 | 13 |
| 2  | 100 | 12 | 54 | 22 | 31 | 32 | 11 |
| 3  | 92  | 13 | 51 | 23 | 29 | 33 | 9  |
| 4  | 85  | 14 | 48 | 24 | 27 | 34 | 7  |
| 5  | 80  | 15 | 45 | 25 | 25 | 35 | 6  |
| 6  | 76  | 16 | 43 | 26 | 23 | 36 | 5  |
| 7  | 72  | 17 | 41 | 27 | 21 | 37 | 4  |
| 8  | 68  | 18 | 39 | 28 | 19 | 38 | 3  |
| 9  | 64  | 19 | 37 | 29 | 17 | 39 | 2  |
| 10 | 60  | 20 | 35 | 30 | 15 | 40 | 1  |

Positions 41 and beyond score **0**.

## Bonuses

- **Fastest Race Lap:** +1 to the driver who set it in the split.
- **Best Qualifying Lap:** +1 to the driver who set it in the split.
- No additional conditions — the setter need not finish or be classified.

## Driver round score

`round score = position points (by finishing position in the driver's division/split) + bonuses earned that round`

- A driver not classified (DNF / DNS) scores **0** for the round.
- For a driver to score points for the race (even while DNF'ing), they must complete 75% of the race distance. Meaning, if the race is 60 minutes long, they must complete 45 minutes of laps in that race.

## Driver season total — with drop

- Each driver drops their **single worst event total** (position points + that round's bonuses).
- `season total = sum of the best (N − 1) of N rounds`. 8-round season → best 7 of 8.
- The drop is applied to the **event total**, never to individual components.

## Driver tiebreaker — countback

If two drivers are level on points, rank by count back of best finishing positions:

1. Most wins (1st-place finishes)
2. then most 2nds, then 3rds, … down the positional ladder.

- Countback uses finishing positions from **all** rounds, including the dropped round.
- **Ultimate fallback (OPEN, non-blocking):** if still exactly tied after the full
  countback, default to best finish in the **most recent round**, then registration order
  as a last deterministic resort. Organizers may override this default — the engine just
  needs *some* deterministic rule, and a full-season identical record is rare.

## Team round score

`team round score = driver A round score + driver B round score`

- In a round where a team fields only one driver, the team scores that driver's points and
  the absent driver contributes 0.

## Team season total — with drop

Each driver drops **their own** single worst event independently; the team total is the
sum of both drivers' post-drop season totals:

`team total = driverA.seasonTotal + driverB.seasonTotal`  (each already best-7-of-8)

This is **not** a single team-level drop of the worst *combined* round. No separate
team-drop logic — the team is purely the sum of two per-driver results.

- **Roster changes (OPEN, non-blocking):** the engine scores the team's two registered
  drivers. Mid-season subs / 3rd drivers (no individual analog) are a roster/eligibility
  concern; if allowed, define whose points count there. Engine default: only the two
  registered drivers score for the team.

## Team tiebreaker

Same full positional countback as the driver tiebreaker, computed on the team's **pooled
driver finishing positions** (both drivers' results across all rounds):

1. Most pooled wins, 2. then pooled 2nds, 3. then 3rds, … down the ladder.

(Wording note: "most wins, then most podiums" is encoded as this same positional ladder,
consistent with "same as individual." Revisit if a coarser wins-then-total-podiums rule
was intended.)

## Output (per division/split)

- **Driver standings:** sorted by season total, ties broken by countback; dropped round identified per driver.
- **Team standings:** sorted by team total, ties broken by team countback; dropped round identified per driver.
- Reference to the **audit snapshot** computed from, and the **ruleset version**.

## Test scenarios to author (Step 2, test-first)

- exact position points for a clean finishing order (spot-check P1, P10, P40, P41→0)
- both bonuses awarded and added correctly
- DNF/DNS scores 0 and is the natural drop candidate
- driver drop: best 7 of 8, worst event total removed
- team round score = sum of two drivers
- team total = sum of each driver's independent best-7 (different dropped rounds per driver)
- one-driver round scores the single driver only
- driver countback: equal points → more wins ranks higher; then 2nds, etc.
- team countback: equal points → more pooled wins; then pooled 2nds, etc.
- ultimate fallback: identical countback resolved deterministically by most-recent-round