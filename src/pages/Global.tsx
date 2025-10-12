// src/pages/Global.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentUser, onDevUserChange } from "../devAuth";

type OverallRow = {
  user_id: string;
  name: string | null;
  ocp: number;
};

type GwPointsRow = {
  user_id: string;
  gw: number;
  points: number;
};

export default function GlobalLeaderboardPage() {
  const [me, setMe] = useState(getCurrentUser());
  useEffect(() => onDevUserChange(setMe), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [latestGw, setLatestGw] = useState<number | null>(null);
  const [overall, setOverall] = useState<OverallRow[]>([]);
  const [gwPoints, setGwPoints] = useState<GwPointsRow[]>([]);
  const [prevOcp, setPrevOcp] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<"overall" | "form5" | "form10">("overall");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // 1) latest GW from results
        const { data: latest, error: lErr } = await supabase
          .from("gw_results")
          .select("gw")
          .order("gw", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lErr) throw lErr;
        const gw = latest?.gw ?? 1;
        if (alive) setLatestGw(gw);

        // 2) all GW points (needed for form leaderboards)
        const { data: gp, error: gErr } = await supabase
          .from("v_gw_points")
          .select("user_id, gw, points")
          .order("gw", { ascending: true });
        if (gErr) throw gErr;

        // 3) overall
        const { data: ocp, error: oErr } = await supabase
          .from("v_ocp_overall")
          .select("user_id, name, ocp");
        if (oErr) throw oErr;

        if (!alive) return;
        setGwPoints((gp as GwPointsRow[]) ?? []);
        setOverall((ocp as OverallRow[]) ?? []);

        // 4) previous OCP totals (up to gw-1) to compute rank movement
        if (gw && gw > 1) {
          // Use the already fetched gwPoints data instead of making another query
          const prevList = (gp as GwPointsRow[] | null)?.filter(r => r.gw < gw) ?? [];
          
          const totals: Record<string, number> = {};
          prevList.forEach((r) => {
            totals[r.user_id] = (totals[r.user_id] ?? 0) + (r.points ?? 0);
          });
          if (alive) setPrevOcp(totals);
        } else {
          if (alive) setPrevOcp({});
        }
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "Failed to load leaderboard.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function ranksFromScores(scores: Record<string, number>): Record<string, number> {
    const ids = Object.keys(scores);
    ids.sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || a.localeCompare(b));
    const out: Record<string, number> = {};
    ids.forEach((id, i) => (out[id] = i + 1));
    return out;
  }

  const currRanks = useMemo(() => {
    const scores: Record<string, number> = {};
    overall.forEach((o) => {
      scores[o.user_id] = (o.ocp ?? 0);
    });
    // include users who only have this GW points (first-week players)
    gwPoints.forEach((g) => {
      if (!(g.user_id in scores)) scores[g.user_id] = g.points ?? 0;
    });
    return ranksFromScores(scores);
  }, [overall, gwPoints]);

  const prevRanks = useMemo(() => ranksFromScores(prevOcp), [prevOcp]);

  // Helper function to create form rows for a given number of weeks
  const createFormRows = useMemo(() => {
    return (weeks: number) => {
      if (!latestGw || latestGw < weeks) return [];
      
      // Get last N game weeks
      const startGw = latestGw - weeks + 1;
      const formGwPoints = gwPoints.filter(gp => gp.gw >= startGw && gp.gw <= latestGw);
      
      // Group by user and count weeks played
      const userFormData = new Map<string, { user_id: string; name: string; formPoints: number; weeksPlayed: Set<number> }>();
      
      // Initialize with users from overall
      overall.forEach(o => {
        userFormData.set(o.user_id, {
          user_id: o.user_id,
          name: o.name ?? "User",
          formPoints: 0,
          weeksPlayed: new Set()
        });
      });
      
      // Add form points and track which weeks each user played
      formGwPoints.forEach(gp => {
        const user = userFormData.get(gp.user_id);
        if (user) {
          user.formPoints += gp.points;
          user.weeksPlayed.add(gp.gw);
        } else {
          userFormData.set(gp.user_id, {
            user_id: gp.user_id,
            name: "User",
            formPoints: gp.points,
            weeksPlayed: new Set([gp.gw])
          });
        }
      });
      
      // Only include players who have played ALL N weeks
      const completeFormPlayers = Array.from(userFormData.values())
        .filter(user => {
          // Check if user played all N weeks
          for (let gw = startGw; gw <= latestGw; gw++) {
            if (!user.weeksPlayed.has(gw)) {
              return false;
            }
          }
          return true;
        })
        .map(user => ({
          user_id: user.user_id,
          name: user.name,
          formPoints: user.formPoints,
          gamesPlayed: weeks // Always N for complete form players
        }))
        .sort((a, b) => (b.formPoints - a.formPoints) || a.name.localeCompare(b.name));
      
      return completeFormPlayers;
    };
  }, [overall, gwPoints, latestGw]);

  // 5 Week Form leaderboard
  const form5Rows = useMemo(() => createFormRows(5), [createFormRows]);
  
  // 10 Week Form leaderboard
  const form10Rows = useMemo(() => createFormRows(10), [createFormRows]);

  const rows = useMemo(() => {
    // Get current GW points only for the Overall tab
    const currentGwPoints = gwPoints.filter(gp => gp.gw === latestGw);
    const byUserThisGw = new Map<string, number>();
    currentGwPoints.forEach((r) => byUserThisGw.set(r.user_id, r.points));

    const merged = overall.map((o) => ({
      user_id: o.user_id,
      name: o.name ?? "User",
      this_gw: byUserThisGw.get(o.user_id) ?? 0,
      ocp: o.ocp ?? 0,
    }));

    // include users that have this GW points but not yet in overall
    currentGwPoints.forEach((g) => {
      if (!merged.find((m) => m.user_id === g.user_id)) {
        merged.push({
          user_id: g.user_id,
          name: "User",
          this_gw: g.points,
          ocp: g.points,
        });
      }
    });

    // sort by OCP desc, then name
    merged.sort((a, b) => (b.ocp - a.ocp) || a.name.localeCompare(b.name));
    return merged;
  }, [overall, gwPoints, latestGw]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 pt-6 pb-16">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mt-0 mb-2">Leaderboard</h1>
          <div className="mt-0 mb-6 text-base text-slate-500">
            See how you rank against every<br />TotL player in the world.
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-6">
          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setActiveTab("overall")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "overall"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Overall
            </button>
            <button
              onClick={() => setActiveTab("form5")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "form5"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              5 Week
            </button>
            <button
              onClick={() => setActiveTab("form10")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "form10"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              10 Week
            </button>
          </div>
        </div>

        {/* Form tab subtitles */}
        {activeTab === "form5" && (
          <div className="text-center mb-6">
            {latestGw && latestGw >= 5 ? (
              <div className="text-sm text-slate-600">
                Showing all players who have completed<br className="sm:hidden" /> the last 5 game weeks<br className="sm:hidden" /> (GW{Math.max(1, latestGw - 4)}-{latestGw})
              </div>
            ) : (
              <div className="text-sm text-amber-600 font-medium">
                ⚠️ Watch this space! Complete 5 GW<br className="sm:hidden" /> in a row to see the 5 Week Form Leaderboard.
              </div>
            )}
          </div>
        )}
        
        {activeTab === "form10" && (
          <div className="text-center mb-6">
            {latestGw && latestGw >= 10 ? (
              <div className="text-sm text-slate-600">
                Showing all players who have completed<br className="sm:hidden" /> the last 10 game weeks<br className="sm:hidden" /> (GW{Math.max(1, latestGw - 9)}-{latestGw})
              </div>
            ) : (
              <div className="text-sm text-amber-600 font-medium">
                ⚠️ Watch this space! Complete 10 GW<br className="sm:hidden" /> in a row to see the 10 Week Form Leaderboard.
              </div>
            )}
          </div>
        )}

        {err && (
          <div className="mb-6 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        )}

        {loading ? (
          <div className="text-slate-500">Loading…</div>
        ) : activeTab === "form5" && latestGw && latestGw < 5 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <div className="text-lg font-semibold text-slate-700 mb-2">5 Week Form Leaderboard Coming Soon</div>
            <div className="text-slate-600">
              Complete 5 game weeks in a row to unlock the 5 Week Form Leaderboard and see who's in the best form!
            </div>
          </div>
        ) : activeTab === "form10" && latestGw && latestGw < 10 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <div className="text-lg font-semibold text-slate-700 mb-2">10 Week Form Leaderboard Coming Soon</div>
            <div className="text-slate-600">
              Complete 10 game weeks in a row to unlock the 10 Week Form Leaderboard and see who's in the best form!
            </div>
          </div>
        ) : (activeTab === "overall" ? rows : activeTab === "form5" ? form5Rows : form10Rows).length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
            No leaderboard data yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm text-slate-800">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-3 text-left w-8 font-semibold">#</th>
                  <th className="px-4 py-3 text-left font-semibold">Player</th>
                  {activeTab === "overall" && (
                    <>
                      <th className="px-4 py-3 text-center font-semibold">GW{latestGw || '?'}</th>
                      <th className="px-4 py-3 text-center font-semibold">OCP</th>
                    </>
                  )}
                  {(activeTab === "form5" || activeTab === "form10") && (
                    <th className="px-4 py-3 text-center font-semibold">Form Points</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {(activeTab === "overall" ? rows : activeTab === "form5" ? form5Rows : form10Rows).map((r, i) => {
                  const isMe = r.user_id === me.id;
                  const zebra = isMe ? "" : (i % 2 === 0 ? "bg-white" : "bg-slate-50");
                  const highlight = isMe ? "bg-emerald-200" : "";

                  let indicator = "";
                  let indicatorClass = "bg-gray-300"; // default (no change)
                  
                  // Only show rank movement indicators for overall tab
                  if (activeTab === "overall") {
                    const prev = prevRanks[r.user_id];
                    const curr = currRanks[r.user_id];
                    if (curr && prev) {
                      if (curr < prev) {
                        indicator = "▲"; // moved up
                        indicatorClass = "bg-green-500 text-white";
                      } else if (curr > prev) {
                        indicator = "▼"; // moved down
                        indicatorClass = "bg-red-500 text-white";
                      } else {
                        indicator = ""; // no change - empty circle
                        indicatorClass = "bg-gray-400";
                      }
                    } else if (curr && !prev) {
                      indicator = "NEW"; // new entrant
                      indicatorClass = "bg-blue-500 text-white";
                    }
                  }

                  return (
                    <tr key={r.user_id} className={`border-t border-slate-200 ${zebra} ${highlight}`}>
                      {/* Rank number only */}
                      <td className="px-2 py-3 text-left tabular-nums whitespace-nowrap">{i + 1}</td>

                      {/* Player name with color-coded indicator */}
                      <td className="px-4 py-3">
                        {(indicator || indicatorClass) && activeTab === "overall" && (
                          <span
                            className={`mr-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold ${indicatorClass} align-middle`}
                            aria-hidden
                          >
                            {indicator}
                          </span>
                        )}
                        <span className="align-middle font-bold">{r.name}</span>
                        {isMe && (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                            you
                          </span>
                        )}
                      </td>

                      {/* Overall tab columns */}
                      {activeTab === "overall" && (
                        <>
                          <td className="px-4 py-3 text-center tabular-nums font-bold">{r.this_gw}</td>
                          <td className="px-4 py-3 text-center font-bold">{r.ocp}</td>
                        </>
                      )}

                      {/* Form tab columns (both 5 Week and 10 Week) */}
                      {(activeTab === "form5" || activeTab === "form10") && (
                        <td className="px-4 py-3 text-center font-bold">{r.formPoints}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}