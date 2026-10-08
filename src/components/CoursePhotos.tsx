import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Folder,
  ImageOff,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Photo = { id: string; path: string; url: string; tutorial_no: number | null };

const FOLDERS = [1, 2, 3, 4, 5];
const UNSORTED = 0;

export function CoursePhotos({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const touchX = useRef<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [folder, setFolder] = useState<number | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const key = ["course-photos", courseId];

  const { data: photos = [] } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Photo[]> => {
      const { data, error } = await supabase
        .from("course_photos")
        .select("id, path, tutorial_no")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data?.length) return [];
      const { data: signed } = await supabase.storage
        .from("course-photos")
        .createSignedUrls(data.map((p) => p.path), 60 * 60);
      return data.map((p, i) => ({
        ...p,
        tutorial_no: p.tutorial_no ?? null,
        url: signed?.[i]?.signedUrl ?? "",
      }));
    },
    staleTime: 30 * 60 * 1000,
  });

  const inFolder =
    folder == null ? [] : photos.filter((p) => (p.tutorial_no ?? UNSORTED) === folder);
  const open = openIdx != null && openIdx < inFolder.length ? inFolder[openIdx] : null;
  const unsortedCount = photos.filter((p) => p.tutorial_no == null).length;

  function step(delta: number) {
    setOpenIdx((i) => {
      if (i == null || inFolder.length === 0) return i;
      return (i + delta + inFolder.length) % inFolder.length;
    });
  }

  useEffect(() => {
    if (openIdx == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "Escape") setOpenIdx(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIdx, inFolder.length]);

  async function upload(files: FileList | null) {
    if (!files?.length || folder == null) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Please sign in");
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${u.user.id}/${courseId}/${folder}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("course-photos")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { error } = await supabase.from("course_photos").insert({
          course_id: courseId,
          path,
          tutorial_no: folder === UNSORTED ? null : folder,
        });
        if (error) throw error;
      }
      toast.success("Photo saved");
      qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(p: Photo) {
    await supabase.storage.from("course-photos").remove([p.path]);
    await supabase.from("course_photos").delete().eq("id", p.id);
    setOpenIdx(null);
    qc.invalidateQueries({ queryKey: key });
  }

  function folderTile(n: number, label: string) {
    const items = photos.filter((p) => (p.tutorial_no ?? UNSORTED) === n);
    return (
      <button
        key={n}
        onClick={() => setFolder(n)}
        className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-accent/40"
      >
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-2">
          {items[0]?.url ? (
            <img src={items[0].url} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <Folder className="size-4 text-ink-soft" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{label}</span>
          <span className="block text-[11px] text-ink-soft">
            {items.length} {items.length === 1 ? "photo" : "photos"}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="border-t border-line px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
          {folder != null && (
            <button
              onClick={() => setFolder(null)}
              aria-label="Back to folders"
              className="flex size-6 items-center justify-center rounded-full border border-line text-ink-soft hover:border-accent/40"
            >
              <ChevronLeft className="size-3.5" />
            </button>
          )}
          {folder == null
            ? `Tutorial photos · ${photos.length}`
            : `${folder === UNSORTED ? "Unsorted" : `Tutorial ${folder}`} · ${inFolder.length}`}
        </p>
        {folder != null && (
          <Button size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Camera className="mr-1 size-4" />}
            Add photo
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </div>

      {folder == null &&
        (photos.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-4 text-xs text-ink-soft">
            <ImageOff className="size-4" />
            No photos yet — open a tutorial folder to add some.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FOLDERS.map((n) => folderTile(n, `Tut ${n}`))}
            {unsortedCount > 0 && folderTile(UNSORTED, "Unsorted")}
          </div>
        ))}

      {folder != null && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {inFolder.length === 0 && (
            <p className="col-span-full py-2 text-xs text-ink-soft">
              Empty — tap "Add photo" to take or pick photos for this tutorial.
            </p>
          )}
          {inFolder.map((p, i) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-line">
              <button onClick={() => setOpenIdx(i)} className="size-full">
                <img src={p.url} alt="Tutorial photo" loading="lazy" className="size-full object-cover" />
              </button>
              <button
                onClick={() => remove(p)}
                aria-label="Delete photo"
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-ink/70 text-background"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4"
            onClick={() => setOpenIdx(null)}
            onTouchStart={(e) => {
              touchX.current = e.changedTouches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              const endX = e.changedTouches[0]?.clientX;
              if (touchX.current == null || endX == null) return;
              const dx = endX - touchX.current;
              touchX.current = null;
              if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
            }}
          >
            <img
              src={open.url}
              alt="Tutorial photo"
              className="max-h-[85vh] max-w-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            {inFolder.length > 1 && (
              <>
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label="Previous photo"
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  onClick={(e) => {
                    e.stopPropagation();
                    step(-1);
                  }}
                >
                  <ChevronLeft className="size-5" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label="Next photo"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={(e) => {
                    e.stopPropagation();
                    step(1);
                  }}
                >
                  <ChevronRight className="size-5" />
                </Button>
                <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-ink/70 px-3 py-1 text-xs text-background">
                  {(openIdx ?? 0) + 1} / {inFolder.length}
                </p>
              </>
            )}

            <div className="absolute right-4 top-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="destructive" onClick={() => remove(open)}>
                Delete
              </Button>
              <Button size="icon" variant="secondary" onClick={() => setOpenIdx(null)}>
                <X className="size-4" />
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
