import { useEffect, useRef, useState, type RefObject } from "react";

export type BuddyMood = "wave" | "ready" | "happy" | "party" | "think";

const GOLD = "#F2B84B";
const DARK_RUST = "#B8431F";
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
];

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
}: {
  mood: BuddyMood;
  joy: boolean;
  confetti?: boolean;
  className?: string;
  svgRef?: RefObject<SVGSVGElement | null>;
  pupilsRef?: RefObject<SVGGElement | null>;
}) {
  const party = mood === "party";
  const bodyClass = confetti ? "buddy-hop" : party ? "buddy-party" : "buddy-bob";
  const confettiColors = ["var(--rust)", GOLD, "var(--ink-soft)", CHEEK];

  return (
    <svg ref={svgRef} viewBox="0 0 100 100" overflow="visible" className={className} aria-hidden="true">
      <ellipse cx="50" cy="96" rx="24" ry="4" style={{ fill: "var(--ink)" }} opacity="0.12" />

      <g className={bodyClass}>
        {/* feet */}
        <ellipse cx="38" cy="92" rx="9" ry="4.5" fill={GOLD} />
        <ellipse cx="62" cy="92" rx="9" ry="4.5" fill={GOLD} />

        {/* wings */}
        <g className={party || joy ? "buddy-wing-up-l" : "buddy-wing-l"}>
          <ellipse cx="17" cy="62" rx="8" ry="15" transform="rotate(-14 17 62)" fill={DARK_RUST} />
        </g>
        <g className={party || joy ? "buddy-wing-up-r" : mood === "wave" ? "buddy-wave" : "buddy-wing-r"}>
          <ellipse cx="83" cy="62" rx="8" ry="15" transform="rotate(14 83 62)" fill={DARK_RUST} />
        </g>

        {/* body, belly, tuft */}
        <ellipse cx="50" cy="58" rx="34" ry="34" style={{ fill: "var(--rust)" }} />
        <ellipse cx="50" cy="68" rx="21" ry="20" style={{ fill: "var(--cream)" }} />
        <path d="M42 27 Q43 14 49 24 Q52 11 57 24 Q60 16 62 28 Z" style={{ fill: "var(--rust)" }} />

        {/* eyes */}
        {joy || party ? (
          <g fill="none" strokeWidth="3.2" strokeLinecap="round" style={{ stroke: "var(--ink)" }}>
            <path d="M29 52 Q38 40 47 52" />
            <path d="M53 52 Q62 40 71 52" />
          </g>
        ) : (
          <g className="buddy-blink">
            <circle cx="38" cy="50" r="10" fill="#fff" />
            <circle cx="62" cy="50" r="10" fill="#fff" />
            <g ref={pupilsRef} style={{ transition: "transform .12s ease-out" }}>
              <circle cx="38" cy="50" r="5" style={{ fill: "var(--ink)" }} />
              <circle cx="62" cy="50" r="5" style={{ fill: "var(--ink)" }} />
              <circle cx="40" cy="48" r="1.6" fill="#fff" />
              <circle cx="64" cy="48" r="1.6" fill="#fff" />
            </g>
          </g>
        )}

        {/* mood details: raised brows when ready, a little smile when happy */}
        {mood === "ready" && !joy && (
          <g strokeWidth="2.6" strokeLinecap="round" style={{ stroke: "var(--ink)" }}>
            <path d="M31 34 Q38 27 45 34" fill="none" />
            <path d="M55 34 Q62 27 69 34" fill="none" />
          </g>
        )}
        {mood === "happy" && !joy && (
          <path d="M43 72 Q50 79 57 72" fill="none" strokeWidth="2.2" strokeLinecap="round" style={{ stroke: "var(--ink)" }} />
        )}

        {/* cheeks */}
        <circle cx="27" cy="63" r="5" fill={CHEEK} opacity="0.65" />
        <circle cx="73" cy="63" r="5" fill={CHEEK} opacity="0.65" />

        {/* beak / mouth */}
        {joy || party ? (
          <g>
            <path d="M41 62 Q50 80 59 62 Z" style={{ fill: "var(--ink)" }} />
            <path d="M45 71 Q50 76 55 71 Q50 68 45 71 Z" fill={CHEEK} />
          </g>
        ) : (
          <polygon points="45,60 55,60 50,68" fill={GOLD} />
        )}
      </g>

      {mood === "think" && !joy && (
        <g style={{ fill: "var(--ink-soft)" }}>
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
