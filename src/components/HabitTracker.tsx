import { useQuery } from "@tanstack/react-query";
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { useState, type ReactNode } from "react";

import { getHabitHistory } from "@/lib/habits.functions";
import { habitColor } from "@/lib/habitColors";

type Range = "week" | "month" | "year";
type DayState = "done" | "missed" | "future" | "before";

const RANGES: Range[] = ["week", "month", "year"];
const WEEK_STARTS_ON = 1; // Monday. Use 6 for Saturday, 0 for Sunday.
const fmt = (d: Date) => format(d, "yyyy-MM-dd");

function boundsFor(range: Range, now: Date) {
  if (range === "week")
    return { start: startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }), end: endOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }) };
  if (range === "month") return { start: startOfMonth(now), end: endOfMonth(now) };
  return { start: startOfYear(now), end: endOfYear(now) };
}

const DOT_MAX = { week: "max-w-[22px]", month: "max-w-[14px]", year: "max-w-[28px]" } as const;
const GAP = { week: "gap-2", month: "gap-[3px]", year: "gap-1.5" } as const;

export function HabitTracker({ date, footer }: { date: string; footer?: ReactNode }) {
  const [range, setRange] = useState<Range>("week");
  const now = new Date(`${date}T00:00:00`);
  const { start, end } = boundsFor(range, now);
  const startStr = fmt(start);
  const endStr = fmt(end);

  const { data, isPending } = useQuery({
    queryKey: ["habit-history", range, startStr],
    queryFn: () => getHabitHistory({ data: { start: startStr, end: endStr } }),
  });

  return <TrackerView date={date} range={range} onRange={setRange} data={data} isPending={isPending} footer={footer} />;
}

export type TrackerData = {
  habits: { id: string; name: string; created_at: string }[];
  completions: { habit_id: string; completed_date: string }[];
};

/** Pure view: everything is derived from props, so it is easy to test. */
export function TrackerView({
  date,
  range,
  onRange,
  data,
  isPending,
  footer,
}: {
  date: string;
  range: Range;
  onRange: (r: Range) => void;
  data: TrackerData | undefined;
  isPending: boolean;
  footer?: ReactNode;
}) {
  const now = new Date(`${date}T00:00:00`);
  const { start, end } = boundsFor(range, now);
  const startStr = fmt(start);

  const days = eachDayOfInterval({ start, end });
  const months = range === "year" ? eachMonthOfInterval({ start, end }) : [];

  const doneByHabit = new Map<string, Set<string>>();
  for (const c of data?.completions ?? []) {
    const set = doneByHabit.get(c.habit_id) ?? new Set<string>();
    set.add(c.completed_date);
    doneByHabit.set(c.habit_id, set);
  }

  const rows = (data?.habits ?? []).map((habit, index) => {
    const done = doneByHabit.get(habit.id) ?? new Set<string>();
    const created = habit.created_at ? fmt(new Date(habit.created_at)) : startStr;
    const firstDone = [...done].sort()[0];
    const since = firstDone && firstDone < created ? firstDone : created;
    const states: DayState[] = days.map((d) => {
      const s = fmt(d);
      if (s > date) return "future";
      if (s < since) return "before";
      return done.has(s) ? "done" : "missed";
    });
    const doneCount = states.filter((s) => s === "done").length;
    const possible = states.filter((s) => s === "done" || s === "missed").length;
    const monthly = months.map((_, m) => {
      let d = 0;
      let p = 0;
      let future = true;
      days.forEach((day, i) => {
        if (day.getMonth() !== m) return;
        const st = states[i];
        if (st !== "future") future = false;
        if (st === "done") d++;
        if (st === "done" || st === "missed") p++;
      });
      return { done: d, possible: p, future };
    });
    return {
      habit,
      color: habitColor(index),
      states,
      monthly,
      doneCount,
      possible,
      rate: possible > 0 ? doneCount / possible : 0,
    };
  });

  const ranked = rows.filter((r) => r.possible >= 3).sort((a, b) => b.rate - a.rate);
  const top = ranked[0];
  const low = ranked.length >= 2 ? ranked[ranked.length - 1] : undefined;

  const columns = range === "year" ? 12 : days.length;
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  const period =
    range === "week"
      ? `${format(start, "MMM d")} – ${format(end, "MMM d")}`
      : range === "month"
        ? format(start, "MMMM yyyy")
        : format(start, "yyyy");

  const headerLabels: { text: string; today?: boolean }[] =
    range === "year"
      ? months.map((m) => ({ text: format(m, "MMMMM") }))
      : range === "week"
        ? days.map((d) => ({ text: format(d, "EEEEE"), today: fmt(d) === date }))
        : days.map((d) => {
            const n = d.getDate();
            return { text: [1, 5, 10, 15, 20, 25, 30].includes(n) ? String(n) : "", today: fmt(d) === date };
          });

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">Tracker</h2>
        <div className="inline-flex rounded-full bg-paper p-1 ring-1 ring-black/5">
          {RANGES.map((r) => (
            <button
              key={r}
              aria-pressed={range === r}
              onClick={() => onRange(r)}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                range === r ? "bg-cream text-ink shadow-sm ring-1 ring-black/5" : "text-ink-soft hover:text-ink"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-3xl bg-cream p-5 ring-1 ring-black/5 sm:p-6">
        <p className="text-xs tabular-nums text-ink-soft">{period}</p>

        {isPending ? (
          <div className="mt-4 h-32 animate-pulse rounded-xl bg-paper" />
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Add a habit and its dots will show up here.</p>
        ) : (
          <>
            <div className={`mt-4 grid ${GAP[range]}`} style={gridStyle} aria-hidden="true">
              {headerLabels.map((l, i) => (
                <span
                  key={i}
                  className={`overflow-visible whitespace-nowrap text-center text-[10px] font-semibold ${
                    l.today ? "text-rust" : "text-ink-soft"
                  }`}
                >
                  {l.text}
                </span>
              ))}
            </div>

            <ul className="mt-2 space-y-5">
              {rows.map((r) => (
                <li key={r.habit.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="truncate">{r.habit.name}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                      {r.doneCount}/{r.possible} · {Math.round(r.rate * 100)}%
                    </span>
                  </div>

                  <div className={`mt-2 grid ${GAP[range]}`} style={gridStyle}>
                    {range === "year"
                      ? r.monthly.map((m, i) => {
                          const rate = m.possible > 0 ? m.done / m.possible : 0;
                          const name = format(months[i]!, "MMMM");
                          return (
                            <span
                              key={i}
                              title={m.future ? `${name}: upcoming` : `${name}: ${m.done}/${m.possible} (${Math.round(rate * 100)}%)`}
                              className={`mx-auto block aspect-square w-full rounded-lg ${DOT_MAX.year} ${
                                m.future ? "bg-sand/60" : ""
                              }`}
                              style={
                                m.future || m.possible === 0
                                  ? undefined
                                  : { backgroundColor: r.color, opacity: 0.12 + 0.88 * rate }
                              }
                            />
                          );
                        })
                      : r.states.map((state, i) => {
                          const d = days[i]!;
                          const isToday = fmt(d) === date;
                          return (
                            <span
                              key={i}
                              title={`${r.habit.name}, ${format(d, "EEE d MMM")}: ${
                                state === "done" ? "done" : state === "missed" ? "missed" : state === "future" ? "upcoming" : "not started"
                              }`}
                              className={`mx-auto block aspect-square w-full rounded-full ${DOT_MAX[range]} ${
                                state === "future" ? "bg-sand/60" : ""
                              } ${isToday ? "ring-2 ring-ink/40 ring-offset-1 ring-offset-cream" : ""}`}
                              style={
                                state === "done"
                                  ? { backgroundColor: r.color }
                                  : state === "missed"
                                    ? { backgroundColor: `${r.color}26` }
                                    : undefined
                              }
                            />
                          );
                        })}
                  </div>
                </li>
              ))}
            </ul>

            {top && low && low.rate < top.rate ? (
              <p className="mt-5 text-xs leading-relaxed text-ink-soft">
                Most consistent: <span className="font-semibold text-ink">{top.habit.name}</span> {Math.round(top.rate * 100)}%
                · Needs some love: <span className="font-semibold text-ink">{low.habit.name}</span> {Math.round(low.rate * 100)}%
              </p>
            ) : null}
          </>
        )}

        {footer}
      </div>
    </section>
  );
}
