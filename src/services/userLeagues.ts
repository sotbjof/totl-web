// src/services/userLeagues.ts
import { supabase } from "../lib/supabase";

export type UserLeague = {
  id: string;
  name: string;
  code: string;
};

/**
 * Return all leagues the given user belongs to.
 * Uses a join from league_members → leagues so we get {id,name,code} in one hit.
 */
export async function fetchUserLeagues(userId: string): Promise<UserLeague[]> {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("league_members")
    .select("leagues(id,name,code)")
    .eq("user_id", userId);

  if (error) throw error;

  const leagues =
    (data ?? [])
      .map((row: any) => row.leagues)
      .filter(Boolean) as UserLeague[];

  // stable, tidy order
  leagues.sort((a, b) => a.name.localeCompare(b.name));
  return leagues;
}