import { useEffect, useRef, useState, type RefObject } from "react";

import { FURS, useOutfit, type Outfit } from "@/lib/customize";

export type BuddyMood = "wave" | "ready" | "happy" | "party" | "think";

const GOLD = "#F2B84B";
const CHEEK = "#FFB59A";

const CHEER_LINES = [
  "Yesss! That's one more!",
  "Look at you go! 🎉",
  "Stamped! Keep that rhythm.",
  "Small steps, big streak.",
  "I'm so proud of you!",
];
const TAP_LINES = [
  "Ready when you are!",
  "Tiny step now, big streak later.",
  "You've got this.",
  "Start with the easiest one.",
  "Finish one thing, then breathe.",
  "Psst! You can dress me up. Tap the 🎨 up top.",
];

const INK = "#2B2118";

/** What Buddy wears. Drawn in the same 100x100 space as the face. */
function Accessories({ outfit }: { outfit: Outfit }) {
  return (
    <g>
      {outfit.neck === "scarf" && (
        <g>
          <path d="M24 73 Q50 87 76 73 L78 82 Q50 96 22 82 Z" fill="#2F7D6B" />
          <path d="M28 78 Q50 91 72 78" fill="none" stroke="#9ED0C3" strokeWidth="2" />
        </g>
      )}
      {outfit.neck === "bow-tie" && (
        <g fill="#C2547B">
          <polygon points="50,77 35,69 35,85" />
          <polygon points="50,77 65,69 65,85" />
          <circle cx="50" cy="77" r="3.4" fill="#8E2F55" />
        </g>
      )}

      {outfit.face === "glasses" && (
        <g fill="none" strokeWidth="2.4" strokeLinecap="round" style={{ stroke: INK }}>
          <circle cx="38" cy="50" r="12" fill="#fff" fillOpacity="0.18" />
          <circle cx="62" cy="50" r="12" fill="#fff" fillOpacity="0.18" />
          <path d="M26 48 L19 45" />
          <path d="M74 48 L81 45" />
        </g>
      )}
      {outfit.face === "sunglasses" && (
        <g>
          <ellipse cx="38" cy="51" rx="12.5" ry="9.5" fill={INK} opacity="0.93" />
          <ellipse cx="62" cy="51" rx="12.5" ry="9.5" fill={INK} opacity="0.93" />
          <path d="M49 49 L51 49" stroke={INK} strokeWidth="3" />
          <path d="M25.5 49 L19 46 M74.5 49 L81 46" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M31 47 L36 44 M55 47 L60 44" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
        </g>
      )}

      {outfit.head === "grad-cap" && (
        <g>
          <path d="M38 30 L38 37 Q50 43 62 37 L62 30 Z" fill="#2B2118" />
          <polygon points="16,26 50,11 84,26 50,40" fill="#3A2E24" />
          <path d="M50 26 L78 29 L78 41" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
          <circle cx="78" cy="42" r="2.6" fill={GOLD} />
        </g>
      )}
      {outfit.head === "party-hat" && (
        <g transform="rotate(-10 50 34)">
          <polygon points="36,34 50,-3 64,34" fill={GOLD} />
          <polygon points="41,25 59,25 56,17 44,17" style={{ fill: "var(--rust)" }} />
          <ellipse cx="50" cy="34" rx="16" ry="3.4" fill="#E0A126" />
          <circle cx="50" cy="-4" r="4.2" fill="#fff" stroke="#E0A126" strokeWidth="1" />
        </g>
      )}
      {outfit.head === "crown" && (
        <g>
          <path d="M33 32 L35 12 L43 22 L50 8 L57 22 L65 12 L67 32 Z" fill={GOLD} stroke="#B8861B" strokeWidth="1.5" strokeLinejoin="round" />
          <rect x="33" y="27" width="34" height="5" fill="#E0A126" />
          <circle cx="35" cy="11" r="2.4" fill="#C2547B" />
          <circle cx="50" cy="7" r="2.6" fill="#4A6FA5" />
          <circle cx="65" cy="11" r="2.4" fill="#C2547B" />
        </g>
      )}
      {outfit.head === "headphones" && (
        <g>
          <path d="M20 54 Q20 12 50 12 Q80 12 80 54" fill="none" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
          <rect x="12" y="46" width="12" height="22" rx="6" fill="#3A2E24" />
          <rect x="76" y="46" width="12" height="22" rx="6" fill="#3A2E24" />
          <rect x="15" y="50" width="6" height="14" rx="3" style={{ fill: "var(--rust)" }} />
          <rect x="79" y="50" width="6" height="14" rx="3" style={{ fill: "var(--rust)" }} />
        </g>
      )}
    </g>
  );
}

/** Pupils follow the pointer; when `lookUp` is set they stare up-left instead (thinking). */
export function usePupilFollow(lookUp = false) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pupilsRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    if (lookUp) {
      if (pupilsRef.current) pupilsRef.current.style.transform = "translate(-1.5px, -3px)";
      return;
    }
    const move = (e: PointerEvent) => {
      const svg = svgRef.current;
      const pupils = pupilsRef.current;
      if (!svg || !pupils) return;
      const r = svg.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const k = (Math.min(d, 140) / 140) * 3;
      pupils.style.transform = `translate(${(dx / d) * k}px, ${(dy / d) * k}px)`;
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [lookUp]);

  return { svgRef, pupilsRef };
}

/** The drawing only (no state), so it can be rendered on its own. */
export function BuddyFace({
  mood,
  joy,
  confetti = false,
  svgRef,
  pupilsRef,
  className = "size-20",
  outfit,
}: {
  mood: BuddyMood;
  joy: boolean;
  confetti?: boolean;
  className?: string;
  /** Overrides what Buddy is wearing (used for try-on); otherwise the saved outfit is used. */
  outfit?: Outfit;
  svgRef?: RefObject<SVGSVGElement | null>;
  pupilsRef?: RefObject<SVGGElement | null>;
}) {
  const stored = useOutfit();
  const worn = outfit ?? stored;
  const furColor = FURS.find((f) => f.id === worn.fur)?.color ?? null;
  const bodyFill = furColor ?? "var(--rust)";
  const wingFill = `color-mix(in oklab, ${bodyFill} 78%, black)`;
  const party = mood === "party";
  const bodyClass = confetti ? "buddy-hop" : party ? "buddy-party" : "buddy-bob";
  const confettiColors = ["var(--rust)", GOLD, "#9A8B7A", CHEEK];

  return (
    <svg ref={svgRef} viewBox="0 0 100 100" overflow="visible" className={className} aria-hidden="true">
      <ellipse cx="50" cy="96" rx="24" ry="4" fill="#000" opacity="0.15" />

      <g className={bodyClass}>
        {/* feet */}
        <ellipse cx="38" cy="92" rx="9" ry="4.5" fill={GOLD} />
        <ellipse cx="62" cy="92" rx="9" ry="4.5" fill={GOLD} />

        {/* wings */}
        <g className={party || joy ? "buddy-wing-up-l" : "buddy-wing-l"}>
          <ellipse cx="17" cy="62" rx="8" ry="15" transform="rotate(-14 17 62)" style={{ fill: wingFill }} />
        </g>
        <g className={party || joy ? "buddy-wing-up-r" : mood === "wave" ? "buddy-wave" : "buddy-wing-r"}>
          <ellipse cx="83" cy="62" rx="8" ry="15" transform="rotate(14 83 62)" style={{ fill: wingFill }} />
        </g>

        {/* body, belly, tuft */}
        <ellipse cx="50" cy="58" rx="34" ry="34" style={{ fill: bodyFill }} />
        <ellipse cx="50" cy="68" rx="21" ry="20" fill="#FBF7EF" />
        <path d="M42 27 Q43 14 49 24 Q52 11 57 24 Q60 16 62 28 Z" style={{ fill: bodyFill }} />

        {/* eyes */}
        {joy || party ? (
          <g fill="none" strokeWidth="3.2" strokeLinecap="round" stroke={INK}>
            <path d="M29 52 Q38 40 47 52" />
            <path d="M53 52 Q62 40 71 52" />
          </g>
        ) : (
          <g className="buddy-blink">
            <circle cx="38" cy="50" r="10" fill="#fff" />
            <circle cx="62" cy="50" r="10" fill="#fff" />
            <g ref={pupilsRef} style={{ transition: "transform .12s ease-out" }}>
              <circle cx="38" cy="50" r="5" fill={INK} />
              <circle cx="62" cy="50" r="5" fill={INK} />
              <circle cx="40" cy="48" r="1.6" fill="#fff" />
              <circle cx="64" cy="48" r="1.6" fill="#fff" />
            </g>
          </g>
        )}

        {/* mood details: raised brows when ready, a little smile when happy */}
        {mood === "ready" && !joy && (
          <g strokeWidth="2.6" strokeLinecap="round" stroke={INK}>
            <path d="M31 34 Q38 27 45 34" fill="none" />
            <path d="M55 34 Q62 27 69 34" fill="none" />
          </g>
        )}
        {mood === "happy" && !joy && (
          <path d="M43 72 Q50 79 57 72" fill="none" strokeWidth="2.2" strokeLinecap="round" stroke={INK} />
        )}

        {/* cheeks */}
        <circle cx="27" cy="63" r="5" fill={CHEEK} opacity="0.65" />
        <circle cx="73" cy="63" r="5" fill={CHEEK} opacity="0.65" />

        {/* beak / mouth */}
        {joy || party ? (
          <g>
            <path d="M41 62 Q50 80 59 62 Z" fill={INK} />
            <path d="M45 71 Q50 76 55 71 Q50 68 45 71 Z" fill={CHEEK} />
          </g>
        ) : (
          <polygon points="45,60 55,60 50,68" fill={GOLD} />
        )}

        <Accessories outfit={worn} />
      </g>

      {mood === "think" && !joy && (
        <g fill="#9A8B7A">
          {[34, 50, 66].map((x, i) => (
            <circle key={x} cx={x} cy={8 - (i === 1 ? 4 : 0)} r="3.2" className="buddy-think-dot" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </g>
      )}

      {party && !confetti && (
        <g fill={GOLD} fontSize="11">
          <text x="6" y="26" className="buddy-twinkle">✦</text>
          <text x="86" y="30" className="buddy-twinkle" style={{ animationDelay: "0.5s" }}>✦</text>
          <text x="78" y="8" className="buddy-twinkle" style={{ animationDelay: "1s" }}>✦</text>
        </g>
      )}

      {confetti &&
        Array.from({ length: 10 }).map((_, i) => (
          <rect
            key={i}
            x={14 + i * 8}
            y={4 + (i % 3) * 6}
            width="4"
            height="7"
            rx="1"
            className="buddy-confetti"
            style={{ fill: confettiColors[i % confettiColors.length], animationDelay: `${i * 50}ms` }}
          />
        ))}
    </svg>
  );
}

export function Buddy({ mood, completed, total }: { mood: BuddyMood; completed: number; total: number }) {
  const [hop, setHop] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const { svgRef, pupilsRef } = usePupilFollow();
  const prevCompleted = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const lastLine = useRef("");

  const celebrate = (lines: string[]) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const options = lines.filter((l) => l !== lastLine.current);
    const line = options[Math.floor(Math.random() * options.length)] ?? lines[0] ?? "";
    lastLine.current = line;
    setHop(true);
    setBubble(line);
    timers.current.push(window.setTimeout(() => setHop(false), 1000));
    timers.current.push(window.setTimeout(() => setBubble(null), 3200));
  };

  // React when a habit gets ticked (but not when the data first loads).
  useEffect(() => {
    if (total === 0) return;
    if (prevCompleted.current !== null && completed > prevCompleted.current) {
      celebrate(completed === total ? ["All done! Go claim a reward ✦", "Perfect day! 🎉"] : CHEER_LINES);
    }
    prevCompleted.current = completed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, total]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <div className="relative">
      {bubble && (
        <div
          role="status"
          className="absolute right-[88px] top-1 w-44 rounded-2xl bg-card px-3 py-2 text-xs font-medium text-ink shadow-sm ring-1 ring-black/10 animate-rise"
        >
          {bubble}
          <span className="absolute -right-1 top-4 size-2.5 rotate-45 bg-card ring-1 ring-black/10 [clip-path:polygon(100%_0,100%_100%,0_0)]" />
        </div>
      )}
      <button
        type="button"
        onClick={() => celebrate(TAP_LINES)}
        aria-label="Buddy: tap for a pep talk"
        className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-rust"
      >
        <BuddyFace mood={mood} joy={hop} confetti={hop} svgRef={svgRef} pupilsRef={pupilsRef} />
      </button>
    </div>
  );
}
