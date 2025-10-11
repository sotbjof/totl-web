// src/lib/mockTables.ts
// TEMP: fake weekly/overall numbers until backend is wired.
export type Row = { name: string; W: number; D: number; OCP: number; UNI: number; PTS: number; FORM: string };

function pts(W:number, D:number){ return W*3 + D*1; }

export function makeMockRows(names: string[]): Row[] {
  return names.map(n => {
    const W = Math.floor(Math.random()*5);
    const D = Math.floor(Math.random()*3);
    const UNI = Math.floor(Math.random()*3);
    const OCP = 10 + Math.floor(Math.random()*20);
    const PTSv = pts(W,D);
    const choices = ['✅','🟰','❌'];
    const FORM = Array.from({length:5},()=>choices[Math.floor(Math.random()*choices.length)]).join('');
    return { name:n, W, D, OCP, UNI, PTS:PTSv, FORM };
  }).sort((a,b)=> b.PTS - a.PTS || b.OCP - a.OCP || b.UNI - a.UNI || a.name.localeCompare(b.name));
}