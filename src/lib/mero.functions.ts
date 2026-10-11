import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MeroAction = {
  type: "mark_lecture_studied" | "mark_deadline_done";
  id: string;
  label: string;
};

export type MeroBriefing = {
  greeting: string;
  summary: string;
  focus: string[];
  actions: MeroAction[];
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["greeting", "summary", "focus", "actions"],
  properties: {
    greeting: { type: "string" },
    summary: { type: "string" },
    focus: { type: "array", items: { type: "string" } },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "id", "label"],
        properties: {
          type: { type: "string", enum: ["mark_lecture_studied", "mark_deadline_done"] },
          id: { type: "string" },
          label: { type: "string" },
        },
      },
    },
  },
};

export const getMeroBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }): Promise<MeroBriefing> => {
    const sb = context.supabase;
    const agentName = (await sb.from("user_settings").select("agent_name").maybeSingle()).data?.agent_name || "Mero";
    const [courses, lectures, deadlines, habits, comps] = await Promise.all([
      sb.from("courses").select("id, name"),
      sb.from("lectures").select("id, course_id, title, kind, completed"),
      sb.from("deadlines").select("id, course_id, title, kind, due_date, completed"),
      sb.from("habits").select("id, name").eq("archived", false),
      sb.from("habit_completions").select("habit_id, completed_date").gte(
        "completed_date",
        new Date(Date.parse(data.today) - 6 * 86400000).toISOString().slice(0, 10),
      ),
    ]);
    for (const r of [courses, lectures, deadlines, habits, comps]) if (r.error) throw new Error(r.error.message);

    const courseName = new Map((courses.data ?? []).map((c) => [c.id, c.name]));
    const lec = lectures.data ?? [];
    const dl = deadlines.data ?? [];
    const lines: string[] = [`Today: ${data.today}`, "", "COURSES:"];
    for (const c of courses.data ?? []) {
      const items = lec.filter((l) => l.course_id === c.id);
      const done = items.filter((l) => l.completed).length;
      lines.push(`- ${c.name}: ${done}/${items.length} studied`);
      for (const l of items.filter((l) => !l.completed).slice(0, 8))
        lines.push(`  - not studied: ${l.title} (${l.kind}) [lecture_id=${l.id}]`);
    }
    lines.push("", "DEADLINES:");
    for (const d of dl.filter((d) => !d.completed))
      lines.push(`- ${d.kind} "${d.title}" for ${courseName.get(d.course_id) ?? "?"} due ${d.due_date} [deadline_id=${d.id}]`);
    lines.push("", "HABITS (completions last 7 days):");
    for (const h of habits.data ?? [])
      lines.push(`- ${h.name}: ${(comps.data ?? []).filter((c) => c.habit_id === h.id).length}/7`);

    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error("AI is not configured.");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions:
          `You are ${agentName}, a warm, concise study coach for a university student. Write a daily briefing from their data. greeting: one short line signed as ${agentName}. summary: 2-4 sentences on what's urgent (overdue, due today/tomorrow/this week) and overall progress. focus: 3-5 short, specific to-dos for today in priority order. actions: up to 4 one-tap changes the student would likely want (mark an assignment/quiz done, or mark a lecture/tutorial studied), using ONLY ids given in the data; label like 'Mark Physics Lecture 3 studied'. Never invent deadlines.`,
        input: lines.join("\n"),
        text: { format: { type: "json_schema", name: "briefing", strict: true, schema } },
      }),
    });
    if (!res.ok || !res.body) {
      const msg = await res.text().catch(() => "");
      if (res.status === 402) throw new Error("Out of AI credits — add credits to keep using Mero.");
      if (res.status === 429) throw new Error("Mero is busy right now. Try again in a minute.");
      throw new Error(`Mero couldn't write a briefing (${res.status}). ${msg.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const p = line.slice(5).trim();
        if (!p || p === "[DONE]") continue;
        try {
          const ev = JSON.parse(p);
          if (ev.type === "response.output_text.delta") text += ev.delta;
          if (ev.type === "error" || ev.type === "response.failed")
            throw new Error(ev.error?.message ?? ev.response?.error?.message ?? "Mero failed.");
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
    const out = JSON.parse(text) as MeroBriefing;
    const lecIds = new Set(lec.filter((l) => !l.completed).map((l) => l.id));
    const dlIds = new Set(dl.filter((d) => !d.completed).map((d) => d.id));
    out.actions = (out.actions ?? [])
      .filter((a) => (a.type === "mark_lecture_studied" ? lecIds.has(a.id) : dlIds.has(a.id)))
      .slice(0, 4);
    out.focus = (out.focus ?? []).slice(0, 5);
    return out;
  });
