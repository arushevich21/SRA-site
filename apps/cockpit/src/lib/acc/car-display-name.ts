import { accCarModelName } from '@sra/domain';

// The display name for a car on a leaderboard row.
//
// Every ACC board table carries both a numeric car_model_id and a car_model
// string written by the ingest/bot that produced the row. The string is not
// reliable for display: ACC ships distinct car_model_ids under one plain
// name, and the writers store that plain name — id 1 (the 2015 Mercedes-AMG
// GT3) and id 25 (the 2020 Evo) both land as "Mercedes-AMG GT3", so a driver
// with a lap in each shows two rows that look identical. Resolve the name
// from the id instead (ACC_CAR_MODEL_NAMES disambiguates them), same
// reasoning as tracks.ts's resolveCarGroup deriving class from the id rather
// than trusting a persisted column: a naming correction then takes effect
// everywhere immediately, with no stored rows to backfill.
//
// Falls back to the stored string when the id is null or newer than the
// handbook table (accCarModelName returns null) — better a plain name than
// none.
export function accCarDisplayName(
  carModelId: number | null | undefined,
  storedName: string | null | undefined,
): string | null {
  return (carModelId != null ? accCarModelName(carModelId) : null) ?? storedName ?? null;
}
