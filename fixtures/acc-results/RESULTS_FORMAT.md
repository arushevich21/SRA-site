# ACC Result JSON Format

Notes on the raw Assetto Corsa Competizione (ACC) dedicated-server result files
in this directory. These are the native files ACC's server writes per session as pulled directly fromm ACCSM.

The following data are from SRA TS S18 D1 Rd.8 at Nurburgring GP.

Fixtures: one file per session, filename = `SessionFile` value =
`<YYMMDD>_<HHMMSS>_<sessionType>` (e.g. `260616_224355_R.json`).

## Top-level fields

```jsonc
{
  "sessionType": "R",          // "FP" (Free Practice) | "Q" (Qualify) | "R" (Race)
  "trackName": "nurburgring",
  "serverName": "#SRAggTT | Division 1 | Season 18 | GT3 Team Championship | ...",
  "Date": "2026-06-16T22:43:55Z",
  "SessionFile": "260616_224355_R",
  "metaData": "championship:<championshipGuid>:<seasonGuid>",
  "raceWeekendIndex": 0,
  "sessionIndex": 2,
  "laps": [ /* flat per-lap log, see below */ ],
  "penalties": [],              // empty in all 3 fixtures — shape unverified
  "post_race_penalties": [],    // empty in all 3 fixtures — shape unverified
  "sessionResult": { /* classification, see below */ }
}
```

- `metaData` encodes the championship + season GUIDs as a colon-delimited
  string, not a structured object.
- `penalties` / `post_race_penalties` presumably hold steward-issued time/grid
  penalties, but every fixture we have is empty — treat the shape as unknown
  until a file with real entries turns up.

## `laps[]` — flat per-lap log

One entry per completed lap, across all cars, in session order (not grouped
by car).

```jsonc
{
  "carId": 1010,
  "driverIndex": 0,        // which driver of a multi-driver car set this lap
  "isValidForBest": true,  // ACC's own track-limits/cut validity flag
  "laptime": 116575,       // ms
  "splits": [56930, 42857, 16787]  // 3 sector times, ms
}
```

- `isValidForBest` is a pre-resolved boolean from ACC itself — no bitmask
  decoding needed (contrast with AC Evo's `flags & 1`).
- Formation laps / out-laps / laps with a car retiring mid-lap can produce
  very large `laptime` outliers (seen up to ~1.24M ms in the race fixture) —
  don't assume `laptime` is always a plausible racing lap; validity/outlier
  filtering should still gate anything computed from this array.
- `carId` here is ACC's server-assigned numeric car slot for the session, not
  a persistent identity — cross-reference via `sessionResult` to resolve to a
  driver/team.

## `sessionResult` — the classification

```jsonc
{
  "type": 1,
  "isWetSession": 0,
  "bestlap": 113610,               // session-wide fastest lap, ms
  "bestSplits": [ ... ],           // session-wide fastest sectors, ms
  "leaderBoardLines": [ /* one per car, already in finishing/session order */ ]
}
```

`leaderBoardLines[0]` is always the session winner / pole-sitter / practice
P1 — the array is pre-sorted, same principle as AC Evo's `driver_standings`
being authoritative rather than something to re-derive from lap times.

### `leaderBoardLines[]` entry

```jsonc
{
  "car": {
    "carId": 1010,
    "carModel": 8,           // numeric ACC car model ID, not a name
    "carGroup": "GT3",
    "carGuid": -1,
    "teamGuid": -1,
    "cupCategory": 0,       // numeric driver category, 0 - Pro/Overall, 2- AM, 3 - Silver 
    "raceNumber": 747,
    "teamName": "",
    "drivers": [
      {
        "firstName": "Mr",
        "lastName": "Sir",
        "playerId": "S76561199227704358",  // "S" + SteamID64
        "shortName": "NRE"
      }
      // more than one entry for multi-driver / endurance cars
    ]
  },
  "currentDriver": { /* same shape as a drivers[] entry */ },
  "currentDriverIndex": 0,     // index into car.drivers[] of who was driving at session end
  "driverTotalTimes": [3610371],  // per-driver stint time, ms — index-matched to car.drivers[]
  "missingMandatoryPitstop": 0,   // 1 if a required pit stop was skipped (race only)
  "timing": {
    "bestLap": 113610,
    "bestSplits": [54700, 42627, 16850],
    "lapCount": 31,
    "lastLap": 115790,
    "lastSplitId": 0,
    "lastSplits": [ ... ],
    "totalTime": 3610371       // ms
  }
}
```

## Driver identity

`playerId` is the stable cross-system identity anchor, same role as AC Evo's
`player_id`, but formatted differently:

| | ACC | AC Evo |
|---|---|---|
| Identity field | `car.drivers[].playerId` | `drivers[].player_id` |
| Format | `"S" + SteamID64"` (e.g. `S76561199227704358`) | bare SteamID64 |
| Name fields | plain `firstName` / `lastName` / `shortName` | `first_name` / `last_name` / `nickname` |
| Name precedence logic needed? | No — no nickname-vs-real-name ambiguity | Yes — parser prefers real name over nickname, falls back to "Unknown" |

**Strip the leading `S` before treating `playerId` as a SteamID64** if
cross-referencing against AC Evo data or any store keyed on bare SteamID.
`parseAccSession()` (`packages/domain/src/acc-parser.ts`) does this via
`stripSteamPrefix()`.

## Car ↔ driver linkage

Unlike AC Evo (where the only driver→car link is inferred from
`laps[].driver_key` + `laps[].car_key`), ACC's `leaderBoardLines[].car`
directly nests its `drivers[]` array — no indirection needed to know which
driver(s) piloted which car.

## Session-type differences

| Field | FP / Q | R |
|---|---|---|
| `sessionResult.leaderBoardLines[].timing.lapCount` | practice/quali lap count | race lap count |
| `missingMandatoryPitstop` | always `-1` (not applicable) — parser normalizes to `null` | `0`/`1` — parser normalizes to `false`/`true` |
| `driverTotalTimes` | always `[]` in both fixtures we have | `[<float ms>]`, one entry per car (e.g. `[3548661.5]`) — note it's a **float**, unlike every other timing field, which is an int |
| `laps[].laptime` outliers | fewer (no pit stops/incidents mid-race) | frequent (pit stops, incidents, DNFs inflate laptime) |

All three fixtures share the same `sessionResult` shape (`bestSplits`,
`bestlap`, `isWetSession`, `leaderBoardLines`, `type`) regardless of session
type — no per-type schema variation observed.

## Parser implementation: `acc-parser.ts` vs `ac-evo-parser.ts`

Both live in `packages/domain`, share the same shape (raw JSON in →
normalized `*SessionResult` out, pure, no I/O), and both trust the source's
own ordering (`leaderBoardLines` / `driver_standings`) rather than
re-deriving finishing order from lap times. Where they diverge:

| | AC Evo | ACC |
|---|---|---|
| Best lap computation | **Computed** by the parser — reduces over the flat `laps[]` array, filtering invalid laps via `isValidLap()` (`flags & 1`), picking the min | **Read directly** off `sessionResult.leaderBoardLines[].timing.bestLap` — ACC's server has already aggregated it per driver |
| "No time set" representation | `time_standings` entry is `0` | Int32-max sentinel `2147483647` on `bestLap`/`lastLap`/`totalTime`/`bestSplits`; a **different**, uint32-max sentinel (`4294967295`) on `timing.lastSplitId` (not currently parsed — would need its own sentinel constant if ever exposed) |
| Multi-driver / endurance cars | Not modeled (1 driver per car in the AC Evo fixtures) | Modeled: `drivers[]` array + `currentDriverIndex`/`currentDriverSteamId` — but **untested against real fixtures**, since every car in all 3 ACC fixtures has exactly 1 driver; the multi-driver path is only exercised by hand-built test fixtures |
| Human-readable lookups | None needed — car model already a string (e.g. `"Mazda MX-5 ND Cup"`) | `carModel`/`cupCategory` are opaque integer IDs — resolved via `acc-constants.ts` (`accCarModelName()`/`accCupCategoryName()`, transcribed from the Server Admin Handbook IX.3/IX.5). One real ID (`carModel: 36`) appears in all 3 fixtures but isn't in the handbook table — resolves to `carModelName: null`, raw ID preserved |
| Input validation / exception handling | None — casts `raw as RawSession` and trusts the shape | Same posture — no validation. Neither parser throws a clean domain error on malformed input; both would surface a raw `TypeError` from deep inside the mapping callback. Exception handling instead lives at the orchestration boundary (see `acevo-hotlaps.ts`'s per-session `try`/`catch` in `runIncrementalRefresh()`) — there's no ACC-equivalent pipeline yet, so this boundary doesn't exist for ACC today |
| Session-type source values | `'Race' \| 'Qualify' \| 'Practice'` used close to as-is | Abbreviated (`'FP' \| 'Q' \| 'R'`), explicitly mapped via `mapSessionType()` to the same vocabulary; the fallback branch for an unrecognized value is untested against real data (all 3 fixtures are exactly `FP`/`Q`/`R`) |
| Live pipeline wiring | Fully wired: `EmperorClient` → `parseAcEvoSession` → `aggregateHotLapLeaderboard`/points → Supabase cache, driven by cron + on-demand refresh | **Not wired to anything** — `parseAccSession` exists only as a pure function with fixture-based tests; no ACC equivalent of `acevo-hotlaps.ts` exists yet |
