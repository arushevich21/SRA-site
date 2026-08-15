// Maps championships.ts's allowedCars strings (content-layer car NAME
// picker options) to ACC's numeric car_model_id (the FK registrations.
// car_model_id actually needs — see packages/domain/src/acc/acc-constants.ts's
// ACC_CAR_MODEL_NAMES, the id->name direction).
//
// Every entry here is HUMAN-CONFIRMED, not string-matched. 7 of the 21 S19
// GT3 allowedCars strings happen to match ACC_CAR_MODEL_NAMES exactly; the
// other 14 don't (naming variants — "Evo" vs "EVO", model-year suffixes,
// real-world team names like "Emil Frey"/"Reiter Engineering" instead of
// ACC's internal car name). Three of those 14 had a genuine ambiguity (two
// ACC model-year variants exist for the same real car) and were settled by
// querying which car_model_id actually appears in our own historical
// results (acc_race_sessions / acc_race_sessions_staging), not guessed:
//   - Bentley: id 8 (2018) has 18 occurrences across our results; id 11
//     (2016) has zero. Not id 11.
//   - Nissan: id 6 (2018) has 34 occurrences; id 10 (2017) has zero.
//     Not id 10.
//   - Mercedes: id 25 ("2020"/EVO) has 65 occurrences spanning June-August;
//     id 1 (2016 base) has 8, all from one ~45-minute window on a single
//     day — a one-off, not recurring league use. Not id 1.
//
// FORWARD COMPATIBILITY: this map is NOT exhaustive of ACC's full car list
// on purpose — only of cars actually offered in an allowedCars picker
// today. A new championship adding a car string not yet in this map must
// fail closed (a clear, admin-facing "this car needs to be mapped" error —
// see registerTeam() in [sim]/register/actions.ts) rather than silently
// guessing a match or dropping the car_model_id. When that happens: add the
// new entry here, confirmed the same way as above — do not string-match it
// in.
export const ACC_CAR_MODEL_ID_BY_NAME: Readonly<Record<string, number>> = {
  // High-confidence identity matches (exact ACC_CAR_MODEL_NAMES match).
  'BMW M4 GT3': 30,
  'BMW M6 GT3': 7,
  'Ferrari 296 GT3': 32,
  'Ford Mustang GT3': 36,
  'Lexus RC F GT3': 15,
  'McLaren 650S GT3': 5,
  'Porsche 992 GT3 R': 34,

  // High-confidence identity matches (real-world car identity, string differs).
  'AMR V12 Vantage GT3': 12, // Aston Martin V12 Vantage GT3
  'AMR V8 Vantage GT3': 20, // AMR V8 Vantage (2019)
  'Audi R8 LMS GT3 Evo 2': 31, // Audi R8 LMS GT3 evo II — not id 19 (evo I) or id 3 (base)
  'Emil Frey Jaguar G3': 14, // Jaguar G3 — Emil Frey is the real-world team livery, not ACC's car name
  'Ferrari 488 GT3 Evo': 24, // Ferrari 488 GT3 Evo 2020 — not id 2 (base)
  'Honda NSX GT3 Evo': 21, // Honda NSX Evo (2019) — not id 17 (base)
  'Lamborghini Huracán GT3 EVO2': 33, // Lamborghini Huracan Evo2 — not id 16 (evo 1) or id 4 (base)
  'McLaren 720S GT3': 22, // McLaren 720S GT3 (2019) — base, distinct from the Evo entry below
  'McLaren 720S GT3 Evo': 35, // McLaren 720S GT3 Evo 2023
  'Porsche 991 II GT3 R': 23, // ACC_CAR_MODEL_NAMES has this as "911II" — believed to be a
  // transcription typo in the Server Admin Handbook / this codebase's table
  // ("991.II" is the real Porsche chassis code, "911II" is not a thing) —
  // the car itself is unambiguous regardless.
  'Reiter Engineering R-EX GT3': 13, // Lamborghini Gallardo R-EX — Reiter Engineering races this specific car in ACC

  // Settled by historical results data (see header) — not by reasoning alone.
  'Bentley Continental GT3': 8, // 2018 — 18 occurrences in our results; the 2016 variant (id 11) has none
  'Nissan GT-R Nismo GT3': 6, // 2018 — 34 occurrences; the 2017 variant (id 10) has none
  'Mercedes-AMG GT3 EVO': 25, // "2020" — 65 occurrences vs. 8 for the base 2016 car (id 1), which
  // only appears in one ~45-minute window, not recurring use
};
