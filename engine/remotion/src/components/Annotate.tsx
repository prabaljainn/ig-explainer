import React from "react";
import { C, F, glow, STROKE } from "../style";
import { clamp01, easeOutBack } from "../lib/timeline";

/**
 * Annotation layer: the marks that point at the diagram rather than being part of it. Three primitives, one job
 * each, all driven by a progress `p` 0..1 so the caller decides when they happen (a fraction of a line, never a
 * second). They sit on top of the diagram and are the only place `mark` and `badge` colours are allowed.
 *
 * Two contexts, and mixing them renders nothing:
 *   inside <svg>: MarkArrow, Packet
 *   plain HTML:   Pop, Glow, Badge   (Badge positions itself absolutely; Pop and Glow wrap what you give them)
 */

/** Scale-and-settle entry with a small overshoot. The house entrance: things arrive, they do not fade in. */
export const Pop: React.FC<{ p: number; from?: number; children: React.ReactNode }> = ({ p, from = 0.55, children }) => {
  const k = easeOutBack(clamp01(p));
  return p <= 0 ? null : (
    <div style={{ transform: `scale(${from + (1 - from) * k})`, transformOrigin: "center", opacity: Math.min(1, p * 3) }}>
      {children}
    </div>
  );
};

/** Bloom around the hero object. `k` 0..1 so it can light up as the line that names it starts. */
export const Glow: React.FC<{ k?: number; color?: string; children: React.ReactNode }> = ({ k = 1, color = C.hero, children }) => (
  <div style={{ filter: glow(color, k) }}>{children}</div>
);

type MarkArrowProps = {
  x1: number; y1: number; x2: number; y2: number; p: number;
  /** Sideways bow as a fraction of the arrow's length; negative bows the other way. */
  bend?: number;
  color?: string; width?: number;
};

/**
 * Hand-drawn pointing arrow: a bowed stroke that draws itself, then a fat head that pops once it lands.
 * Any direction (unlike Diagram's axis-aligned Arrow, which belongs to the diagram, not to the annotation).
 */
export const MarkArrow: React.FC<MarkArrowProps> = ({ x1, y1, x2, y2, p, bend = 0.3, color = C.mark, width = STROKE * 1.6 }) => {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const cx = (x1 + x2) / 2 - (dy / len) * len * bend;
  const cy = (y1 + y2) / 2 + (dx / len) * len * bend;
  const tail = clamp01(p / 0.8);
  const head = clamp01((p - 0.75) / 0.25);
  // the tangent at the end of the quadratic is the control point -> end point direction
  const a = Math.atan2(y2 - cy, x2 - cx);
  const k = width * 3.2 * head;
  const wing = (s: number) => `${x2 - k * Math.cos(a + s)},${y2 - k * Math.sin(a + s)}`;
  return tail <= 0 ? null : (
    <>
      <path d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} pathLength={1} fill="none" stroke={color} strokeWidth={width}
        strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - tail} />
      {head > 0 ? (
        <polyline points={`${wing(-0.55)} ${x2},${y2} ${wing(0.55)}`} fill="none" stroke={color} strokeWidth={width}
          strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
    </>
  );
};

/**
 * Numbered chip plus its label, the way the reference names each item in a list: `[2] shared process`.
 * Only for content that is literally a sequence — drop `n` for a plain tick.
 */
export const Badge: React.FC<{
  x: number; y: number; p?: number; n?: number; align?: "left" | "center"; color?: string; children: React.ReactNode;
}> = ({ x, y, p = 1, n, align = "left", color = C.badge, children }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: `translate(${align === "center" ? "-50%" : "0"}, -50%)` }}>
    <Pop p={p}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, whiteSpace: "nowrap" }}>
        <div style={{
          background: color, color: C.bg, borderRadius: 12, width: F.label * 1.3, height: F.label * 1.3,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: F.label, fontWeight: 600, lineHeight: 1, fontVariantNumeric: "tabular-nums",
        }}>
          {n ?? "✓"}
        </div>
        <div style={{ fontSize: F.label, fontWeight: 500, color: C.fg }}>{children}</div>
      </div>
    </Pop>
  </div>
);

/**
 * A dot travelling along a straight connector, `p` 0..1 from one end to the other. The reference uses this for
 * requests going client -> database; it is the cheapest way to show that a line carries something.
 */
export const Packet: React.FC<{ x1: number; y1: number; x2: number; y2: number; p: number; r?: number; color?: string }> = ({
  x1, y1, x2, y2, p, r = 10, color = C.hero,
}) => {
  const k = clamp01(p);
  return k <= 0 || k >= 1 ? null : <circle cx={x1 + (x2 - x1) * k} cy={y1 + (y2 - y1) * k} r={r} fill={color} />;
};
