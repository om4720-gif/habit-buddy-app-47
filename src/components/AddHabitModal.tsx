import { useState } from "react";
import { toast } from "sonner";

interface AddHabitModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onCreate: (values: { name: string; description: string; category: string }) => void;
  defaultCategory?: string;
}

export function AddHabitModal({
  open,
  onOpenChange,
  onClose,
  onCreate,
  defaultCategory = "general",
}: AddHabitModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate({ name: name.trim(), description: description.trim(), category });
      setName("");
      setDescription("");
      setCategory(defaultCategory);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create habit.");
    } finally {
      setSaving(false);
    }
  };

  const isOpen = open ?? true;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-cream p-6 ring-1 ring-black/5">
        <h2 className="font-display text-xl font-semibold text-ink">Add a habit</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              placeholder="e.g. Read for 30 minutes"
              className="mt-1.5 block w-full rounded-xl border-0 bg-paper px-3 py-2.5 text-sm text-ink ring-1 ring-line placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-rust"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
              Note (optional)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Any book, no distractions"
              className="mt-1.5 block w-full rounded-xl border-0 bg-paper px-3 py-2.5 text-sm text-ink ring-1 ring-line placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-rust"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border-0 bg-paper px-3 py-2.5 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-rust"
            >
              <option value="general">General</option>
              <option value="german">German learning</option>
              <option value="uni">University</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-full bg-paper px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-sand"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-full bg-rust px-4 py-2.5 text-sm font-semibold text-cream ring-1 ring-rust/40 transition hover:bg-rust/90 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save habit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
