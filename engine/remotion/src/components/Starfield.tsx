import React from "react";
import { HEIGHT, STARS, WIDTH } from "../style";

/**
 * The house background: true black with a fixed field of small white stars. Seeded, so the layout is identical
 * on every render and a re-render never shifts a star under a label. Static on purpose — a drifting field
 * competes with the diagram for the eye, which is the one thing the diagram must never lose.
 */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const Starfield: React.FC<{ count?: number; seed?: number; o?: number }> = ({
  count = STARS.count,
  seed = STARS.seed,
  o = 1,
}) => {
  const stars = React.useMemo(() => {
    const rnd = mulberry32(seed);
    return Array.from({ length: count }, () => {
      // squared brightness: mostly faint dust, a few bright ones, like the reference
      const b = rnd() ** 2;
      return {
        cx: Math.round(rnd() * WIDTH),
        cy: Math.round(rnd() * HEIGHT),
        r: +(STARS.minR + b * (STARS.maxR - STARS.minR)).toFixed(2),
        o: +(STARS.minO + b * (STARS.maxO - STARS.minO)).toFixed(2),
      };
    });
  }, [count, seed]);

  return (
    <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", left: 0, top: 0, opacity: o }}>
      {stars.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#FFFFFF" opacity={s.o} />
      ))}
    </svg>
  );
};
