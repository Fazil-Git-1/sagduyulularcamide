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
    const { data, error } = await supabase
      .from("teams")
      .select("id, name, is_active, total_score, created_at")
      .order("total_score", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Team[];
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
