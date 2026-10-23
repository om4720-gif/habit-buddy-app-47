import { createFileRoute } from "@tanstack/react-router";

import { syncFeed } from "@/lib/feed-sync.server";

// Called by the scheduler (see docs/grade-feed-schedule.sql). It checks every connected link once.
// It only runs with the CRON_SECRET, so nobody else can trigger it.
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/public/grade-feed-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        const sent = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        if (!secret || sent.length !== secret.length || !timingSafeEqual(sent, secret)) return json(401, { error: "Unauthorized" });

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: feeds, error } = await db.from("grade_feeds").select("id, user_id, encrypted_url").eq("enabled", true).limit(200);
        if (error) return json(500, { error: error.message });

        const results = [];
        for (const feed of feeds ?? []) {
          results.push({ id: feed.id, ...(await syncFeed(db as never, feed)) });
          await new Promise((r) => setTimeout(r, 1000)); // be gentle with the other app
        }
        return json(200, { checked: results.length, results: results.map(({ id, status }) => ({ id, status })) });
      },
    },
  },
});

function timingSafeEqual(a: string, b: string) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
