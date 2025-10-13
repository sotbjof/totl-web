import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getMediumName } from "../lib/teamNames";
import { useAuth } from "../context/AuthContext";

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

export default function HomePage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

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
  const [nextGwComing, setNextGwComing] = useState<number | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [lastScoreGw, setLastScoreGw] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);

      if (!userId) {
        // Not signed in yet; clear and stop
        setLeagues([]);
        setFixtures([]);
        setPicksMap({});
        setResultsMap({});
        setGwSubmitted(false);
        setGwScore(null);
        setGlobalCount(null);
        setGlobalRank(null);
        setNextGwComing(null);
        setLastScore(null);
        setLastScoreGw(null);
        setLoading(false);
        return;
      }

      // User's leagues (only those where current user is a member)
      const { data: lm } = await supabase
        .from("league_members")
        .select("leagues(id,name,code)")
        .eq("user_id", userId);

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
            supabase.from("picks").select("fixture_index,pick").eq("gw", lastGwWithResults).eq("user_id", userId),
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
      } catch (_) {}

      // Determine if next GW is coming soon
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
        } catch (_) {}

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
            } catch (_) {}
          }
        }

        setNextGwComing(nextPublished ? null : nextGw);
      } else {
        setNextGwComing(null);
      }

      // Load this user's picks for current GW
      let userPicks: PickRow[] = [];
      if (thisGwFixtures.length) {
        const { data: pk } = await supabase
          .from("picks")
          .select("user_id,gw,fixture_index,pick")
          .eq("user_id", userId)
          .eq("gw", currentGw);
        userPicks = (pk as PickRow[]) ?? [];
      }

      // Submitted?
      let submitted = false;
      {
        const { data: sb } = await supabase
          .from("gw_submissions")
          .select("user_id")
          .eq("user_id", userId)
          .eq("gw", currentGw)
          .maybeSingle();
        submitted = !!sb;
      }

      let score: number | null = null;
      if (thisGwFixtures.length) {
        const { data: rs } = await supabase
          .from("gw_results")
          .select("gw,fixture_index,result")
          .eq("gw", currentGw);
        const results = (rs as Array<{ gw: number; fixture_index: number; result: "H" | "D" | "A" | null }>) ?? [];

        const outcomeByIdx = new Map<number, "H" | "D" | "A">();
        results.forEach((r) => {
          if (r && (r.result === "H" || r.result === "D" || r.result === "A")) {
            outcomeByIdx.set(r.fixture_index, r.result);
          }
        });

        const currentResultsMap: Record<number, "H" | "D" | "A"> = {};
        outcomeByIdx.forEach((result, fixtureIndex) => {
          currentResultsMap[fixtureIndex] = result;
        });
        setResultsMap(currentResultsMap);

        if (outcomeByIdx.size > 0) {
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

      // Submission status for each of my leagues
      const submissionStatus: Record<string, boolean> = {};
      for (const league of ls) {
        try {
          const { data: members } = await supabase
            .from("league_members")
            .select("user_id")
            .eq("league_id", league.id);

          if (members && members.length > 0) {
            const memberIds = members.map(m => m.user_id);
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
  }, [userId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId) return;
      try {
        // Player count
        let countSet = false;
        try {
          const { count: usersCount } = await supabase
            .from("users")
            .select("id", { count: "exact", head: true });
          if (alive && typeof usersCount === "number") {
            setGlobalCount(usersCount);
            countSet = true;
          }
        } catch {}

        if (!countSet) {
          try {
            const { count: pickUsers } = await supabase
              .from("picks")
              .select("user_id", { count: "exact", head: true });
            if (alive && typeof pickUsers === "number") setGlobalCount(pickUsers);
          } catch {}
        }

        // Rank
        try {
          const { data: rk } = await supabase
            .from("overall_ranks")
            .select("rank")
            .eq("user_id", userId)
            .maybeSingle();
          if (alive && rk?.rank != null) {
            setGlobalRank(rk.rank as number);
            return;
          }
        } catch {}

        try {
          const { data: ocps } = await supabase
            .from("overall_ocp")
            .select("user_id, ocp")
            .order("ocp", { ascending: false });
          if (alive && Array.isArray(ocps) && ocps.length) {
            const idx = ocps.findIndex((row: any) => row.user_id === userId);
            if (idx !== -1) {
              setGlobalRank(idx + 1);
              return;
            }
          }
        } catch {}

        try {
          const [{ data: rs }, { data: pk }] = await Promise.all([
            supabase.from("gw_results").select("gw,fixture_index,result"),
            supabase.from("picks").select("user_id,gw,fixture_index,pick"),
          ]);

          const results = (rs as Array<{gw:number, fixture_index:number, result:"H"|"D"|"A"|null}>) || [];
          const picksAll = (pk as Array<{user_id:string,gw:number,fixture_index:number,pick:"H"|"D"|"A"}>) || [];

          const outMap = new Map<string, "H"|"D"|"A">();
          results.forEach(r => { if (r.result === "H" || r.result === "D" || r.result === "A") outMap.set(`${r.gw}:${r.fixture_index}`, r.result); });

          const scores = new Map<string, number>();
          picksAll.forEach(p => {
            const out = outMap.get(`${p.gw}:${p.fixture_index}`);
            if (!out) return;
            if (p.pick === out) scores.set(p.user_id, (scores.get(p.user_id) || 0) + 1);
            else if (!scores.has(p.user_id)) scores.set(p.user_id, 0);
          });

          if (scores.size) {
            const ordered = Array.from(scores.entries()).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
            const myIndex = ordered.findIndex(([uid]) => uid === userId);
            if (alive && myIndex !== -1) setGlobalRank(myIndex + 1);
          }
        } catch {}
      } finally {}
    })();
    return () => { alive = false; };
  }, [userId]);

  const Dot: React.FC<{ correct?: boolean }> = ({ correct }) =>
    correct === true ? (
      <span className="inline-block h-5 w-5 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 shadow-xl shadow-yellow-400/40 ring-2 ring-yellow-300/60 transform scale-125 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]" />
    ) : correct === false ? (
      <span className="inline-block h-5 w-5 rounded-full bg-red-500 border-2 border-white shadow ring-1 ring-red-300" />
    ) : (
      <span className="inline-block h-5 w-5 rounded-full bg-emerald-500 border-2 border-white shadow ring-1 ring-emerald-300" />
    );

  const gamesSubtitle = (
    <div className="text-slate-700 font-semibold text-lg mt-4 mb-0">
      <div className="flex justify-between items-center">
        <span>Game Week {gw}</span>
        {fixtures.length > 0 && (() => {
          const firstFixture = fixtures[0];
          const firstDate = firstFixture.kickoff_time
            ? new Date(firstFixture.kickoff_time).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
            : null;
          return firstDate ? <span className="text-sm">{firstDate}</span> : null;
        })()}
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
  );

  const gamesSubtitle = (
    <div className="text-slate-700 font-semibold text-lg mt-4 mb-0">
      {/* ... */}
    </div>
  );

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
        <div className="absolute top-4 left-4 text-emerald-700 text-sm sm:text-base font-semibold">
          GW{gw}
        </div>
        <div className="absolute bottom-4 left-4 text-emerald-700 text-sm sm:text-base font-semibold">
          Last week's score
        </div>
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
    <div className="max-w-6xl mx-auto px-4 py-4 bg-gray-50 min-h-screen">
      {/* Leaderboards */}
      <section>
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
                <span className="ml-1">⬆️</span>
                <span className="font-semibold">{globalRank ?? "—"}</span>
              </div>
            }
          />
          <GWCard gw={lastScoreGw ?? gw} score={lastScore} submitted={false} />
        </div>
      </section>

      {/* Mini Leagues */}
      <section className="mt-6">
  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
    Mini Leagues
  </h2>

  <div className="mt-3">
    {loading ? (
      <div className="p-4 text-slate-500">Loading…</div>
    ) : leagues.length === 0 ? (
      <div className="p-4">
        <div className="rounded-2xl border bg-white p-4 sm:p-6">
          <div className="text-slate-600">You haven't joined any leagues yet.</div>
          <Link
            to="/tables#create"
            className="mt-3 inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 no-underline"
          >
            Start a mini league
          </Link>
        </div>
      </div>
    ) : (
      <div className="space-y-3">
        {leagues.map((l) => (
          <Link
            key={l.id}
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
              <div className="px-3 py-1 bg-slate-100 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-200 transition-colors">
                View
              </div>
            </div>
          </Link>
        ))}
      </div>
    )}
  </div>
</section>

      {/* Games (first GW) */}
      <section className="mt-6">
        <div className="text-slate-700 font-semibold text-lg mt-4 mb-0">
          <div className="flex justify-between items-center">
            <span>Game Week {gw}</span>
            {fixtures.length > 0 && (() => {
              const firstFixture = fixtures[0];
              const firstDate = firstFixture.kickoff_time
                ? new Date(firstFixture.kickoff_time).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
                : null;
              return firstDate ? <span className="text-sm">{firstDate}</span> : null;
            })()}
          </div>
        </div>

        {fixtures.length === 0 ? (
          <div className="p-4 text-slate-500">No fixtures yet.</div>
        ) : (
          <div>
            {(() => {
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
              return days.map((day, dayIndex) => (
                <div key={day}>
                  {dayIndex > 0 && <div className="mt-6 mb-3 text-slate-700 font-semibold text-lg">{day}</div>}
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
                                <div className="flex items-center justify-center gap-1">
                                  <img src={homeBadge} alt={`${homeName} badge`} className="h-4 w-3" />
                                  <div className="text-[15px] sm:text-base font-semibold text-slate-600">
                                    {f.kickoff_time
                                      ? new Date(f.kickoff_time).toLocaleTimeString(undefined, {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          hour12: false,
                                        })
                                      : ""}
                                  </div>
                                  <img src={awayBadge} alt={`${awayName} badge`} className="h-4 w-3" />
                                </div>
                                <div className="flex items-center justify-center pl-1">
                                  <span className="text-sm sm:text-base font-medium text-slate-900 truncate">{awayName}</span>
                                </div>
                              </div>
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