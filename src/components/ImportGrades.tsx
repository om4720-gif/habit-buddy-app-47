import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type ImportResult, parseGradeFile } from "@/lib/grade-import";

type Course = { id: string; name: string; code: string | null };
type Item = { id: string; course_id: string; title: string; score: number | null; max_score: number };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Imports scores from a JSON or CSV file into existing assessments. Matching is by course, then by assessment name. */
export function ImportGrades({
  open,
  onOpenChange,
  courses,
  items,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
  items: Item[];
  onApply: (updates: { id: string; score: number; max_score: number }[]) => void;
}) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const plan = useMemo(() => {
    if (!result) return null;
    const matched: { id: string; label: string; score: number; max_score: number }[] = [];
    const unmatched: string[] = [];
    for (const g of result.grades) {
      const course = courses.find(
        (c) => (g.course && (norm(c.name) === norm(g.course) || (c.code && norm(g.course).includes(norm(c.code))))) ||
          (!g.course && courses.length === 1),
      );
      const item = course
        ? items.find((i) => i.course_id === course.id && norm(i.title) === norm(g.title))
        : undefined;
      if (item) matched.push({ id: item.id, label: `${course!.name} · ${item.title}`, score: g.score, max_score: g.max_score });
      else unmatched.push(`${g.course || "(no course)"} · ${g.title}`);
    }
    return { matched, unmatched };
  }, [result, courses, items]);

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("That file is too large. Export a smaller one.");
      return;
    }
    const body = await file.text();
    setFileName(file.name);
    setText(body);
    setResult(parseGradeFile(body, file.name));
  }

  function readPasted() {
    const parsed = parseGradeFile(text, "");
    setFileName("");
    setResult(parsed);
    if (parsed.grades.length === 0) toast.error("I couldn't find any grades in that. Check that it's JSON or CSV.");
  }

  function apply() {
    if (!plan || plan.matched.length === 0) return;
    onApply(plan.matched.map(({ id, score, max_score }) => ({ id, score, max_score })));
    toast.success(`${plan.matched.length} grade${plan.matched.length === 1 ? "" : "s"} imported`);
    reset();
    onOpenChange(false);
  }

  function reset() {
    setText("");
    setFileName("");
    setResult(null);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Import grades</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">
              Choose a JSON or CSV file, or paste its contents. Grades are matched to your courses and assessments by name, and you'll see a preview before anything changes.
            </p>
            <label className="flex cursor-pointer items-center justify-center rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-sand">
              Choose a file
              <input type="file" accept=".json,.csv,application/json,text/csv" className="sr-only" onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <div>
              <label htmlFor="import-text" className="text-sm text-ink-soft">Or paste it here</label>
              <textarea
                id="import-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2 font-mono text-xs text-ink outline-none"
              />
              <Button className="mt-2 w-full rounded-full" disabled={!text.trim()} onClick={readPasted}>
                Read it
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">
              {fileName ? `${fileName}: ` : ""}
              {result.grades.length} grade{result.grades.length === 1 ? "" : "s"} read
              {result.skipped > 0 ? `, ${result.skipped} line${result.skipped === 1 ? "" : "s"} skipped (no score)` : ""}.
            </p>
            {result.fields["title"] && (
              <p className="text-xs text-ink-soft">
                Read fields: course “{result.fields["course"] || "—"}”, item “{result.fields["title"]}”, score “{result.fields["score"]}”
                {result.fields["max"] ? `, maximum “${result.fields["max"]}”` : ""}.
              </p>
            )}
            {plan && (
              <>
                <div>
                  <p className="text-sm font-semibold text-ink">Will update ({plan.matched.length})</p>
                  <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-xs text-ink">
                    {plan.matched.map((m) => (
                      <li key={m.id} className="flex justify-between gap-2 rounded-lg bg-cream px-2 py-1">
                        <span className="truncate">{m.label}</span>
                        <span className="shrink-0 tabular-nums">{m.score} / {m.max_score}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {plan.unmatched.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-ink-soft">No matching assessment ({plan.unmatched.length})</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      Add these to the course's weights first, using the same names: {plan.unmatched.slice(0, 6).join("; ")}
                      {plan.unmatched.length > 6 ? "…" : ""}
                    </p>
                  </div>
                )}
              </>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" className="rounded-full" onClick={reset}>Back</Button>
              <Button className="flex-1 rounded-full" disabled={!plan || plan.matched.length === 0} onClick={apply}>
                Import {plan?.matched.length ?? 0} grade{plan?.matched.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
