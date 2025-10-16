import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { getMediumName } from "../lib/teamNames";

// Types
type League = { id: string; name: string; code: string };
type Fixture = {
  id: string;
  gw: number;
  fixture_index: number;
  home_code?: string | null;
  away_code?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  home_name?: string | null;
  away_name?: string | null;
  kickoff_time?: string | null;
};

type PickRow = { user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" };

// Results for outcome + helper to derive H/D/A if only goals exist


export default function HomePage() {
  const { user } = useAuth();
  const [oldSchoolMode] = useState(() => {
    const saved = localStorage.getItem('oldSchoolMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('oldSchoolMode', JSON.stringify(oldSchoolMode));
  }, [oldSchoolMode]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueSubmissions, setLeagueSubmissions] = useState<Record<string, boolean>>({});
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [gw, setGw] = useState<number>(1);
  const [gwSubmitted, setGwSubmitted] = useState<boolean>(false);
  const [gwScore, setGwScore] = useState<number | null>(null);
  const [picksMap, setPicksMap] = useState<Record<number, "H" | "D" | "A">>({});
  const [resultsMap, setResultsMap] = useState<Record<number, "H" | "D" | "A">>({});
  const [loading, setLoading] = useState(true);
  const [globalCount, setGlobalCount] = useState<number | null>(null);
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [prevGlobalRank, setPrevGlobalRank] = useState<number | null>(null);
  const [nextGwComing, setNextGwComing] = useState<number | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [lastScoreGw, setLastScoreGw] = useState<number | null>(null);

  const [unreadByLeague, setUnreadByLeague] = useState<Record<string, number>>({});
  const leagueIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);

      // User's leagues
      const { data: lm } = await supabase
        .from("league_members")
        .select("leagues(id,name,code)")
        .eq("user_id", user?.id);

      const ls: League[] = (lm as any[])?.map((r) => r.leagues).filter(Boolean) ?? [];

      // All fixtures ordered by GW then index
      const { data: fx } = await supabase
        .from("fixtures")
        .select(
          "id,gw,fixture_index,home_code,away_code,home_team,away_team,home_name,away_name,kickoff_time"
        )
        .order("gw")
        .order("fixture_index");

      const fixturesList: Fixture[] = (fx as Fixture[]) ?? [];

      // Determine current GW: show the latest GW that has fixtures
      let currentGw: number;
      if (fixturesList.length) {
        currentGw = Math.max(...fixturesList.map(f => f.gw));
      } else {
        currentGw = 1;
      }
      const thisGwFixtures = fixturesList.filter(f => f.gw === currentGw);
      setGw(currentGw);

      // Determine the most recent GW that has published results, and compute my score for it
      try {
        const { data: lastGwRows } = await supabase
          .from("gw_results")
          .select("gw")
          .order("gw", { ascending: false })
          .limit(1);

        const lastGwWithResults = Array.isArray(lastGwRows) && lastGwRows.length ? (lastGwRows[0] as any).gw as number : null;

        if (lastGwWithResults != null) {
          // fetch results for that GW
          const [{ data: rs2 }, { data: pk2 }] = await Promise.all([
            supabase.from("gw_results").select("fixture_index,result").eq("gw", lastGwWithResults),
            supabase.from("picks").select("fixture_index,pick").eq("gw", lastGwWithResults).eq("user_id", user?.id),
          ]);

          const outMap2 = new Map<number, "H" | "D" | "A">();
          (rs2 as Array<{ fixture_index: number; result: "H" | "D" | "A" | null }> | null)?.forEach(r => {
            if (r.result === "H" || r.result === "D" || r.result === "A") outMap2.set(r.fixture_index, r.result);
          });

          let myScore = 0;
          (pk2 as Array<{ fixture_index: number; pick: "H" | "D" | "A" }> | null)?.forEach(p => {
            const out = outMap2.get(p.fixture_index);
            if (out && out === p.pick) myScore += 1;
          });

          if (alive) {
            setLastScoreGw(lastGwWithResults);
            setLastScore(myScore);
          }
        } else {
          if (alive) {
            setLastScoreGw(null);
            setLastScore(null);
          }
        }
      } catch (_) {
        // ignore; leave lastScore/lastScoreGw as-is
      }

      // Determine if next GW is coming soon. If fixtures exist for next GW and no results published yet, show the hint.
      const nextGw = currentGw + 1;
      const hasNextGwFixtures = fixturesList.some(f => f.gw === nextGw);
      if (hasNextGwFixtures) {
        let nextPublished = false;
        try {
          const { data: nextRs } = await supabase
            .from("gw_results")
            .select("gw")
            .eq("gw", nextGw)
            .limit(1);
          nextPublished = Array.isArray(nextRs) && nextRs.length > 0;
        } catch (_) { /* ignore */ }

        // Fallback: treat as published if legacy `results` has any rows for those fixtures
        if (!nextPublished) {
          const nextIds = fixturesList.filter(f => f.gw === nextGw).map(f => f.id);
          if (nextIds.length) {
            try {
              const { data: legacyNext } = await supabase
                .from("results")
                .select("id")
                .in("fixture_id", nextIds)
                .limit(1);
              nextPublished = Array.isArray(legacyNext) && legacyNext.length > 0;
            } catch (_) { /* ignore */ }
          }
        }

        setNextGwComing(nextPublished ? null : nextGw);
      } else {
        setNextGwComing(null);
      }

      // Load this user's picks for that GW so we can show the dot under Home/Draw/Away
      let userPicks: PickRow[] = [];
      if (thisGwFixtures.length) {
        const { data: pk } = await supabase
          .from("picks")
          .select("user_id,gw,fixture_index,pick")
          .eq("user_id", user?.id)
          .eq("gw", currentGw);
        userPicks = (pk as PickRow[]) ?? [];
      }

      let submitted = false;
      {
        const { data: sb } = await supabase
          .from("gw_submissions")
          .select("user_id")
          .eq("user_id", user?.id)
          .eq("gw", currentGw)
          .maybeSingle();
        submitted = !!sb;
      }

      let score: number | null = null;
      if (thisGwFixtures.length) {
        // Prefer GW-scoped results so it works wherever fixture IDs differ
        const { data: rs } = await supabase
          .from("gw_results")
          .select("gw,fixture_index,result")
          .eq("gw", currentGw);
        const results = (rs as Array<{ gw: number; fixture_index: number; result: "H" | "D" | "A" | null }>) ?? [];

        // Build fixture_index -> outcome map directly
        const outcomeByIdx = new Map<number, "H" | "D" | "A">();
        results.forEach((r) => {
          if (r && (r.result === "H" || r.result === "D" || r.result === "A")) {
            outcomeByIdx.set(r.fixture_index, r.result);
          }
        });

        // Populate resultsMap for the current GW
        const currentResultsMap: Record<number, "H" | "D" | "A"> = {};
        outcomeByIdx.forEach((result, fixtureIndex) => {
          currentResultsMap[fixtureIndex] = result;
        });
        setResultsMap(currentResultsMap);

        if (outcomeByIdx.size > 0) {
          // count correct picks
          let s = 0;
          userPicks.forEach((p) => {
            const out = outcomeByIdx.get(p.fixture_index);
            if (out && out === p.pick) s += 1;
          });
          score = s;
        }
      }

      if (!alive) return;

      setGwSubmitted(submitted);
      setGwScore(score);

      const map: Record<number, "H" | "D" | "A"> = {};
      userPicks.forEach((p) => (map[p.fixture_index] = p.pick));

      setLeagues(ls);
      leagueIdsRef.current = new Set(ls.map((l) => l.id));

      // unread-by-league (robust)
      try {
        let reads: any[] | null = null;
        try {
          const { data, error } = await supabase
            .from("league_message_reads")
            .select("league_id,last_read_at")
            .eq("user_id", user?.id);
          if (error) {
            console.warn("league_message_reads not accessible, defaulting to no reads", error?.message);
            reads = null;
          } else {
            reads = data as any[] | null;
          }
        } catch (err: any) {
          console.warn("league_message_reads query failed — defaulting to no reads", err?.message);
          reads = null;
        }

        const lastRead = new Map<string, string>();
        (reads ?? []).forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));

        const out: Record<string, number> = {};
        for (const lg of ls) {
          const since = lastRead.get(lg.id) ?? "1970-01-01T00:00:00Z";
          const { data: msgs, count, error } = await supabase
            .from("league_messages")
            .select("id", { count: "exact" })
            .eq("league_id", lg.id)
            .gte("created_at", since);
          if (error) {
            console.warn("unread count query error", lg.id, error?.message);
          }
          out[lg.id] = typeof count === "number" ? count : (msgs?.length ?? 0);
        }
        if (alive) setUnreadByLeague(out);
      } catch (e) {
        // best-effort; ignore errors
      }

      setFixtures(thisGwFixtures);
      setPicksMap(map);
      setLoading(false);

      // Check submission status for each league
      const submissionStatus: Record<string, boolean> = {};
      for (const league of ls) {
        try {
          // Get all members of this league
          const { data: members } = await supabase
            .from("league_members")
            .select("user_id")
            .eq("league_id", league.id);
          
          if (members && members.length > 0) {
            const memberIds = members.map(m => m.user_id);
            
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
      setLeagueSubmissions(submissionStatus);
      
      setFixtures(thisGwFixtures);
      setPicksMap(map);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 1) Player count — prefer users head count; fall back to distinct pickers
        let countSet = false;
        try {
          const { count: usersCount } = await supabase
            .from("users")
            .select("id", { count: "exact", head: true });
          if (alive && typeof usersCount === "number") {
            setGlobalCount(usersCount);
            countSet = true;
          }
        } catch (_) { /* ignore */ }

        if (!countSet) {
          try {
            const { count: pickUsers } = await supabase
              .from("picks")
              .select("user_id", { count: "exact", head: true });
            if (alive && typeof pickUsers === "number") setGlobalCount(pickUsers);
          } catch (_) { /* ignore */ }
        }

        // 2) Rank — use same logic as Global page (v_ocp_overall)
        try {
          const { data: ocp } = await supabase
            .from("v_ocp_overall")
            .select("user_id, ocp")
            .order("ocp", { ascending: false });
          if (alive && Array.isArray(ocp) && ocp.length) {
            const idx = ocp.findIndex((row: any) => row.user_id === user?.id);
            if (idx !== -1) {
              console.log('Using v_ocp_overall (same as Global page):', idx + 1, 'from', ocp.length, 'players');
              setGlobalRank(idx + 1);
              return; // done
            }
          }
        } catch (_) { /* ignore */ }

        // 2c) compute from picks + gw_results (client-side)
        try {
          const [{ data: rs }, { data: pk }] = await Promise.all([
            supabase.from("gw_results").select("gw,fixture_index,result"),
            supabase.from("picks").select("user_id,gw,fixture_index,pick"),
          ]);

          const results = (rs as Array<{gw:number, fixture_index:number, result:"H"|"D"|"A"|null}>) || [];
          const picksAll = (pk as Array<{user_id:string,gw:number,fixture_index:number,pick:"H"|"D"|"A"}>) || [];

          // map gw:idx -> outcome
          const outMap = new Map<string, "H"|"D"|"A">();
          results.forEach(r => { if (r.result === "H" || r.result === "D" || r.result === "A") outMap.set(`${r.gw}:${r.fixture_index}`, r.result); });

          // Get latest GW with results
          const latestGw = Math.max(...results.map(r => r.gw));
          
          // Calculate current scores (all GWs)
          const scores = new Map<string, number>();
          picksAll.forEach(p => {
            const out = outMap.get(`${p.gw}:${p.fixture_index}`);
            if (!out) return;
            if (p.pick === out) scores.set(p.user_id, (scores.get(p.user_id) || 0) + 1);
            else if (!scores.has(p.user_id)) scores.set(p.user_id, 0);
          });

          // Calculate previous scores (up to latest GW - 1)
          const prevScores = new Map<string, number>();
          picksAll.forEach(p => {
            if (p.gw >= latestGw) return; // Skip latest GW
            const out = outMap.get(`${p.gw}:${p.fixture_index}`);
            if (!out) return;
            if (p.pick === out) prevScores.set(p.user_id, (prevScores.get(p.user_id) || 0) + 1);
            else if (!prevScores.has(p.user_id)) prevScores.set(p.user_id, 0);
          });

          if (scores.size) {
            const ordered = Array.from(scores.entries()).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
            const myIndex = ordered.findIndex(([uid]) => uid === user?.id);
            if (alive && myIndex !== -1) {
              console.log('Current rank calculation:', {
                myIndex,
                rank: myIndex + 1,
                myScore: scores.get(user?.id ?? ""),
                ordered: ordered.slice(0, 5).map(([uid, score]) => ({ uid: uid.slice(0, 8), score }))
              });
              setGlobalRank(myIndex + 1);
            }

            // Calculate previous rank if we have previous scores
            if (prevScores.size > 0) {
              const prevOrdered = Array.from(prevScores.entries()).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
              const prevMyIndex = prevOrdered.findIndex(([uid]) => uid === user?.id);
              if (alive && prevMyIndex !== -1) {
                console.log('Previous rank calculation (Global page logic):', {
                  prevMyIndex,
                  prevRank: prevMyIndex + 1,
                  prevScore: prevScores.get(user?.id ?? ""),
                  prevOrdered: prevOrdered.slice(0, 5).map(([uid, score]) => ({ uid: uid.slice(0, 8), score }))
                });
                setPrevGlobalRank(prevMyIndex + 1);
              }
            }
          }
        } catch (_) { /* ignore */ }
      } finally { /* no-op */ }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // Realtime: increment unread badge on new messages in any of my leagues
  useEffect(() => {
    const channel = supabase
      .channel(`home-unreads:${user?.id ?? "anon"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "league_messages" },
        (payload) => {
          try {
            const lg = (payload as any)?.new?.league_id as string | undefined;
            const sender = (payload as any)?.new?.user_id as string | undefined;
            if (!lg) return;
            if (!leagueIdsRef.current.has(lg)) return;
            if (sender && sender === user?.id) return;
            setUnreadByLeague((prev) => ({
              ...prev,
              [lg]: (prev?.[lg] ?? 0) + 1,
            }));
          } catch {}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // When window gains focus (e.g., user read chat and returns), resync unread counts
  useEffect(() => {
    const onFocus = async () => {
      try {
        const { data: reads } = await supabase
          .from("league_message_reads")
          .select("league_id,last_read_at")
          .eq("user_id", user?.id);

        const lastRead = new Map<string, string>();
        (reads ?? []).forEach((r: any) => lastRead.set(r.league_id, r.last_read_at));

        const out: Record<string, number> = {};
        for (const leagueId of leagueIdsRef.current) {
          const since = lastRead.get(leagueId) ?? "1970-01-01T00:00:00Z";
          const { data: msgs, count } = await supabase
            .from("league_messages")
            .select("id", { count: "exact" })
            .eq("league_id", leagueId)
            .gte("created_at", since);
          out[leagueId] = typeof count === "number" ? count : (msgs?.length ?? 0);
        }
        setUnreadByLeague(out);
      } catch {}
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user?.id]);

  const Section: React.FC<{
    title: string;
    subtitle?: React.ReactNode;
    headerRight?: React.ReactNode;
    className?: string;
    boxed?: boolean; // if false, render children without the outer card
    children?: React.ReactNode;
  }> = ({ title, subtitle, headerRight, className, boxed = true, children }) => (
    <section className={className ?? ""}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          {title}
        </h2>
        {headerRight && (
          <div>
            {headerRight}
          </div>
        )}
      </div>
      {subtitle && (
        <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
      )}
      {boxed ? (
        <div className="mt-3 rounded-2xl border bg-slate-50 overflow-hidden">{children}</div>
      ) : (
        <div className="mt-3">{children}</div>
      )}
    </section>
  );

  const Dot: React.FC<{ correct?: boolean }> = ({ correct }) => {
    if (correct === true) {
      return <span className="inline-block h-5 w-5 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 shadow-xl shadow-yellow-400/40 ring-2 ring-yellow-300/60 transform scale-125 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]" />;
    } else if (correct === false) {
      return <span className="inline-block h-5 w-5 rounded-full bg-red-500 border-2 border-white shadow ring-1 ring-red-300" />;
    } else {
      return <span className="inline-block h-5 w-5 rounded-full bg-emerald-500 border-2 border-white shadow ring-1 ring-emerald-300" />;
    }
  };

  const LeaderCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    footerLeft?: React.ReactNode;
    footerRight?: React.ReactNode;
    className?: string;
    to?: string;
    compactFooter?: boolean;
  }> = ({ title, icon, footerLeft, footerRight, className, to, compactFooter }) => {
    const inner = (
      <div className={"h-full rounded-3xl border-2 border-emerald-200 bg-emerald-50/50 p-4 sm:p-6 " + (className ?? "")}>
        <div className="flex items-center gap-3">
          <div className={"rounded-full bg-white shadow-inner flex items-center justify-center text-2xl " + (compactFooter ? "h-12 w-12 sm:h-14 sm:w-14" : "h-14 w-14 sm:h-16 sm:w-16")}>
            {icon}
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">{title}</div>
        </div>
        {(footerLeft || footerRight) && (
          <div className="mt-3 flex items-center gap-3 text-emerald-700">
            {footerLeft && (
              <div className={"flex items-center gap-1 " + (compactFooter ? "text-sm sm:text-base" : "text-lg sm:text-xl")}>
                {footerLeft}
              </div>
            )}
            {footerRight && (
              <div className={"flex items-center gap-1 " + (compactFooter ? "text-sm sm:text-base" : "text-lg sm:text-xl")}>
                {footerRight}
              </div>
            )}
          </div>
        )}
      </div>
    );
    if (to) {
      return (
        <Link to={to} className="no-underline block hover:bg-emerald-50/40 rounded-3xl">
          {inner}
        </Link>
      );
    }
    return inner;
  };

  const GWCard: React.FC<{ gw: number; score: number | null; submitted: boolean; }> = ({ gw, score, submitted }) => {
    const display = score !== null ? score : (submitted ? 0 : NaN);
    return (
      <div className="h-full rounded-3xl border-2 border-emerald-200 bg-emerald-50/50 p-4 sm:p-6 relative">
        {/* Corner badges */}
        <div className="absolute top-4 left-4 text-emerald-700 text-sm sm:text-base font-semibold">
          GW{gw}
        </div>
        <div className="absolute bottom-4 left-4 text-emerald-700 text-sm sm:text-base font-semibold">
          Last week's score
        </div>
        {/* Big score */}
        <div className="mt-2 flex items-center justify-center h-24 sm:h-28">
          {Number.isNaN(display) ? (
            <span className="text-5xl sm:text-6xl font-extrabold text-slate-900">—</span>
          ) : (
            <span className="text-5xl sm:text-6xl font-extrabold text-slate-900">{display}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`max-w-6xl mx-auto px-4 py-4 min-h-screen ${oldSchoolMode ? 'oldschool-theme' : ''}`}>
      {/* Leaderboards */}
      <Section title="Leaderboards" boxed={false}>
        <div className="grid grid-cols-2 gap-4">
          <LeaderCard
            to="/global"
            title="TotL Global"
            icon={<span role="img" aria-label="trophy">🏆</span>}
            compactFooter
            footerLeft={
              <div className="flex items-center gap-1">
                <span>👥</span>
                <span className="font-semibold">{globalCount ?? "—"}</span>
        {(() => {
          if (globalRank === null || prevGlobalRank === null) {
            return <span className="ml-1">—</span>;
          }
          if (globalRank < prevGlobalRank) {
            return <span className="ml-1">⬆️</span>; // Moved up (better rank = lower number)
          } else if (globalRank > prevGlobalRank) {
            return <span className="ml-1">⬇️</span>; // Moved down (worse rank = higher number)
          } else {
            return <span className="ml-1">→</span>; // Same position
          }
        })()}
                <span className="font-semibold">{globalRank ?? "—"}</span>
              </div>
            }
          />
          <GWCard gw={lastScoreGw ?? gw} score={lastScore} submitted={false} />
        </div>
      </Section>

      {/* Mini Leagues */}
      <section className="mt-12">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Mini Leagues
        </h2>
        <div className="mt-3">
          {loading ? (
            <div className="p-4 text-slate-500">Loading…</div>
          ) : leagues.length === 0 ? (
            <div className="p-6 bg-white rounded-lg border border-slate-200 text-center">
              <div className="text-slate-600 mb-3">You don't have any mini leagues yet.</div>
              <Link 
                to="/leagues" 
                className="inline-block px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors no-underline"
              >
                Create one now!
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border bg-slate-50 overflow-hidden">
              <ul>
                {leagues.map((l, idx) => {
                  const unread = unreadByLeague?.[l.id] ?? 0;
                  const badge = unread > 0 ? Math.min(unread, 99) : 0;
                  const rowBorder = idx ? "border-t" : "";
                  return (
                    <li key={l.id} className={rowBorder}>
                      <Link
                        to={`/league/${l.code}`}
                        className="block p-4 bg-white hover:bg-emerald-50 transition-colors no-underline"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-lg font-semibold text-slate-900">
                              {l.name}
                            </div>
                            {leagueSubmissions[l.id] && (
                              <div className="text-sm text-emerald-600 font-bold mt-1">
                                All Submitted
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {badge > 0 && (
                              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-600 text-white text-sm font-bold">
                                {badge}
                              </span>
                            )}
                            <div className="px-3 py-1 bg-slate-100 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-200 transition-colors">
                              View
                            </div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Games (first GW) */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Games
          </h2>
          {fixtures.length > 0 && !gwSubmitted && gwScore === null && (
            <div>
              <Link to="/predictions" className="inline-block px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors no-underline">Do your predictions</Link>
            </div>
          )}
        </div>
        <div className="text-slate-700 font-semibold text-lg mt-4 mb-0">
          <div className="flex justify-between items-center">
            <span>Game Week {gw}</span>
          </div>
          {gwScore !== null ? (
            <div className="mt-1">
              <span className="font-extrabold text-emerald-600 text-xl">Score {gwScore}</span>
            </div>
          ) : null}
          {nextGwComing ? (
            <div className="mt-1">
              <span className="font-semibold">GW{nextGwComing} coming soon</span>
            </div>
          ) : null}
        </div>
        {fixtures.length === 0 ? (
          <div className="p-4 text-slate-500">No fixtures yet.</div>
        ) : (
          <div>
            {(() => {
              // Group fixtures by day name
              const grouped: Record<string, Fixture[]> = {};
              fixtures.forEach((f) => {
                const day = f.kickoff_time
                  ? new Date(f.kickoff_time).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
                  : "Unknown";
                if (!grouped[day]) grouped[day] = [];
                grouped[day].push(f);
              });
              const days = Object.keys(grouped);
              let idx = 0;
              return days.map((day) => (
                <div key={day}>
                  <div className="mt-6 mb-3 text-slate-700 font-semibold text-lg">{day}</div>
                  <div className="rounded-2xl border bg-slate-50 overflow-hidden mb-6">
                    <ul>
                      {grouped[day].map((f) => {
                        const pick = picksMap[f.fixture_index];
                        const homeKey = f.home_code || f.home_name || f.home_team || "";
                        const awayKey = f.away_code || f.away_name || f.away_team || "";

                        const homeName = getMediumName(homeKey);
                        const awayName = getMediumName(awayKey);

                        const homeBadge = `/assets/badges/${homeKey.toUpperCase()}.png`;
                        const awayBadge = `/assets/badges/${awayKey.toUpperCase()}.png`;
                        const liClass = idx++ ? "border-t" : undefined;
                        return (
                          <li key={f.id} className={liClass}>
                            <div className="p-4 bg-white">
                              <div className="grid grid-cols-3 items-center gap-2">
                                <div className="flex items-center justify-center pr-1">
                                  <span className="text-sm sm:text-base font-medium text-slate-900 truncate">{homeName}</span>
                                </div>
                                <div className="flex items-center justify-center gap-2">
                                  <img src={homeBadge} alt={`${homeName} badge`} className="h-6 w-6" />
                                  <div className="text-[15px] sm:text-base font-semibold text-slate-600">
                                    {f.kickoff_time
                                      ? new Date(f.kickoff_time).toLocaleTimeString(undefined, {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          hour12: false,
                                        })
                                      : ""}
                                  </div>
                                  <img src={awayBadge} alt={`${awayName} badge`} className="h-6 w-6" />
                                </div>
                                <div className="flex items-center justify-center pl-1">
                                  <span className="text-sm sm:text-base font-medium text-slate-900 truncate">{awayName}</span>
                                </div>
                              </div>
                              {/* Row: dots under H/D/A, always centered in each third */}
                              <div className="mt-3 grid grid-cols-3 items-center">
                                <div className="flex justify-center">
                                  {pick === "H" ? (
                                    <Dot correct={resultsMap[f.fixture_index] ? resultsMap[f.fixture_index] === "H" : undefined} />
                                  ) : resultsMap[f.fixture_index] === "H" ? (
                                    <span className="inline-block h-5 w-5 rounded-full bg-gray-300 border-2 border-white shadow ring-1 ring-gray-200" />
                                  ) : (
                                    <span className="h-5" />
                                  )}
                                </div>
                                <div className="flex justify-center">
                                  {pick === "D" ? (
                                    <Dot correct={resultsMap[f.fixture_index] ? resultsMap[f.fixture_index] === "D" : undefined} />
                                  ) : resultsMap[f.fixture_index] === "D" ? (
                                    <span className="inline-block h-5 w-5 rounded-full bg-gray-300 border-2 border-white shadow ring-1 ring-gray-200" />
                                  ) : (
                                    <span className="h-5" />
                                  )}
                                </div>
                                <div className="flex justify-center">
                                  {pick === "A" ? (
                                    <Dot correct={resultsMap[f.fixture_index] ? resultsMap[f.fixture_index] === "A" : undefined} />
                                  ) : resultsMap[f.fixture_index] === "A" ? (
                                    <span className="inline-block h-5 w-5 rounded-full bg-gray-300 border-2 border-white shadow ring-1 ring-gray-200" />
                                  ) : (
                                    <span className="h-5" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </section>


    </div>
  );
}