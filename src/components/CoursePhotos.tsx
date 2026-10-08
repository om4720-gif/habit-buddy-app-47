import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Photo = { id: string; path: string; url: string };

export function CoursePhotos({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const touchX = useRef<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const key = ["course-photos", courseId];

  const { data: photos = [] } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Photo[]> => {
      const { data, error } = await supabase
        .from("course_photos")
        .select("id, path")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data?.length) return [];
      const { data: signed } = await supabase.storage
        .from("course-photos")
        .createSignedUrls(data.map((p) => p.path), 60 * 60);
      return data.map((p, i) => ({ ...p, url: signed?.[i]?.signedUrl ?? "" }));
    },
    staleTime: 30 * 60 * 1000,
  });

  const open = openIdx != null && openIdx < photos.length ? photos[openIdx] : null;

  function step(delta: number) {
    setOpenIdx((i) => {
      if (i == null || photos.length === 0) return i;
      return (i + delta + photos.length) % photos.length;
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
  }, [openIdx, photos.length]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Please sign in");
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${u.user.id}/${courseId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("course-photos")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { error } = await supabase
          .from("course_photos")
          .insert({ course_id: courseId, path });
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

  return (
    <div className="border-t border-line px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
          Tutorial photos · {photos.length}
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Camera className="mr-1 size-4" />}
          Add photo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {photos.map((p, i) => (
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
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4"
          onClick={() => setOpenIdx(null)}
          onTouchStart={(e) => {
            touchX.current = e.changedTouches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
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

          {photos.length > 1 && (
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
                {(openIdx ?? 0) + 1} / {photos.length}
              </p>
            </>
          )}

          <div className="absolute right-4 top-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="destructive" onClick={() => remove(open)}>Delete</Button>
            <Button size="icon" variant="secondary" onClick={() => setOpenIdx(null)}><X className="size-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
