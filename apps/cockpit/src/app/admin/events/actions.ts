'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/require-admin';
import { supabase } from '@/lib/supabase';

// Structured payload the EventForm sends. Empty strings mean "unset" and are
// converted to NULL; numeric-ish strings are parsed. Kept as a plain object
// (not FormData) so the dynamic rounds array and string arrays serialize
// cleanly across the server-action boundary.
export type ChampionshipRoundInput = {
  round: number;
  track: string;
  raceLength: string;
  startsAt: string; // '' -> NULL (fully TBA); date-only or Eastern ISO otherwise
  emperorTrack: string;
  emperorRawTrackName: string;
};

export type ChampionshipInput = {
  id?: string; // present = update, absent = create
  slug: string;
  game: string;
  title: string;
  classTag: string;
  formatTag: string;
  eventType: 'championship' | 'exhibition';
  classes: string[];
  logoUrl: string;
  raceFormat: string;
  raceDays: string;
  rulesBullets: string[];
  discordLinks: { label: string; url: string }[];
  resultsUrl: string;
  resultsLabel: string;
  emperorChampionshipId: string;
  simgridId: string;
  standingsKey: string;
  registrationKey: string;
  registrationSeason: string;
  registrationOpen: boolean;
  maxTeamSize: string;
  allowedCars: string[];
  teaserOnly: boolean;
  concluded: boolean;
  sortOrder: number;
  rounds: ChampionshipRoundInput[];
};

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

const nullIfEmpty = (s: string): string | null => (s.trim() === '' ? null : s.trim());

function intOrNull(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toRow(input: ChampionshipInput) {
  return {
    slug: input.slug.trim(),
    game: input.game,
    title: input.title.trim(),
    class_tag: input.classTag.trim(),
    format_tag: nullIfEmpty(input.formatTag),
    event_type: input.eventType,
    classes: input.classes,
    logo_url: nullIfEmpty(input.logoUrl),
    race_format: input.raceFormat.trim(),
    race_days: nullIfEmpty(input.raceDays),
    rules_bullets: input.rulesBullets,
    discord_links: input.discordLinks,
    results_url: nullIfEmpty(input.resultsUrl),
    results_label: nullIfEmpty(input.resultsLabel),
    emperor_championship_id: nullIfEmpty(input.emperorChampionshipId),
    simgrid_id: intOrNull(input.simgridId),
    standings_key: nullIfEmpty(input.standingsKey),
    registration_key: nullIfEmpty(input.registrationKey),
    registration_season: nullIfEmpty(input.registrationSeason),
    registration_open: input.registrationOpen,
    max_team_size: intOrNull(input.maxTeamSize),
    allowed_cars: input.allowedCars.length > 0 ? input.allowedCars : null,
    teaser_only: input.teaserOnly,
    concluded: input.concluded,
    sort_order: input.sortOrder,
  };
}

function roundRows(championshipId: string, rounds: ChampionshipRoundInput[]) {
  return rounds
    .filter((r) => r.track.trim() !== '')
    .map((r) => ({
      championship_id: championshipId,
      round: r.round,
      track: r.track.trim(),
      race_length: r.raceLength.trim(),
      starts_at: nullIfEmpty(r.startsAt),
      emperor_track: nullIfEmpty(r.emperorTrack),
      emperor_raw_track_name: nullIfEmpty(r.emperorRawTrackName),
    }));
}

export async function saveChampionship(input: ChampionshipInput): Promise<SaveResult> {
  await requireAdmin();

  if (input.slug.trim() === '' || input.title.trim() === '' || input.classTag.trim() === '') {
    return { ok: false, error: 'Slug, title, and class tag are required.' };
  }

  const row = toRow(input);
  let championshipId: string;

  if (input.id) {
    const { error } = await supabase.from('championships').update(row).eq('id', input.id);
    if (error) return { ok: false, error: error.message };
    championshipId = input.id;
  } else {
    const { data, error } = await supabase
      .from('championships')
      .insert(row)
      .select('id')
      .single();
    if (error) {
      return {
        ok: false,
        error: error.code === '23505' ? `Slug "${row.slug}" is already in use.` : error.message,
      };
    }
    championshipId = data.id as string;
  }

  // Replace rounds wholesale (matches the seed script's approach).
  const { error: delErr } = await supabase
    .from('championship_rounds')
    .delete()
    .eq('championship_id', championshipId);
  if (delErr) return { ok: false, error: delErr.message };

  const rows = roundRows(championshipId, input.rounds);
  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('championship_rounds').insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidatePath('/', 'layout');
  return { ok: true, id: championshipId };
}

export async function deleteChampionship(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  // championship_rounds cascade-delete via the FK.
  const { error } = await supabase.from('championships').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}

// Uploads a logo to the public championship-logos bucket and returns its
// public URL. Called from the form before saveChampionship.
export async function uploadChampionshipLogo(formData: FormData): Promise<SaveResult> {
  await requireAdmin();

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { ok: false, error: 'No file provided.' };
  if (!file.type.startsWith('image/')) return { ok: false, error: 'File must be an image.' };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: 'Image must be under 2 MB.' };

  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from('championship-logos')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: error.message };

  const { data } = supabase.storage.from('championship-logos').getPublicUrl(path);
  return { ok: true, id: data.publicUrl };
}
