import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { getCityProgress, POINTS } from "@/lib/city.functions";

export const Route = createFileRoute("/_authenticated/city")({
  head: () => ({
    meta: [
      { title: "My City — Ritual" },
      { name: "description", content: "Grow your own little city with points from habits, lectures and assignments." },
      { property: "og:title", content: "My City — Ritual" },
      { property: "og:description", content: "Every finished task adds to your city." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CityPage,
});

const BUILDINGS = [
  { cost: 0, icon: "⛺", name: "Camp" },
  { cost: 25, icon: "🌳", name: "Tree" },
  { cost: 50, icon: "🏠", name: "House" },
  { cost: 100, icon: "🌷", name: "Garden" },
  { cost: 150, icon: "🏡", name: "Cottage" },
  { cost: 225, icon: "⛲", name: "Fountain" },
  { cost: 300, icon: "🏪", name: "Shop" },
  { cost: 400, icon: "☕", name: "Café" },
  { cost: 500, icon: "🏫", name: "School" },
  { cost: 650, icon: "📚", name: "Library" },
  { cost: 800, icon: "🏥", name: "Hospital" },
  { cost: 1000, icon: "🏛️", name: "Museum" },
  { cost: 1250, icon: "🏟️", name: "Stadium" },
  { cost: 1500, icon: "🎡", name: "Ferris wheel" },
  { cost: 2000, icon: "🏢", name: "Tower" },
  { cost: 2500, icon: "🏰", name: "Castle" },
  { cost: 3200, icon: "🌉", name: "Bridge" },
  { cost: 4000, icon: "🚀", name: "Launch pad" },
];

function CityPage() {
  const fetchCity = useServerFn(getCityProgress);
  const { data } = useQuery({ queryKey: ["city"], queryFn: () => fetchCity() });
  const total = data?.total ?? 0;
  const built = BUILDINGS.filter((b) => b.cost <= total);
  const next = BUILDINGS.find((b) => b.cost > total);
  const prevCost = built[built.length - 1]?.cost ?? 0;
  const pct = next ? ((total - prevCost) / (next.cost - prevCost)) * 100 : 100;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 sm:px-8 animate-rise">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rust">Your city</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-medium text-ink">
          {built.length} building{built.length === 1 ? "" : "s"}
        </h1>
        <div className="text-right">
          <p className="font-display text-3xl text-rust">{total}</p>
          <p className="text-xs text-ink-soft">points</p>
        </div>
      </div>

      {next && (
        <div className="mt-6 rounded-2xl border border-line bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink">
              Next: <span className="mr-1">{next.icon}</span>
              <strong>{next.name}</strong>
            </span>
            <span className="text-ink-soft">{next.cost - total} points to go</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-cream">
            <div className="h-full rounded-full bg-rust transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <section className="mt-6 overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-cream to-sand/60 p-6 shadow-sm">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {BUILDINGS.map((b, i) => {
            const owned = b.cost <= total;
            return (
              <div
                key={b.name}
                title={owned ? b.name : `${b.name} — ${b.cost} points`}
                style={{ animationDelay: `${i * 40}ms` }}
                className={`flex aspect-square flex-col items-center justify-center rounded-2xl border transition ${
                  owned
                    ? "animate-rise border-line bg-card shadow-sm hover:-translate-y-1"
                    : "border-dashed border-ink-soft/30 bg-card/30"
                }`}
              >
                <span className={`text-3xl sm:text-4xl ${owned ? "" : "opacity-25 grayscale"}`}>{b.icon}</span>
                <span className="mt-1 text-[10px] text-ink-soft">{owned ? b.name : b.cost}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <Earn label="Habits & German practice" each={`+${POINTS.habit} each`} count={data?.counts.habits} pts={data?.breakdown.habits} />
        <Earn label="Lectures & tutorials studied" each={`+${POINTS.lecture} each`} count={data?.counts.lectures} pts={data?.breakdown.lectures} />
        <Earn label="Assignments & quizzes done" each={`+${POINTS.assignment} each`} count={data?.counts.assignments} pts={data?.breakdown.assignments} />
        <Earn label="Finished early bonus" each={`+${POINTS.earlyPerDay} per day early (up to ${POINTS.earlyMaxDays})`} count={data?.counts.early} pts={data?.breakdown.early} />
      </section>
    </main>
  );
}

function Earn({ label, each, count = 0, pts = 0 }: { label: string; each: string; count?: number; pts?: number }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="text-xs text-ink-soft">{each}</p>
      <p className="mt-2 text-xs text-ink-soft">
        {count} done · <span className="font-semibold text-rust">{pts} pts</span>
      </p>
    </div>
  );
}
