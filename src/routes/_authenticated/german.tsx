import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { BookOpen, Check, Flame, Plus } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getHabitsForDate, toggleCompletion } from "@/lib/habits.functions";
import { AddHabitModal } from "@/components/AddHabitModal";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/german")({
  component: GermanPage,
});

const today = format(new Date(), "yyyy-MM-dd");

function GermanPage() {
  const queryClient = useQueryClient();
  const fetchHabits = useServerFn(getHabitsForDate);
  const toggleHabit = useServerFn(toggleCompletion);

  const { data: habits = [] } = useQuery({
    queryKey: ["habits", today, "german"],
    queryFn: () => fetchHabits({ date: today, category: "german" }),
  });

  const [isAddOpen, setIsAddOpen] = useState(false);

  const completedToday = habits.filter((h) => h.completedToday).length;
  const total = habits.length || 1;
  const progress = Math.round((completedToday / total) * 100);
  const streak = habits.reduce((max, h) => Math.max(max, h.streak), 0);

  async function handleToggle(habitId: string) {
    try {
      await toggleHabit({ habitId, date: today });
      queryClient.invalidateQueries({ queryKey: ["habits", today, "german"] });
      toast.success("Progress saved");
    } catch (err) {
      toast.error("Could not update habit");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 sm:px-8">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-rust">
          <BookOpen className="size-5" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">
            German Learning
          </span>
        </div>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink sm:text-4xl">
          Deutsch heute
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Small daily rituals build fluency.
        </p>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
            Done today
          </p>
          <p className="mt-1 font-display text-2xl text-ink">
            {completedToday}/{habits.length}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
            Progress
          </p>
          <p className="mt-1 font-display text-2xl text-ink">{progress}%</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
            Best streak
          </p>
          <p className="mt-1 flex items-center gap-1 font-display text-2xl text-ink">
            {streak} <Flame className="size-4 text-rust" />
          </p>
        </div>
      </section>

      <section className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-lg font-medium text-ink">Today&apos;s rituals</h2>
        <Button
          size="sm"
          onClick={() => setIsAddOpen(true)}
          className="rounded-full bg-ink text-cream hover:bg-ink/90"
        >
          <Plus className="mr-1 size-4" /> Add German habit
        </Button>
      </section>

      {habits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center">
          <p className="text-sm text-ink-soft">No German habits yet.</p>
          <Button
            variant="ghost"
            onClick={() => setIsAddOpen(true)}
            className="mt-2 text-rust hover:text-rust/80"
          >
            Create your first habit
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {habits.map((habit) => (
            <div
              key={habit.id}
              className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 shadow-sm transition hover:shadow-md"
            >
              <div>
                <p className="font-medium text-ink">{habit.name}</p>
                {habit.description && (
                  <p className="text-xs text-ink-soft">{habit.description}</p>
                )}
                <p className="mt-1 text-[10px] uppercase tracking-wider text-ink-muted">
                  {habit.streak} day streak
                </p>
              </div>
              <button
                onClick={() => handleToggle(habit.id)}
                className={`stamp-check size-10 rounded-full border-2 transition ${
                  habit.completedToday
                    ? "border-rust bg-rust text-cream"
                    : "border-line bg-transparent text-ink-soft hover:border-rust/40"
                }`}
                aria-label={habit.completedToday ? "Mark incomplete" : "Mark complete"}
              >
                {habit.completedToday && <Check className="size-5" />}
              </button>
            </div>
          ))}
        </div>
      )}

      <AddHabitModal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        defaultCategory="german"
      />
    </main>
  );
}
