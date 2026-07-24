import 'server-only';
import { accCarModelName, accCarManufacturerLogoUrl } from '@sra/domain';
import { supabase } from './supabase';
import { BOP_CAR_MODELS, BOP_TRACKS } from '@/content/bop';
import { BOP_DATA, MANUFACTURER_LOGOS } from '@/content/custom-bop';

// Public Custom BoP view data. Sourced from the admin-edited bop_entries table
// so the About page always reflects the admin tool. Falls back to the in-repo
// static BOP_DATA when the table is empty/unreachable, so the page never blanks
// before an admin has published (same graceful-degradation as championships).

export type PublicBopCar = { name: string; logo: string | null };

export type PublicBop = {
  cars: PublicBopCar[];
  tracks: string[];
  ballast: (number | null)[][]; // [carIdx][trackIdx]; null = no change ("-")
  restrictor: (number | null)[][];
  source: 'db' | 'static';
};

export async function getPublicBop(): Promise<PublicBop> {
  const { data, error } = await supabase
    .from('bop_entries')
    .select('track, car_model, ballast_kg, restrictor');

  if (error || !data || data.length === 0) {
    return {
      cars: BOP_DATA.cars.map((name) => ({ name, logo: MANUFACTURER_LOGOS[name] ?? null })),
      tracks: BOP_DATA.tracks,
      ballast: BOP_DATA.ballast,
      restrictor: BOP_DATA.restrictor,
      source: 'static',
    };
  }

  const byKey = new Map<string, { b: number; r: number }>();
  for (const e of data) {
    byKey.set(`${e.track}:${e.car_model}`, {
      b: e.ballast_kg as number,
      r: e.restrictor as number,
    });
  }

  const cars: PublicBopCar[] = BOP_CAR_MODELS.map((id) => ({
    name: accCarModelName(id) ?? `Car ${id}`,
    logo: accCarManufacturerLogoUrl(id),
  }));
  const tracks = BOP_TRACKS.map((t) => t.displayName);

  // Per-field "no change" is a blank ("-"), so 0 in a field renders as null even
  // when the other field on that cell is set.
  const ballast = BOP_CAR_MODELS.map((id) =>
    BOP_TRACKS.map((t) => {
      const v = byKey.get(`${t.key}:${id}`);
      return v && v.b !== 0 ? v.b : null;
    }),
  );
  const restrictor = BOP_CAR_MODELS.map((id) =>
    BOP_TRACKS.map((t) => {
      const v = byKey.get(`${t.key}:${id}`);
      return v && v.r !== 0 ? v.r : null;
    }),
  );

  return { cars, tracks, ballast, restrictor, source: 'db' };
}
