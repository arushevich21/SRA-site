"""
AC Evo (Assetto Corsa Evo) result parser.

Takes a raw AC Evo session result JSON (as exported from the Emperor Servers
dashboard) and produces a clean, normalized SESSION RESULT.

One input file = one session (Practice / Qualify / Race).
Aggregating multiple sessions/rounds into championship standings is a separate
step handled by the scoring layer, not here.

Key format notes (learned from real files):
- Driver & car identity is a {a, b} GUID pair; we key on the "a:b" string.
- `player_id` on each driver IS the SteamID -> the stable cross-system identity.
- `driver_standings` is the authoritative FINISHING ORDER (P1 first). Do NOT
  re-derive order from times: for races, classification is lap-count-first
  (more laps finishes ahead even with a larger total time), and the file
  already encodes the correct order here.
- `time_standings` is parallel (index-matched) to `driver_standings`:
    * Race    -> total elapsed time (ms) for that driver
    * Qualify -> best lap time (ms); 0 means no valid time set
    * Practice-> often 0 / not meaningful
- `laps` is a flat list across all drivers; each lap has driver_key, time,
  split[], and a `flags` field (validity/in-out lap encoding - TODO confirm
  exact meaning with more samples).
"""

import json
import sys
from collections import defaultdict


def gkey(g):
    """Normalize a {a, b} GUID pair into a stable string key."""
    return f"{g['a']}:{g['b']}"


def ms_to_laptime(ms):
    """Convert milliseconds to M:SS.mmm, or None for 0/missing."""
    if not ms:
        return None
    total_s, millis = divmod(ms, 1000)
    minutes, seconds = divmod(total_s, 60)
    return f"{minutes}:{seconds:02d}.{millis:03d}"


def parse_session(raw):
    session_type = raw.get("session_type", "Unknown")

    # --- driver lookup, keyed by GUID pair ---
    drivers = {gkey(d["guid"]): d for d in raw.get("drivers", [])}

    # --- laps grouped by driver, in order ---
    laps_by_driver = defaultdict(list)
    for lap in raw.get("laps", []):
        laps_by_driver[gkey(lap["driver_key"])].append(lap)

    # --- car / starting position lookup ---
    # car_standings holds starting_position; cars[] holds model + race_number.
    # IMPORTANT FORMAT LIMITATION: the file contains NO explicit driver->car
    # mapping. The car_standings / cars / driver_standings / drivers arrays are
    # all in different orders with no cross-reference field. The ONLY place a
    # driver is linked to a car is inside the `laps` array (lap.driver_key +
    # lap.car_key). Therefore a driver who completed ZERO laps cannot be mapped
    # to a car from this file alone (their car/startPos will be null). That's a
    # DNS-type case where the car assignment is moot for scoring anyway; we flag
    # it explicitly with "noLaps": true rather than silently nulling.
    driver_to_car = {}
    for lap in raw.get("laps", []):
        driver_to_car[gkey(lap["driver_key"])] = gkey(lap["car_key"])

    car_meta = {}
    for c in raw.get("cars", []):
        car_meta[gkey(c["car_id"])] = {
            "model": c.get("model_displayname"),
            "raceNumber": c.get("race_number"),
        }
    start_pos = {}
    for cs in raw.get("car_standings", []):
        start_pos[gkey(cs["car_id"])] = cs.get("starting_position")

    # --- finishing order (authoritative) ---
    finishing = raw.get("driver_standings", [])
    times = raw.get("time_standings", [])

    results = []
    for pos, g in enumerate(finishing, start=1):
        k = gkey(g)
        d = drivers.get(k, {})
        driver_laps = laps_by_driver.get(k, [])

        # best lap = min positive lap time
        lap_times = [l["time"] for l in driver_laps if l.get("time")]
        best_lap_ms = min(lap_times) if lap_times else None

        raw_time = times[pos - 1] if pos - 1 < len(times) else None

        car_key = driver_to_car.get(k)
        meta = car_meta.get(car_key, {}) if car_key else {}

        entry = {
            "position": pos,
            "driverName": (d.get("nickname")
                           or f"{d.get('first_name','')} {d.get('last_name','')}".strip()
                           or "Unknown"),
            "firstName": d.get("first_name"),
            "lastName": d.get("last_name"),
            "steamId": d.get("player_id"),      # <- stable identity anchor
            "nation": d.get("nation"),
            "carModel": meta.get("model"),
            "raceNumber": meta.get("raceNumber"),
            "startingPosition": (start_pos.get(car_key) if car_key else None),
            "lapsCompleted": len(driver_laps),
            "noLaps": len(driver_laps) == 0,
            "bestLapMs": best_lap_ms,
            "bestLap": ms_to_laptime(best_lap_ms),
        }

        # session-type-specific time semantics
        if session_type == "Race":
            entry["totalTimeMs"] = raw_time
        elif session_type == "Qualify":
            # qualifying time_standings = best lap; 0 = no time
            entry["qualifyingBestMs"] = raw_time or None
            entry["qualifyingBest"] = ms_to_laptime(raw_time)
            entry["setValidTime"] = bool(raw_time)

        results.append(entry)

    return {
        "sessionType": session_type,
        "sessionName": raw.get("session_name"),
        "track": raw.get("track_name"),
        "trackLayout": raw.get("track_layout_name"),
        "serverName": raw.get("server_name"),
        "seasonGuid": raw.get("season_guid"),
        "championshipId": gkey(raw["championship_id"]) if raw.get("championship_id") else None,
        "isCompleted": raw.get("is_completed"),
        "serverStartTime": raw.get("server_manager", {}).get("server_start_time"),
        "results": results,
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_acevo.py <result.json> [more.json ...]")
        sys.exit(1)
    for path in sys.argv[1:]:
        raw = json.load(open(path))
        parsed = parse_session(raw)
        out_path = path.replace(".json", "_parsed.json")
        json.dump(parsed, open(out_path, "w"), indent=2)
        print(f"Parsed {path} -> {out_path}")
        print(json.dumps(parsed, indent=2))
        print("=" * 60)


if __name__ == "__main__":
    main()
