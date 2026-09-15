import React from "react";
import { C, F, STYLE } from "../style";
import { clamp01, easeOut, Timeline, useT } from "../lib/timeline";
import { cjkBreaks, cjkNodes } from "../lib/fonts";

/**
 * Shows the narration line currently being spoken. Place once at the composition root (outside any Beat).
 * `hide` lists line indices whose text is already on screen as a headline, to avoid saying it twice.
 */
export const Captions: React.FC<{ tl: Timeline; hide?: number[] }> = ({ tl, hide = [] }) => {
  const { t, fps } = useT();
  const line = [...tl.lines].reverse().find((l) => t >= l.start);
  if (!line || hide.includes(line.i)) return null;
  // fade in over 6 frames, and out just before the next line starts: without the second half the outgoing
  // caption vanishes on one frame while the incoming appears, which is a hard cut at every line boundary
  const next = tl.lines[line.i + 1];
  const p = easeOut(clamp01(((t - line.start) * fps) / 6)) * (next ? clamp01((next.start - t) / 0.13) : 1);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: STYLE.caption.y, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: STYLE.caption.maxWidth, // fixed, not shrink-to-fit: a trimmed trailing 。 must not re-wrap the line
          textAlign: "center",
          fontSize: F.caption,
          fontWeight: 500,
          lineHeight: 1.25,
          wordBreak: "keep-all",
          whiteSpace: "pre-line",
          ...({ textWrap: "balance" } as React.CSSProperties), // no one-word widows on a wrapped caption
          color: C.fg,
          opacity: p,
          transform: `translateY(${(1 - p) * 8}px)`,
        }}
      >
        {cjkNodes(cjkBreaks(line.text, STYLE.caption.maxWidth / F.caption))}
      </div>
    </div>
  );
};
