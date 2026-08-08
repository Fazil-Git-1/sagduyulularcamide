import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Team = {
  id: string;
  name: string;
  is_active: boolean;
  total_score: number;
  created_at: string;
};

export const teamsQuery = queryOptions({
  queryKey: ["teams"],
  queryFn: async (): Promise<Team[]> => {
    const [teamsRes, scoresRes] = await Promise.all([
      supabase.from("teams").select("id, name, is_active, total_score, created_at"),
      supabase.from("scores").select("team_id, score"),
    ]);
    if (teamsRes.error) throw teamsRes.error;
    if (scoresRes.error) throw scoresRes.error;

    const totals = new Map<string, number>();
    for (const row of scoresRes.data ?? []) {
      totals.set(row.team_id, (totals.get(row.team_id) ?? 0) + (row.score ?? 0));
    }

    return ((teamsRes.data ?? []) as Team[])
      .map((t) => ({ ...t, total_score: totals.get(t.id) ?? 0 }))
      .sort((a, b) => b.total_score - a.total_score || a.name.localeCompare(b.name, "tr"));
  },
});

export const teamScoresQuery = (teamId: string) =>
  queryOptions({
    queryKey: ["scores", teamId],
    enabled: !!teamId,
    queryFn: async (): Promise<{ date: string; score: number }[]> => {
      const { data, error } = await supabase
        .from("scores")
        .select("date, score")
        .eq("team_id", teamId)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const settingsQuery = queryOptions({
  queryKey: ["contest_settings"],
  queryFn: async (): Promise<{ start_date: string }> => {
    const { data, error } = await supabase
      .from("contest_settings")
      .select("start_date")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data ?? { start_date: new Date().toISOString().slice(0, 10) };
  },
});
