import { SIM_CATALOG } from './sim-catalog';

// Config for the Custom BoP editor. The grid is ACC tracks (rows) × GT3 car
// models (columns), matching the ACCSM bop.json shape.

export const BOP_BALLAST_MIN = -40;
export const BOP_BALLAST_MAX = 40;
export const BOP_RESTRICTOR_MIN = 0;
export const BOP_RESTRICTOR_MAX = 40;

// GT3 car models that appear in ACC BoP, as carModel ids. Display names come
// from accCarModelName() so headers always match the game's own naming.
export const BOP_CAR_MODELS: number[] = [
  5, 6, 7, 8, 12, 13, 14, 15, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36,
];

// Rows: reuse the ACC catalog tracks (every one carries an accTrackKey).
export const BOP_TRACKS: { key: string; displayName: string }[] =
  SIM_CATALOG.ACC.tracks
    .filter((t) => t.accTrackKey)
    .map((t) => ({ key: t.accTrackKey as string, displayName: t.displayName }));

export function clampBallast(n: number): number {
  return Math.max(BOP_BALLAST_MIN, Math.min(BOP_BALLAST_MAX, Math.trunc(n)));
}
export function clampRestrictor(n: number): number {
  return Math.max(BOP_RESTRICTOR_MIN, Math.min(BOP_RESTRICTOR_MAX, Math.trunc(n)));
}
