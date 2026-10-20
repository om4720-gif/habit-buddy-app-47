import { Link } from "@tanstack/react-router";

import { ExamCircles } from "@/components/ExamCircles";
import { useExams } from "@/lib/useExams";

/** A slim row of countdown circles for exams in the next 30 days. Renders nothing when there are none. */
export function ExamStrip() {
  const { upcoming } = useExams();
  const near = upcoming.filter((e) => e.daysLeft <= 30).slice(0, 6);
  if (near.length === 0) return null;
  return (
    <section className="mt-4 rounded-2xl bg-cream px-4 py-3 ring-1 ring-black/5" aria-label="Upcoming exams">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">Exams</h2>
        <Link to="/uni" className="text-xs font-medium text-rust hover:underline">
          See all
        </Link>
      </div>
      <ExamCircles exams={near} size={52} />
    </section>
  );
}
