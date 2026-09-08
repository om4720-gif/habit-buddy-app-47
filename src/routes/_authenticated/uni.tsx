import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Check, GraduationCap, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  createCourse,
  createLecture,
  deleteCourse,
  deleteLecture,
  getCourses,
  getLectures,
  updateLecture,
} from "@/lib/uni.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/uni")({
  component: UniPage,
});

function UniPage() {
  const queryClient = useQueryClient();
  const fetchCourses = useServerFn(getCourses);
  const fetchLectures = useServerFn(getLectures);
  const createCourseFn = useServerFn(createCourse);
  const createLectureFn = useServerFn(createLecture);
  const updateLectureFn = useServerFn(updateLecture);
  const deleteCourseFn = useServerFn(deleteCourse);
  const deleteLectureFn = useServerFn(deleteLecture);

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: () => fetchCourses(),
  });

  const { data: lectures = [] } = useQuery({
    queryKey: ["lectures"],
    queryFn: () => fetchLectures({ data: {} }),
  });

  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [lectureDialogOpen, setLectureDialogOpen] = useState(false);
  const [lectureCourseId, setLectureCourseId] = useState<string>("");
  const [courseForm, setCourseForm] = useState({ name: "", code: "" });
  const [lectureForm, setLectureForm] = useState({
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
  });

  const lecturesByCourse = new Map<string, typeof lectures>();
  for (const lecture of lectures) {
    const list = lecturesByCourse.get(lecture.course_id) ?? [];
    list.push(lecture);
    lecturesByCourse.set(lecture.course_id, list);
  }

  async function handleAddCourse(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createCourseFn({
        data: { name: courseForm.name, code: courseForm.code || undefined },
      });
      setCourseForm({ name: "", code: "" });
      setCourseDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course added");
    } catch (err) {
      toast.error("Could not add course");
    }
  }

  function openLectureDialog(courseId: string) {
    setLectureCourseId(courseId);
    setLectureForm({
      title: "",
      date: format(new Date(), "yyyy-MM-dd"),
    });
    setLectureDialogOpen(true);
  }

  async function handleAddLecture(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createLectureFn({
        data: {
          courseId: lectureCourseId,
          title: lectureForm.title,
          lectureDate: lectureForm.date,
        },
      });
      setLectureForm({
        title: "",
        date: format(new Date(), "yyyy-MM-dd"),
      });
      setLectureDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["lectures"] });
      toast.success("Lecture added");
    } catch (err) {
      toast.error("Could not add lecture");
    }
  }

  async function toggleLecture(lectureId: string, completed: boolean) {
    try {
      await updateLectureFn({ data: { lectureId, completed: !completed } });
      queryClient.invalidateQueries({ queryKey: ["lectures"] });
    } catch (err) {
      toast.error("Could not update lecture");
    }
  }

  async function removeCourse(courseId: string) {
    try {
      await deleteCourseFn({ data: { courseId } });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["lectures"] });
      toast.success("Course removed");
    } catch (err) {
      toast.error("Could not remove course");
    }
  }

  async function removeLecture(lectureId: string) {
    try {
      await deleteLectureFn({ data: { lectureId } });
      queryClient.invalidateQueries({ queryKey: ["lectures"] });
      toast.success("Lecture removed");
    } catch (err) {
      toast.error("Could not remove lecture");
    }
  }

  const completedCount = lectures.filter((l) => l.completed).length;
  const completionRate = lectures.length
    ? Math.round((completedCount / lectures.length) * 100)
    : 0;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 sm:px-8">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-rust">
          <GraduationCap className="size-5" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">
            University
          </span>
        </div>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink sm:text-4xl">
          Course tracker
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Keep track of which lectures you have studied and finished.
        </p>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
            Courses
          </p>
          <p className="mt-1 font-display text-2xl text-ink">{courses.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
            Lectures
          </p>
          <p className="mt-1 font-display text-2xl text-ink">{lectures.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
            Studied
          </p>
          <p className="mt-1 font-display text-2xl text-ink">{completionRate}%</p>
        </div>
      </section>

      <section className="mb-6 flex items-center justify-between">
        <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-line bg-card text-ink hover:bg-cream"
            >
              <Plus className="mr-1 size-4" /> Course
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl border-line bg-card">
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-ink">
                Add course
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddCourse} className="mt-2 space-y-4">
              <div>
                <Label htmlFor="courseName" className="text-ink-soft">
                  Course name
                </Label>
                <Input
                  id="courseName"
                  value={courseForm.name}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, name: e.target.value })
                  }
                  required
                  className="mt-1 rounded-xl border-line bg-background text-ink"
                />
              </div>
              <div>
                <Label htmlFor="courseCode" className="text-ink-soft">
                  Code (optional)
                </Label>
                <Input
                  id="courseCode"
                  value={courseForm.code}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, code: e.target.value })
                  }
                  className="mt-1 rounded-xl border-line bg-background text-ink"
                />
              </div>
              <Button
                type="submit"
                className="w-full rounded-full bg-rust text-cream hover:bg-rust/90"
              >
                Save course
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </section>

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center">
          <p className="text-sm text-ink-soft">No courses yet.</p>
          <Button
            variant="ghost"
            onClick={() => setCourseDialogOpen(true)}
            className="mt-2 text-rust hover:text-rust/80"
          >
            Add your first course
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {courses.map((course) => {
            const courseLectures = lecturesByCourse.get(course.id) ?? [];
            const studiedCount = courseLectures.filter((l) => l.completed).length;

            return (
              <section
                key={course.id}
                className="rounded-2xl border border-line bg-card shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block size-3 rounded-full"
                      style={{ backgroundColor: course.color ?? "#CE552F" }}
                    />
                    <div>
                      <h2 className="font-display text-lg font-medium text-ink">
                        {course.name}
                      </h2>
                      {course.code && (
                        <p className="text-xs text-ink-soft">{course.code}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-soft">
                      {studiedCount}/{courseLectures.length} studied
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openLectureDialog(course.id)}
                      className="rounded-full text-ink hover:bg-cream"
                    >
                      <Plus className="mr-1 size-4" /> Lecture
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-ink-muted hover:text-ink"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="rounded-xl border-line bg-card"
                      >
                        <DropdownMenuItem
                          onClick={() => removeCourse(course.id)}
                          className="text-rust focus:bg-cream focus:text-rust"
                        >
                          <Trash2 className="mr-2 size-4" /> Delete course
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="divide-y divide-line">
                  {courseLectures.length === 0 ? (
                    <div className="px-5 py-6 text-center">
                      <p className="text-sm text-ink-soft">No lectures yet.</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openLectureDialog(course.id)}
                        className="mt-1 text-rust hover:text-rust/80"
                      >
                        Add the first lecture
                      </Button>
                    </div>
                  ) : (
                    courseLectures
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(a.lecture_date ?? 0).getTime() -
                          new Date(b.lecture_date ?? 0).getTime()
                      )
                      .map((lecture) => (
                        <div
                          key={lecture.id}
                          className="flex items-center justify-between px-5 py-4 transition hover:bg-cream/30"
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() =>
                                toggleLecture(lecture.id, !!lecture.completed)
                              }
                              className={`mt-0.5 size-6 rounded-full border-2 transition ${
                                lecture.completed
                                  ? "border-rust bg-rust text-cream"
                                  : "border-line bg-transparent text-ink-soft hover:border-rust/40"
                              }`}
                              aria-label={
                                lecture.completed ? "Mark not studied" : "Mark studied"
                              }
                            >
                              {lecture.completed && <Check className="size-4" />}
                            </button>
                            <div>
                              <p
                                className={`font-medium ${
                                  lecture.completed
                                    ? "text-ink-soft line-through"
                                    : "text-ink"
                                }`}
                              >
                                {lecture.title}
                              </p>
                              {lecture.lecture_date && (
                                <p className="mt-0.5 text-xs text-ink-soft">
                                  {format(new Date(lecture.lecture_date), "MMM d, yyyy")}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLecture(lecture.id)}
                            className="text-ink-muted hover:text-rust"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={lectureDialogOpen} onOpenChange={setLectureDialogOpen}>
        <DialogContent className="rounded-2xl border-line bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-ink">
              Add lecture
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddLecture} className="mt-2 space-y-4">
            <div>
              <Label htmlFor="lectureCourse" className="text-ink-soft">
                Course
              </Label>
              <select
                id="lectureCourse"
                value={lectureCourseId}
                onChange={(e) => setLectureCourseId(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2 text-sm text-ink outline-none"
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
              <Label htmlFor="lectureTitle" className="text-ink-soft">
                Lecture title
              </Label>
              <Input
                id="lectureTitle"
                value={lectureForm.title}
                onChange={(e) =>
                  setLectureForm({ ...lectureForm, title: e.target.value })
                }
                required
                className="mt-1 rounded-xl border-line bg-background text-ink"
              />
            </div>
            <div>
              <Label htmlFor="lectureDate" className="text-ink-soft">
                Date
              </Label>
              <Input
                id="lectureDate"
                type="date"
                value={lectureForm.date}
                onChange={(e) =>
                  setLectureForm({ ...lectureForm, date: e.target.value })
                }
                required
                className="mt-1 rounded-xl border-line bg-background text-ink"
              />
            </div>
            <Button
              type="submit"
              className="w-full rounded-full bg-rust text-cream hover:bg-rust/90"
            >
              Save lecture
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
