import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
type Course = { id: string; name: string; code: string | null; color: string | null };
type GradeItem = {
  id: string;
  course_id: string;
  title: string;
  score: number | null;
  max_score: number;
  weight: number;
  is_final: boolean;
};
type CourseGradeSettings = {
  course_id: string;
  credit_hours: number;
  grade_cutoffs: Record<string, { minimum: number; gpaStart: number; gpaEnd: number }>;
};
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

const LOCAL_GRADES_KEY = "habit-buddy:course-grades:v1";

function readLocalGrades(): { items: GradeItem[]; settings: CourseGradeSettings[] } {
  try {
    const raw = localStorage.getItem(LOCAL_GRADES_KEY);
    if (!raw) return { items: [], settings: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { items: [], settings: [] };
    const data = parsed as { items?: unknown; settings?: unknown };
    return {
      items: Array.isArray(data.items) ? (data.items as GradeItem[]) : [],
      settings: Array.isArray(data.settings) ? (data.settings as CourseGradeSettings[]) : [],
    };
  } catch {
    return { items: [], settings: [] };
  }
}

export function GradesSection({ courses }: { courses: Course[] }) {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id ?? "");
  const [schemeOpen, setSchemeOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GradeItem | null>(null);
  const [form, setForm] = useState<GradeForm>(emptyForm);
  const [cutoffForm, setCutoffForm] = useState<GradeCutoff[]>(defaultCutoffs);
  const [creditHours, setCreditHours] = useState("3");
  const [gradeItems, setGradeItems] = useState<GradeItem[]>([]);
  const [gradeSettings, setGradeSettings] = useState<CourseGradeSettings[]>([]);

  useEffect(() => {
    const saved = readLocalGrades();
    setGradeItems(saved.items);
    setGradeSettings(saved.settings);
  }, []);

  function persistLocalGrades(items: GradeItem[], settings: CourseGradeSettings[]) {
    localStorage.setItem(LOCAL_GRADES_KEY, JSON.stringify({ items, settings }));
    setGradeItems(items);
    setGradeSettings(settings);
  }

  function updateGradeSettings(
    courseId: string,
    update: Partial<Omit<CourseGradeSettings, "course_id">>,
  ) {
    const existing = gradeSettings.find((setting) => setting.course_id === courseId);
    const next: CourseGradeSettings = {
      course_id: courseId,
      credit_hours: existing?.credit_hours ?? 3,
      grade_cutoffs:
        existing?.grade_cutoffs ??
        Object.fromEntries(
          defaultCutoffs.map((item) => [
            item.label,
            {
              minimum: Number(item.minimum),
              gpaStart: Number(item.gpaStart),
              gpaEnd: Number(item.gpaEnd),
            },
          ]),
        ),
      ...update,
    };
    persistLocalGrades(gradeItems, [
      ...gradeSettings.filter((setting) => setting.course_id !== courseId),
      next,
    ]);
  }

  useEffect(() => {
    if (!courses.some((course) => course.id === selectedCourseId))
      setSelectedCourseId(courses[0]?.id ?? "");
  }, [courses, selectedCourseId]);

  useEffect(() => {
    const currentSettings = gradeSettings.find((setting) => setting.course_id === selectedCourseId);
    setCutoffForm(readCutoffs(currentSettings?.grade_cutoffs));
    setCreditHours(String(currentSettings?.credit_hours ?? 3));
  }, [gradeSettings, selectedCourseId]);

  const selectedCourse = courses.find((item) => item.id === selectedCourseId);
  const courseGradeItems = gradeItems.filter((item) => item.course_id === selectedCourseId);
  const orderedItems = courseGradeItems
    .slice()
    .sort((a, b) => Number(b.is_final) - Number(a.is_final));
  const totalWeight = courseGradeItems.reduce((sum, item) => sum + item.weight, 0);

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

  function neededOnRemaining(minimum: number, earned: number, remaining: number) {
    if (remaining <= 0) return null;
    return ((minimum - earned) / remaining) * 100;
  }

  function openNewItem() {
    setSchemeOpen(false);
    setEditingItem(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEditItem(item: GradeItem) {
    setSchemeOpen(false);
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
    const title = form.title.trim();
    const score = form.score === "" ? null : Number(form.score);
    const maxScore = Number(form.maxScore);
    const weight = Number(form.weight);
    const courseItems = gradeItems.filter((item) => item.course_id === selectedCourseId);
    try {
      if (!title || !Number.isFinite(weight) || weight <= 0 || weight > 100)
        throw new Error("Enter an assessment name and a weight from 0.1% to 100%.");
      if (!Number.isFinite(maxScore) || maxScore <= 0)
        throw new Error("Maximum score must be greater than 0.");
      if (score !== null && (!Number.isFinite(score) || score < 0 || score > maxScore))
        throw new Error("Score must be between 0 and the maximum score.");
      if (
        courseItems.some(
          (item) => item.id !== editingItem?.id && item.title.toLowerCase() === title.toLowerCase(),
        )
      )
        throw new Error("This assessment already exists in the grading scheme.");
      if (form.isFinal && courseItems.some((item) => item.id !== editingItem?.id && item.is_final))
        throw new Error("This course already has a final exam component.");
      const otherWeight = courseItems
        .filter((item) => item.id !== editingItem?.id)
        .reduce((sum, item) => sum + item.weight, 0);
      if (otherWeight + weight > 100.0001)
        throw new Error("Course grade weights cannot add up to more than 100%.");

      const item: GradeItem = {
        id: editingItem?.id ?? crypto.randomUUID(),
        course_id: selectedCourseId,
        title,
        score,
        max_score: maxScore,
        weight,
        is_final: form.isFinal,
      };
      persistLocalGrades(
        [...gradeItems.filter((existing) => existing.id !== item.id), item],
        gradeSettings,
      );
      setFormOpen(false);
      toast.success(editingItem ? "Grading component updated" : "Grading component added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the grading component");
    }
  }

  async function handleDeleteItem(item: GradeItem) {
    if (!window.confirm(`Remove ${item.title} from this course grading scheme?`)) return;
    try {
      persistLocalGrades(
        gradeItems.filter((grade) => grade.id !== item.id),
        gradeSettings,
      );
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
    const parsedCreditHours = Number(creditHours);
    if (!Number.isFinite(parsedCreditHours) || parsedCreditHours <= 0 || parsedCreditHours > 30) {
      toast.error("Credit hours must be more than 0 and no more than 30.");
      return;
    }
    try {
      updateGradeSettings(selectedCourseId, {
        credit_hours: parsedCreditHours,
        grade_cutoffs: cutoffs,
      });
      toast.success("Grading cutoffs saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save grade cutoffs");
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
                ? ` · ${Math.min(...gpaCourses.map((item) => item.gpaPoints ?? 5)).toFixed(1)} is the best`
                : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-card px-4 py-3 text-xs leading-relaxed text-ink-soft">
        Grades are saved in this browser without a Supabase migration. They are not yet synced to
        other devices or connected to GUC.
      </div>

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
          <p className="mt-2 text-sm text-ink-soft">Add a course before setting up its grades.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => {
            const items = gradeItems
              .filter((grade) => grade.course_id === course.id)
              .sort((a, b) => Number(b.is_final) - Number(a.is_final));
            const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
            const markedWeight = items.reduce(
              (sum, item) => sum + (item.score === null ? 0 : item.weight),
              0,
            );
            const earned = items.reduce(
              (sum, item) =>
                sum + (item.score === null ? 0 : (item.score / item.max_score) * item.weight),
              0,
            );
            const average = markedWeight > 0 ? (earned / markedWeight) * 100 : null;
            const remaining = items.reduce(
              (sum, item) => sum + (item.score === null ? item.weight : 0),
              0,
            );
            const settings = gradeSettings.find((setting) => setting.course_id === course.id);
            const bands = readCutoffs(settings?.grade_cutoffs)
              .map((cutoff) => ({
                ...cutoff,
                minimum: Number(cutoff.minimum),
                gpaStart: Number(cutoff.gpaStart),
                gpaEnd: Number(cutoff.gpaEnd),
              }))
              .sort((a, b) => b.minimum - a.minimum);
            const letter =
              average === null
                ? null
                : (bands.find((band) => average >= band.minimum)?.label ?? "Below scale");
            const points = average === null ? null : gpaForGrade(average, bands);
            const final = items.some((item) => item.is_final);

            return (
              <article
                key={course.id}
                className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => {
                        setSelectedCourseId(course.id);
                        setSchemeOpen(true);
                      }}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                        {course.code || "Course"} · {settings?.credit_hours ?? 3} CH
                      </p>
                      <h3 className="mt-0.5 font-display text-lg font-semibold text-ink">
                        {course.name}
                      </h3>
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <div className="text-right">
                        <p className="text-xl font-bold text-ink">
                          {average === null ? "—" : percent(average)}
                        </p>
                        {letter && (
                          <p className="text-xs font-semibold text-ink-soft">
                            {letter} · {points?.toFixed(2)}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-ink-soft"
                        onClick={() => {
                          setSelectedCourseId(course.id);
                          setSchemeOpen(true);
                        }}
                      >
                        Grading scheme
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-cream">
                    <div
                      className="h-full rounded-full bg-rust transition-all"
                      style={{ width: `${Math.min(100, markedWeight)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-ink-soft">
                    {percent(markedWeight)} of the grade marked
                  </p>

                  <div className="mt-3 rounded-xl bg-cream p-3">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-xs font-semibold uppercase text-ink-soft">
                        Coursework
                      </span>
                      <span className="text-sm font-bold text-ink">
                        {percent(earned)} / {percent(totalWeight)}
                      </span>
                      {markedWeight > 0 && (
                        <span className="text-sm font-semibold text-ink">
                          {percent(average ?? 0)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {average === null
                        ? "No grades marked yet"
                        : `Average ${percent(average)} on the ${percent(markedWeight)} marked so far`}
                    </p>
                  </div>

                  {final && remaining > 0 && (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2">
                        {bands.slice(0, 3).map(({ label, minimum }) => {
                          const needed = neededOnRemaining(minimum, earned, remaining);
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
                              className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink"
                            >
                              {label} {value}
                            </span>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-xs text-ink-soft">
                        average in the {percent(remaining)} still to come
                      </p>
                    </div>
                  )}

                  <div className="mt-3 divide-y divide-line">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedCourseId(course.id);
                          openEditItem(item);
                        }}
                        className="flex w-full items-center justify-between gap-3 py-2 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {item.title}
                          </span>
                          <span className="block text-xs text-ink-soft">
                            {percent(item.weight)} of the grade
                            {item.score !== null ? ` · ${item.score}/${item.max_score}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-sm font-semibold text-ink-soft">
                          {item.score === null ? "Not marked" : `${item.score}/${item.max_score}`}
                        </span>
                      </button>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full rounded-full border-line bg-background text-ink"
                    onClick={() => {
                      setSelectedCourseId(course.id);
                      openNewItem();
                    }}
                  >
                    + Add assessment
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
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
          {selectedCourse?.code?.toLowerCase().replace(/[\s-]/g, "") === "ciw501" &&
            courseGradeItems.length === 0 && (
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full"
                onClick={() => {
                  const template = [
                    ["Final Exam", 40, true],
                    ["Mid-Term Exam", 20, false],
                    ["Assignments", 15, false],
                    ["Quiz and in-class assessment", 15, false],
                    ["Poster & Report", 10, false],
                  ] as const;
                  const items = template.map(([title, weight, isFinal]) => ({
                    id: crypto.randomUUID(),
                    course_id: selectedCourseId,
                    title,
                    score: null,
                    max_score: 100,
                    weight,
                    is_final: isFinal,
                  }));
                  try {
                    const existingSettings = gradeSettings.find(
                      (setting) => setting.course_id === selectedCourseId,
                    );
                    const settings: CourseGradeSettings = {
                      course_id: selectedCourseId,
                      credit_hours: 4,
                      grade_cutoffs:
                        existingSettings?.grade_cutoffs ??
                        Object.fromEntries(
                          defaultCutoffs.map((cutoff) => [
                            cutoff.label,
                            {
                              minimum: Number(cutoff.minimum),
                              gpaStart: Number(cutoff.gpaStart),
                              gpaEnd: Number(cutoff.gpaEnd),
                            },
                          ]),
                        ),
                    };
                    persistLocalGrades(
                      [...gradeItems, ...items],
                      [
                        ...gradeSettings.filter(
                          (setting) => setting.course_id !== selectedCourseId,
                        ),
                        settings,
                      ],
                    );
                    setSchemeOpen(false);
                    toast.success("CIW-501 grading scheme added");
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Could not save the grading scheme",
                    );
                  }
                }}
              >
                Use CIW-501 sample scheme (4 credit hours)
              </Button>
            )}
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
