'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/require-admin';
import { supabase } from '@/lib/supabase';
import { parseAccsmChampionshipId } from '@/lib/accsm-championship-id';

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
  hotlapReleased: boolean;
};

// One row of the form's "Division championships" table. Both fields are
// strings because they come straight off text/select inputs; divisionId is
// parsed and championshipId is normalized (URL or bare GUID) at save time.
export type DivisionTargetInput = {
  divisionId: string;
  championshipId: string;
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
  minTeamSize: string; // '' -> 1 (solo entries allowed)
  maxRegistrations: string; // '' -> NULL (unlimited)
  allowedCars: string[];
  requiresDivision: boolean;
  teaserOnly: boolean;
  concluded: boolean;
  sortOrder: number;
  rounds: ChampionshipRoundInput[];
  // Multi-division series only — written to championship_accsm_targets, not
  // to the championships row. Empty for a single-championship event.
  divisionTargets: DivisionTargetInput[];
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
    // NOT NULL in the DB with a default of 1 — an empty field means
    // "no partner required", not "unknown".
    min_team_size: intOrNull(input.minTeamSize) ?? 1,
    max_registrations: intOrNull(input.maxRegistrations),
    allowed_cars: input.allowedCars.length > 0 ? input.allowedCars : null,
    requires_division: input.requiresDivision,
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
      hotlap_released: r.hotlapReleased,
    }));
}

type ResolvedDivisionTarget = { division_id: number; emperor_championship_id: string };

// Validates + normalizes the form's division rows. Returns an error string
// rather than throwing so saveChampionship can surface it inline on the form,
// the same way every other validation here does.
//
// Every failure names the offending row. A division target that is silently
// dropped or stored wrong doesn't fail here - it fails as an empty standings
// page, or (far worse) as one division's entrylist pushed onto another
// division's grid, with nothing pointing back at this form.
function resolveDivisionTargets(
  rows: DivisionTargetInput[],
): { ok: true; targets: ResolvedDivisionTarget[] } | { ok: false; error: string } {
  const targets: ResolvedDivisionTarget[] = [];
  const seenDivisions = new Set<number>();
  const seenGuids = new Set<string>();

  for (const row of rows) {
    // A row where BOTH halves are blank is just an unfilled "+ Add division"
    // slot - ignore it rather than making the admin delete it to save.
    if (row.divisionId.trim() === '' && row.championshipId.trim() === '') continue;

    const divisionId = intOrNull(row.divisionId);
    if (divisionId == null) {
      return { ok: false, error: 'Every division championship row needs a division selected.' };
    }

    const guid = parseAccsmChampionshipId(row.championshipId);
    if (guid == null) {
      return {
        ok: false,
        error:
          `Division ${divisionId}: "${row.championshipId.trim()}" isn't a valid ACSM championship. ` +
          'Paste the championship URL (.../championship/<id>) or the ID on its own.',
      };
    }

    // (registration_key, division_id) is the table's PK, so a duplicate
    // division would fail at the DB anyway - caught here to name which one.
    if (seenDivisions.has(divisionId)) {
      return { ok: false, error: `Division ${divisionId} is listed twice. Each division gets one championship.` };
    }
    // emperor_championship_id is UNIQUE across the whole table: one ACCSM
    // championship must never serve two divisions, or an entrylist push would
    // race two rosters against the same file.
    if (seenGuids.has(guid)) {
      return { ok: false, error: `Championship ${guid} is assigned to two divisions. Each division needs its own.` };
    }

    seenDivisions.add(divisionId);
    seenGuids.add(guid);
    targets.push({ division_id: divisionId, emperor_championship_id: guid });
  }

  return { ok: true, targets };
}

// Reconciles championship_accsm_targets for one registration_key.
//
// Upsert-then-delete, NOT the delete-then-reinsert the rounds save uses. These
// rows are read live by SRA-Bot to decide which registrations belong on which
// ACCSM grid; a window where they don't exist is a window where a push can
// resolve nothing and skip a division. Upserting first means the mapping is
// only ever correct-or-stale, never absent.
async function saveDivisionTargets(
  registrationKey: string,
  targets: ResolvedDivisionTarget[],
): Promise<string | null> {
  if (targets.length > 0) {
    const { error } = await supabase
      .from('championship_accsm_targets')
      .upsert(
        targets.map((t) => ({ ...t, registration_key: registrationKey })),
        { onConflict: 'registration_key,division_id' },
      );
    if (error) {
      // 23505 here is the emperor_championship_id UNIQUE, not the PK (the PK
      // is what onConflict just handled). It means a GUID being assigned to
      // one division is still recorded against another - including another
      // division of THIS series, when two divisions' ids are swapped in a
      // single save. Upsert and delete are separate statements, so that swap
      // can't be resolved in one pass.
      if (error.code === '23505') {
        return (
          'One of these championship IDs is already assigned to a different division. ' +
          'If you are swapping IDs between divisions, clear one and save, then set the other.'
        );
      }
      return error.message;
    }
  }

  // Drop divisions the admin removed. Scoped to this registration_key, and
  // expressed as "not in the submitted set" so an empty submission clears them
  // all - which is the correct reading of removing every row from the form.
  let del = supabase
    .from('championship_accsm_targets')
    .delete()
    .eq('registration_key', registrationKey);

  if (targets.length > 0) {
    del = del.not('division_id', 'in', `(${targets.map((t) => t.division_id).join(',')})`);
  }

  const { error: delErr } = await del;
  return delErr ? delErr.message : null;
}

export async function saveChampionship(input: ChampionshipInput): Promise<SaveResult> {
  await requireAdmin();

  if (input.slug.trim() === '' || input.title.trim() === '' || input.classTag.trim() === '') {
    return { ok: false, error: 'Slug, title, and class tag are required.' };
  }

  const resolved = resolveDivisionTargets(input.divisionTargets);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const divisionTargets = resolved.targets;
  const registrationKey = nullIfEmpty(input.registrationKey);

  // An event is EITHER one ACCSM championship or a series spanning several -
  // never both. Allowing both is how the GT3 Team Series ended up carrying
  // Division 1's GUID as though it were the whole series', which made every
  // standings and results page silently show D1 only.
  if (divisionTargets.length > 0 && nullIfEmpty(input.emperorChampionshipId)) {
    return {
      ok: false,
      error:
        'This event has per-division championships, so the single "ACSM championship ID" must be empty. ' +
        'Clear it, or remove the division rows.',
    };
  }

  // championship_accsm_targets.registration_key is a real FK to
  // championships.registration_key - without one there is nothing to hang the
  // targets off, and the insert would fail with a foreign-key error that says
  // nothing about which field the admin actually needs to fill in.
  if (divisionTargets.length > 0 && !registrationKey) {
    return {
      ok: false,
      error: 'Per-division championships need a Registration key set (Registration section below).',
    };
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

  // After the championships write, so a registration_key set or renamed in
  // this same save exists (and has cascaded to any existing targets) before
  // these rows reference it.
  if (registrationKey) {
    const targetErr = await saveDivisionTargets(registrationKey, divisionTargets);
    if (targetErr) return { ok: false, error: targetErr };
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
