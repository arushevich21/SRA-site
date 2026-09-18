# Division classifications poster

Generates the season's "Division Classifications" announcement image — one
column per division/tier, in the site's own visual language (carbon + gold,
Saira Condensed, Hanken Grotesk, the real `public/badges` division artwork).

```powershell
node build.mjs
node build.mjs --data data/season-19.csv --out out/season-19.png
```

Output lands in `out/classifications.png` (and `out/poster.html`, which you can
open in a browser to inspect the layout before re-rendering).

## Input

A flat CSV — one row per driver, any order:

```csv
name,division,tier
Anton Rushevich,1,gold
Alex Kruse,1,silver
```

- `name` — displayed verbatim
- `division` — `1`–`4` (any surrounding text is stripped, so `D3` works)
- `tier` — `gold` / `silver`; omit the column entirely for a league with no
  tier split and you get one column per division using the tierless badge

Columns are ordered division ascending, gold before silver, and each column's
driver order is the CSV's own order. Sort the spreadsheet how you want it to
read before exporting — the script doesn't re-sort names.

Row height and name size step down automatically as the biggest division grows,
so a 30-driver division still fits the same poster proportions as a 22-driver
one.

## Titles and framing

`config.json` holds the season title, subtitle, footer text, and output size.
`width` is the CSS layout width; `scale` is the export multiplier (2600 × 1.5
gives a ~3900px-wide PNG, matching the dimensions the league has published at
before).

## How it renders

Headless Chrome, driven over the DevTools Protocol so the screenshot clips to
the poster element — the image height follows the data instead of a hard-coded
window. Chrome is found at the usual Windows install paths; override with
`CHROME_PATH`.

Fonts are vendored in `fonts/` (Saira Condensed + Hanken Grotesk, pulled from
Google Fonts once) so a render is deterministic and works offline. Refresh them
only if the site's type stack changes.
