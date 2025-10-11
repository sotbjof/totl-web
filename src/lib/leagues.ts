// src/lib/leagues.ts
import { getUser } from './auth';

export type League = {
  id: string;            // league code, e.g. ABCD12
  name: string;          // display name
  ownerId: string;       // creator
  members: Array<{ id: string; displayName: string }>;
  createdAt: string;     // ISO
};

const KEY = 'totl_leagues_v1';
const MAX_MEMBERS = 8;

function readAll(): League[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as League[] : [];
  } catch { return []; }
}
function writeAll(list: League[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function randCode(): string {
  // 6-char code A–Z0–9, avoids confusing chars
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i=0;i<6;i++) out += alphabet[Math.floor(Math.random()*alphabet.length)];
  return out;
}

export function myLeagues(): League[] {
  const u = getUser();
  if (!u) return [];
  return readAll().filter(L => L.members.some(m => m.id === u.id));
}

export function getLeague(id: string): League | null {
  return readAll().find(L => L.id === id) || null;
}

export function createLeague(name: string): League {
  const user = getUser();
  if (!user) throw new Error('Not signed in');
  const clean = name.trim();
  if (!clean) throw new Error('League name is required');

  const all = readAll();
  let id: string;
  do { id = randCode(); } while (all.some(L => L.id === id));

  const league: League = {
    id,
    name: clean,
    ownerId: user.id,
    members: [{ id: user.id, displayName: user.displayName }],
    createdAt: new Date().toISOString()
  };
  all.push(league);
  writeAll(all);
  return league;
}

export function joinLeague(code: string): League {
  const user = getUser();
  if (!user) throw new Error('Not signed in');
  const id = code.trim().toUpperCase();
  if (!id) throw new Error('Enter a code');

  const all = readAll();
  const league = all.find(L => L.id === id);
  if (!league) throw new Error('League not found');

  if (league.members.some(m => m.id === user.id)) return league; // already in
  if (league.members.length >= MAX_MEMBERS) throw new Error('League is full (max 8)');

  // Prevent duplicate display names inside a league
  if (league.members.some(m => m.displayName.toLowerCase() === user.displayName.toLowerCase())) {
    throw new Error('That display name already exists in this league');
  }

  league.members.push({ id: user.id, displayName: user.displayName });
  writeAll(all);
  return league;
}

export function leaveLeague(id: string) {
  const user = getUser();
  if (!user) throw new Error('Not signed in');
  const all = readAll();
  const i = all.findIndex(L => L.id === id);
  if (i === -1) return;

  const league = all[i];
  league.members = league.members.filter(m => m.id !== user.id);

  // If empty, delete league
  if (league.members.length === 0) {
    all.splice(i,1);
  }
  writeAll(all);
}