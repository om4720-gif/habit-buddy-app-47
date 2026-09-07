import { createFileRoute } from "@tanstack/react-router";
import { format, subDays } from "date-fns";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AddHabitModal } from "@/components/AddHabitModal";
import {
  createHabit,
  deleteHabit,
  getHabitsForDate,
  getStats,
  getWeeklyProgress,
  toggleCompletion,
  updateHabit,
} from "@/lib/habits.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Today — Ritual" },
      { name: "description", content: "Your daily habit dashboard." },
      { property: "og:title", content: "Today — Ritual" },
      { property: "og:description", content: "Your daily habit dashboard." },
    ],
  }),
  component: DashboardPage,
});

const today = () => format(new Date(), "yyyy-MM-dd");

function DashboardPage() {
  const date = today();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);

  const { data: habits, isPending: habitsPending } = useQuery({
    queryKey: ["habits", date],
    queryFn: () => getHabitsForDate({ data: { date } }),
  });

  const { data: stats, isPending: statsPending } = useQuery({
    queryKey: ["stats", date],
    queryFn: () => getStats({ data: { date } }),
  });

  const { data: weekly, isPending: weeklyPending } = useQuery({
    queryKey: ["weekly", date],
    queryFn: () => getWeeklyProgress({ data: { date } }),
  });

  const completedCount = habits?.filter((h) => h.completed).length ?? 0;
  const totalCount = habits?.length ?? 0;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  const handleToggle = async (habitId: string) => {
    try {
      await toggleCompletion({ data: { habitId, date } });
      queryClient.invalidateQueries({ queryKey: ["habits", date] });
      queryClient.invalidateQueries({ queryKey: ["stats", date] });
      queryClient.invalidateQueries({ queryKey: ["weekly", date] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update habit.");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-4xl px-6 py-8 sm:px-8 sm:py-12">
        <Header
          date={date}
          streak={stats?.longestStreak ?? 0}
          onSignOut={handleSignOut}
        />

        <ProgressCard
          completed={completedCount}
          total={totalCount}
          progress={progress}
          onAdd={() => setIsAdding(true)}
        />

        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-base uppercase tracking-[0.12em] text-ink-soft">
              Today's habits
            </h2>
            <span className="text-xs text-ink-soft tabular-nums">
              {completedCount} of {totalCount} done
            </span>
          </div>

          {habitsPending ? (
            <div className="mt-4 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-2xl bg-cream"
                />
              ))}
            </div>
          ) : habits && habits.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {habits.map((habit) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  onToggle={() => handleToggle(habit.id)}
                  onUpdate={async (updates) => {
                    await updateHabit({ data: { habitId: habit.id, ...updates } });
                    queryClient.invalidateQueries({ queryKey: ["habits", date] });
                  }}
                  onDelete={async () => {
                    await deleteHabit({ data: { habitId: habit.id } });
                    queryClient.invalidateQueries({ queryKey: ["habits", date] });
                    queryClient.invalidateQueries({ queryKey: ["stats", date] });
                    queryClient.invalidateQueries({ queryKey: ["weekly", date] });
                  }}
                />
              ))}
            </ul>
          ) : (
            <EmptyState onAdd={() => setIsAdding(true)} />
          )}
        </section>

        <WeeklyProgress days={weekly ?? []} isPending={weeklyPending} />

        <StatsGrid
          longestStreak={stats?.longestStreak ?? 0}
          longestStreakHabit={stats?.longestStreakHabit ?? "—"}
          consistencyRate={stats?.consistencyRate ?? 0}
          activeHabitCount={stats?.activeHabitCount ?? 0}
          isPending={statsPending}
        />
      </div>

      {isAdding && (
        <AddHabitModal
          onClose={() => setIsAdding(false)}
          onCreate={async (values) => {
            await createHabit({ data: values });
            queryClient.invalidateQueries({ queryKey: ["habits", date] });
            queryClient.invalidateQueries({ queryKey: ["stats", date] });
            queryClient.invalidateQueries({ queryKey: ["weekly", date] });
            setIsAdding(false);
          }}
        />
      )}
    </div>
  );
}

function Header({
  date,
  streak,
  onSignOut,
}: {
  date: string;
  streak: number;
  onSignOut: () => void;
}) {
  const displayDate = format(new Date(`${date}T00:00:00`), "EEEE, MMMM d");

  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rust">
          Ritual
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold leading-tight text-balance sm:text-4xl">
          {displayDate}
        </h1>
        <p className="mt-2 max-w-md text-sm text-ink-soft text-pretty sm:text-base">
          Small acts, stamped daily. Keep the rhythm loose.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-ink-soft">
            Best streak
          </p>
          <p className="font-display text-xl font-semibold tabular-nums">{streak}</p>
        </div>
        <button
          onClick={onSignOut}
          className="grid size-11 place-items-center rounded-full bg-cream text-xs font-semibold text-rust ring-1 ring-black/5 transition hover:bg-sand"
          aria-label="Sign out"
          title="Sign out"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function ProgressCard({
  completed,
  total,
  progress,
  onAdd,
}: {
  completed: number;
  total: number;
  progress: number;
  onAdd: () => void;
}) {
  const circumference = 2 * Math.PI * 30;
  const offset = circumference * (1 - progress);

  return (
    <section className="mt-8 rounded-2xl bg-cream p-5 ring-1 ring-black/5 sm:p-6">
      <div className="flex items-center gap-5">
        <div className="relative grid size-20 shrink-0 place-items-center">
          <svg viewBox="0 0 72 72" className="size-20 -rotate-90">
            <circle
              cx="36"
              cy="36"
              r="30"
              fill="none"
              className="text-sand"
              stroke="currentColor"
              strokeWidth="6"
            />
            <circle
              cx="36"
              cy="36"
              r="30"
              fill="none"
              className="text-rust"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ animation: "ringFill 0.8s ease-out 0.1s both" }}
            />
          </svg>
          <span className="absolute font-display text-lg font-semibold tabular-nums">
            {completed}
            <span className="text-ink-soft text-sm">/{total || 1}</span>
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-display max-w-md text-lg font-semibold leading-tight text-balance">
            {completed === total
              ? "All habits stamped"
              : `${total - completed} habit${total - completed === 1 ? "" : "s"} to stamp`}
          </p>
          <p className="mt-1 max-w-md text-sm text-ink-soft text-pretty">
            {completed === total
              ? "A quiet, complete day. Tomorrow is a fresh page."
              : "You're on pace for a steady week. Keep the rhythm loose."}
          </p>
        </div>
        <button
          onClick={onAdd}
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rust px-4 py-2 text-sm font-semibold text-cream ring-1 ring-rust/40 transition hover:bg-rust/90"
        >
          <Plus className="size-4" />
          Add habit
        </button>
      </div>
    </section>
  );
}

function HabitRow({
  habit,
  onToggle,
  onUpdate,
  onDelete,
}: {
  habit: Awaited<ReturnType<typeof getHabitsForDate>>[number];
  onToggle: () => void;
  onUpdate: (updates: { name?: string; description?: string }) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
      <li className="flex items-center gap-4 rounded-2xl bg-cream p-4 ring-1 ring-black/5">
        <button
          onClick={onToggle}
          aria-label={`Mark ${habit.name} as ${habit.completed ? "not done" : "done"}`}
          className={`grid size-7 shrink-0 place-items-center rounded-full transition ${
            habit.completed
              ? "bg-rust text-cream stamp-check"
              : "border-2 border-line text-transparent hover:border-rust"
          }`}
        >
          <span className="font-display text-sm leading-none font-semibold">✓</span>
        </button>
        <div className="min-w-0 flex-1">
          <p
            className={`font-medium text-balance ${
              habit.completed ? "text-ink-soft line-through decoration-rust/40" : "text-ink"
            }`}
          >
            {habit.name}
          </p>
          {habit.description ? (
            <p className="text-xs text-ink-soft">{habit.description}</p>
          ) : null}
          <p className="text-xs text-ink-soft">{habit.streak} day streak</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsEditing(true)}
            className="grid size-8 place-items-center rounded-full text-ink-soft transition hover:bg-sand hover:text-ink"
            aria-label="Edit habit"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      </li>

      {isEditing && (
        <EditHabitModal
          habit={habit}
          onClose={() => setIsEditing(false)}
          onSave={async (values) => {
            await onUpdate(values);
            setIsEditing(false);
          }}
          onDelete={async () => {
            await onDelete();
            setIsEditing(false);
          }}
        />
      )}
    </>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-4 rounded-2xl bg-cream p-8 text-center ring-1 ring-black/5">
      <p className="font-display text-lg font-semibold text-ink">No habits yet</p>
      <p className="mt-1 text-sm text-ink-soft">
        Add your first small act and start building the streak.
      </p>
      <button
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-rust px-4 py-2 text-sm font-semibold text-cream ring-1 ring-rust/40 transition hover:bg-rust/90"
      >
        <Plus className="size-4" />
        Add habit
      </button>
    </div>
  );
}

function WeeklyProgress({
  days,
  isPending,
}: {
  days: Awaited<ReturnType<typeof getWeeklyProgress>>;
  isPending: boolean;
}) {
  const completionRate =
    days.length > 0 && days[0]!.total > 0
      ? Math.round(
          (days.reduce((acc, d) => acc + d.completed, 0) /
            (days[0]!.total * days.length)) *
            100
        )
      : 0;

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-base uppercase tracking-[0.12em] text-ink-soft">
          This week
        </h2>
        <span className="text-xs text-ink-soft tabular-nums">
          {isPending ? "—" : `${completionRate}% complete`}
        </span>
      </div>
      <div className="mt-4 rounded-2xl bg-cream p-5 ring-1 ring-black/5">
        {isPending ? (
          <div className="h-24 animate-pulse rounded-xl bg-paper" />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2 sm:gap-3">
              {days.map((day) => {
                const date = new Date(`${day.date}T00:00:00`);
                const label = format(date, "EEE").slice(0, 1);
                const isToday = day.date === today();
                const filled =
                  day.total > 0
                    ? Array.from({ length: day.total }, (_, i) =>
                        i < day.completed ? "rust" : "sand"
                      )
                    : ["sand"];

                return (
                  <div key={day.date} className="flex flex-col items-center gap-2">
                    <span
                      className={`text-[11px] font-medium ${
                        isToday ? "text-rust" : "text-ink-soft"
                      }`}
                    >
                      {label}
                    </span>
                    <div className="grid grid-cols-1 gap-1">
                      {filled.map((color, i) => (
                        <span
                          key={i}
                          className={`size-2.5 rounded-full ${
                            color === "rust" ? "bg-rust" : "bg-sand"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center gap-4 border-t border-line pt-4">
              <span className="flex items-center gap-2 text-xs text-ink-soft">
                <span className="size-2.5 rounded-full bg-rust" /> Stamped
              </span>
              <span className="flex items-center gap-2 text-xs text-ink-soft">
                <span className="size-2.5 rounded-full bg-sand" /> Missed
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function StatsGrid({
  longestStreak,
  longestStreakHabit,
  consistencyRate,
  activeHabitCount,
  isPending,
}: {
  longestStreak: number;
  longestStreakHabit: string;
  consistencyRate: number;
  activeHabitCount: number;
  isPending: boolean;
}) {
  const cards = [
    { label: "Longest streak", value: longestStreak, sub: longestStreakHabit },
    { label: "This month", value: `${consistencyRate}%`, sub: "Consistency rate" },
    { label: "Active habits", value: activeHabitCount, sub: "In practice now" },
  ];

  return (
    <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl bg-cream p-5 ring-1 ring-black/5"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-ink-soft">
            {card.label}
          </p>
          <p className="font-display mt-2 text-2xl font-semibold tabular-nums">
            {isPending ? "—" : card.value}
          </p>
          <p className="text-xs text-ink-soft">{card.sub}</p>
        </div>
      ))}
    </section>
  );
}


function EditHabitModal({
  habit,
  onClose,
  onSave,
  onDelete,
}: {
  habit: Awaited<ReturnType<typeof getHabitsForDate>>[number];
  onClose: () => void;
  onSave: (values: { name: string; description: string }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(habit.name);
  const [description, setDescription] = useState(habit.description ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim() });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update habit.");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this habit and its history?")) return;
    setDeleting(true);
    try {
      await onDelete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete habit.");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-cream p-6 ring-1 ring-black/5">
        <h2 className="font-display text-xl font-semibold text-ink">Edit habit</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              className="mt-1.5 block w-full rounded-xl border-0 bg-paper px-3 py-2.5 text-sm text-ink ring-1 ring-line placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-rust"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
              Note
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="mt-1.5 block w-full rounded-xl border-0 bg-paper px-3 py-2.5 text-sm text-ink ring-1 ring-line placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-rust"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-full bg-paper px-4 py-2.5 text-sm font-semibold text-destructive ring-1 ring-line transition hover:bg-sand disabled:opacity-60"
            >
              <Trash2 className="size-4" />
              {deleting ? "Deleting..." : "Delete"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full bg-paper px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-sand"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-full bg-rust px-4 py-2.5 text-sm font-semibold text-cream ring-1 ring-rust/40 transition hover:bg-rust/90 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
