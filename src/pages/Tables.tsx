import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getCurrentUser, onDevUserChange } from "../devAuth";

type League = { id: string; name: string; code: string; created_at: string };
type LeagueRow = {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  submittedCount?: number;
};

export default function TablesPage() {
  const [me, setMe] = useState(() => getCurrentUser());
  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [error, setError] = useState("");
  const [leagueSubmissions, setLeagueSubmissions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = onDevUserChange((u) => setMe(u));
    return () => unsub();
  }, []);

  async function load() {
    setLoading(true);
    setError("");

    try {
      // 1) all leagues
      const { data: leaguesData, error: lErr } = await supabase
        .from("leagues")
        .select("id,name,code,created_at")
        .order("created_at", { ascending: true });

      if (lErr) throw lErr;
      const leagues: League[] = (leaguesData ?? []) as any;

      if (!leagues.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      const leagueIds = leagues.map((l) => l.id);

      // 2) all members for those leagues
      const { data: memData, error: mErr } = await supabase
        .from("league_members")
        .select("league_id,user_id")
        .in("league_id", leagueIds);

      if (mErr) throw mErr;

      const membersByLeague = new Map<string, string[]>();
      (memData ?? []).forEach((r: any) => {
        const arr = membersByLeague.get(r.league_id) ?? [];
        arr.push(r.user_id);
        membersByLeague.set(r.league_id, arr);
      });

      // 3) get fixtures to determine current GW (matching Home.tsx logic)
      const { data: fx } = await supabase
        .from("fixtures")
        .select("gw")
        .order("gw", { ascending: false });

      const fixturesList = (fx as Array<{ gw: number }>) ?? [];
      
      // Determine current GW: show the latest GW that has fixtures
      let currentGw: number;
      if (fixturesList.length) {
        currentGw = Math.max(...fixturesList.map(f => f.gw));
      } else {
        currentGw = 1;
      }

      // 4) check submissions for each league (matching Home.tsx logic)
      const submissionStatus: Record<string, boolean> = {};
      
      for (const league of leagues) {
        try {
          const memberIds = membersByLeague.get(league.id) ?? [];
          
          if (memberIds.length > 0) {
            // Check if all members have submitted for current GW
            const { data: submissions } = await supabase
              .from("gw_submissions")
              .select("user_id")
              .eq("gw", currentGw)
              .in("user_id", memberIds);
            
            const submittedCount = submissions?.length || 0;
            submissionStatus[league.id] = submittedCount === memberIds.length;
          } else {
            submissionStatus[league.id] = false;
          }
        } catch (error) {
          console.warn(`Error checking submissions for league ${league.id}:`, error);
          submissionStatus[league.id] = false;
        }
      }
      
      console.log('Tables page - submission status:', submissionStatus);
      console.log('Tables page - current GW:', currentGw);
      setLeagueSubmissions(submissionStatus);

      // 5) build rows
      const out: LeagueRow[] = leagues.map((l) => {
        const memberIds = membersByLeague.get(l.id) ?? [];
        return {
          id: l.id,
          name: l.name,
          code: l.code,
          memberCount: memberIds.length,
        };
      });

      setRows(out);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load leagues.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id]);

  async function createLeague() {
    if (!leagueName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const name = leagueName.trim();
      const code = await genCode();
      const { data, error } = await supabase
        .from("leagues")
        .insert({ name, code })
        .select("id,code")
        .single();
      if (error) throw error;

      // creator becomes a member
      await supabase.from("league_members").insert({
        league_id: data!.id,
        user_id: me.id,
      });

      setLeagueName("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create league.");
    } finally {
      setCreating(false);
    }
  }

  async function joinLeague() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setError("");
    try {
      const { data, error } = await supabase
        .from("leagues")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setError("League code not found.");
        return;
      }

      // Check if league is full (max 8 members)
      const { data: members, error: membersError } = await supabase
        .from("league_members")
        .select("user_id")
        .eq("league_id", data.id);
      
      if (membersError) throw membersError;
      
      if (members && members.length >= 8) {
        setError("League is full (max 8 members).");
        return;
      }

      await supabase.from("league_members").upsert(
        { league_id: data.id, user_id: me.id },
        { onConflict: "league_id,user_id" }
      );
      setJoinCode("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to join league.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mt-0 mb-2">Mini Leagues</h1>
        <p className="mt-0 mb-6 text-base text-slate-500">
          Create or join a private league<br />and battle it out with your friends.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Leagues list */}
      <div className="mt-6">
        {loading ? (
          <div className="px-4 py-4 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-4 text-sm">No leagues yet.</div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <Link 
                key={r.id} 
                to={`/league/${r.code}`} 
                className="block p-4 bg-white hover:bg-emerald-50 transition-colors no-underline border border-gray-200 rounded-lg shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">
                      {r.name}
                    </div>
                    <div className={`text-xs mt-1 ${r.memberCount >= 8 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                      {r.memberCount} member{r.memberCount === 1 ? "" : "s"}
                      {r.memberCount >= 8 && " (Full)"}
                    </div>
                    {leagueSubmissions[r.id] && (
                      <div className="text-sm text-emerald-600 font-bold mt-1">
                        All Submitted
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-1 bg-slate-100 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-200 transition-colors">
                    View
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* separator */}
      <div className="mt-10 mb-3 text-xl font-extrabold text-slate-900">Create or Join</div>

      {/* Create / Join cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-2xl p-4 bg-white">
          <div className="text-sm font-medium mb-2">Create a league</div>
          <input
            className="border rounded px-3 py-2 w-full bg-white"
            placeholder="League name"
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
          />
          <button
            className="mt-3 px-3 py-2 rounded bg-slate-900 text-white disabled:opacity-50"
            onClick={createLeague}
            disabled={creating || !leagueName.trim()}
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>

        <div className="border rounded-2xl p-4 bg-white">
          <div className="text-sm font-medium mb-2">Join with code</div>
          <input
            className="border rounded px-3 py-2 w-full uppercase tracking-widest bg-white"
            placeholder="ABCDE"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button
            className="mt-3 px-3 py-2 rounded border"
            onClick={joinLeague}
          >
            Join
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// simple 5-char code
async function genCode(): Promise<string> {
  const alphabet = "ABCDEFGHJKLMPQRSTVWXYZ23456789";
  for (let t = 0; t < 6; t++) {
    let code = "";
    for (let i = 0; i < 5; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const { data } = await supabase
      .from("leagues")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!data) return code;
  }
  // worst case
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}