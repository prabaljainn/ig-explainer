import React from "react";
import { Sequence, useCurrentFrame, useVideoConfig } from "remotion";

export type Line = { i: number; text: string; start: number; end: number; dur: number };
export type Timeline = { fps: number; total_duration: number; lines: Line[] };

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (p: number) => 1 - Math.pow(1 - clamp01(p), 3);
/** Overshoots past 1, then settles. The house entrance easing (see components/Annotate Pop). */
export const easeOutBack = (p: number) => {
  p = clamp01(p);
  return 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
};
export const easeInOut = (p: number) => {
  p = clamp01(p);
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
};

/** Local time in seconds inside the nearest <Sequence> (or the composition root). */
export const useT = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { t: frame / fps, frame, fps };
};

/** 0..1 progress of local time t through the window [a, b]. */
export const prog = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(0.001, b - a));

const clampIdx = (tl: Timeline, i: number) => Math.min(Math.max(0, i), tl.lines.length - 1);

/**
 * Window from the start of line `from` until the NEXT line after `to` starts (so visuals hold through the gap).
 * Line 0 owns the lead-in silence too: the hook must be on screen from frame 0.
 */
export const span = (tl: Timeline, from: number, to = from) => {
  const a = from <= 0 ? 0 : tl.lines[clampIdx(tl, from)].start;
  const next = tl.lines[clampIdx(tl, to) + 1];
  const b = next ? next.start : tl.total_duration;
  return { from: a, to: b, dur: b - a };
};

/**
 * Mount children only while lines from..to are being narrated.
 * Inside, useT() restarts at 0 at the start of line `from`.
 */
export const Beat: React.FC<{ tl: Timeline; from: number; to?: number; children: React.ReactNode }> = ({
  tl,
  from,
  to,
  children,
}) => {
  const { fps } = useVideoConfig();
  const s = span(tl, from, to);
  return (
    <Sequence from={Math.round(s.from * fps)} durationInFrames={Math.max(1, Math.round(s.dur * fps))} layout="none">
      {children}
    </Sequence>
  );
};

/**
 * Inside a Beat that started at line `from`, progress through the first `seconds` of line `i`.
 * Use it to trigger sub-animations exactly when a later line begins.
 */
export const lineP = (tl: Timeline, from: number, i: number, tLocal: number, seconds = 1.0) => {
  const t0 = tl.lines[clampIdx(tl, from)].start;
  const li = tl.lines[clampIdx(tl, i)];
  return prog(tLocal + t0, li.start, li.start + seconds);
};
