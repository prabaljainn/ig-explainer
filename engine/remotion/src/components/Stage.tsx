import React from "react";
import { AbsoluteFill } from "remotion";
import { C, FONT } from "../style";
import { SafeFrame } from "./SafeFrame";

/** Black canvas with the house typeface (or a script-specific one, e.g. Noto Sans JP). Pass debug to draw the safe-zone guides in Studio. */
export const Stage: React.FC<{ debug?: boolean; font?: string; children: React.ReactNode }> = ({ debug = false, font = FONT, children }) => (
  <AbsoluteFill style={{ backgroundColor: C.bg, color: C.fg, fontFamily: font }}>
    {children}
    {debug ? <SafeFrame /> : null}
  </AbsoluteFill>
);
