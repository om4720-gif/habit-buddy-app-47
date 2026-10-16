import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { BuddyFace, type BuddyMood } from "@/components/Buddy";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserSettings } from "@/lib/useUserSettings";

const tourKey = (uid: string) => `ritual:tourDone:${uid}`;
export const OPEN_TOUR_EVENT = "ritual:open-tour";
const LAST = 5;
const MOODS: BuddyMood[] = ["wave", "happy", "happy", "ready", "happy", "party"];

const em = (t: string) => <strong className="font-semibold text-ink">{t}</strong>;

function NavMock({ page }: { page: string }) {
  const pill = "rounded-full px-3 py-1.5 text-xs font-medium";
  const hot = "bg-rust/15 text-rust ring-1 ring-rust/40";
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 rounded-2xl bg-paper p-3 ring-1 ring-black/5">
      <span className={`${pill} text-ink-soft`}>Today</span>
      <span className={`${pill} ${hot}`}>{page.trim() || "Main habit"}</span>
      <span className={`${pill} text-ink-soft`}>University</span>
      <span className={`${pill} ${hot} animate-pulse`}>Settings</span>
    </div>
  );
}

/** First-run walkthrough. Shows once per user; can be replayed from Settings. */
export function WelcomeTour() {
  const { settings, save } = useUserSettings();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [agent, setAgent] = useState("");
  const [page, setPage] = useState("");
  const uid = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      uid.current = data.session?.user.id ?? null;
      if (!uid.current) return;
      try {
        if (localStorage.getItem(tourKey(uid.current)) !== "1") setOpen(true);
      } catch {
        /* storage unavailable: don't nag on every load */
      }
    })();
  }, []);

  useEffect(() => {
    const replay = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_TOUR_EVENT, replay);
    return () => window.removeEventListener(OPEN_TOUR_EVENT, replay);
  }, []);

  useEffect(() => {
    if (open) {
      setAgent(settings.agent_name);
      setPage(settings.habit_page_name);
    }
  }, [open, settings.agent_name, settings.habit_page_name]);

  const markDone = () => {
    try {
      if (uid.current) localStorage.setItem(tourKey(uid.current), "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && markDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const finish = async () => {
    const next = {
      agent_name: agent.trim().slice(0, 30) || "Mero",
      habit_page_name: page.trim().slice(0, 30) || "Main habit",
    };
    if (next.agent_name !== settings.agent_name || next.habit_page_name !== settings.habit_page_name) {
      try {
        await save(next);
        toast.success("Saved. You can change these anytime in Settings.");
      } catch {
        toast.error("Could not save your names. Try again from Settings.");
      }
    }
    markDone();
  };

  if (!open) return null;

  const pageName = settings.habit_page_name;
  const agentName = settings.agent_name;

  const content: { title: string; body: React.ReactNode }[] = [
    {
      title: "Welcome to Ritual 👋",
      body: <p>I'm Buddy. Here's a 30-second tour so you know where everything lives.</p>,
    },
    {
      title: "Today",
      body: (
        <p>
          Tick your habits to {em("stamp")} them and build streaks. Every tick earns points you can spend on treats you
          choose yourself. Tap the {em("✦ pill")} in the corner to see them.
        </p>
      ),
    },
    {
      title: "University",
      body: (
        <p>
          Add a course and pick {em("how many lectures and tutorials")} it has. They're created for you, so there's
          nothing to type one by one. Add deadlines too, and finish things early for bonus points.
        </p>
      ),
    },
    {
      title: "Your second page",
      body: (
        <p>
          The tab next to Today is a {em("second habit list")} for anything you like: a language, the gym, reading.
          Right now it's called {em(pageName)}. You can rename it in {em("Settings")}.
        </p>
      ),
    },
    {
      title: "Meet your agent",
      body: (
        <p>
          The round button in the corner is your {em("study agent")}. Type or talk to it, like "I finished lecture 2",
          and it marks things done and plans your day. Right now it's called {em(agentName)}. You can rename it in{" "}
          {em("Settings")}.
        </p>
      ),
    },
    {
      title: "Make it yours",
      body: (
        <div className="space-y-4">
          <p>
            Open {em("Settings")} in the top bar any time to rename your second page and your agent. You can do it right
            now too:
          </p>
          <NavMock page={page} />
          <label className="block text-sm text-ink">
            Second page name
            <Input className="mt-1" maxLength={30} value={page} onChange={(e) => setPage(e.target.value)} />
          </label>
          <label className="block text-sm text-ink">
            Agent name
            <Input className="mt-1" maxLength={30} value={agent} onChange={(e) => setAgent(e.target.value)} />
          </label>
        </div>
      ),
    },
  ];
  const current = content[step]!;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/30 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-cream p-6 ring-1 ring-black/5 sm:p-7"
      >
        <div className="flex items-start justify-between">
          <BuddyFace mood={MOODS[step] ?? "happy"} joy={false} />
          {step < LAST && (
            <button
              onClick={markDone}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-sand hover:text-ink"
            >
              Skip tour
            </button>
          )}
        </div>

        <div key={step} className="animate-rise">
          <h2 id="tour-title" className="mt-3 font-display text-2xl font-semibold text-ink">
            {current.title}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-ink-soft">{current.body}</div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${LAST + 1}`}>
            {content.map((_, i) => (
              <span key={i} className={`size-2 rounded-full ${i === step ? "bg-rust" : "bg-sand"}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="rounded-full bg-paper px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-sand"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (step === LAST ? void finish() : setStep(step + 1))}
              className="rounded-full bg-rust px-5 py-2.5 text-sm font-semibold text-cream ring-1 ring-rust/40 transition hover:bg-rust/90"
            >
              {step === LAST ? "Save & start" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
