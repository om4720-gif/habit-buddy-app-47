import { createOpenAI } from "@ai-sdk/openai";
import { createServerFn } from "@tanstack/react-start";
import { stepCountIs, streamText, tool } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const msgSchema = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(40),
});

export const askMero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => msgSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const agentName = (await sb.from("user_settings").select("agent_name").maybeSingle()).data?.agent_name || "Mero";
    const [courses, lectures, deadlines, habits, comps] = await Promise.all([
      sb.from("courses").select("id, name, code"),
      sb.from("lectures").select("id, course_id, title, kind, completed"),
      sb.from("deadlines").select("id, course_id, title, kind, due_date, completed"),
      sb.from("habits").select("id, name").eq("archived", false),
      sb.from("habit_completions").select("habit_id").eq("completed_date", data.today),
    ]);
    for (const r of [courses, lectures, deadlines, habits, comps]) if (r.error) throw new Error(r.error.message);

    const lines: string[] = [`Today: ${data.today}`, "COURSES:"];
    for (const c of courses.data ?? []) {
      lines.push(`- ${c.name}${c.code ? ` (${c.code})` : ""} [course_id=${c.id}]`);
      for (const l of (lectures.data ?? []).filter((l) => l.course_id === c.id))
        lines.push(`  - ${l.title} (${l.kind}) ${l.completed ? "STUDIED" : "not studied"} [lecture_id=${l.id}]`);
    }
    lines.push("DEADLINES:");
    for (const d of deadlines.data ?? [])
      lines.push(`- ${d.kind} "${d.title}" course_id=${d.course_id} due ${d.due_date} ${d.completed ? "DONE" : "open"} [deadline_id=${d.id}]`);
    const doneToday = new Set((comps.data ?? []).map((c) => c.habit_id));
    lines.push("HABITS:");
    for (const h of habits.data ?? [])
      lines.push(`- ${h.name} ${doneToday.has(h.id) ? "done today" : "not done today"} [habit_id=${h.id}]`);

    let changed = false;
    const ok = (error: { message: string } | null) => {
      if (error) return { ok: false, error: error.message };
      changed = true;
      return { ok: true };
    };

    const tools = {
      set_lecture_studied: tool({
        description: "Mark a lecture or tutorial as studied or not studied.",
        inputSchema: z.object({ lecture_id: z.string(), studied: z.boolean() }),
        execute: async ({ lecture_id, studied }) =>
          ok((await sb.from("lectures").update({ completed: studied, updated_at: new Date().toISOString() } as never).eq("id", lecture_id)).error),
      }),
      set_deadline_done: tool({
        description: "Mark an assignment or quiz as done or not done.",
        inputSchema: z.object({ deadline_id: z.string(), done: z.boolean() }),
        execute: async ({ deadline_id, done }) =>
          ok((await sb.from("deadlines").update({ completed: done, updated_at: new Date().toISOString() } as never).eq("id", deadline_id)).error),
      }),
      add_deadline: tool({
        description: "Add a new assignment or quiz to a course. due_date is YYYY-MM-DD.",
        inputSchema: z.object({ course_id: z.string(), title: z.string(), kind: z.enum(["assignment", "quiz"]), due_date: z.string() }),
        execute: async (a) =>
          ok((await sb.from("deadlines").insert({ course_id: a.course_id, title: a.title, kind: a.kind, due_date: a.due_date } as never)).error),
      }),
      add_lecture: tool({
        description: "Add a lecture or tutorial to a course, e.g. title 'Lecture 7'.",
        inputSchema: z.object({ course_id: z.string(), title: z.string(), kind: z.enum(["lecture", "tutorial"]) }),
        execute: async (a) =>
          ok((await sb.from("lectures").insert({ course_id: a.course_id, title: a.title, kind: a.kind } as never)).error),
      }),
      complete_habit_today: tool({
        description: "Mark a habit as done today.",
        inputSchema: z.object({ habit_id: z.string() }),
        execute: async ({ habit_id }) =>
          doneToday.has(habit_id)
            ? { ok: true }
            : ok((await sb.from("habit_completions").insert({ habit_id, completed_date: data.today } as never)).error),
      }),
    };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured.");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions:
          `You are ${agentName}, a warm voice assistant and study coach for a university student. Replies are read aloud, so keep them short (1-3 sentences), no markdown, no lists, no ids. ALWAYS reply in the same language the user spoke (Arabic, including Egyptian dialect, or English). When the user says they finished/studied something or did a habit, call the right tool with the exact id from the data, then confirm briefly. Match courses and items flexibly (e.g. 'lecture two' = 'Lecture 2' or 'L2'; Arabic course names may be spoken in Arabic). If ambiguous, ask a short question. Never invent ids.\n\nDATA:\n" +
          lines.join("\n"),
        messages: data.messages,
        tools,
        stopWhen: stepCountIs(50),
        providerOptions: {
          openai: {
            store: false,
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const reply = (await result.text).trim();
      return { reply: reply || "Done.", changed };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 402) throw new Error("Out of AI credits — add credits to keep talking to Mero.");
      if (status === 429) throw new Error("Mero is busy right now. Try again in a minute.");
      throw new Error(e instanceof Error ? e.message : "Mero couldn't answer.");
    }
  });
