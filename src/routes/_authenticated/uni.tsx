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

  const [selectedCourse, setSelectedCourse] = useState<string | "all">("all");
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [lectureDialogOpen, setLectureDialogOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({ name: "", code: "" });
  const [lectureForm, setLectureForm] = useState({
    courseId: "",
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
  });

  const filteredLectures =
    selectedCourse === "all"
      ? lectures
      : lectures.filter((l) => l.course_id === selectedCourse);

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

  async function handleAddLecture(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createLectureFn({
        data: {
          courseId: lectureForm.courseId,
          title: lectureForm.title,
          lectureDate: lectureForm.date,
        },
      });
      setLectureForm({
        courseId: courses[0]?.id ?? "",
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
          Keep up with lectures and attendance across your classes.
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
            Attendance
          </p>
          <p className="mt-1 font-display text-2xl text-ink">{completionRate}%</p>
        </div>
      </section>

      <section className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="rounded-full border border-line bg-card px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-rust/20"
          >
            <option value="all">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
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

          <Dialog open={lectureDialogOpen} onOpenChange={setLectureDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="rounded-full bg-ink text-cream hover:bg-ink/90"
              >
                <Plus className="mr-1 size-4" /> Lecture
              </Button>
            </DialogTrigger>
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
                    value={lectureForm.courseId}
                    onChange={(e) =>
                      setLectureForm({ ...lectureForm, courseId: e.target.value })
                    }
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
        </div>
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
        <div className="space-y-3">
          {filteredLectures.map((lecture) => {
            const course = courses.find((c) => c.id === lecture.course_id);
            return (
              <div
                key={lecture.id}
                className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleLecture(lecture.id, lecture.completed)}
                    className={`mt-0.5 size-6 rounded-full border-2 transition ${
                      lecture.completed
                        ? "border-rust bg-rust text-cream"
                        : "border-line bg-transparent text-ink-soft hover:border-rust/40"
                    }`}
                    aria-label={lecture.completed ? "Mark absent" : "Mark attended"}
                  >
                    {lecture.completed && <Check className="size-4" />}
                  </button>
                  <div>
                    <p className="font-medium text-ink">{lecture.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-ink-soft">
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: course?.color ?? "#CE552F" }}
                      />
                      {course?.name}
                      {lecture.lecture_date && (
                        <span>· {format(new Date(lecture.lecture_date), "MMM d")}</span>
                      )}
                    </div>
                  </div>
                </div>
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
                      onClick={() => removeLecture(lecture.id)}
                      className="text-rust focus:bg-cream focus:text-rust"
                    >
                      <Trash2 className="mr-2 size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {selectedCourse !== "all" && courses.find((c) => c.id === selectedCourse) && (
        <div className="mt-8 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeCourse(selectedCourse)}
            className="text-ink-muted hover:text-rust"
          >
            <Trash2 className="mr-1 size-4" /> Delete this course
          </Button>
        </div>
      )}
    </main>
  );
}
