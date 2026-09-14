import React from "react";
import type { LucideIcon } from "lucide-react";
import { C, STROKE } from "../style";

/**
 * Line icon from Lucide (ISC, 4000+ icons), drawn with the diagram's stroke so it reads as part of the drawing.
 *
 *   import { Server } from "lucide-react";
 *   <Icon of={Server} x={540} y={900} size={120} />
 *
 * Centred on (x, y). `absoluteStrokeWidth` keeps the stroke at STROKE px whatever the size, so an icon inside a
 * box has the same line weight as the box. Icons label an object inside the diagram; they never replace the hero
 * diagram and never appear as decoration (CLAUDE.md, Look).
 */
export const Icon: React.FC<{
  of: LucideIcon;
  x: number;
  y: number;
  size?: number;
  dim?: boolean;
  color?: string;
  opacity?: number;
}> = ({ of: Glyph, x, y, size = 120, dim = false, color, opacity = 1 }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", lineHeight: 0, opacity }}>
    <Glyph size={size} color={color ?? (dim ? C.dim : C.fg)} strokeWidth={STROKE} absoluteStrokeWidth />
  </div>
);
