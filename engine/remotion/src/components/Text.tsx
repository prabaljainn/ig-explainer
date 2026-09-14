import React from "react";
import { C, CONTENT_MID, F, SAFE, WIDTH } from "../style";
import { clamp01, easeOut, useT } from "../lib/timeline";

/** Hook / takeaway statement, centred in the diagram area. Fades in over 10 frames (unless fade is false), then holds. */
export const Headline: React.FC<{ text: React.ReactNode; size?: number; y?: number; width?: number; fade?: boolean }> = ({
  text,
  size = F.headline,
  y = CONTENT_MID,
  width = WIDTH - 2 * SAFE.side,
  fade = true,
}) => {
  const { frame } = useT();
  const p = fade ? easeOut(clamp01(frame / 10)) : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: (WIDTH - width) / 2,
        width,
        top: y,
        transform: "translateY(-50%)",
        textAlign: "center",
        fontSize: size,
        fontWeight: 600,
        lineHeight: 1.12,
        letterSpacing: -0.5,
        ...({ textWrap: "balance" } as React.CSSProperties), // no one-word last line on a wrapped headline
        color: C.fg,
        opacity: p,
      }}
    >
      {text}
    </div>
  );
};

/** Small explanatory label next to a diagram element. */
export const Label: React.FC<{ x: number; y: number; children: React.ReactNode; dim?: boolean; align?: "left" | "center" | "right" }> = ({
  x,
  y,
  children,
  dim = false,
  align = "left",
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: align === "center" ? "translateX(-50%)" : align === "right" ? "translateX(-100%)" : undefined,
      fontSize: F.label,
      fontWeight: 500,
      color: dim ? C.dim : C.fg,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

/** A number that counts up over `seconds` of local time. */
export const Counter: React.FC<{ from: number; to: number; seconds?: number; suffix?: string; label?: string; y?: number }> = ({
  from,
  to,
  seconds = 1.6,
  suffix = "",
  label,
  y = CONTENT_MID,
}) => {
  const { t } = useT();
  const v = from + (to - from) * easeOut(t / seconds);
  const shown = Math.round(v).toLocaleString("en-US");
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, transform: "translateY(-50%)", textAlign: "center" }}>
      <div style={{ fontSize: F.display, fontWeight: 600, letterSpacing: -2, fontVariantNumeric: "tabular-nums", color: C.fg }}>
        {shown}
        {suffix}
      </div>
      {label ? <div style={{ marginTop: 16, fontSize: F.label, color: C.dim }}>{label}</div> : null}
    </div>
  );
};
