import type { ChampionshipInput, ChampionshipRoundInput } from './actions';

// Blank-form factories. Kept in a plain (non-'use client') module so server
// components (e.g. the New Event page) can call blankInput() directly — a
// function exported from a client module can't be invoked on the server.

export function blankRound(round: number): ChampionshipRoundInput {
  return { round, track: '', raceLength: '', startsAt: '', emperorTrack: '', emperorRawTrackName: '' };
}

export function blankInput(): ChampionshipInput {
  return {
    slug: '', game: 'ACC', title: '', classTag: '', formatTag: '',
    eventType: 'championship', classes: [], logoUrl: '', raceFormat: '', raceDays: '',
    rulesBullets: [], discordLinks: [], resultsUrl: '', resultsLabel: '',
    emperorChampionshipId: '', simgridId: '', standingsKey: '',
    registrationKey: '', registrationSeason: '', registrationOpen: false,
    maxTeamSize: '', allowedCars: [], teaserOnly: false, concluded: false,
    sortOrder: 0, rounds: [],
  };
}
