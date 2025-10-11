// src/lib/fixtures.ts
export type Fixture = {
  id: string;
  home: string;
  away: string;
  kickoffISO: string; // UTC ISO string
};

export type Round = {
  gw: number;
  fixtures: Fixture[];
};

export function firstKickoffISO(round: Round): string {
  const first = [...round.fixtures].sort(
    (a,b)=> new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime()
  )[0];
  return first?.kickoffISO;
}

export function roundDeadlineISO(round: Round): string {
  const firstISO = firstKickoffISO(round);
  const t = new Date(firstISO).getTime() - 75 * 60 * 1000; // 75 minutes
  return new Date(t).toISOString();
}

// --- TEMP: mock round data (replace later with API) ---
export const MOCK_ROUND: Round = {
  gw: 1,
  fixtures: [
    { id:'fx1', home:'Liverpool', away:'Everton', kickoffISO:'2026-09-20T11:30:00Z' }, // 12:30 UK ~ 11:30Z if BST? adjust as needed
    { id:'fx2', home:'Brighton & Hove Albion', away:'Tottenham Hotspur', kickoffISO:'2026-09-20T14:00:00Z' },
    { id:'fx3', home:'Burnley', away:'Nottingham Forest', kickoffISO:'2026-09-20T14:00:00Z' },
    { id:'fx4', home:'West Ham United', away:'Crystal Palace', kickoffISO:'2026-09-20T14:00:00Z' },
    { id:'fx5', home:'Wolverhampton Wanderers', away:'Leeds United', kickoffISO:'2026-09-20T14:00:00Z' },
    { id:'fx6', home:'Manchester United', away:'Chelsea', kickoffISO:'2026-09-20T16:30:00Z' },
    { id:'fx7', home:'Fulham', away:'Brentford', kickoffISO:'2026-09-20T19:00:00Z' },
    { id:'fx8', home:'AFC Bournemouth', away:'Newcastle United', kickoffISO:'2026-09-21T13:00:00Z' },
    { id:'fx9', home:'Sunderland', away:'Aston Villa', kickoffISO:'2026-09-21T13:00:00Z' },
    { id:'fx10',home:'Arsenal', away:'Manchester City', kickoffISO:'2026-09-21T15:30:00Z' },
  ]
};