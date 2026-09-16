// Renders the season division-classification poster as a PNG.
//
// Reads a flat `name,division,tier` CSV, groups it into one column per
// division/tier, lays the columns out in the site's own visual language
// (carbon + gold, Saira Condensed display, the real division badge art), then
// screenshots the result through headless Chrome.
//
// Chrome is driven over the DevTools Protocol rather than `--screenshot`
// because the poster's height depends on the largest division — CDP's
// captureBeyondViewport clips exactly to the element, so the output is sized
// by the data instead of a hard-coded window.
//
//   node build.mjs [--data data/season-18.csv] [--out out/classifications.png]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import WebSocket from 'ws';

const HERE = import.meta.dirname;
const BADGES = path.resolve(HERE, '../../apps/cockpit/public/badges');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const DATA = path.resolve(HERE, args.data ?? 'data/season-18.csv');
const OUT = path.resolve(HERE, args.out ?? 'out/classifications.png');
const cfg = JSON.parse(readFileSync(path.join(HERE, 'config.json'), 'utf8'));

// ── division identity ────────────────────────────────────────────────────
// `base` is the literal colour of the division's badge artwork; `accent` is
// that same hue lifted into legibility against a near-black background (D1's
// badge is pure black, D2's near-black graphite — unusable as-is on carbon).
const DIVISIONS = {
  1: { base: '#0b0c0e', accent: '#d7dee9' },
  2: { base: '#2e302f', accent: '#9fb3ab' },
  3: { base: '#a6171b', accent: '#e0454b' },
  4: { base: '#671f6b', accent: '#b268b8' },
};
const TIERS = {
  gold: { label: 'Gold', ink: '#e6b53d' },
  silver: { label: 'Silver', ink: '#c3ccd8' },
};

const fileUrl = (p) => pathToFileURL(p).href;
const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── data ─────────────────────────────────────────────────────────────────
// Deliberately minimal CSV handling: quoted fields are supported because
// exported names legitimately contain commas ("Smith, Jr."), but nothing
// beyond that — the input is a two-or-three column roster, not a spreadsheet.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function loadColumns() {
  const rows = parseCsv(readFileSync(DATA, 'utf8'));
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const iName = header.indexOf('name');
  const iDiv = header.indexOf('division');
  const iTier = header.indexOf('tier');
  if (iName < 0 || iDiv < 0) {
    throw new Error(
      `${DATA}: needs at least "name" and "division" columns, got: ${header.join(', ')}`,
    );
  }

  const groups = new Map();
  for (const r of rows.slice(1)) {
    const name = (r[iName] ?? '').trim();
    if (!name) continue;
    const division = Number(String(r[iDiv] ?? '').replace(/\D/g, ''));
    if (!DIVISIONS[division]) {
      throw new Error(`Unknown division "${r[iDiv]}" for ${name}`);
    }
    const raw = (iTier >= 0 ? (r[iTier] ?? '') : '').trim().toLowerCase();
    const tier = raw.startsWith('g') ? 'gold' : raw.startsWith('s') ? 'silver' : null;
    const key = `${division}-${tier ?? 'none'}`;
    if (!groups.has(key)) groups.set(key, { division, tier, drivers: [] });
    groups.get(key).drivers.push(name);
  }

  // Gold before silver within a division, divisions ascending — the order the
  // league always publishes them in.
  return [...groups.values()].sort(
    (a, b) =>
      a.division - b.division ||
      (a.tier === 'gold' ? 0 : 1) - (b.tier === 'gold' ? 0 : 1),
  );
}

// ── markup ───────────────────────────────────────────────────────────────
function badgeFor(col) {
  const name = col.tier
    ? `Division ${col.division} ${TIERS[col.tier].label}.png`
    : `Division ${col.division}.png`;
  return fileUrl(path.join(BADGES, name));
}

function renderColumn(col) {
  const d = DIVISIONS[col.division];
  const tier = col.tier ? TIERS[col.tier] : null;
  const heading = `D${col.division}${tier ? ' ' + tier.label : ''}`;
  const names = col.drivers.map((n) => `<li class="name">${esc(n)}</li>`).join('');
  const ink = tier ? tier.ink : d.accent;
  return `
    <section class="col" style="--base:${d.base};--accent:${d.accent};--ink:${ink}">
      <header class="col-head">
        <img class="col-badge" src="${badgeFor(col)}" alt="">
        <h2 class="col-title">${heading}</h2>
        <p class="col-count">${col.drivers.length} driver${col.drivers.length === 1 ? '' : 's'}</p>
      </header>
      <ol class="names">${names}</ol>
    </section>`;
}

function renderHtml(columns) {
  const total = columns.reduce((n, c) => n + c.drivers.length, 0);
  const tallest = Math.max(...columns.map((c) => c.drivers.length));
  const fonts = readFileSync(path.join(HERE, 'fonts.css'), 'utf8').replace(
    /url\(fonts\//g,
    `url(${fileUrl(path.join(HERE, 'fonts'))}/`,
  );
  // Rows shrink as the tallest column grows so a 30-driver division stays on
  // one screen-height poster instead of running long.
  //
  // Names are sized generously against the poster width rather than for a
  // desktop viewer: this gets read on a phone, scaled to fit the screen, so
  // legibility is the ratio of name size to poster WIDTH — nothing else.
  const rowH = tallest > 28 ? 36 : tallest > 24 ? 42 : 46;
  const nameSize = rowH >= 46 ? 22 : rowH >= 42 ? 20 : 18;

  return `<!doctype html>
<meta charset="utf-8">
<style>
${fonts}
:root{
  --carbon:#0a0b0e; --panel:#13161c; --panel-2:#171b22;
  --line:#23272f; --line-2:#2e333d;
  --txt:#e9ebef; --txt-2:#b0b8c4; --txt-3:#8a92a0;
  --gold:#e6b53d; --gold-deep:#c8941f; --gold-soft:#f2cf73;
  --row-h:${rowH}px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#000}
.poster{
  width:${cfg.width}px; position:relative; overflow:hidden;
  padding:56px 56px 40px;
  font-family:'Hanken Grotesk',system-ui,sans-serif;
  color:var(--txt);
  background:
    radial-gradient(1100px 620px at 78% -8%, rgba(230,181,61,.12), transparent 60%),
    radial-gradient(900px 700px at 8% 12%, rgba(54,224,200,.05), transparent 55%),
    linear-gradient(180deg,#0a0b0e 0%,#0b0d11 100%);
}
/* The site's fixed grid overlay, baked in — masked so it fades before the
   poster edge instead of stopping at a hard line. */
.poster::before{
  content:""; position:absolute; inset:0; pointer-events:none; opacity:.5;
  background-image:
    linear-gradient(to right, rgba(255,255,255,.022) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,.022) 1px, transparent 1px);
  background-size:64px 64px;
  -webkit-mask-image:radial-gradient(circle at 50% 30%,#000 0%,transparent 78%);
}
.poster>*{position:relative}

/* ── masthead ── */
.head{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;margin-bottom:34px}
.head img{height:132px;width:auto;filter:drop-shadow(0 14px 34px rgba(0,0,0,.65))}
.title{
  font-family:'Saira Condensed',sans-serif; font-weight:800;
  font-size:52px; line-height:1; letter-spacing:.055em; text-transform:uppercase;
  color:var(--gold);
}
.title em{font-style:normal;color:#f0f2f5}
.meta{
  display:flex;align-items:center;gap:14px;
  font-size:14px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--txt-3);
}
.meta span{width:52px;height:1px;background:linear-gradient(90deg,transparent,var(--gold-deep),transparent)}

/* ── columns ── */
.grid{display:grid;grid-template-columns:repeat(${columns.length},1fr);gap:16px;align-items:start}
.col{
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--base) 55%, var(--panel)) 0%, var(--panel) 190px),
    var(--panel);
  border:1px solid var(--line);
  border-top:2px solid var(--accent);
  box-shadow:0 22px 50px rgba(0,0,0,.45);
}
.col-head{padding:16px 14px 14px;text-align:center;border-bottom:1px solid var(--line)}
.col-badge{height:34px;width:auto;display:block;margin:0 auto 10px}
.col-title{
  font-family:'Saira Condensed',sans-serif;font-weight:800;
  font-size:26px;line-height:1;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);
}
.col-count{margin-top:6px;font-size:11.5px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--txt-3)}
.names{list-style:none;padding:6px 0 10px}
.name{
  height:var(--row-h);display:flex;align-items:center;justify-content:center;text-align:center;
  padding:0 10px;font-size:${nameSize}px;font-weight:500;color:var(--txt);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.name:nth-child(odd){background:rgba(255,255,255,.022)}

/* ── footer ── */
.foot{
  display:flex;justify-content:space-between;align-items:center;
  margin-top:30px;padding-top:18px;border-top:1px solid var(--line);
  font-size:13px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--txt-3);
}
.foot b{color:var(--gold);font-weight:700}
</style>
<div class="poster" id="poster">
  <div class="head">
    <img src="${fileUrl(path.join(BADGES, 'GT3TS_Logo.png'))}" alt="">
    <h1 class="title">${esc(cfg.title)} <em>${esc(cfg.subtitle)}</em></h1>
    <p class="meta"><span></span>${total} drivers · ${columns.length} classifications<span></span></p>
  </div>
  <div class="grid">${columns.map(renderColumn).join('')}</div>
  <div class="foot"><div>${esc(cfg.footerLeft)}</div><div><b>${esc(cfg.footerRight)}</b></div></div>
</div>`;
}

// ── headless Chrome over CDP ─────────────────────────────────────────────
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);

function findChrome() {
  const hit = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!hit) throw new Error('No Chrome/Edge found — set CHROME_PATH.');
  return hit;
}

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message));
    else p.resolve(msg.result);
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function screenshot(htmlPath) {
  const port = 9222 + (process.pid % 500);
  const userDir = path.join(HERE, 'out', '.chrome-profile');
  const chrome = spawn(
    findChrome(),
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--disable-gpu',
      '--allow-file-access-from-files',
      '--force-device-scale-factor=1',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let wsUrl;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      wsUrl = (await res.json()).webSocketDebuggerUrl;
      break;
    } catch {
      await sleep(150);
    }
  }
  if (!wsUrl) {
    chrome.kill();
    throw new Error('Chrome never opened its debug port.');
  }

  const big = { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 };
  const browser = new WebSocket(wsUrl, big);
  await new Promise((r, j) => {
    browser.once('open', r);
    browser.once('error', j);
  });
  const bSend = cdp(browser);

  const { targetId } = await bSend('Target.createTarget', { url: 'about:blank' });
  const target = await fetch(`http://127.0.0.1:${port}/json/list`)
    .then((r) => r.json())
    .then((list) => list.find((t) => t.id === targetId));

  const page = new WebSocket(target.webSocketDebuggerUrl, big);
  await new Promise((r, j) => {
    page.once('open', r);
    page.once('error', j);
  });
  const send = cdp(page);

  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: cfg.width,
      height: 1200,
      // Left at 1 deliberately: the screenshot clip's own `scale` applies the
      // export multiplier, and setting both compounds them (2 x 2 = 4x).
      deviceScaleFactor: 1,
      mobile: false,
    });

    const loaded = new Promise((resolve) => {
      const onMsg = (raw) => {
        if (JSON.parse(raw.toString()).method === 'Page.loadEventFired') {
          page.off('message', onMsg);
          resolve();
        }
      };
      page.on('message', onMsg);
    });
    await send('Page.navigate', { url: fileUrl(htmlPath) });
    await loaded;

    // Local @font-face files still load asynchronously; screenshotting before
    // they resolve silently produces a fallback-font poster.
    await send('Runtime.evaluate', {
      expression: 'document.fonts.ready',
      awaitPromise: true,
    });
    await sleep(250);

    const { result } = await send('Runtime.evaluate', {
      expression:
        "JSON.stringify(document.getElementById('poster').getBoundingClientRect().toJSON())",
      returnByValue: true,
    });
    const box = JSON.parse(result.value);

    const { data } = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: {
        x: box.x,
        y: box.y,
        width: Math.round(box.width),
        height: Math.round(box.height),
        scale: cfg.scale,
      },
    });
    return { png: Buffer.from(data, 'base64'), box };
  } finally {
    page.close();
    browser.close();
    chrome.kill();
  }
}

// ── go ───────────────────────────────────────────────────────────────────
const columns = loadColumns();
mkdirSync(path.dirname(OUT), { recursive: true });
const htmlPath = path.join(path.dirname(OUT), 'poster.html');
writeFileSync(htmlPath, renderHtml(columns), 'utf8');

const { png, box } = await screenshot(htmlPath);
writeFileSync(OUT, png);

const total = columns.reduce((n, c) => n + c.drivers.length, 0);
console.log(
  `${OUT}\n  ${total} drivers across ${columns.length} classifications` +
    ` — ${Math.round(box.width * cfg.scale)}x${Math.round(box.height * cfg.scale)}px` +
    ` (${(png.length / 1024 / 1024).toFixed(2)} MB)`,
);
for (const c of columns) {
  console.log(`  D${c.division} ${c.tier ?? '—'}: ${c.drivers.length}`);
}
