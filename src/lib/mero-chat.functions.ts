import { createOpenAI } from "@ai-sdk/openai";
import { createServerFn } from "@tanstack/react-start";
import { stepCountIs, streamText, tool, type LanguageModel } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bestMatch, titleNumber } from "@/lib/mero-match";
import {
  getFallbackAI,
  isOutOfCredits,
  markPrimaryDown,
  primaryIsDown,
} from "@/lib/ai-fallback.server";

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

    const courseRows = courses.data ?? [];
    const lectureRows = lectures.data ?? [];
    const deadlineRows = deadlines.data ?? [];
    const habitRows = habits.data ?? [];
    const doneToday = new Set((comps.data ?? []).map((c) => c.habit_id));
    const courseName = (id: string) => courseRows.find((c) => c.id === id)?.name ?? "?";

    // Reply in the language the user spoke (Arabic script anywhere in their last message = Arabic).
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    const ar = /[\u0600-\u06FF]/.test(lastUser?.content ?? "");
    const say = (en: string, arText: string) => (ar ? arText : en);
    const kindAr = (k: string) => (k === "lecture" ? "محاضرة" : k === "tutorial" ? "تيوتوريال" : k);

    // The model works with names and numbers (easy to copy), never database ids.
    const lines: string[] = [`Today: ${data.today}`, "COURSES (use these exact names in tools):"];
    for (const c of courseRows) {
      lines.push(`- ${c.name}${c.code ? ` [code ${c.code}]` : ""}`);
      for (const kind of ["lecture", "tutorial"] as const) {
        const items = lectureRows
          .filter((l) => l.course_id === c.id && l.kind === kind)
          .sort((x, y) => (titleNumber(x.title) ?? 1e9) - (titleNumber(y.title) ?? 1e9));
        if (items.length)
          lines.push(
            `  ${kind}s: ` +
              items.map((l) => `${titleNumber(l.title) ?? `"${l.title}"`} ${l.completed ? "done" : "open"}`).join(", "),
          );
      }
    }
    lines.push("DEADLINES:");
    for (const d of deadlineRows)
      lines.push(`- ${d.kind} "${d.title}" (${courseName(d.course_id)}) due ${d.due_date} ${d.completed ? "done" : "open"}`);
    lines.push("HABITS:");
    for (const h of habitRows) lines.push(`- ${h.name}: ${doneToday.has(h.id) ? "done today" : "not done today"}`);

    let changed = false;
    const doneActions: string[] = [];
    const toolErrors: string[] = [];
    const fail = (message: string) => {
      toolErrors.push(message);
      return { ok: false as const, error: message };
    };
    const success = (label: string) => {
      changed = true;
      doneActions.push(label);
      return { ok: true as const, done: label };
    };

    const findCourse = (q: string): { course: (typeof courseRows)[number] } | { error: string } => {
      const m = bestMatch(q, courseRows, (c) => [c.name, c.code ?? ""]);
      if ("item" in m) return { course: m.item };
      if ("ambiguous" in m) {
        const list = m.ambiguous.map((c) => c.name);
        return { error: say(`Which course: ${list.join(" or ")}?`, `تقصد أنهي كورس: ${list.join(" ولا ")}؟`) };
      }
      return { error: say(`I couldn't find a course called "${q}".`, `مالقيتش كورس اسمه "${q}".`) };
    };

    const tools = {
      set_lecture_studied: tool({
        description: "Mark a lecture or tutorial as studied (or not studied). Identify it by course name, kind and number.",
        inputSchema: z.object({
          course: z.string().describe("Course name exactly as written in DATA"),
          kind: z.enum(["lecture", "tutorial"]),
          number: z.number().int().optional().describe("The lecture/tutorial number, e.g. 3"),
          title: z.string().optional().describe("Only for items without a number: their title"),
          studied: z.boolean(),
        }),
        execute: async (a) => {
          const found = findCourse(a.course);
          if ("error" in found) return fail(found.error);
          const pool = lectureRows.filter((l) => l.course_id === found.course.id && l.kind === a.kind);
          let target: (typeof pool)[number] | undefined;
          if (a.number != null) target = pool.find((l) => titleNumber(l.title) === a.number);
          else if (a.title) {
            const m = bestMatch(a.title, pool, (l) => [l.title]);
            if ("item" in m) target = m.item;
          }
          if (!target) {
            const what = String(a.number ?? a.title ?? "");
            return fail(
              say(
                `I couldn't find ${a.kind} ${what} in ${found.course.name}.`,
                `مالقيتش ${kindAr(a.kind)} ${what} في ${found.course.name}.`,
              ),
            );
          }
          const { error } = await sb
            .from("lectures")
            .update({ completed: a.studied, updated_at: new Date().toISOString() } as never)
            .eq("id", target.id);
          if (error) return fail(error.message);
          target.completed = a.studied;
          return success(`${found.course.name} · ${target.title}${a.studied ? "" : " (unmarked)"}`);
        },
      }),
      set_deadline_done: tool({
        description: "Mark an assignment or quiz as done (or not done). Identify it by its title, optionally with the course name.",
        inputSchema: z.object({
          title: z.string().describe("The assignment/quiz title as written in DATA, e.g. 'Assignment 2'"),
          course: z.string().optional(),
          done: z.boolean(),
        }),
        execute: async (a) => {
          let pool = deadlineRows;
          if (a.course) {
            const found = findCourse(a.course);
            if ("error" in found) return fail(found.error);
            pool = deadlineRows.filter((d) => d.course_id === found.course.id);
          }
          const m = bestMatch(a.title, pool, (d) => [d.title, `${d.kind} ${titleNumber(d.title) ?? ""}`]);
          if ("ambiguous" in m)
            return fail(
              say(
                `Which one: ${m.ambiguous.map((d) => d.title).join(" or ")}?`,
                `تقصد أنهي واحد: ${m.ambiguous.map((d) => d.title).join(" ولا ")}؟`,
              ),
            );
          if ("none" in m) return fail(say(`I couldn't find "${a.title}".`, `مالقيتش "${a.title}".`));
          const { error } = await sb
            .from("deadlines")
            .update({ completed: a.done, updated_at: new Date().toISOString() } as never)
            .eq("id", m.item.id);
          if (error) return fail(error.message);
          return success(`${m.item.title}${a.done ? "" : " (unmarked)"}`);
        },
      }),
      add_deadline: tool({
        description: "Add a new assignment or quiz to a course. due_date is YYYY-MM-DD.",
        inputSchema: z.object({
          course: z.string().describe("Course name exactly as written in DATA"),
          title: z.string(),
          kind: z.enum(["assignment", "quiz"]),
          due_date: z.string(),
        }),
        execute: async (a) => {
          const found = findCourse(a.course);
          if ("error" in found) return fail(found.error);
          const { error } = await sb
            .from("deadlines")
            .insert({ course_id: found.course.id, title: a.title, kind: a.kind, due_date: a.due_date } as never);
          if (error) return fail(error.message);
          return success(`Added ${a.kind} "${a.title}" to ${found.course.name}`);
        },
      }),
      add_lecture: tool({
        description: "Add a lecture or tutorial to a course, e.g. title 'Lecture 7'.",
        inputSchema: z.object({
          course: z.string().describe("Course name exactly as written in DATA"),
          title: z.string(),
          kind: z.enum(["lecture", "tutorial"]),
        }),
        execute: async (a) => {
          const found = findCourse(a.course);
          if ("error" in found) return fail(found.error);
          const { error } = await sb
            .from("lectures")
            .insert({ course_id: found.course.id, title: a.title, kind: a.kind } as never);
          if (error) return fail(error.message);
          return success(`Added ${a.title} to ${found.course.name}`);
        },
      }),
      complete_habit_today: tool({
        description: "Mark a habit as done today. Identify it by its name.",
        inputSchema: z.object({ habit: z.string().describe("Habit name exactly as written in DATA") }),
        execute: async (a) => {
          const m = bestMatch(a.habit, habitRows, (h) => [h.name]);
          if ("ambiguous" in m)
            return fail(
              say(
                `Which habit: ${m.ambiguous.map((h) => h.name).join(" or ")}?`,
                `تقصد أنهي عادة: ${m.ambiguous.map((h) => h.name).join(" ولا ")}؟`,
              ),
            );
          if ("none" in m) return fail(say(`I couldn't find a habit called "${a.habit}".`, `مالقيتش عادة اسمها "${a.habit}".`));
          if (doneToday.has(m.item.id)) {
            doneActions.push(`${m.item.name} (already done)`);
            return { ok: true as const, done: "already done" };
          }
          const { error } = await sb
            .from("habit_completions")
            .insert({ habit_id: m.item.id, completed_date: data.today } as never);
          if (error) return fail(error.message);
          doneToday.add(m.item.id);
          return success(m.item.name);
        },
      }),
    };

    const key = process.env["LOVABLE_API_KEY"];
    const fallback = getFallbackAI();

    // streamText reports API failures through the stream; awaiting .text then only
    // throws a generic "No output generated" error. Keep the real error instead.
    const statusOf = (e: unknown): number | undefined => {
      const x = e as { statusCode?: number; lastError?: unknown; cause?: unknown } | undefined;
      return (
        x?.statusCode ??
        (x?.lastError ? statusOf(x.lastError) : undefined) ??
        (x?.cause ? statusOf(x.cause) : undefined)
      );
    };

    const run = async (
      model: LanguageModel,
      providerOptions?: Record<string, Record<string, unknown>>,
      singleStep = false,
    ) => {
      let streamError: unknown;
      const result = streamText({
        model,
        onError: ({ error }) => {
          streamError = error;
        },
        instructions:
          `You are ${agentName}, a warm voice assistant and study coach for a university student. Replies are read aloud, so keep them short (1-3 sentences), no markdown, no lists. ALWAYS reply in the language the user spoke (Egyptian Arabic or English; the user may mix Arabic with English course names). ACTIONS: when the user says they finished or studied something, did a habit, or asks you to add something, you MUST call the matching tool. Never say you did something without calling a tool. Use course, habit and assignment names exactly as written in DATA (translate or transliterate them if the user said them in Arabic). If a request is ambiguous, ask one short question instead of guessing.\n\nDATA:\n` +
          lines.join("\n"),
        messages: data.messages,
        tools,
        // Fallback runs one step: Gemini 3 rejects the follow-up request that carries tool
        // results unless its "thought signature" is echoed back, which the OpenAI-compatible
        // layer can't do. Actions still run; we confirm them ourselves below.
        stopWhen: stepCountIs(singleStep ? 1 : 50),
        ...(providerOptions ? { providerOptions: providerOptions as never } : {}),
      });
      try {
        return (await result.text).trim();
      } catch (e) {
        throw streamError ?? e;
      }
    };

    const runFallback = () => {
      if (!fallback) throw new Error("AI is not configured.");
      const p = createOpenAI({ baseURL: fallback.baseURL, apiKey: fallback.apiKey });
      return run(p.chat(fallback.model), undefined, true);
    };

    try {
      let reply: string;
      if (key && !(fallback && primaryIsDown())) {
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: key,
          headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });
        try {
          reply = await run(provider.responses("openai/gpt-6-astra"), {
            openai: {
              store: false,
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            },
          });
        } catch (e) {
          // Out of credits before anything ran: switch to the free fallback if configured.
          if (fallback && !changed && isOutOfCredits(statusOf(e))) {
            markPrimaryDown();
            reply = await runFallback();
          } else {
            throw e;
          }
        }
      } else {
        reply = await runFallback();
      }
      console.log("Mero actions:", JSON.stringify({ doneActions, toolErrors }));
      if (toolErrors.length > 0 && doneActions.length === 0) {
        // Never let a confident-sounding reply cover for an action that did not happen.
        reply = toolErrors[0]!;
      } else if (!reply) {
        const list = doneActions.join(ar ? "، " : "; ");
        reply = doneActions.length
          ? say(`Done: ${list}.`, `تمام، خلصت: ${list}.`) + (toolErrors[0] ? ` ${toolErrors[0]}` : "")
          : say("Done.", "تمام.");
      }
      return { reply, changed };
    } catch (e) {
      console.error("Mero chat failed:", e);
      const status = statusOf(e);
      if (status === 402) throw new Error("Out of AI credits — add credits (or set FALLBACK_AI_API_KEY for a free fallback) to keep talking to Mero.");
      if (status === 429) throw new Error("Mero is busy right now. Try again in a minute.");
      throw new Error(e instanceof Error ? e.message : "Mero couldn't answer.");
    }
  });
