import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getCurrentUser, onDevUserChange } from "../devAuth";

/* =========================
   Types
   ========================= */
type League = { id: string; name: string; code: string; created_at?: string };
type Member = { id: string; name: string };

type Fixture = {
  id: string;
  gw: number;
  fixture_index: number;
  home_team: string;
  away_team: string;
  home_code?: string | null;
  away_code?: string | null;
  home_name?: string | null;
  away_name?: string | null;
  kickoff_time?: string | null;
};

type PickRow = { user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" };
type SubmissionRow = { user_id: string; gw: number; submitted_at: string | null };

type ResultRowRaw = {
  gw: number;
  fixture_index: number;
  // keep goals optional in case you ever store them later
  result?: "H" | "D" | "A" | null;
  home_goals?: number | null;
  away_goals?: number | null;
};

type MltRow = {
  user_id: string;
  name: string;
  mltPts: number;   // standings points (3/1/0 per GW)
  ocp: number;      // sum of correct picks across season
  unicorns: number; // unique correct picks across season
  wins: number;
  draws: number;
  form: ("W" | "D" | "L")[]; // oldest->newest; renderer will show last 5
};


/* =========================
   Helpers
   ========================= */



function initials(name: string) {
  const parts = (name || "?").trim().split(/\s+/);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}


function rowToOutcome(r: ResultRowRaw): "H" | "D" | "A" | null {
  if (r.result === "H" || r.result === "D" || r.result === "A") return r.result;
  if (
    typeof r.home_goals === "number" &&
    typeof r.away_goals === "number"
  ) {
    if (r.home_goals > r.away_goals) return "H";
    if (r.home_goals < r.away_goals) return "A";
    return "D";
  }
  return null;
}

/* Small chip used in GW Picks grid */
function Chip({
  letter,
  correct,        // null = result not decided yet
  unicorn,
}: {
  letter: string;
  correct: boolean | null;
  unicorn: boolean;
}) {
  const tone =
    correct === null
      ? "bg-slate-100 text-slate-600 border-slate-200"
              : correct
              ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl shadow-yellow-400/40 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s] ring-2 ring-yellow-300/60"
      : "bg-slate-50 text-slate-400 border-slate-200";

  return (
    <span
      className={[
        "inline-flex items-center justify-center h-5 min-w-[20px] px-1.5",
        "rounded-full border text-xs font-semibold mr-1 mb-0.5",
        "align-middle",
        tone,
      ].join(" ")}
      title={unicorn ? "Unicorn!" : undefined}
    >
      {letter}
      {unicorn ? <span className="ml-1">🦄</span> : null}
    </span>
  );
}

/* =========================
   Page
   ========================= */
export default function LeaguePage() {
  const { code = "" } = useParams();
  const [me, setMe] = useState(getCurrentUser());
  useEffect(() => onDevUserChange(setMe), []);

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // tabs: Mini League Table / GW Picks / GW Results
  const [tab, setTab] = useState<"mlt" | "gw" | "gwr">("mlt");
  const [showForm, setShowForm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [currentGw, setCurrentGw] = useState<number | null>(null);      // for GW Picks
  const [latestResultsGw, setLatestResultsGw] = useState<number | null>(null); // for GW Results

  /* ---------- load current GW (for picks) and latest results GW (for results tab) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      // current GW
      const { data: meta } = await supabase
        .from("meta")
        .select("current_gw")
        .eq("id", 1)
        .maybeSingle();
      if (!alive) return;
      setCurrentGw((meta as any)?.current_gw ?? null);

      // latest GW that has results
      const { data: rs } = await supabase
        .from("gw_results")
        .select("gw")
        .order("gw", { ascending: false })
        .limit(1);
      if (!alive) return;
      setLatestResultsGw((rs && rs.length ? (rs[0] as any).gw : null));
    })();
    return () => { alive = false; };
  }, []);

  // data for GW Picks / GW Results
  const memberIds = useMemo(() => members.map((m) => m.id), [members]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [subs, setSubs] = useState<SubmissionRow[]>([]);
  const [results, setResults] = useState<ResultRowRaw[]>([]);

  // MLT (season standings) rows
  const [mltRows, setMltRows] = useState<MltRow[]>([]);
  const [mltLoading, setMltLoading] = useState(false);

  /* ---------- load league + members ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);

      const { data: lg } = await supabase
        .from("leagues")
        .select("id,name,code,created_at")
        .eq("code", code)
        .maybeSingle();

      if (!alive) return;
      if (!lg) {
        setLeague(null);
        setMembers([]);
        setLoading(false);
        return;
      }
      setLeague(lg as League);

      const { data: mm } = await supabase
        .from("league_members")
        .select("users(id,name)")
        .eq("league_id", (lg as League).id);

      const mem: Member[] =
        (mm as any[])?.map((r) => ({
          id: r.users.id,
          name: r.users.name ?? "(no name)",
        })) ?? [];

      mem.sort((a, b) => a.name.localeCompare(b.name));

      setMembers(mem);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [code]);

  /* ---------- leave league function ---------- */
  async function leaveLeague() {
    if (!league) return;
    
    setLeaving(true);
    try {
      const { error } = await supabase
        .from("league_members")
        .delete()
        .eq("league_id", league.id)
        .eq("user_id", me.id);

      if (error) throw error;

      // Redirect to leagues page
      window.location.href = "/leagues";
    } catch (error) {
      console.error("Error leaving league:", error);
      alert("Failed to leave league. Please try again.");
    } finally {
      setLeaving(false);
      setShowLeaveConfirm(false);
    }
  }

  /* ---------- share league function ---------- */
  function shareLeague() {
    if (!league) return;
    
    const shareText = `Join my mini league "${league.name}" on TotL! Use code: ${league.code}`;
    const shareUrl = `${window.location.origin}/leagues`;
    
    // Try to use Web Share API first (mobile)
    if (navigator.share) {
      navigator.share({
        title: `Join ${league.name}`,
        text: shareText,
        url: shareUrl
      }).catch(console.error);
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`).then(() => {
        alert("League code copied to clipboard!");
      }).catch(() => {
        // Final fallback: show the code in a prompt
        prompt("Share this league code:", league.code);
      });
    }
  }

  /* ---------- load fixtures + picks + submissions + results for selected GW ---------- */
  useEffect(() => {
    let alive = true;

    (async () => {
      const gwForData = tab === "gwr" ? latestResultsGw : currentGw;
      if (!gwForData) {
        setFixtures([]);
        setPicks([]);
        setSubs([]);
        setResults([]);
        return;
      }
      // Fixtures for GW (names/codes for display)
      const { data: fx } = await supabase
        .from("fixtures")
        .select(
          "id,gw,fixture_index,home_team,away_team,home_code,away_code,home_name,away_name,kickoff_time"
        )
        .eq("gw", gwForData)
        .order("fixture_index", { ascending: true });

      if (!alive) return;
      setFixtures((fx as Fixture[]) ?? []);

      if (!memberIds.length) {
        setPicks([]);
        setSubs([]);
        setResults([]);
        return;
      }

      // Picks
      const { data: pk } = await supabase
        .from("picks")
        .select("user_id,gw,fixture_index,pick")
        .eq("gw", gwForData)
        .in("user_id", memberIds);

      if (!alive) return;
      setPicks((pk as PickRow[]) ?? []);

      // Submissions
      const { data: sb } = await supabase
        .from("gw_submissions")
        .select("user_id,gw,submitted_at")
        .eq("gw", gwForData)
        .in("user_id", memberIds);

      if (!alive) return;
      setSubs((sb as SubmissionRow[]) ?? []);

      // Results (from gw_results; we’ll filter by gw in components)
      const { data: rs } = await supabase
        .from("gw_results")
        .select("gw,fixture_index,result");

      if (!alive) return;
      setResults((rs as ResultRowRaw[]) ?? []);
    })();

    return () => {
      alive = false;
    };
  }, [tab, currentGw, latestResultsGw, memberIds]);

  const submittedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    subs.forEach((s) => m.set(`${s.user_id}:${s.gw}`, true));
    return m;
  }, [subs]);

  /* ---------- Compute Mini League Table (season) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!members.length) {
        setMltRows([]);
        return;
      }
      setMltLoading(true);

      // all results we have (gw + fixture_index based)
      const { data: rs } = await supabase
        .from("gw_results")
        .select("gw,fixture_index,result");
      const resultList = (rs as ResultRowRaw[]) ?? [];

      // outcome per gw:idx key = `${gw}:${fixture_index}`
      const outcomeByGwIdx = new Map<string, "H" | "D" | "A">();
      resultList.forEach((r) => {
        const out = rowToOutcome(r);
        if (!out) return;
        outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
      });

      if (outcomeByGwIdx.size === 0) {
        // No results yet ⇒ zero rows
        setMltRows(
          members.map((m) => ({
            user_id: m.id,
            name: m.name,
            mltPts: 0,
            ocp: 0,
            unicorns: 0,
            wins: 0,
            draws: 0,
            form: [],
          }))
        );
        setMltLoading(false);
        return;
      }

      const gwsWithResults = [...new Set(
        Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10))
      )].sort((a, b) => a - b);

      // all picks for those GWs
      const { data: pk } = await supabase
        .from("picks")
        .select("user_id,gw,fixture_index,pick")
        .in("user_id", members.map((m) => m.id))
        .in("gw", gwsWithResults);
      const picksAll = (pk as PickRow[]) ?? [];

      // perGW map of user score & unicorns
      type GwScore = { user_id: string; score: number; unicorns: number };
      const perGw = new Map<number, Map<string, GwScore>>();
      gwsWithResults.forEach((g) => {
        const map = new Map<string, GwScore>();
        members.forEach((m) => map.set(m.id, { user_id: m.id, score: 0, unicorns: 0 }));
        perGw.set(g, map);
      });

      // fill scores and unicorns
      gwsWithResults.forEach((g) => {
        // fixture indexes that have outcomes for gw g
        const idxInGw = Array.from(outcomeByGwIdx.entries())
          .filter(([k]) => parseInt(k.split(":")[0], 10) === g)
          .map(([k, v]) => ({ idx: parseInt(k.split(":")[1], 10), out: v }));

        idxInGw.forEach(({ idx, out }) => {
          const thesePicks = picksAll.filter((p) => p.gw === g && p.fixture_index === idx);
          const correctUsers = thesePicks.filter((p) => p.pick === out).map((p) => p.user_id);

          // increment one point for each correct user
          const map = perGw.get(g)!;
          thesePicks.forEach((p) => {
            if (p.pick === out) {
              const row = map.get(p.user_id)!;
              row.score += 1;
            }
          });

          // unicorn
          if (correctUsers.length === 1) {
            const uid = correctUsers[0];
            const row = map.get(uid)!;
            row.unicorns += 1;
          }
        });
      });

      // accumulate season stats
      const mltPts = new Map<string, number>();
      const ocp = new Map<string, number>();
      const unis = new Map<string, number>();
      const wins = new Map<string, number>();
      const draws = new Map<string, number>();
      const form = new Map<string, ("W" | "D" | "L")[]>();
      members.forEach((m) => {
        mltPts.set(m.id, 0);
        ocp.set(m.id, 0);
        unis.set(m.id, 0);
        wins.set(m.id, 0);
        draws.set(m.id, 0);
        form.set(m.id, []);
      });

      gwsWithResults.forEach((g) => {
        const rows = Array.from(perGw.get(g)!.values());
        // add ocp/unicorns season totals
        rows.forEach((r) => {
          ocp.set(r.user_id, (ocp.get(r.user_id) ?? 0) + r.score);
          unis.set(r.user_id, (unis.get(r.user_id) ?? 0) + r.unicorns);
        });

        // rank this GW by score, then unicorns
        rows.sort((a, b) => (b.score - a.score) || (b.unicorns - a.unicorns));
        if (!rows.length) return;

        const top = rows[0];
        const coTop = rows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);

        if (coTop.length === 1) {
          // win
          mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
          wins.set(top.user_id, (wins.get(top.user_id) ?? 0) + 1);
          form.get(top.user_id)!.push("W");
          // others lose
          rows.slice(1).forEach((r) => form.get(r.user_id)!.push("L"));
        } else {
          // draw among coTop
          coTop.forEach((r) => {
            mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
            draws.set(r.user_id, (draws.get(r.user_id) ?? 0) + 1);
            form.get(r.user_id)!.push("D");
          });
          // the rest lose
          rows
            .filter((r) => !coTop.find((t) => t.user_id === r.user_id))
            .forEach((r) => form.get(r.user_id)!.push("L"));
        }
      });

      const rows: MltRow[] = members.map((m) => ({
        user_id: m.id,
        name: m.name,
        mltPts: mltPts.get(m.id) ?? 0,
        ocp: ocp.get(m.id) ?? 0,
        unicorns: unis.get(m.id) ?? 0,
        wins: wins.get(m.id) ?? 0,
        draws: draws.get(m.id) ?? 0,
        form: form.get(m.id) ?? [],
      }));

      rows.sort(
        (a, b) =>
          (b.mltPts - a.mltPts) ||
          (b.unicorns - a.unicorns) ||
          (b.ocp - a.ocp) ||
          a.name.localeCompare(b.name)
      );

      if (!alive) return;
      setMltRows(rows);
      setMltLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [members]);

  /* =========================
     Renderers
     ========================= */

  function MltTab() {
    const renderForm = (formArr: ("W" | "D" | "L")[]) => {
      const last5 = formArr.slice(-5);
      const pad = 5 - last5.length;
      
      return (
        <div className="flex items-center gap-2">
          {/* Show dots for missing games */}
          {Array.from({ length: pad }).map((_, i) => (
            <div key={`dot-${i}`} className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
          ))}
          {/* Show form indicators */}
          {last5.map((result, i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                result === "W" 
                  ? "bg-green-100 text-green-700" 
                  : result === "D" 
                  ? "bg-yellow-100 text-yellow-700" 
                  : "bg-red-100 text-red-700"
              }`}
            >
              {result === "W" ? "W" : result === "D" ? "D" : "L"}
            </div>
          ))}
        </div>
      );
    };

    const rows = mltRows.length
      ? mltRows
      : members.map((m) => ({
          user_id: m.id,
          name: m.name,
          mltPts: 0,
          ocp: 0,
          unicorns: 0,
          wins: 0,
          draws: 0,
          form: [] as ("W" | "D" | "L")[],
        }));

    return (
      <div>
        {/* Table container */}
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <div className="min-w-full">
              {/* Header */}
              <div className="grid grid-cols-[48px_80px_200px] gap-0 bg-slate-50 text-xs font-semibold text-slate-600">
                <div className="px-2 py-3 text-left">#</div>
                <div className="px-2 py-3 text-left">PLAYER</div>
                {showForm ? (
                  <div className="px-2 py-3 text-left">FORM</div>
                ) : (
                  <div className="px-2 py-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-center font-semibold w-8">W</span>
                      <span className="text-center font-semibold w-8">D</span>
                      <span className="text-center font-semibold w-10">OCP</span>
                      <span className="text-center font-semibold w-8">🦄</span>
                      <span className="text-center font-semibold w-10">PTS</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Rows */}
              {rows.map((r, i) => (
                <div key={r.user_id} className="grid grid-cols-[48px_80px_200px] gap-0 border-t border-slate-200 text-sm">
                  <div className="px-2 py-3 font-semibold text-slate-600">{i + 1}</div>
                  <div className="px-2 py-3 font-bold text-slate-900 truncate">{r.name}</div>
                  <div className="px-2 py-3">
                    {showForm ? (
                      renderForm(r.form)
                    ) : (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-center font-semibold w-8">{r.wins}</span>
                        <span className="text-center font-semibold w-8">{r.draws}</span>
                        <span className="text-center font-semibold w-10">{r.ocp}</span>
                        <span className="text-center font-semibold w-8">{r.unicorns}</span>
                        <span className="text-center font-bold text-emerald-600 w-10">{r.mltPts}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {mltLoading && <div className="p-3 text-slate-500 text-xs sm:text-sm">Calculating…</div>}
          {!mltLoading && !mltRows.length && (
            <div className="p-3 text-slate-500 text-xs sm:text-sm">
              No gameweeks completed yet — this will populate after the first results are saved.
            </div>
          )}
        </div>
        
        {/* Toggle switch outside the table */}
        <div className="mt-3 flex justify-end">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 shadow-sm">
            <button
              onClick={() => setShowForm(false)}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                !showForm
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              Points
            </button>
            <button
              onClick={() => setShowForm(true)}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                showForm
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              Form
            </button>
          </div>
        </div>
      </div>
    );
  }

  function GwPicksTab() {
    const picksGw = currentGw;
    if (!picksGw) {
      return (
        <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-600">
          No active gameweek yet.
        </div>
      );
    }
    // Build outcome map for current GW directly from gw_results
    const outcomes = new Map<number, "H" | "D" | "A">(); // fixture_index -> outcome
    results.forEach((r) => {
      if (r.gw !== picksGw) return;
      const out = rowToOutcome(r);
      if (!out) return;
      outcomes.set(r.fixture_index, out);
    });

    // Group fixtures by kickoff date, ordered by date
    const sections = useMemo(() => {
      const fmt = (iso?: string | null) => {
        if (!iso) return "Fixtures";
        const d = new Date(iso);
        if (isNaN(d.getTime())) return "Fixtures";
        return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      };
      const buckets = new Map<string, { label: string; key: number; items: Fixture[] }>();
      fixtures
        .filter((f) => f.gw === picksGw)
        .forEach((f) => {
          const label = fmt(f.kickoff_time);
          const key = f.kickoff_time ? new Date(f.kickoff_time).getTime() : Number.MAX_SAFE_INTEGER;
          if (!buckets.has(label)) buckets.set(label, { label, key, items: [] });
          buckets.get(label)!.items.push(f);
        });
      const out = Array.from(buckets.values());
      out.forEach((b) => b.items.sort((a, b) => a.fixture_index - b.fixture_index));
      out.sort((a, b) => a.key - b.key);
      return out;
    }, [fixtures, picksGw]);

    // Index picks by fixture_index for this GW
    const picksByFixture = new Map<number, PickRow[]>();
    picks.forEach((p) => {
      if (p.gw !== picksGw) return;
      const arr = picksByFixture.get(p.fixture_index) ?? [];
      arr.push(p);
      picksByFixture.set(p.fixture_index, arr);
    });

    const allSubmitted =
      members.length > 0 && members.every((m) => submittedMap.get(`${m.id}:${picksGw}`));
    const resultsPublished = latestResultsGw !== null && latestResultsGw >= picksGw;
    const remaining = members.filter((m) => !submittedMap.get(`${m.id}:${picksGw}`)).length;


    return (
      <div className="mt-4">
        <div className="flex items-center gap-4 text-sm mb-4">
          <div className="text-slate-900 font-bold text-xl">Game Week {picksGw}</div>
          {allSubmitted && resultsPublished ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold border border-emerald-300 shadow-sm">
              Round Complete!
            </span>
          ) : allSubmitted ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-bold border border-blue-300 shadow-sm">
              All Submitted
            </span>
          ) : (
            <span className="text-slate-500">not all submitted</span>
          )}
        </div>

        {/* Fun line for waiting state */}
        {!allSubmitted && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-blue-800 font-medium text-sm">
              👀 Watch this space! You'll see everyone's picks once everybody has submitted
            </div>
          </div>
        )}

        {/* Sections (only show once all members have submitted) */}
        {!allSubmitted ? (
          <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-700">
            <div className="mb-3">
              Waiting for <span className="font-semibold">{remaining}</span> of {members.length} to submit.
            </div>

            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 w-2/3 font-semibold text-slate-600">Player</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {members
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((m) => {
                      const submitted = !!submittedMap.get(`${m.id}:${picksGw}`);
                      return (
                        <tr key={m.id} className="border-t border-slate-200">
                          <td className="px-4 py-3 font-bold text-slate-900">{m.name}</td>
                          <td className="px-4 py-3">
                            {submitted ? (
                              <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs px-2 py-1 border border-emerald-300 font-bold shadow-sm whitespace-nowrap w-24">
                                ✅ Submitted
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center rounded-full bg-amber-50 text-amber-700 text-xs px-2 py-1 border border-amber-200 font-semibold whitespace-nowrap w-24">
                                ⏳ Not yet
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-8">
            {sections.map((sec, si) => (
              <div key={si}>
                <div className="text-slate-600 font-bold mb-4 text-lg">{sec.label}</div>
                <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-xs font-semibold text-slate-600">
                        <th className="text-center px-4 py-4 w-[32%]">Fixture</th>
                        <th className="text-center px-3 py-4 w-[22%] border-l border-slate-200">Home</th>
                        <th className="text-center px-3 py-4 w-[23%] border-l border-slate-200">Draw</th>
                        <th className="text-center px-3 py-4 w-[23%] border-l border-slate-200">Away</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sec.items.map((f) => {
                        try {
                          // Get team names safely
                          const homeName = f.home_name || f.home_team || "Home";
                          const awayName = f.away_name || f.away_team || "Away";
                          
                          // Format kickoff time
                          const timeOf = (iso?: string | null) => {
                            if (!iso) return "";
                            const d = new Date(iso);
                            if (isNaN(d.getTime())) return "";
                            return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                          };
                          const timeStr = timeOf(f.kickoff_time);
                          
                          // Get picks for this fixture
                          const fxIdx = f.fixture_index;
                          const these = picksByFixture.get(fxIdx) ?? [];
                          
                          // Create chips for each pick type
                          const toChips = (want: "H" | "D" | "A") =>
                            these
                              .filter((p) => p.pick === want)
                              .map((p) => {
                                const m = members.find((mm) => mm.id === p.user_id);
                                const letter = initials(m?.name ?? "?");
                                const actualResult = outcomes.get(fxIdx);
                                const isCorrect = actualResult === want;
                                return (
                                  <Chip
                                    key={p.user_id}
                                    letter={letter}
                                    correct={actualResult ? isCorrect : null} // null if no result yet, boolean if result exists
                                    unicorn={false}
                                  />
                                );
                              });
                          
                          return (
                            <tr key={`${f.gw}-${f.fixture_index}`} className="border-b border-slate-200">
                              <td className="px-4 py-3 text-slate-900 font-bold border-r border-slate-200">
                                <div>
                                  <div>{homeName} v {awayName}</div>
                                  {timeStr && <div className="text-xs text-slate-500 mt-1">{timeStr}</div>}
                                </div>
                              </td>
                              <td className="px-4 py-3 bg-emerald-50/30 border-r border-slate-200">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {toChips("H")}
                                </div>
                              </td>
                              <td className="px-4 py-3 bg-slate-50/50 border-r border-slate-200">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {toChips("D")}
                                </div>
                              </td>
                              <td className="px-4 py-3 bg-blue-50/30">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {toChips("A")}
                                </div>
                              </td>
                            </tr>
                          );
                        } catch (error) {
                          console.error('Error rendering fixture:', error, f);
                          return (
                            <tr key={`${f.gw}-${f.fixture_index}`}>
                              <td className="px-4 py-3 text-red-500" colSpan={4}>
                                Error loading fixture: {f.fixture_index}
                              </td>
                            </tr>
                          );
                        }
                      })}
                      {!sec.items.length && (
                        <tr>
                          <td className="px-3 py-4 text-slate-500" colSpan={4}>
                            No fixtures.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {!sections.length && (
              <div className="rounded-2xl border bg-white shadow-sm p-4 text-slate-500">
                No fixtures for GW {picksGw}.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function GwResultsTab() {
    const resGw = latestResultsGw;
    if (!resGw) {
      return (
        <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-600">
          No results have been recorded yet.
        </div>
      );
    }
    // Build outcome map for current GW directly from gw_results
    const outcomes = new Map<number, "H" | "D" | "A">(); // fixture_index -> outcome
    results.forEach((r) => {
      if (r.gw !== resGw) return;
      const out = rowToOutcome(r);
      if (!out) return;
      outcomes.set(r.fixture_index, out);
    });

    // Calculate score + unicorns for this GW
    type Row = { user_id: string; name: string; score: number; unicorns: number };
    const rows: Row[] = members.map((m) => ({
      user_id: m.id,
      name: m.name,
      score: 0,
      unicorns: 0,
    }));

    const picksByFixture = new Map<number, PickRow[]>();
    picks.forEach((p) => {
      if (p.gw !== resGw) return;
      const arr = picksByFixture.get(p.fixture_index) ?? [];
      arr.push(p);
      picksByFixture.set(p.fixture_index, arr);
    });

    Array.from(outcomes.entries()).forEach(([idx, out]) => {
      const these = picksByFixture.get(idx) ?? [];
      const correctIds = these.filter((p) => p.pick === out).map((p) => p.user_id);

      // +1 per correct
      correctIds.forEach((uid) => {
        const r = rows.find((x) => x.user_id === uid)!;
        r.score += 1;
      });

      // unicorn
      if (correctIds.length === 1) {
        const r = rows.find((x) => x.user_id === correctIds[0])!;
        r.unicorns += 1;
      }
    });

    rows.sort((a, b) => (b.score - a.score) || (b.unicorns - a.unicorns) || a.name.localeCompare(b.name));

    return (
      <div className="mt-4">
        <div className="text-slate-900 font-bold text-xl mb-4">Game Week {resGw}</div>
        
        {/* Winner Section */}
        {rows.length > 0 && (
          <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 shadow-xl shadow-yellow-400/40 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/30 after:to-transparent after:animate-[shimmer_2.5s_ease-in-out_infinite_0.6s] ring-4 ring-yellow-300/50">
            <div className="text-center relative z-10">
              {rows[0].score === rows[1]?.score && rows[0].unicorns === rows[1]?.unicorns ? (
                <div className="text-lg font-bold text-white">
                  🤝 It's a Draw!
                </div>
              ) : (
                <div className="text-lg font-bold text-white">
                  🏆 {rows[0].name} Wins!
                </div>
              )}
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Player</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Score</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">🦄</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-bold text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 text-center font-semibold text-emerald-600">{r.score}</td>
                  <td className="px-4 py-3 text-center font-semibold">{r.unicorns}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className="px-4 py-6 text-slate-500 text-center" colSpan={3}>
                    No results recorded for GW {resGw} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ---------- page chrome ---------- */
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-slate-500">Loading…</div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded border bg-white p-6">
          <div className="font-semibold mb-2">League not found</div>
          <Link to="/leagues" className="text-slate-600 underline">
            Back to Mini Leagues
          </Link>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-16">
        {/* Header with back link */}
        <div className="mb-6">
          <Link
            to="/leagues"
            className="inline-flex items-center text-slate-500 hover:text-slate-700 text-sm mb-3"
          >
            ← Back to Mini Leagues
          </Link>
          
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mt-0 mb-2">
              {league.name}
            </h1>
            
            <div className="mt-0 mb-6 text-base text-slate-500">
              Code: <span className="font-mono font-semibold">{league.code}</span> · {members.length} member{members.length === 1 ? "" : "s"}
            </div>
            
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={shareLeague}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors text-sm font-medium"
                title="Share league code"
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
                Share
              </button>
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="px-3 py-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors text-sm font-medium"
                title="Leave league"
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Leave
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 shadow-sm">
            <button
              onClick={() => setTab("gwr")}
              className={
                "px-6 py-3 rounded-md text-sm font-semibold transition-colors " +
                (tab === "gwr"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50")
              }
            >
              {latestResultsGw ? `GW ${latestResultsGw} Results` : "GW Results"}
            </button>
            <button
              onClick={() => setTab("gw")}
              className={
                "px-6 py-3 rounded-md text-sm font-semibold transition-colors " +
                (tab === "gw"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50")
              }
            >
              {currentGw ? `GW ${currentGw} Picks` : "GW Picks"}
            </button>
            <button
              onClick={() => setTab("mlt")}
              className={
                "px-6 py-3 rounded-md text-sm font-semibold transition-colors " +
                (tab === "mlt"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50")
              }
            >
              Table
            </button>
          </div>
        </div>

        <div className="mt-6">
          {tab === "mlt" && <MltTab />}
          {tab === "gw" && <GwPicksTab />}
          {tab === "gwr" && <GwResultsTab />}
        </div>
      </div>

      {/* Leave League Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Leave League
            </h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to leave "{league?.name}"? You'll need the league code to rejoin later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                disabled={leaving}
              >
                Cancel
              </button>
              <button
                onClick={leaveLeague}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={leaving}
              >
                {leaving ? "Leaving..." : "Leave League"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}