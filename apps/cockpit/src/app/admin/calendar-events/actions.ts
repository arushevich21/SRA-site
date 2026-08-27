'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/require-admin';
import { supabase } from '@/lib/supabase';

export type CalendarEventInput = {
  id?: string; // present = update, absent = create
  slug: string; // '' -> NULL; code (e.g. HotStintDeadlineCountdown) looks events up by this
  title: string;
  description: string;
  eventDate: string; // Eastern wall-clock — 'YYYY-MM-DD' or 'YYYY-MM-DDThh:mm:00', required
  opensAt: string; // same format, optional — '' -> NULL (no progress bar)
  game: string; // '' -> NULL (cumulative calendar only)
  eventType: 'event' | 'deadline' | 'stream' | 'announcement';
  href: string;
  color: string;
  sortOrder: number;
};

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

const nullIfEmpty = (s: string): string | null => (s.trim() === '' ? null : s.trim());

function toRow(input: CalendarEventInput) {
  return {
    slug: nullIfEmpty(input.slug),
    title: input.title.trim(),
    description: nullIfEmpty(input.description),
    event_date: input.eventDate.trim(),
    opens_at: nullIfEmpty(input.opensAt),
    game: nullIfEmpty(input.game),
    event_type: input.eventType,
    href: nullIfEmpty(input.href),
    color: nullIfEmpty(input.color),
    sort_order: input.sortOrder,
  };
}

export async function saveCalendarEvent(input: CalendarEventInput): Promise<SaveResult> {
  await requireAdmin();

  if (input.title.trim() === '' || input.eventDate.trim() === '') {
    return { ok: false, error: 'Title and date are required.' };
  }

  const row = toRow(input);

  if (input.id) {
    const { error } = await supabase.from('calendar_events').update(row).eq('id', input.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/', 'layout');
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .insert(row)
    .select('id')
    .single();
  if (error) {
    return {
      ok: false,
      error: error.code === '23505' ? `Slug "${row.slug}" is already in use.` : error.message,
    };
  }
  revalidatePath('/', 'layout');
  return { ok: true, id: data.id as string };
}

export async function deleteCalendarEvent(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const { error } = await supabase.from('calendar_events').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}
