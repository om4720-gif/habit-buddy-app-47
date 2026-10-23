import { useServerFn } from "@tanstack/react-start";
import { Camera, ClipboardPaste, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toJpegBase64 } from "@/lib/imageUpload";
import { checkWeights, parseWeightsText, type WeightRow } from "@/lib/weights";
import { scanWeights } from "@/lib/weights.functions";

type Existing = { weight: number; is_final: boolean; title: string }[];

/** Adds assessments and their weights from pasted text or a photo. Every row is reviewed before it's saved. */
export function WeightsImport({
  open,
  onOpenChange,
  courseName,
  existing,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseName: string;
  existing: Existing;
  /** Returns an error message to show, or null when saved. */
  onImport: (rows: WeightRow[], creditHours: number | null) => string | null;
}) {
  const scan = useServerFn(scanWeights);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<(WeightRow & { key: number; include: boolean })[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [creditHours, setCreditHours] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const keyRef = useRef(0);

  const reset = () => {
    setText("");
    setRows(null);
    setSkipped([]);
    setCreditHours(null);
  };
  const close = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };
  const toRows = (list: WeightRow[]) => {
    const seen = new Set(existing.map((e) => e.title.trim().toLowerCase()));
    const unique = list.filter((r) => !seen.has(r.title.trim().toLowerCase()));
    setRows(unique.map((r) => ({ ...r, key: keyRef.current++, include: true })));
    const dupes = list.length - unique.length;
    if (dupes > 0) toast.message(`${dupes} already in this course, so skipped.`);
  };

  function readText() {
    const { rows: found, skipped: bad, creditHours: credits } = parseWeightsText(text);
    setSkipped(bad.slice(0, 8));
    setCreditHours(credits);
    if (found.length === 0) {
      toast.error("I couldn't find any weights. Write one per line, like “Midterm 30%”.");
      return;
    }
    toRows(found);
  }

  async function readPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const img = await toJpegBase64(file);
      const res = await scan({ data: { imageBase64: img.base64, mime: img.mime } });
      setSkipped([]);
      if (res.items.length === 0) {
        toast.error("I couldn't find any weights in that photo. Try a sharper one, or paste the text.");
        return;
      }
      toRows(res.items.map((i) => ({ title: i.title, weight: i.weight, isFinal: i.isFinal })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that photo");
    } finally {
      setBusy(false);
    }
  }

  const included = (rows ?? []).filter((r) => r.include);
  const total = included.reduce((s, r) => s + r.weight, 0) + existing.reduce((s, e) => s + e.weight, 0);
  const problem = included.length ? checkWeights(included, existing) : null;

  function save() {
    if (!rows) return;
    const list = included.map(({ title, weight, isFinal, bestCount, expectedCount }) => ({
      title: title.trim(),
      weight,
      isFinal,
      bestCount: bestCount ?? null,
      expectedCount: expectedCount ?? null,
    }));
    if (list.some((r) => !r.title)) {
      toast.error("Every included assessment needs a name.");
      return;
    }
    const error = onImport(list, creditHours);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`${list.length} assessment${list.length === 1 ? "" : "s"} added to ${courseName}`);
    close(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Import weights · {courseName}</DialogTitle>
        </DialogHeader>

        {rows === null ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="weights-text" className="text-sm text-ink-soft">
                Paste the grading scheme, one per line
              </label>
              <textarea
                id="weights-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder={"Quizzes 20%\nAssignments 10%\nMidterm 20%\nFinal exam 50%"}
                className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2 text-sm text-ink outline-none"
              />
              <Button className="mt-2 w-full rounded-full" onClick={readText} disabled={!text.trim()}>
                <ClipboardPaste className="size-4" /> Read the weights
              </Button>
            </div>
            <div className="relative text-center text-xs text-ink-soft before:absolute before:left-0 before:top-1/2 before:h-px before:w-[42%] before:bg-line after:absolute after:right-0 after:top-1/2 after:h-px after:w-[42%] after:bg-line">
              or
            </div>
            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-sand ${busy ? "pointer-events-none opacity-60" : ""}`}
            >
              <Camera className="size-4" /> {busy ? "Reading your photo…" : "Take or choose a photo of the scheme"}
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
            <p className="text-center text-[11px] text-ink-soft">You'll check every line before anything is saved.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">
              Check each line, then add the ones you want.
              {creditHours !== null && <span> Credit hours: {creditHours}.</span>}
            </p>
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.key} className={`flex items-center gap-2 rounded-2xl border border-line p-2 ${r.include ? "bg-card" : "opacity-60"}`}>
                  <input
                    type="checkbox"
                    checked={r.include}
                    aria-label="Include"
                    onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, include: e.target.checked } : x)))}
                    className="size-4 accent-[var(--rust)]"
                  />
                  {r.bestCount ? (
                    <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                      best {r.bestCount} of {r.expectedCount}
                    </span>
                  ) : null}
                  <Input
                    value={r.title}
                    maxLength={200}
                    aria-label="Name"
                    className="min-w-0 flex-1"
                    onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, title: e.target.value } : x)))}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={r.weight}
                    aria-label="Weight percent"
                    className="w-20"
                    onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, weight: Number(e.target.value) } : x)))}
                  />
                  <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink-soft" title="This is the final exam">
                    <input
                      type="checkbox"
                      checked={r.isFinal}
                      onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, isFinal: e.target.checked } : x)))}
                      className="size-3.5 accent-[var(--rust)]"
                    />
                    Final
                  </label>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
                    className="grid size-7 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-sand hover:text-ink"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => setRows([...rows, { title: "", weight: 0, isFinal: false, key: keyRef.current++, include: true }])}
            >
              <Plus className="size-4" /> Add a line
            </Button>

            <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
              <span className="text-ink">Total with this course</span>
              <span className={total > 100.0001 ? "font-semibold text-destructive" : "font-semibold text-ink"}>
                {Math.round(total * 10) / 10}%
              </span>
            </div>
            {problem && <p className="text-xs text-destructive">{problem}</p>}
            {skipped.length > 0 && (
              <p className="text-xs text-ink-soft">
                Skipped lines with no weight: {skipped.map((l) => `“${l.slice(0, 40)}”`).join(", ")}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" className="rounded-full" onClick={() => setRows(null)}>
                Back
              </Button>
              <Button className="flex-1 rounded-full" onClick={save} disabled={included.length === 0 || !!problem}>
                Add {included.length} assessment{included.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
