import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createGradeItem,
  deleteGradeItem,
  dismissGradeNotifications,
  getCourseGradeSettings,
  getGradeInboxToken,
  getGradeItems,
  getUnreadGradeNotifications,
  resetGradeInboxToken,
  saveCourseGradeSettings,
  updateGradeItem,
} from "@/lib/grades.functions";

type Course = { id: string; name: string; code: string | null; color: string | null };
type GradeItem = Awaited<ReturnType<typeof getGradeItems>>[number];
type GradeForm = {
  title: string;
  score: string;
  maxScore: string;
  weight: string;
  isFinal: boolean;
};
type GradeCutoff = { label: string; minimum: string; gpaStart: string; gpaEnd: string };

const emptyForm: GradeForm = { title: "", score: "", maxScore: "100", weight: "", isFinal: false };
const defaultCutoffs: GradeCutoff[] = [
  { label: "A+", minimum: "94", gpaStart: "0.99", gpaEnd: "0.7" },
  { label: "A", minimum: "90", gpaStart: "1.29", gpaEnd: "1.0" },
  { label: "A-", minimum: "86", gpaStart: "1.69", gpaEnd: "1.3" },
  { label: "B+", minimum: "82", gpaStart: "1.99", gpaEnd: "1.7" },
  { label: "B", minimum: "78", gpaStart: "2.29", gpaEnd: "2.0" },
  { label: "B-", minimum: "74", gpaStart: "2.69", gpaEnd: "2.3" },
  { label: "C+", minimum: "70", gpaStart: "2.99", gpaEnd: "2.7" },
  { label: "C", minimum: "65", gpaStart: "3.29", gpaEnd: "3.0" },
  { label: "C-", minimum: "60", gpaStart: "3.69", gpaEnd: "3.3" },
  { label: "D+", minimum: "55", gpaStart: "3.99", gpaEnd: "3.7" },
  { label: "D", minimum: "50", gpaStart: "4.99", gpaEnd: "4.0" },
  { label: "F", minimum: "0", gpaStart: "5.0", gpaEnd: "5.0" },
];
const percent = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
type GradeBand = { label: string; minimum: number; gpaStart: number; gpaEnd: number };

function gpaForGrade(average: number, bands: GradeBand[]) {
  const index = bands.findIndex((band) => average >= band.minimum);
  if (index < 0) return null;
  const band = bands[index]!;
  const upperBound = index === 0 ? 100 : bands[index - 1]!.minimum - 0.1;
  const progress =
    upperBound <= band.minimum
      ? 1
      : Math.max(0, Math.min(1, (average - band.minimum) / (upperBound - band.minimum)));
  return band.gpaStart + (band.gpaEnd - band.gpaStart) * progress;
}

function readCutoffs(value: unknown): GradeCutoff[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultCutoffs;
  const rows = Object.entries(value).flatMap(([label, cutoff]) => {
    if (!cutoff || typeof cutoff !== "object" || Array.isArray(cutoff)) return [];
    const values = cutoff as { minimum?: unknown; gpaStart?: unknown; gpaEnd?: unknown };
    if (
      typeof values.minimum !== "number" ||
      typeof values.gpaStart !== "number" ||
      typeof values.gpaEnd !== "number"
    )
      return [];
    return [
      {
        label,
        minimum: String(values.minimum),
        gpaStart: String(values.gpaStart),
        gpaEnd: String(values.gpaEnd),
      },
    ];
  });
  return rows.length ? rows : defaultCutoffs;
}

export function GradesSection({ courses }: { courses: Course[] }) {
  const queryClient = useQueryClient();
  const fetchGradeItems = useServerFn(getGradeItems);
  const fetchSettings = useServerFn(getCourseGradeSettings);
  const createItem = useServerFn(createGradeItem);
  const updateItem = useServerFn(updateGradeItem);
  const deleteItem = useServerFn(deleteGradeItem);
  const saveSettings = useServerFn(saveCourseGradeSettings);
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id ?? "");
  const [schemeOpen, setSchemeOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GradeItem | null>(null);
  const [form, setForm] = useState<GradeForm>(emptyForm);
  const [cutoffForm, setCutoffForm] = useState<GradeCutoff[]>(defaultCutoffs);
  const [creditHours, setCreditHours] = useState("3");

  const { data: gradeItems = [] } = useQuery({
    queryKey: ["grade-items"],
    queryFn: () => fetchGradeItems({ data: {} }),
  });
  const { data: gradeSettings = [] } = useQuery({
    queryKey: ["course-grade-settings"],
    queryFn: () => fetchSettings({ data: {} }),
  });
  useEffect(() => {
    if (!courses.some((course) => course.id === selectedCourseId))
      setSelectedCourseId(courses[0]?.id ?? "");
  }, [courses, selectedCourseId]);

  useEffect(() => {
    const currentSettings = gradeSettings.find((setting) => setting.course_id === selectedCourseId);
    setCutoffForm(readCutoffs(currentSettings?.grade_cutoffs));
    setCreditHours(String(currentSettings?.credit_hours ?? 3));
  }, [gradeSettings, selectedCourseId]);

  const course = courses.find((item) => item.id === selectedCourseId);
  const courseGradeItems = gradeItems.filter((item) => item.course_id === selectedCourseId);
  const orderedItems = useMemo(
    () => courseGradeItems.slice().sort((a, b) => Number(b.is_final) - Number(a.is_final)),
    [courseGradeItems],
  );
  const totalWeight = courseGradeItems.reduce((sum, item) => sum + item.weight, 0);
  const markedWeight = courseGradeItems.reduce(
    (sum, item) => sum + (item.score === null ? 0 : item.weight),
    0,
  );
  const earnedWeightedPoints = courseGradeItems.reduce(
    (sum, item) => sum + (item.score === null ? 0 : (item.score / item.max_score) * item.weight),
    0,
  );
  const currentAverage = markedWeight > 0 ? (earnedWeightedPoints / markedWeight) * 100 : null;
  const finalItem = courseGradeItems.find((item) => item.is_final);
  const remainingWeight = courseGradeItems.reduce(
    (sum, item) => sum + (item.score === null ? item.weight : 0),
    0,
  );
  const sortedCutoffs = cutoffForm
    .map(({ label, minimum, gpaStart, gpaEnd }) => ({
      label,
      minimum: Number(minimum),
      gpaStart: Number(gpaStart),
      gpaEnd: Number(gpaEnd),
    }))
    .filter(
      ({ label, minimum, gpaStart, gpaEnd }) =>
        label.trim() &&
        Number.isFinite(minimum) &&
        minimum >= 0 &&
        minimum <= 100 &&
        Number.isFinite(gpaStart) &&
        Number.isFinite(gpaEnd),
    )
    .sort((a, b) => b.minimum - a.minimum);
  const currentLetterGrade =
    currentAverage === null
      ? null
      : (sortedCutoffs.find(({ minimum }) => currentAverage >= minimum)?.label ?? "Below scale");

  const courseSummaries = courses.map((item) => {
    const items = gradeItems.filter((grade) => grade.course_id === item.id);
    const marked = items.filter((grade) => grade.score !== null);
    const weight = marked.reduce((sum, grade) => sum + grade.weight, 0);
    const earned = marked.reduce(
      (sum, grade) => sum + ((grade.score ?? 0) / grade.max_score) * grade.weight,
      0,
    );
    const average = weight > 0 ? (earned / weight) * 100 : null;
    const settings = gradeSettings.find((setting) => setting.course_id === item.id);
    const bands = readCutoffs(settings?.grade_cutoffs)
      .map((cutoff) => ({
        ...cutoff,
        minimum: Number(cutoff.minimum),
        gpaStart: Number(cutoff.gpaStart),
        gpaEnd: Number(cutoff.gpaEnd),
      }))
      .sort((a, b) => b.minimum - a.minimum);
    return {
      credits: settings?.credit_hours ?? 3,
      gpaPoints: average === null ? null : gpaForGrade(average, bands),
    };
  });
  const gpaCourses = courseSummaries.filter((summary) => summary.gpaPoints !== null);
  const gpaCredits = gpaCourses.reduce((sum, summary) => sum + summary.credits, 0);
  const gpaSoFar =
    gpaCredits > 0
      ? gpaCourses.reduce((sum, summary) => sum + summary.credits * (summary.gpaPoints ?? 0), 0) /
        gpaCredits
      : null;
  const totalCredits = courses.reduce(
    (sum, item) =>
      sum + (gradeSettings.find((setting) => setting.course_id === item.id)?.credit_hours ?? 3),
    0,
  );

  function neededOnRemaining(minimum: number) {
    if (remainingWeight <= 0) return null;
    return ((minimum - earnedWeightedPoints) / remainingWeight) * 100;
  }

  function openNewItem() {
    setEditingItem(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEditItem(item: GradeItem) {
    setEditingItem(item);
    setForm({
      title: item.title,
      score: item.score === null ? "" : String(item.score),
      maxScore: String(item.max_score),
      weight: String(item.weight),
      isFinal: item.is_final,
    });
    setFormOpen(true);
  }

  async function handleSaveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourseId) return;
    const data = {
      courseId: selectedCourseId,
      title: form.title.trim(),
      score: form.score === "" ? null : Number(form.score),
      maxScore: Number(form.maxScore),
      weight: Number(form.weight),
      isFinal: form.isFinal,
    };
    try {
      if (editingItem) await updateItem({ data: { ...data, gradeItemId: editingItem.id } });
      else await createItem({ data });
      await queryClient.invalidateQueries({ queryKey: ["grade-items"] });
      setFormOpen(false);
      toast.success(editingItem ? "Grading component updated" : "Grading component added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the grading component");
    }
  }

  async function handleDeleteItem(item: GradeItem) {
    if (!window.confirm(`Remove ${item.title} from this course grading scheme?`)) return;
    try {
      await deleteItem({ data: { gradeItemId: item.id } });
      await queryClient.invalidateQueries({ queryKey: ["grade-items"] });
      toast.success("Grading component removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the component");
    }
  }

  async function handleSaveCutoffs(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourseId) return;
    const cutoffs: Record<string, { minimum: number; gpaStart: number; gpaEnd: number }> = {};
    for (const { label, minimum, gpaStart, gpaEnd } of cutoffForm) {
      const normalizedLabel = label.trim();
      const value = Number(minimum);
      const start = Number(gpaStart);
      const end = Number(gpaEnd);
      if (
        !normalizedLabel ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 100 ||
        !Number.isFinite(start) ||
        start < 0 ||
        start > 5 ||
        !Number.isFinite(end) ||
        end < 0 ||
        end > 5
      ) {
        toast.error("Enter a grade label, cutoff from 0 to 100, and GPA endpoints from 0 to 5.");
        return;
      }
      if (normalizedLabel in cutoffs) {
        toast.error("Grade labels must be unique.");
        return;
      }
      cutoffs[normalizedLabel] = { minimum: value, gpaStart: start, gpaEnd: end };
    }
    try {
      await saveSettings({
        data: {
          courseId: selectedCourseId,
          creditHours: Number(creditHours),
          gradeCutoffs: cutoffs,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["course-grade-settings"] });
      toast.success("Grading cutoffs saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save grade cutoffs");
    }
  }

  async function copyInboxLink(reset = false) {
    try {
      const { token } = reset ? await resetGradeInboxToken() : await getGradeInboxToken();
      const url = `${window.location.origin}/api/public/grades?key=${token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success(reset ? "New grade inbox link copied" : "Grade inbox link copied");
      } catch {
        toast.message(url);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the grade inbox link");
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
            Course grades
          </p>
          <h2 className="mt-1 font-display text-2xl font-medium text-ink">Grades</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-line bg-card text-ink"
            onClick={() => void copyInboxLink()}
          >
            Copy inbox link
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full text-ink-soft"
            onClick={() => {
              if (window.confirm("Reset this grade inbox link? The old link will stop working."))
                void copyInboxLink(true);
            }}
          >
            Reset link
          </Button>
        </div>
      </div>

      <div className="rounded-2xl bg-violet-600 px-5 py-4 text-white shadow-md">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="font-display text-4xl font-semibold">
            {gpaSoFar === null ? "—" : gpaSoFar.toFixed(2)}
          </p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
              GPA so far
            </p>
            <p className="mt-1 text-xs text-white/90">
              {courses.length} courses · {totalCredits} credit hours
              {gpaCourses.length
                ? ` · ${Math.min(...defaultCutoffs.map((item) => Number(item.gpaEnd))).toFixed(1)} is the best`
                : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-card px-4 py-3 text-xs leading-relaxed text-ink-soft">
        The private inbox accepts grade updates from an authorized GUC integration. It never asks
        for your GUC password. Checks are limited to 3 per rolling 24 hours; resetting the link does
        not reset this limit. Send a JSON POST with the course code and exact assessment names from
        the grading scheme, for example:
        <pre className="mt-2 overflow-x-auto rounded-lg bg-cream p-3 text-[11px] text-ink">
          {`{"course_code":"CIW 501","grades":[{"title":"Final exam","score":87,"max_score":100}]}`}
        </pre>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
          <p className="mt-2 text-sm text-ink-soft">Add a course before setting up its grades.</p>
        </div>
      ) : (
        <>
          <label className="block max-w-sm text-sm font-medium text-ink">
            Course
            <select
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink"
            >
              {courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.code ? ` · ${item.code}` : ""}
                </option>
              ))}
            </select>
          </label>

          {course && (
            <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                      {course.code || "Course"}
                    </p>
                    <h3 className="mt-1 font-display text-xl font-medium text-ink">
                      {course.name}
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full border-line bg-background text-ink"
                    onClick={() => setSchemeOpen(true)}
                  >
                    Grading scheme
                  </Button>
                </div>

                <div className="mt-5 rounded-2xl bg-violet-600 px-5 py-4 text-white shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-3xl font-bold">
                        {currentAverage === null ? "—" : percent(currentAverage)}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/80">
                        Average on marked work
                      </p>
                    </div>
                    <div className="text-right">
                      {currentLetterGrade && (
                        <p className="text-2xl font-bold">
                          {currentLetterGrade}
                          {sortedCutoffs.find((item) => item.label === currentLetterGrade)
                            ? ` · ${gpaForGrade(currentAverage ?? 0, sortedCutoffs)?.toFixed(2)}`
                            : ""}
                        </p>
                      )}
                      <p className="text-xs text-white/85">
                        {percent(markedWeight)} of course marked
                      </p>
                      <p className="text-xs text-white/85">{percent(totalWeight)} weighted</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/20">
                    <div
                      className="h-full rounded-full bg-orange-400 transition-all"
                      style={{ width: `${Math.min(100, markedWeight)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-cream p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    {remainingWeight > 0 ? "What you need on remaining work" : "Course targets"}
                  </p>
                  {remainingWeight > 0 && finalItem ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sortedCutoffs.map(({ label, minimum }) => {
                        const needed = neededOnRemaining(minimum);
                        const value =
                          needed === null
                            ? "—"
                            : needed <= 0
                              ? "Already there"
                              : needed > 100
                                ? "Over 100%"
                                : `needs ${percent(needed)}`;
                        return (
                          <span
                            key={label}
                            className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-ink"
                          >
                            {label} {value}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {finalItem
                        ? "All graded components are marked."
                        : "Set a final exam component in the grading scheme."}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
                    Average needed across the remaining {percent(remainingWeight)} of the configured
                    grading scheme.
                  </p>
                </div>

                <div className="mt-5 divide-y divide-line">
                  {orderedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                        <p className="text-xs text-ink-soft">
                          {percent(item.weight)} of the grade
                          {item.score !== null
                            ? ` · ${item.score}/${item.max_score} · ${percent((item.score / item.max_score) * 100)}`
                            : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-sm font-semibold text-ink-soft">
                        {item.score === null ? "Not marked" : `${item.score}/${item.max_score}`}
                      </div>
                    </div>
                  ))}
                  {courseGradeItems.length === 0 && (
                    <p className="py-5 text-sm text-ink-soft">
                      No components yet. Add the course assessment weights to begin.
                    </p>
                  )}
                </div>
              </div>
            </article>
          )}
        </>
      )}

      <Dialog open={schemeOpen} onOpenChange={setSchemeOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl border-line bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-ink">Grading scheme</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-soft">
            Enter the assessment components and weights from this course’s official scheme. Weights
            must total no more than 100%, with one final exam component. Percentage and GPA ranges
            match your example; edit them to match the course’s official scheme.
          </p>
          <div className="divide-y divide-line">
            {orderedItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                  <p className="text-xs text-ink-soft">
                    {percent(item.weight)} ·{" "}
                    {item.score === null ? "Not marked" : `${item.score}/${item.max_score}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${item.title}`}
                    onClick={() => openEditItem(item)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${item.title}`}
                    onClick={() => void handleDeleteItem(item)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
            <span className="font-medium text-ink">Total weight</span>
            <span
              className={
                totalWeight > 100 ? "font-semibold text-destructive" : "font-semibold text-ink"
              }
            >
              {percent(totalWeight)}
            </span>
          </div>
          <form onSubmit={handleSaveCutoffs} className="space-y-3 border-t border-line pt-4">
            <label className="block text-sm font-medium text-ink">
              Credit hours
              <Input
                required
                type="number"
                min={0.1}
                max={30}
                step="0.1"
                value={creditHours}
                onChange={(event) => setCreditHours(event.target.value)}
                className="mt-1 rounded-xl border-line bg-background"
              />
            </label>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">Letter grades and GPA</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setCutoffForm([
                    ...cutoffForm,
                    { label: "", minimum: "", gpaStart: "", gpaEnd: "" },
                  ])
                }
              >
                + Add grade
              </Button>
            </div>
            {cutoffForm.map((cutoff, index) => (
              <div
                key={`${index}-${cutoff.label}`}
                className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2"
              >
                <Input
                  aria-label="Letter grade"
                  value={cutoff.label}
                  onChange={(event) =>
                    setCutoffForm(
                      cutoffForm.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="A+"
                  maxLength={10}
                  className="rounded-xl border-line bg-background"
                />
                <Input
                  aria-label="Minimum percentage"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={cutoff.minimum}
                  onChange={(event) =>
                    setCutoffForm(
                      cutoffForm.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, minimum: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="94"
                  className="rounded-xl border-line bg-background"
                />
                <Input
                  aria-label="GPA points"
                  type="number"
                  min={0}
                  max={5}
                  step="0.1"
                  value={cutoff.gpaStart}
                  onChange={(event) =>
                    setCutoffForm(
                      cutoffForm.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, gpaStart: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="GPA low score"
                  className="rounded-xl border-line bg-background"
                />
                <Input
                  aria-label="GPA point at maximum percentage"
                  type="number"
                  min={0}
                  max={5}
                  step="0.1"
                  value={cutoff.gpaEnd}
                  onChange={(event) =>
                    setCutoffForm(
                      cutoffForm.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, gpaEnd: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="GPA high score"
                  className="rounded-xl border-line bg-background"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${cutoff.label || "grade"} cutoff`}
                  disabled={cutoffForm.length <= 1}
                  onClick={() =>
                    setCutoffForm(cutoffForm.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button type="submit" variant="outline" className="w-full rounded-full">
              Save grading scheme
            </Button>
          </form>
          <Button type="button" className="w-full rounded-full" onClick={openNewItem}>
            + Add assessment component
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="rounded-2xl border-line bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-ink">
              {editingItem ? "Edit component" : "Add assessment component"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveItem} className="space-y-4">
            <label className="block text-sm text-ink">
              Assessment name
              <Input
                required
                maxLength={200}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Final exam, assignments…"
                className="mt-1 rounded-xl border-line bg-background"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-ink">
                Weight (%)
                <Input
                  required
                  type="number"
                  min={0.1}
                  max={100}
                  step="0.1"
                  value={form.weight}
                  onChange={(event) => setForm({ ...form, weight: event.target.value })}
                  className="mt-1 rounded-xl border-line bg-background"
                />
              </label>
              <label className="block text-sm text-ink">
                Maximum score
                <Input
                  required
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={form.maxScore}
                  onChange={(event) => setForm({ ...form, maxScore: event.target.value })}
                  className="mt-1 rounded-xl border-line bg-background"
                />
              </label>
            </div>
            <label className="block text-sm text-ink">
              Score (leave blank until marked)
              <Input
                type="number"
                min={0}
                max={Number(form.maxScore) || undefined}
                step="0.01"
                value={form.score}
                onChange={(event) => setForm({ ...form, score: event.target.value })}
                className="mt-1 rounded-xl border-line bg-background"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.isFinal}
                onChange={(event) => setForm({ ...form, isFinal: event.target.checked })}
              />
              This is the final exam
            </label>
            <Button type="submit" className="w-full rounded-full">
              {editingItem ? "Save component" : "Add component"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function GradeNotificationsPopup() {
  const queryClient = useQueryClient();
  const fetchNotifications = useServerFn(getUnreadGradeNotifications);
  const dismissNotifications = useServerFn(dismissGradeNotifications);
  const { data: notifications = [] } = useQuery({
    queryKey: ["grade-notifications"],
    queryFn: () => fetchNotifications(),
    refetchInterval: 60_000,
  });

  async function dismissPopup() {
    if (!notifications.length) return;
    try {
      await dismissNotifications({
        data: { notificationIds: notifications.map((item) => item.id) },
      });
      await queryClient.invalidateQueries({ queryKey: ["grade-notifications"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not dismiss grade alerts");
    }
  }

  return (
    <Dialog open={notifications.length > 0} onOpenChange={(open) => !open && void dismissPopup()}>
      <DialogContent className="rounded-2xl border-line bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-ink">New grade received</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div key={notification.id} className="rounded-xl bg-cream p-3">
              <p className="text-xs text-ink-soft">
                {notification.course_name}
                {notification.course_code ? ` · ${notification.course_code}` : ""}
              </p>
              <p className="font-semibold text-ink">{notification.grade_title}</p>
              <p className="text-sm text-ink-soft">
                {notification.score}/{notification.max_score} (
                {percent((notification.score / notification.max_score) * 100)})
              </p>
            </div>
          ))}
        </div>
        <Button type="button" className="w-full rounded-full" onClick={() => void dismissPopup()}>
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}
