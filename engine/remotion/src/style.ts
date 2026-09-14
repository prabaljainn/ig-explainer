// Single source of truth is brand/style.json; Manim reads the same file.
import style from "../../../brand/style.json";
import { loadFont } from "@remotion/google-fonts/InstrumentSans";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

export const STYLE = style;
export const WIDTH = style.width;
export const HEIGHT = style.height;
export const FPS = style.fps;
export const C = style.colors;
export const F = style.font;
export const SAFE = style.safe;
export const STROKE = style.stroke;
export const FONT = `${fontFamily}, ${style.font.fallback.join(", ")}`;

/** Usable vertical band: everything a viewer must read lives between these. */
export const CONTENT_TOP = SAFE.top;
export const CONTENT_BOTTOM = HEIGHT - SAFE.bottom;
export const CONTENT_MID = (CONTENT_TOP + STYLE.caption.y) / 2; // centre of the diagram area, above captions
