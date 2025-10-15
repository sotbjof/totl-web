// scripts/fetch-badges.mjs
// Usage:
//   FOOTBALL_DATA_API_KEY=ed3153d132b847db836289243894706e node scripts/fetch-badges.mjs
// Outputs PNGs to public/assets/badges/{TLA}.png (e.g., ARS.png, MCI.png)

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const API_KEY = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';
const COMPETITION = process.env.FD_COMP || 'PL';        // e.g., 'PL'
const SEASON = process.env.FD_SEASON || '';            // e.g., '2024'; empty = current
const OUT_DIR = path.resolve('public/assets/badges');
const WIDTH = parseInt(process.env.BADGE_WIDTH || '128', 10);

// optional overrides if your internal code differs from team.tla
// (football-data tla values usually match: ARS, MCI, LIV, AVL, BHA, BOU, BRE, BUR, CHE, CRY, EVE, FUL, LEE, NEW, NFO, MUN, TOT, WHU, WOL, etc.)
const CODE_OVERRIDES = {
  // 'NOT': 'NFO',
  // add overrides if needed
};

async function ensureDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

async function getTeams() {
  const url = new URL(`https://api.football-data.org/v4/competitions/${COMPETITION}/teams`);
  if (SEASON) url.searchParams.set('season', SEASON);
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': API_KEY },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`football-data.org error ${res.status}: ${text || res.statusText}`);
  }
  const json = await res.json();
  return Array.isArray(json?.teams) ? json.teams : [];
}

function pickCode(team) {
  const tla = (team.tla || '').trim().toUpperCase();
  if (tla && CODE_OVERRIDES[tla]) return CODE_OVERRIDES[tla];
  if (tla) return tla;
  const short = (team.shortName || team.name || '').toUpperCase().replace(/[^A-Z]/g, '');
  return short.slice(0, 3) || `TEAM_${team.id}`;
}

async function fetchArrayBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch crest failed ${res.status} ${url}`);
  return await res.arrayBuffer();
}

async function savePng(code, buf, formatHint) {
  const out = path.join(OUT_DIR, `${code}.png`);
  // football-data `crest` can be svg/png/webp; sharp handles svg->png conversion
  let pipeline = sharp(Buffer.from(buf));
  if (formatHint === 'svg') {
    pipeline = sharp(Buffer.from(buf), { density: 384 }); // higher density for crisp svg rasterization
  }
  const png = await pipeline
    .resize({ width: WIDTH, height: WIDTH, fit: 'inside', withoutEnlargement: true })
    .png({ quality: 90 })
    .toBuffer();
  await fs.writeFile(out, png);
  console.log('Wrote', out);
}

function inferFormatFromUrl(u) {
  try {
    const ext = new URL(u).pathname.split('.').pop()?.toLowerCase();
    if (ext === 'svg' || ext === 'svgz') return 'svg';
    if (ext === 'webp') return 'webp';
    if (ext === 'png') return 'png';
  } catch {}
  return 'unknown';
}

async function main() {
  if (!API_KEY) {
    throw new Error('Missing FOOTBALL_DATA_API_KEY env var.');
  }
  await ensureDir();
  const teams = await getTeams();
  if (!teams.length) {
    console.warn('No teams returned. Check competition/season or API key.');
    return;
  }

  console.log(`Found ${teams.length} teams for ${COMPETITION}${SEASON ? ` ${SEASON}` : ''}`);
  for (const team of teams) {
    try {
      const code = pickCode(team);
      const crestUrl = team.crest || team.crestUrl || '';
      if (!crestUrl) {
        console.warn('No crest URL for', code, team.name);
        continue;
      }
      const ab = await fetchArrayBuffer(crestUrl);
      const hint = inferFormatFromUrl(crestUrl);
      await savePng(code, ab, hint);
    } catch (e) {
      console.warn('Skip', team?.tla || team?.name || team?.id, e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});