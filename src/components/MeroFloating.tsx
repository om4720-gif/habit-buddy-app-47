import { format } from "date-fns";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { MeroBriefing } from "@/components/MeroBriefing";

export function MeroFloating() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(0);

  // Mero drifts between spots along the screen edge every few seconds
  useEffect(() => {
    if (open) return;
    const t = window.setInterval(() => setPos((p) => (p + 1) % 3), 7000);
    return () => window.clearInterval(t);
  }, [open]);

  const spots = ["bottom-6 right-6", "bottom-[40%] right-4", "bottom-24 right-10"];

  return (
    <>
      {open && (
        <div className="fixed inset-x-3 bottom-24 z-50 max-h-[75vh] overflow-y-auto sm:inset-x-auto sm:right-6 sm:w-[420px] animate-rise">
          <div className="relative">
            <button
              aria-label="Close Mero"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-full p-1 text-ink-soft hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="[&>section]:mt-0 [&>section]:shadow-xl">
              <MeroBriefing date={format(new Date(), "yyyy-MM-dd")} />
            </div>
          </div>
        </div>
      )}
      <button
        aria-label="Open Mero"
        onClick={() => setOpen((o) => !o)}
        className={`fixed z-50 transition-all duration-[2000ms] ease-in-out ${open ? "bottom-6 right-6" : spots[pos]}`}
      >
        <span className="relative block animate-mero-float">
          <span className="absolute inset-x-2 -bottom-3 h-2 rounded-full bg-ink/15 blur-sm" />
          <span className="grid h-14 w-14 place-items-center rounded-full bg-primary font-display text-2xl font-semibold text-primary-foreground shadow-lg ring-4 ring-primary/20">
            M
          </span>
          {!open && (
            <span className="absolute -top-8 right-0 whitespace-nowrap rounded-full bg-card px-2.5 py-1 text-xs font-medium shadow border border-border">
              Hi, I'm Mero 👋
            </span>
          )}
        </span>
      </button>
    </>
  );
}
