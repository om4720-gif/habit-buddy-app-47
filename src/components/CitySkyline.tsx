// A little skyline that grows as you finish things:
//   habits -> homes (every 3), lectures -> halls (every 2), assignments -> towers,
//   finishing early -> stars in the sky.

export type CityCounts = { habits: number; lectures: number; assignments: number; early: number };

export const cityShape = (c: CityCounts) => ({
  houses: Math.min(10, Math.floor(c.habits / 3)),
  halls: Math.min(7, Math.floor(c.lectures / 2)),
  towers: Math.min(7, c.assignments),
  stars: Math.min(8, c.early),
});

const GROUND = 130;

export function CitySkyline(props: CityCounts) {
  const { houses, halls, towers, stars } = cityShape(props);
  const pools = { h: houses, l: halls, t: towers };
  const kinds: ("h" | "l" | "t")[] = [];
  while (pools.h + pools.l + pools.t > 0) {
    for (const k of ["h", "l", "t"] as const) {
      if (pools[k] > 0) {
        kinds.push(k);
        pools[k]--;
      }
    }
  }
  const empty = kinds.length === 0;

  return (
    <svg
      viewBox="0 0 600 150"
      className="block h-auto w-full"
      role="img"
      aria-label={`Your city: ${houses} homes, ${halls} halls, ${towers} towers, ${stars} stars`}
    >
      <circle cx="560" cy="30" r="14" style={{ fill: "var(--rust)" }} opacity="0.25" />
      {Array.from({ length: stars }).map((_, i) => (
        <text
          key={i}
          x={30 + ((i * 71) % 480)}
          y={20 + (i % 3) * 16}
          fontSize="13"
          style={{ fill: "var(--rust)" }}
        >
          ★
        </text>
      ))}

      {empty && (
        <g>
          <polygon points="285,130 300,98 315,130" style={{ fill: "var(--rust)" }} />
          <polygon points="300,98 306,130 294,130" style={{ fill: "var(--ink)" }} opacity="0.35" />
          <text x="300" y="148" textAnchor="middle" fontSize="11" style={{ fill: "var(--ink-soft)" }}>
            An empty campsite — finish something to lay your first brick
          </text>
        </g>
      )}

      {kinds.map((k, i) => {
        const x = 14 + i * 24;
        if (k === "h")
          return (
            <g key={i}>
              <rect x={x} y={GROUND - 16} width="18" height="16" style={{ fill: "var(--sand)", stroke: "var(--ink-soft)" }} strokeWidth="0.8" />
              <polygon points={`${x - 2},${GROUND - 16} ${x + 9},${GROUND - 27} ${x + 20},${GROUND - 16}`} style={{ fill: "var(--rust)" }} />
              <rect x={x + 7} y={GROUND - 9} width="4" height="9" style={{ fill: "var(--ink-soft)" }} />
            </g>
          );
        if (k === "l")
          return (
            <g key={i}>
              <polygon points={`${x - 1},${GROUND - 28} ${x + 9},${GROUND - 38} ${x + 19},${GROUND - 28}`} style={{ fill: "var(--rust)" }} />
              <rect x={x} y={GROUND - 28} width="18" height="28" style={{ fill: "var(--ink-soft)" }} />
              {[2, 8, 14].map((dx) => (
                <rect key={dx} x={x + dx} y={GROUND - 22} width="2.5" height="22" style={{ fill: "var(--cream)" }} opacity="0.85" />
              ))}
            </g>
          );
        const h = 38 + ((i * 7) % 4) * 8;
        return (
          <g key={i}>
            <line x1={x + 8} y1={GROUND - h} x2={x + 8} y2={GROUND - h - 9} style={{ stroke: "var(--ink)" }} strokeWidth="1.2" />
            <rect x={x + 1} y={GROUND - h} width="14" height={h} style={{ fill: "var(--ink)" }} />
            {Array.from({ length: Math.floor((h - 6) / 9) }).map((_, w) => (
              <g key={w}>
                <rect x={x + 4} y={GROUND - h + 5 + w * 9} width="3" height="4" style={{ fill: "var(--rust)" }} opacity={(i + w) % 3 === 0 ? 0.35 : 1} />
                <rect x={x + 9} y={GROUND - h + 5 + w * 9} width="3" height="4" style={{ fill: "var(--rust)" }} opacity={(i + w) % 2 === 0 ? 1 : 0.35} />
              </g>
            ))}
          </g>
        );
      })}

      <line x1="0" y1={GROUND} x2="600" y2={GROUND} style={{ stroke: "var(--line)" }} strokeWidth="2" />
    </svg>
  );
}
