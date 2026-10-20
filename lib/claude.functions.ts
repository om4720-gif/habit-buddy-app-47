import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { limitUser, MINUTE } from "@/lib/rate-limit.server";

export const getClaudeFeedToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    limitUser(userId, "feed-token", [{ limit: 20, windowMs: MINUTE, label: "link" }]);
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

/** Replaces the link, so anyone who had the old one can no longer read the feed. */
export const resetClaudeFeedToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    limitUser(userId, "feed-token", [{ limit: 20, windowMs: MINUTE, label: "link" }]);
    const { error: deleteError } = await supabase.from("claude_feed_tokens").delete().eq("user_id", userId);
    if (deleteError) throw new Error("Could not reset the link");
    const { data, error } = await supabase
      .from("claude_feed_tokens")
      .insert({ user_id: userId })
      .select("token")
      .single();
    if (error) throw new Error("Could not create a new link");
    return { token: data.token };
  });
