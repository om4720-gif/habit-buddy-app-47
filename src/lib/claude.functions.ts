import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getClaudeFeedToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("claude_feed_tokens")
      .select("token")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return { token: existing.token };
    const { data, error } = await supabase
      .from("claude_feed_tokens")
      .insert({ user_id: userId })
      .select("token")
      .single();
    if (error) throw new Error("Could not create link");
    return { token: data.token };
  });
