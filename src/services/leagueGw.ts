import { supabase } from "../lib/supabase";

export type GwPickRow = {
  league_id: string;
  gw: number;
  fixture_index: number;
  home_code: string | null;
  away_code: string | null;
  kickoff_time: string | null;
  user_id: string;
  name: string;
  pick: "H" | "D" | "A";
  is_correct: boolean | null;   // null before result exists
  is_unicorn: boolean | null;   // null before result exists
};

export type GwScoreRow = {
  league_id: string;
  gw: number;
  user_id: string;
  name: string;
  points: number;
  unicorns: number;
  is_win: boolean;
  is_draw: boolean;
};

export async function fetchLeagueGwPicks(leagueId: string, gw: number) {
  const { data, error } = await supabase
    .from("v_league_gw_picks")
    .select("*")
    .eq("league_id", leagueId)
    .eq("gw", gw)
    .order("fixture_index", { ascending: true });

  if (error) throw error;
  return (data ?? []) as GwPickRow[];
}

export async function fetchLeagueGwScores(leagueId: string, gw: number) {
  const { data, error } = await supabase
    .from("v_league_gw_scores_named")
    .select("*")
    .eq("league_id", leagueId)
    .eq("gw", gw)
    .order("points", { ascending: false })
    .order("unicorns", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as GwScoreRow[];
}