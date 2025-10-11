import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Member = { id: string; name: string };
type League = { id: string; code: string; name: string; created_at: string };

export default function LeaguePage() {
  const { code: rawCode } = useParams();
  const code = (rawCode ?? "").trim().toUpperCase();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);

      // 1) find league by code
      const { data: lg, error: lgErr } = await supabase
        .from("leagues")
        .select("id, code, name, created_at")
        .eq("code", code)
        .maybeSingle();

      if (cancelled) return;

      if (lgErr || !lg) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setLeague(lg);

      // 2) load members via join
      const { data: rows, error: mErr } = await supabase
        .from("league_members")
        .select("user_id, users(name)")
        .eq("league_id", lg.id);

      if (cancelled) return;

      if (mErr) {
        // degrade gracefully: show league with empty members
        setMembers([]);
      } else {
        setMembers(
          (rows ?? []).map((r: any) => ({
            id: r.user_id,
            name: r.users?.name ?? "Unknown",
          }))
        );
      }

      setLoading(false);
    }

    if (code.length === 5) load();
    else {
      setNotFound(true);
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (loading) {
    return <div className="text-slate-500">Loading…</div>;
  }

  if (notFound || !league) {
    return (
      <div className="max-w-xl">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">League not found</h2>
          <div className="mt-2 text-sm text-slate-600">
            Code: <span className="font-mono">{code}</span>
          </div>
          <div className="mt-4">
            <Link
              to="/tables"
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              Back to Tables
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{league.name}</h1>
            <div className="text-xs text-slate-500">
              Code: <span className="font-mono">{league.code}</span> · Created{" "}
              {new Date(league.created_at).toLocaleDateString()}
            </div>
          </div>
          <div className="text-xs text-slate-400">loaded from Supabase</div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Members</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-600">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">User ID</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-500" colSpan={2}>
                    No members yet.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{m.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">
                      {m.id}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <Link
            to="/tables"
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            Back to Tables
          </Link>
        </div>
      </section>
    </div>
  );
}