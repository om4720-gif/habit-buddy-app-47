import { format } from "date-fns";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import meroFace from "@/assets/mero.jpg";
import { MeroBriefing } from "@/components/MeroBriefing";
import { MeroChat } from "@/components/MeroChat";

const WAKE = /(hello|hi|hey|hallo|helo)\s*,?\s*(mero|miro|meero|merro|nero)|(هلو|هالو|هاي|مرحبا|اهلا|أهلا)\s*(ميرو|مِيرو|ميرو)/i;

type Rec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function MeroFloating() {
  const [awake, setAwake] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(0);
  const recRef = useRef<Rec | null>(null);
  const listenRef = useRef(true);

  // Listen in the background for "hello Mero" while Mero is hidden
  useEffect(() => {
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (WAKE.test(e.results[i]?.[0]?.transcript ?? "")) {
          setAwake(true);
          setOpen(true);
        }
      }
    };
    let running = false;
    const begin = () => {
      if (running || !listenRef.current) return;
      try { rec.start(); running = true; } catch { /* already running */ }
    };
    rec.onend = () => { running = false; window.setTimeout(begin, 400); };
    rec.onerror = () => { running = false; };
    recRef.current = rec;
    begin();
    // Some browsers only allow listening after a tap
    window.addEventListener("pointerdown", begin);
    return () => {
      listenRef.current = false;
      window.removeEventListener("pointerdown", begin);
      rec.onend = null;
      try { rec.stop(); } catch { /* noop */ }
    };
  }, []);

  // Pause wake listening while Mero is awake (so the mic is free for talking)
  useEffect(() => {
    const rec = recRef.current;
    if (!rec) return;
    listenRef.current = !awake;
    if (awake) { try { rec.stop(); } catch { /* noop */ } }
    else { try { rec.start(); } catch { /* noop */ } }
  }, [awake]);

  useEffect(() => {
    if (open || !awake) return;
    const t = window.setInterval(() => setPos((p) => (p + 1) % 3), 7000);
    return () => window.clearInterval(t);
  }, [open, awake]);

  if (!awake) return null;

  const spots = ["bottom-6 right-6", "bottom-[40%] right-4", "bottom-24 right-10"];
  const sleep = () => { setOpen(false); setAwake(false); window.speechSynthesis?.cancel(); };

  return (
    <>
      {open && (
        <div className="fixed inset-x-3 bottom-24 z-50 max-h-[75vh] overflow-y-auto sm:inset-x-auto sm:right-6 sm:w-[420px] animate-rise">
          <div className="relative">
            <button
              aria-label="Close Mero"
              onClick={sleep}
              className="absolute right-3 top-3 z-10 rounded-full p-1 text-ink-soft hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="rounded-3xl border border-border bg-card p-6 shadow-xl [&>section]:mt-0 [&>section]:border-0 [&>section]:p-0 [&>section]:shadow-none">
              <MeroBriefing date={format(new Date(), "yyyy-MM-dd")} />
              <MeroChat />
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
          <img
            src={meroFace}
            alt="Mero"
            className="h-16 w-16 rounded-full object-cover shadow-lg ring-4 ring-primary/40"
          />
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
