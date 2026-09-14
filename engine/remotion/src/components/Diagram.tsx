import React from "react";
import { C, F, STROKE } from "../style";
import { clamp01 } from "../lib/timeline";

/**
 * Diagram primitives every video can build from (lifted from the Kubernetes video, unchanged API). Each takes
 * `p` 0..1, the progress of its own drawing, so the caller decides when it draws: a fraction of the narration
 * line, never a second (see lib/timeline). One stroke weight (STROKE); hierarchy by colour, white for the
 * subject of the current line, dim from the next line on. Pair with components/Icon for a glyph inside a Box.
 */
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
/** Colour between two hex colours, p 0..1. mix(C.fg, C.dim, 1) is the dim grey. */
export const mix = (a: string, b: string, p: number) =>
  `rgb(${hex(a).map((v, i) => Math.round(lerp(v, hex(b)[i], p))).join(",")})`;

type BoxProps = { x: number; y: number; w: number; h: number; p: number; fill?: number; r?: number; width?: number; color?: string };
/** Rounded rect whose outline draws itself as p goes 0..1. `fill` 0..1 grows a solid inner rect out of the centre. */
export const Box: React.FC<BoxProps> = ({ x, y, w, h, p, fill = 0, r = 14, width = STROKE, color = C.fg }) => (
  <>
    {p > 0 ? (
      <rect x={x} y={y} width={w} height={h} rx={r} pathLength={1} fill="none" stroke={color} strokeWidth={width}
        strokeLinejoin="round" strokeDasharray={1} strokeDashoffset={1 - p} />
    ) : null}
    {fill > 0 ? <rect x={x + (w * (1 - fill)) / 2} y={y + (h * (1 - fill)) / 2} width={w * fill} height={h * fill} rx={r * fill} fill={color} /> : null}
  </>
);

type LineProps = { x1: number; y1: number; x2: number; y2: number; p: number; width?: number; color?: string };
/** Straight line that draws from (x1,y1) to (x2,y2) as p goes 0..1. Returns null at 0 (a zero-length round cap renders as a dot). */
export const Line: React.FC<LineProps> = ({ x1, y1, x2, y2, p, width = STROKE, color = C.fg }) =>
  p > 0 ? (
    <line x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - p} />
  ) : null;

/** Line with a head that pops once the shaft has arrived. Axis-aligned only (+x, -x, +y or -y). */
export const Arrow: React.FC<LineProps> = (a) => {
  const dx = Math.sign(a.x2 - a.x1), dy = Math.sign(a.y2 - a.y1), k = 14 * clamp01((a.p - 0.85) / 0.15);
  const head = `${a.x2 - dx * k - dy * k},${a.y2 - dy * k - dx * k} ${a.x2},${a.y2} ${a.x2 - dx * k + dy * k},${a.y2 - dy * k + dx * k}`;
  return (
    <>
      <Line {...a} />
      {k > 0 ? <polyline points={head} fill="none" stroke={a.color ?? C.fg} strokeWidth={a.width ?? STROKE} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </>
  );
};

/** Label text positioned by its vertical centre (outside the svg). `dim` 0..1 mixes white towards the dim grey, `o` is opacity. */
export const Txt: React.FC<{ x: number; y: number; o?: number; align?: "left" | "center" | "right"; dim?: number; children: React.ReactNode }> = ({
  x, y, o = 1, align = "left", dim = 0, children,
}) => (
  <div
    style={{
      position: "absolute", left: x, top: y, opacity: o, whiteSpace: "nowrap",
      transform: `translate(${align === "center" ? "-50%" : align === "right" ? "-100%" : "0"}, -50%)`,
      fontSize: F.label, fontWeight: 500, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: mix(C.fg, C.dim, dim),
    }}
  >
    {children}
  </div>
);
