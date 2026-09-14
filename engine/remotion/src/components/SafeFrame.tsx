import React from "react";
import { AbsoluteFill } from "remotion";
import { HEIGHT, SAFE, STYLE, WIDTH } from "../style";

/** Studio-only overlay: the band Instagram's UI covers, and the caption baseline. Never rendered in final output. */
export const SafeFrame: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: SAFE.top, background: "rgba(255,80,80,0.12)" }} />
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: SAFE.bottom, background: "rgba(255,80,80,0.12)" }} />
    <div
      style={{
        position: "absolute",
        left: SAFE.side,
        top: SAFE.top,
        width: WIDTH - 2 * SAFE.side,
        height: HEIGHT - SAFE.top - SAFE.bottom,
        border: "2px dashed rgba(255,255,255,0.35)",
      }}
    />
    <div style={{ position: "absolute", left: 0, right: 0, top: STYLE.caption.y, borderTop: "1px dashed rgba(120,200,255,0.6)" }} />
  </AbsoluteFill>
);
