import { format } from "date-fns";

import { type ExamItem, urgency } from "@/lib/exams";

const COLORS = {
  now: "var(--destructive)",
  soon: "var(--rust)",
  later: "var(--ink-soft)",
} as const;

/** The days left, inside a ring that fills up as the exam gets closer (empty at 30+ days, full on the day). */
export function ExamCircle({
  daysLeft,
  size = 72,
  label,
}: {
  daysLeft: number;
  size?: number;
  label: string;
}) {
  const stroke = Math.max(4, Math.round(size / 13));
  const r = size / 2 - stroke / 2 - 1;
  const c = 2 * Math.PI * r;
  const fill = daysLeft <= 0 ? 1 : Math.max(0.07, 1 - Math.min(daysLeft, 30) / 30);
  const color = COLORS[urgency(daysLeft)];
  const today = daysLeft === 0;
  return (
    <span
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          style={{ stroke: "var(--sand)" }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fill)}
          style={{ stroke: color }}
        />
      </svg>
      <span className="absolute flex flex-col items-center leading-none" style={{ color }}>
        {today ? (
          <span
            className="font-display font-semibold uppercase tracking-wide"
            style={{ fontSize: size * 0.2 }}
          >
            Today
          </span>
        ) : (
          <>
            <span
              className="font-display font-semibold tabular-nums"
              style={{ fontSize: size * (daysLeft >= 100 ? 0.3 : 0.4) }}
            >
              {daysLeft}
            </span>
            <span
              className="mt-0.5 font-medium uppercase tracking-wider text-ink-soft"
              style={{ fontSize: Math.max(8, size * 0.13) }}
            >
              {daysLeft === 1 ? "day" : "days"}
            </span>
          </>
        )}
      </span>
    </span>
  );
}

const describe = (e: ExamItem) =>
  `${e.courseName}, ${e.name}, ${e.daysLeft === 0 ? "today" : `${e.daysLeft} day${e.daysLeft === 1 ? "" : "s"} left`}`;

/** A row of exam countdown circles, soonest first. */
export function ExamCircles({
  exams,
  size = 72,
  onSelect,
}: {
  exams: ExamItem[];
  size?: number;
  onSelect?: (e: ExamItem) => void;
}) {
  return (
    <ul className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
      {exams.map((e) => {
        const inner = (
          <>
            <ExamCircle daysLeft={e.daysLeft} size={size} label={describe(e)} />
            <span
              className="mt-2 block max-w-[6rem] truncate text-xs font-medium text-ink"
              title={e.courseName}
            >
              {e.courseName}
            </span>
            <span className="block text-[11px] text-ink-soft">
              {format(new Date(`${e.date}T00:00:00`), "EEE d MMM")}
              {e.time ? ` · ${e.time}` : ""}
            </span>
          </>
        );
        return (
          <li key={e.id} className="shrink-0 text-center">
            {onSelect ? (
              <button
                onClick={() => onSelect(e)}
                className="rounded-2xl p-1 text-center transition hover:bg-sand/60"
                aria-label={`${describe(e)}. Open details`}
              >
                {inner}
              </button>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}
