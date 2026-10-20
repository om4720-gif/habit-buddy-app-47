import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { Camera, ClipboardPaste, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ExamCircle, ExamCircles } from "@/components/ExamCircles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDeadline, deleteDeadline, updateDeadline } from "@/lib/deadlines.functions";
import { type ExamItem, makeExamTitle, parseTimetableText, todayIso } from "@/lib/exams";
import { toJpegBase64 } from "@/lib/imageUpload";
import { bestMatch } from "@/lib/mero-match";
import { scanTimetable } from "@/lib/timetable.functions";
import { useExams } from "@/lib/useExams";
import { getCourses } from "@/lib/uni.functions";

type Form = { courseId: string; name: string; date: string; time: string; place: string };
const emptyForm = (courseId = ""): Form => ({
  courseId,
  name: "Final exam",
  date: "",
  time: "",
  place: "",
});

type Review = {
  key: string;
  checked: boolean;
  courseId: string;
  courseGuess: string;
  name: string;
  date: string;
  time: string;
  dup: boolean;
};

const selectCls =
  "mt-1 w-full rounded-xl border border-line bg-background px-3 py-2 text-sm text-ink outline-none";
const dayWord = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

export function ExamSection() {
  const qc = useQueryClient();
  const fetchCourses = useServerFn(getCourses);
  const create = useServerFn(createDeadline);
  const update = useServerFn(updateDeadline);
  const remove = useServerFn(deleteDeadline);
  const scan = useServerFn(scanTimetable);

  const { data: courses = [] } = useQuery({ queryKey: ["courses"], queryFn: () => fetchCourses() });
  const { all, upcoming, past } = useExams();

  const [form, setForm] = useState<Form | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExamItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [review, setReview] = useState<Review[] | null>(null);
  const [notRead, setNotRead] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["deadlines"] });
  const sameKey = (courseId: string, date: string, name: string) =>
    `${courseId}|${date}|${name.trim().toLowerCase()}`;
  const existing = new Set(all.map((e) => sameKey(e.courseId, e.date, e.name)));

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm(courses.length === 1 ? courses[0]!.id : ""));
  }
  function openEdit(e: ExamItem) {
    setDetail(null);
    setEditingId(e.id);
    setForm({ courseId: e.courseId, name: e.name, date: e.date, time: e.time, place: e.place });
  }

  async function saveForm(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form || !form.courseId || !form.date) return;
    const title = makeExamTitle(form);
    try {
      if (editingId) await update({ data: { deadlineId: editingId, title, dueDate: form.date } });
      else
        await create({
          data: { courseId: form.courseId, title, kind: "quiz", dueDate: form.date },
        });
      await refresh();
      toast.success(editingId ? "Exam updated" : "Exam added");
      setForm(null);
    } catch {
      toast.error("Could not save the exam");
    }
  }

  async function removeExam(e: ExamItem) {
    if (!window.confirm(`Delete the ${e.name} for ${e.courseName}?`)) return;
    try {
      await remove({ data: { deadlineId: e.id } });
      await refresh();
      setDetail(null);
      toast.success("Exam deleted");
    } catch {
      toast.error("Could not delete the exam");
    }
  }

  const matchCourse = (text: string) => {
    const m = bestMatch(text, courses, (c) => [c.name, c.code ?? ""]);
    return "item" in m ? m.item.id : "";
  };

  function toReview(
    rows: { courseId: string; courseGuess: string; name: string; date: string; time: string }[],
  ) {
    setReview(
      rows.map((r, i) => {
        const dup = !!r.courseId && existing.has(sameKey(r.courseId, r.date, r.name));
        return { key: `${i}-${r.date}`, checked: !dup, dup, ...r };
      }),
    );
  }

  function readPasted() {
    const { exams, skipped } = parseTimetableText(paste, courses);
    setNotRead(skipped.slice(0, 8));
    if (exams.length === 0) {
      toast.error(
        "I couldn't find any dates in that. Try one exam per line, like “Steel Design 20/12/2026 09:00”.",
      );
      return;
    }
    toReview(
      exams.map((e) => ({
        courseId: e.courseId ?? "",
        courseGuess: e.courseGuess,
        name: e.name,
        date: e.date,
        time: e.time,
      })),
    );
  }

  async function readPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const img = await toJpegBase64(file);
      const res = await scan({
        data: { imageBase64: img.base64, mime: img.mime, today: todayIso() },
      });
      setNotRead([]);
      if (res.exams.length === 0) {
        toast.error(
          "I couldn't find any exams in that photo. Try a sharper one, or paste the text.",
        );
        return;
      }
      toReview(
        res.exams.map((e) => ({
          courseId: matchCourse(e.course),
          courseGuess: e.course,
          name: e.name,
          date: e.date,
          time: e.time,
        })),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that photo");
    } finally {
      setBusy(false);
    }
  }

  async function addReviewed() {
    if (!review) return;
    const rows = review.filter((r) => r.checked && r.courseId && r.date);
    if (rows.length === 0) return;
    setBusy(true);
    try {
      for (const r of rows)
        await create({
          data: {
            courseId: r.courseId,
            title: makeExamTitle({ name: r.name, time: r.time, place: "" }),
            kind: "quiz",
            dueDate: r.date,
          },
        });
      await refresh();
      toast.success(`${rows.length} exam${rows.length === 1 ? "" : "s"} added`);
      setImportOpen(false);
      setReview(null);
      setPaste("");
    } catch {
      await refresh();
      toast.error("Some exams could not be added. Check the list and try again.");
    } finally {
      setBusy(false);
    }
  }

  const patch = (key: string, p: Partial<Review>) =>
    setReview((rows) => rows?.map((r) => (r.key === key ? { ...r, ...p } : r)) ?? null);
  const ready = (review ?? []).filter((r) => r.checked && r.courseId && r.date).length;
  const needsCourse = (review ?? []).filter((r) => r.checked && !r.courseId).length;

  return (
    <section className="mb-6" aria-labelledby="exams-heading">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="exams-heading"
          className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft"
        >
          Exams
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              setReview(null);
              setPaste("");
              setNotRead([]);
              setImportOpen(true);
            }}
          >
            <ClipboardPaste className="size-4" /> Import timetable
          </Button>
          <Button
            size="sm"
            className="rounded-full"
            onClick={openAdd}
            disabled={courses.length === 0}
          >
            <Plus className="size-4" /> Add exam
          </Button>
        </div>
      </div>

      <div className="mt-3 rounded-3xl border border-line bg-card p-4 shadow-sm sm:p-5">
        {upcoming.length > 0 ? (
          <ExamCircles exams={upcoming} onSelect={setDetail} />
        ) : (
          <p className="text-sm text-ink-soft">
            {courses.length === 0
              ? "Add a course first, then add its exams here."
              : "No exams yet. Add one, or import your timetable and I'll count the days for you."}
          </p>
        )}
        {past.length > 0 && (
          <details className="mt-3 border-t border-line pt-3 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-ink-soft">
              Past exams ({past.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {past
                .slice()
                .reverse()
                .map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 text-ink-soft">
                    <span className="truncate">
                      {e.courseName} · {e.name} ·{" "}
                      {format(new Date(`${e.date}T00:00:00`), "d MMM yyyy")}
                    </span>
                    <button
                      onClick={() => removeExam(e)}
                      aria-label={`Delete ${e.name} for ${e.courseName}`}
                      className="rounded-full p-1 hover:bg-sand hover:text-ink"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
            </ul>
          </details>
        )}
      </div>

      {/* Details of one exam */}
      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-sm">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{detail.courseName}</DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-4">
                <ExamCircle
                  daysLeft={detail.daysLeft}
                  size={88}
                  label={`${detail.daysLeft} days left`}
                />
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-ink">{detail.name}</p>
                  <p className="text-ink-soft">
                    {format(new Date(`${detail.date}T00:00:00`), "EEEE d MMMM yyyy")}
                  </p>
                  {detail.time && <p className="text-ink-soft">at {detail.time}</p>}
                  {detail.place && <p className="text-ink-soft">{detail.place}</p>}
                  <p className="mt-1 text-xs text-rust">{dayWord(detail.daysLeft)}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => removeExam(detail)}>
                  <Trash2 className="size-4" /> Delete
                </Button>
                <Button size="sm" onClick={() => openEdit(detail)}>
                  <Pencil className="size-4" /> Edit
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / edit */}
      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingId ? "Edit exam" : "Add exam"}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <form onSubmit={saveForm} className="space-y-3">
              <div>
                <Label htmlFor="examCourse" className="text-ink-soft">
                  Course
                </Label>
                <select
                  id="examCourse"
                  value={form.courseId}
                  disabled={editingId !== null}
                  required
                  onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                  className={selectCls}
                >
                  <option value="">Select a course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="examName" className="text-ink-soft">
                  Exam
                </Label>
                <Input
                  id="examName"
                  list="exam-names"
                  value={form.name}
                  maxLength={60}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1"
                />
                <datalist id="exam-names">
                  <option value="Final exam" />
                  <option value="Midterm" />
                  <option value="Oral exam" />
                  <option value="Practical exam" />
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="examDate" className="text-ink-soft">
                    Date
                  </Label>
                  <Input
                    id="examDate"
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="examTime" className="text-ink-soft">
                    Time (optional)
                  </Label>
                  <Input
                    id="examTime"
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="examPlace" className="text-ink-soft">
                  Room (optional)
                </Label>
                <Input
                  id="examPlace"
                  value={form.place}
                  maxLength={60}
                  onChange={(e) => setForm({ ...form, place: e.target.value })}
                  className="mt-1"
                />
              </div>
              <Button
                type="submit"
                className="w-full rounded-full"
                disabled={!form.courseId || !form.date}
              >
                Save exam
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Import a timetable */}
      <Dialog
        open={importOpen}
        onOpenChange={(o) => {
          setImportOpen(o);
          if (!o) setReview(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Import your exam timetable</DialogTitle>
          </DialogHeader>

          {review === null ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="paste" className="text-ink-soft">
                  Paste it here, one exam per line
                </Label>
                <textarea
                  id="paste"
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  rows={6}
                  placeholder={
                    "Steel Design  20/12/2026  09:00\nStructural Analysis III  22 Dec 2026  10:30\nالأحد 27 ديسمبر 2026 — Hydrology"
                  }
                  className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2 text-sm text-ink outline-none"
                />
                <Button
                  className="mt-2 w-full rounded-full"
                  onClick={readPasted}
                  disabled={!paste.trim() || courses.length === 0}
                >
                  Read the timetable
                </Button>
              </div>
              <div className="relative text-center text-xs text-ink-soft before:absolute before:left-0 before:top-1/2 before:h-px before:w-[42%] before:bg-line after:absolute after:right-0 after:top-1/2 after:h-px after:w-[42%] after:bg-line">
                or
              </div>
              <div>
                <label
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-sand ${busy ? "pointer-events-none opacity-60" : ""}`}
                >
                  <Camera className="size-4" />{" "}
                  {busy ? "Reading your photo…" : "Take or choose a photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => {
                      void readPhoto(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="mt-1.5 text-center text-[11px] text-ink-soft">
                  A clear photo or screenshot works best. You can check everything before it's
                  saved.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-soft">
                Check each exam, fix anything that's wrong, then add them.
                {needsCourse > 0 && (
                  <span className="text-rust"> Choose a course for the ones marked below.</span>
                )}
              </p>
              <ul className="space-y-2">
                {review.map((r) => (
                  <li
                    key={r.key}
                    className={`rounded-2xl border p-3 ${r.checked ? "border-line bg-card" : "border-line/60 bg-paper opacity-70"}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={r.checked}
                        onChange={(e) => patch(r.key, { checked: e.target.checked })}
                        aria-label="Include this exam"
                        className="mt-2 size-4 accent-[var(--rust)]"
                      />
                      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                        <select
                          value={r.courseId}
                          onChange={(e) =>
                            patch(r.key, {
                              courseId: e.target.value,
                              dup: existing.has(sameKey(e.target.value, r.date, r.name)),
                            })
                          }
                          aria-label="Course"
                          className={`w-full rounded-xl border bg-background px-3 py-2 text-sm text-ink outline-none sm:col-span-2 ${r.checked && !r.courseId ? "border-rust" : "border-line"}`}
                        >
                          <option value="">
                            {r.courseGuess
                              ? `Choose a course for “${r.courseGuess}”`
                              : "Choose a course"}
                          </option>
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <Input
                          value={r.name}
                          maxLength={60}
                          aria-label="Exam name"
                          onChange={(e) => patch(r.key, { name: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="date"
                            value={r.date}
                            aria-label="Date"
                            onChange={(e) => patch(r.key, { date: e.target.value })}
                          />
                          <Input
                            type="time"
                            value={r.time}
                            aria-label="Time"
                            onChange={(e) => patch(r.key, { time: e.target.value })}
                          />
                        </div>
                        {r.dup && (
                          <p className="text-xs text-ink-soft sm:col-span-2">
                            Already in your exams.
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {notRead.length > 0 && (
                <p className="text-xs text-ink-soft">
                  I couldn't read {notRead.length} line{notRead.length === 1 ? "" : "s"}:{" "}
                  {notRead.map((l) => `“${l.slice(0, 40)}”`).join(", ")}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" className="rounded-full" onClick={() => setReview(null)}>
                  Back
                </Button>
                <Button
                  className="flex-1 rounded-full"
                  onClick={addReviewed}
                  disabled={ready === 0 || busy}
                >
                  {busy ? "Adding…" : `Add ${ready} exam${ready === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
