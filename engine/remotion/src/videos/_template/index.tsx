import React from "react";
import { Sequence } from "remotion";
import type { VideoEntry } from "../../registry";
import { Stage } from "../../components/Stage";
import { Captions } from "../../components/Captions";
import { Headline, Label } from "../../components/Text";
import { mix } from "../../components/Diagram";
import { Beat, easeInOut, easeOut, prog, Timeline, useT } from "../../lib/timeline";
import { C, CONTENT_MID, F, HEIGHT, SAFE, STROKE, STYLE, WIDTH } from "../../style";
import placeholder from "./timeline.json";

/*
 * Template composition (Eratosthenes measures the Earth). Copy is made by tools/new_video.sh; replace the diagram,
 * keep the structure:
 *   - one object persists through the whole video (here: the Earth circle, from the hook to the takeaway ghost)
 *   - one <Beat> per group of narration lines; inside, every sub-step is a FRACTION of a line (at(i, a, b)),
 *     never a second, so a longer line in another language keeps the same choreography
 *   - <Captions> once, at the root, hiding the lines that are already shown as headlines
 * Nothing here knows a second in advance: change the script, re-run tts.py, and the timing follows.
 */

// ---------------------------------------------------------------- hero diagram geometry
const CX = WIDTH / 2; // one axis for the diagram, the headline, the captions and the number
const CY = CONTENT_MID + 40; // a little low, so the hook headline sits above the Earth instead of across it
const R = 300;
const STICK = 80;
const DEG = Math.PI / 180;
const THETA_SHOWN = 24 * DEG; // exaggerated while the shadow is explained (lines 1 to 4), a dim note says so
const THETA_TRUE = 7.2 * DEG; // Alexandria slides to the true angle on line 5, so "fifty of those arcs" is honest
const SYENE = { x: CX - R, y: CY };
const RAY_GAP = 12; // a ray stops short of what it meets, so the stick at Syene reads as its own object
const HOOK_Y = 400;

type P = { x: number; y: number };
const along = (p: P, d: P, k: number): P => ({ x: p.x + d.x * k, y: p.y + d.y * k });
const line = (a: P, b: P) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
/** Short arc from angle a1 to a2 (radians, screen coords), always the small way round. */
const arc = (cx: number, cy: number, r: number, a1: number, a2: number) => {
  let d = a2 - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const s = { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) };
  const e = { x: cx + r * Math.cos(a1 + d), y: cy + r * Math.sin(a1 + d) };
  return `M ${s.x} ${s.y} A ${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${e.x} ${e.y}`;
};
const CIRCLE = arc(CX, CY, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 0.999) + arc(CX, CY, R, Math.PI / 2, Math.PI / 2 + Math.PI * 0.999);

/** A path that draws itself as p goes 0..1. Returns null at 0: a zero-length round cap renders as a dot. */
const Draw: React.FC<{ d: string; p: number; width?: number; color?: string }> = ({ d, p, width = STROKE, color = C.fg }) =>
  p > 0 ? (
    <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - p} />
  ) : null;

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", left: 0, top: 0 }}>
    {children}
  </svg>
);

// ---------------------------------------------------------------- hook (line 0): the Earth draws itself, the first ray arrives
const Hook: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const { t } = useT(); // a Beat from line 0 starts at t = 0, so t is global here
  const ray = easeOut(prog(t, 1.2, tl.lines[1].start - 0.8)); // starts right after the cover frame, so the hook never holds still
  return (
    <>
      <Svg>
        <Draw d={CIRCLE} p={easeOut(prog(t, 0, 1.2))} />
        <Draw d={line({ x: SAFE.side, y: SYENE.y }, { x: SYENE.x - STICK - RAY_GAP, y: SYENE.y })} p={ray} color={C.dim} />
      </Svg>
      <Headline text={tl.lines[0].text} y={HOOK_Y} width={STYLE.caption.maxWidth} fade={false} />
    </>
  );
};

// ---------------------------------------------------------------- the diagram, lines 1..last
const EarthDiagram: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const { t } = useT();
  const last = tl.lines.length - 1;
  const L = (i: number) => tl.lines[Math.min(i, last)];
  const tG = t + L(1).start; // this Beat starts at line 1
  /** 0..1 between fraction a and fraction b of line i. */
  const at = (i: number, a: number, b: number) => prog(tG, L(i).start + a * L(i).dur, L(i).start + b * L(i).dur);
  const E = easeOut;

  const slide = easeInOut(at(5, 0, 0.6));
  const theta = THETA_SHOWN + (THETA_TRUE - THETA_SHOWN) * slide;
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const ALEX = { x: CX - R * cos, y: CY - R * sin };
  const OUT = { x: -cos, y: -sin }, TAN = { x: sin, y: -cos };
  const A_SYENE = Math.PI, A_ALEX = Math.PI + theta;
  const alexTip = along(ALEX, OUT, STICK), shadowEnd = along(ALEX, TAN, STICK * Math.tan(theta));

  // the sun side leaves once the angle has been transferred; every mark leaves before the number; the ring ghosts for the takeaway
  const sunO = 1 - at(5, 0, 0.3);
  const noteO = E(at(3, 0, 0.2)) * (1 - at(5, 0, 0.25));
  // handoff fades are a fixed 0.3 to 0.4 s, not a fraction of a line: a fraction of a 3 s line is a 1 s crossfade
  const marksO = 1 - prog(tG, L(7).end, L(8).start - 0.05); // gone in the gap before the number starts counting
  const ghost = prog(tG, L(last).start, L(last).start + 0.4);
  const circleColor = at(7, 0, 1) > 0 ? mix(C.dim, C.faint, at(7, 0, 0.2)) : mix(C.fg, C.dim, at(6, 0, 0.3)); // faint survives a phone; darker does not

  const lit = Math.floor(at(7, 0.1, 0.95) * 50 + 1e-6);
  const segA = (2 * Math.PI) / 50, gapA = 1.5 * DEG;
  const centreText = lit > 0 ? `${lit} / 50` : slide >= 1 ? "1 / 50" : at(4, 0.3, 1) > 0 ? "7.2°" : "";
  const n = Math.round(40000 * E(at(8, 0, 0.35)));
  const numO = at(8, 0, 0.15) * (1 - ghost);
  const trueO = at(8, 0.5, 0.65);

  return (
    <>
      <Svg>
        <Draw d={CIRCLE} p={1} color={circleColor} />
        {/* sun side: rays, sticks, the shadow and its angle (lines 1 to 3) */}
        <g opacity={sunO}>
          <Draw d={line({ x: SAFE.side, y: SYENE.y }, { x: SYENE.x - STICK - RAY_GAP, y: SYENE.y })} p={1} color={C.dim} />
          <Draw d={line({ x: SAFE.side, y: ALEX.y }, { x: ALEX.x - RAY_GAP, y: ALEX.y })} p={E(at(2, 0, 0.35))} color={C.dim} />
          <Draw d={line(SYENE, { x: SYENE.x - STICK, y: SYENE.y })} p={E(at(1, 0, 0.35))} />
          <Draw d={line(ALEX, alexTip)} p={E(at(2, 0.3, 0.6))} />
          <Draw d={line(ALEX, shadowEnd)} p={E(at(2, 0.55, 0.9))} color={C.dim} />
          <Draw d={arc(ALEX.x, ALEX.y, 90, A_SYENE, A_ALEX)} p={E(at(3, 0, 0.5))} />
        </g>
        {/* the same angle at the centre (line 4), shrinking to the true 7.2 deg (line 5); the arc between the cities on the rim (line 6) */}
        <g opacity={marksO}>
          <Draw d={line({ x: CX, y: CY }, SYENE)} p={E(at(4, 0, 0.45))} color={C.dim} />
          <Draw d={line({ x: CX, y: CY }, ALEX)} p={E(at(4, 0, 0.45))} color={C.dim} />
          <Draw d={arc(CX, CY, 110, A_SYENE, A_ALEX)} p={E(at(4, 0.3, 0.8))} />
          <Draw d={arc(CX, CY, R, A_SYENE, A_ALEX)} p={E(at(6, 0, 0.6))} />
        </g>
        {/* fifty of those arcs, lit one by one on the Earth's own rim (line 7) */}
        <g opacity={1 - ghost}>
          {Array.from({ length: lit }, (_, k) => (
            <Draw key={k} d={arc(CX, CY, R, A_SYENE + k * segA + gapA / 2, A_SYENE + (k + 1) * segA - gapA / 2)} p={1} />
          ))}
        </g>
      </Svg>

      <div style={{ opacity: sunO }}>
        {at(3, 0.1, 1) > 0 ? (
          <Label x={ALEX.x - 118 * Math.cos(theta / 2)} y={ALEX.y - 118 * Math.sin(theta / 2) - 34} align="right">
            7.2°
          </Label>
        ) : null}
      </div>
      <div style={{ opacity: marksO }}>
        {at(1, 0.2, 1) > 0 ? <Label x={SYENE.x + 24} y={SYENE.y + 22}>Syene</Label> : null}
        {at(2, 0.4, 1) > 0 ? <Label x={ALEX.x + 44} y={ALEX.y - 50}>Alexandria</Label> : null}
        {centreText ? <Label x={CX - 110} y={CY + 18}>{centreText}</Label> : null}
        {at(6, 0.2, 1) > 0 ? (
          <Label x={SYENE.x - 24} y={(SYENE.y + ALEX.y) / 2 - 18} align="right">
            800 km
          </Label>
        ) : null}
      </div>
      <div style={{ opacity: noteO }}>
        <Label x={CX} y={SAFE.top + 24} align="center" dim>
          angle exaggerated for clarity
        </Label>
      </div>
      {/* the number, inside the ring (line 8): headline size plus caption size, two sizes on screen */}
      <div style={{ position: "absolute", left: 0, right: 0, top: CY, transform: "translateY(-50%)", textAlign: "center", opacity: numO }}>
        <div style={{ fontSize: F.headline, fontWeight: 600, letterSpacing: -1, fontVariantNumeric: "tabular-nums", color: C.fg }}>
          {n.toLocaleString("en-US")} km
        </div>
        <div style={{ marginTop: 20, fontSize: F.caption, fontWeight: 500, color: C.dim, opacity: trueO }}>true value 40,075 km</div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------- takeaway: the headline starts only after the ring has ghosted
const Takeaway: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const { fps } = useT();
  const last = tl.lines.length - 1;
  return (
    <Sequence from={Math.round(0.45 * fps)} layout="none">
      <Headline text={tl.lines[last].text} width={STYLE.caption.maxWidth} />
    </Sequence>
  );
};

// ---------------------------------------------------------------- composition
const Video: React.FC<{ timeline: Timeline }> = ({ timeline: tl }) => {
  const last = tl.lines.length - 1;
  return (
    <Stage debug={false}>
      <Beat tl={tl} from={0}>
        <Hook tl={tl} />
      </Beat>
      <Beat tl={tl} from={1} to={last}>
        <EarthDiagram tl={tl} />
      </Beat>
      <Beat tl={tl} from={last}>
        <Takeaway tl={tl} />
      </Beat>
      <Captions tl={tl} hide={[0, last]} />
    </Stage>
  );
};

export const video: VideoEntry = {
  id: "template",
  component: Video,
  defaultTimeline: placeholder as Timeline,
};
