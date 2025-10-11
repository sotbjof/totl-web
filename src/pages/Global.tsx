// src/pages/Global.tsx
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

        // 2) this GW points
        const { data: gp, error: gErr } = await supabase
          .from("v_gw_points")
          .select("user_id, gw, points")
          .eq("gw", gw);
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
          const { data: prevList, error: pErr } = await supabase
            .from("v_gw_points")
            .select("user_id, gw, points")
            .lt("gw", gw);
          if (pErr) throw pErr;

          const totals: Record<string, number> = {};
          (prevList as GwPointsRow[] | null)?.forEach((r) => {
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

  const rows = useMemo(() => {
    const byUserThisGw = new Map<string, number>();
    gwPoints.forEach((r) => byUserThisGw.set(r.user_id, r.points));

    const merged = overall.map((o) => ({
      user_id: o.user_id,
      name: o.name ?? "User",
      this_gw: byUserThisGw.get(o.user_id) ?? 0,
      ocp: o.ocp ?? 0,
    }));

    // include users that have this GW points but not yet in overall
    gwPoints.forEach((g) => {
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
  }, [overall, gwPoints]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 pt-6 pb-16">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mt-0 mb-2">Leaderboard</h1>
          <div className="mt-0 mb-6 text-base text-slate-500">
            See how you rank against every<br />TotL player in the world.
          </div>
        </div>

        {err && (
          <div className="mb-6 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        )}

        {loading ? (
          <div className="text-slate-500">Loading…</div>
        ) : rows.length === 0 ? (
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
                  <th className="px-4 py-3 text-center font-semibold">GW{latestGw || '?'}</th>
                  <th className="px-4 py-3 text-center font-semibold">OCP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isMe = r.user_id === me.id;
                  const zebra = isMe ? "" : (i % 2 === 0 ? "bg-white" : "bg-slate-50");
                  const highlight = isMe ? "bg-emerald-200" : "";

                  // Compute color-coded indicator based on rank movement
                  const prev = prevRanks[r.user_id];
                  const curr = currRanks[r.user_id];
                  let indicator = "";
                  let indicatorClass = "bg-gray-300"; // default (no change)
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

                  return (
                    <tr key={r.user_id} className={`border-t border-slate-200 ${zebra} ${highlight}`}>
                      {/* Rank number only */}
                      <td className="px-2 py-3 text-left tabular-nums whitespace-nowrap">{i + 1}</td>

                      {/* Player name with color-coded indicator */}
                      <td className="px-4 py-3">
                        {(indicator || indicatorClass) && (
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

                      {/* This GW points */}
                      <td className="px-4 py-3 text-center tabular-nums font-bold">{r.this_gw}</td>

                      {/* Overall OCP */}
                      <td className="px-4 py-3 text-center font-bold">{r.ocp}</td>
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