import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type UserSettings = { agent_name: string; habit_page_name: string };
const DEFAULTS: UserSettings = { agent_name: "Mero", habit_page_name: "Main habit" };

export function useUserSettings() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["user-settings"],
    queryFn: async (): Promise<UserSettings> => {
      const { data } = await supabase.from("user_settings").select("agent_name, habit_page_name").maybeSingle();
      return data ?? DEFAULTS;
    },
  });
  const save = async (s: UserSettings) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: u.user.id, ...s, updated_at: new Date().toISOString() });
    if (error) throw error;
    qc.setQueryData(["user-settings"], s);
  };
  return { settings: q.data ?? DEFAULTS, save };
}
