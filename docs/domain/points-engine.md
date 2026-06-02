# Points Engine

**Pipeline position:** consumes the **adjusted** classification (after steward time penalties / DQs are applied), NOT raw SimGrid finishing order.

```
SimGrid raw results
  → apply steward penalties/DQs/overrides   (from the ledger + overrides store)
  → adjusted classification
  → points engine  (this spec)
  → drop rounds + tiebreakers
  → standings  → audit snapshot
```

Inputs: adjusted classification per division+split, pole sitter, fastest-lap setter.

## Rules

**filled = known, TODO = confirm from the championship tracker "points reference tab" + an organizer huddle:**

- **Position points table** — TODO (exact array per position).
- **Pole bonus** — TODO confirm value/conditions (Endurance used +5).
- **Fastest-lap bonus** — TODO confirm value + conditions (valid lap? must finish? must be classified?).
- **Team aggregation** — TODO: two drivers per team — sum both, best of two, both must finish?
- **Drop rounds** — TODO: count varies per series (GT3 Team Series TBD; League in a Week = 3; Manufacturers Cup = 1); confirm whether bonuses count toward drop math.
- **Tiebreaker chain** — TODO: not published anywhere. This is the classic undocumented gap — pin it down explicitly.

## Output

Standings table + reference to the audit snapshot it was computed from + ruleset version.
