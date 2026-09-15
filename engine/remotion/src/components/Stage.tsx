import React from "react";
import { AbsoluteFill } from "remotion";
import { C, FONT } from "../style";
import { SafeFrame } from "./SafeFrame";
import { Starfield } from "./Starfield";

/**
 * Black canvas, starfield, house typeface (or a script-specific one, e.g. Noto Sans JP).
 * `stars` takes a 0..1 brightness as well as a boolean: the takeaway ghosts the diagram to near-black, which was
 * tuned against an empty ground, so a takeaway whose ghost loses to the dust passes `stars={0.4}`. Pass debug to
 * draw the safe-zone guides in Studio.
 */
export const Stage: React.FC<{ debug?: boolean; stars?: boolean | number; font?: string; children: React.ReactNode }> = ({
  debug = false,
  stars = true,
  font = FONT,
  children,
}) => (
  <AbsoluteFill style={{ backgroundColor: C.bg, color: C.fg, fontFamily: font }}>
    {stars ? <Starfield o={typeof stars === "number" ? stars : 1} /> : null}
    {children}
    {debug ? <SafeFrame /> : null}
  </AbsoluteFill>
);
