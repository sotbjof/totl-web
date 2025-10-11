import { supabase } from "./supabase";

export type League = {
  id: string;
  name: string;
  code: string;
  created_at: string;
};

export type LeagueMember = {
  id: string;
  name: string;
};

export async function getLeagueByCode(code: string): Promise<League | null> {
  const { data, error } = await supabase
    .from("leagues")
    .select("id, code, name, created_at")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
  const { data, error } = await supabase
    .from("league_members")
    .select("user_id, users(name)")
    .eq("league_id", leagueId);

  if (error) {
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.user_id,
    name: row.users?.name ?? "Unknown",
  }));
}

export async function joinLeague(code: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Find league by code
    const league = await getLeagueByCode(code);
    if (!league) {
      return { success: false, error: "League not found" };
    }

    // Check if league is full
    const members = await getLeagueMembers(league.id);
    if (members.length >= 8) {
      return { success: false, error: "League is full" };
    }

    // Add user to league
    const { error } = await supabase
      .from("league_members")
      .upsert(
        { league_id: league.id, user_id: userId },
        { onConflict: "league_id,user_id" }
      );

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to join league" };
  }
}

export async function leaveLeague(leagueId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("league_members")
      .delete()
      .eq("league_id", leagueId)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to leave league" };
  }
}

export async function createLeague(name: string, userId: string): Promise<{ success: boolean; league?: League; error?: string }> {
  try {
    // Generate a random 5-character code
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();

    // Create league
    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .insert({ name, code })
      .select("id, name, code, created_at")
      .single();

    if (leagueError) {
      return { success: false, error: leagueError.message };
    }

    // Add creator as member
    const { error: memberError } = await supabase
      .from("league_members")
      .insert({ league_id: league.id, user_id: userId });

    if (memberError) {
      return { success: false, error: memberError.message };
    }

    return { success: true, league };
  } catch (error) {
    return { success: false, error: "Failed to create league" };
  }
}
