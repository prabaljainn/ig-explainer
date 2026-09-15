import React from "react";
import { Sequence } from "remotion";
import type { VideoEntry } from "../../registry";
import { Stage } from "../../components/Stage";
import { Captions } from "../../components/Captions";
import { Headline, Label } from "../../components/Text";
import { Badge, MarkArrow } from "../../components/Annotate";
import { lerp, mix } from "../../components/Diagram";
import { Beat, clamp01, easeInOut, easeOut, prog, Timeline, useT } from "../../lib/timeline";
import { C, CONTENT_MID, F, HEIGHT, SAFE, STYLE, WIDTH } from "../../style";
import placeholder from "./timeline.json";

/*
 * Why an index makes a lookup fast. Two columns of 24 bars, length = value:
 *   the TABLE, in arbitrary order, which only lines 0-2 ever see; and
 *   the INDEX, a second column that slides clear of the table on line 2 and carries every line after it.
 * The table is never reordered — that it stays as it was is what makes the new column a copy, which is the
 * one idea the video exists to land.
 *
 * Colour says one thing each: white is the row being searched for and nothing else, hero is the live index,
 * faint is a row already thrown away or already read, coral is annotation ink pointing at something.
 * Every sub-beat is a fraction of its line, never a second, so the choreography survives a re-record, and
 * every state change is interpolated across its window — a colour that flips on one frame reads as a glitch.
 */

// ---------------------------------------------------------------- geometry
const N = 24;
const TARGET = 8; // sorted position of the row being searched for; the only white bar in the video
const X0 = 240; // bars grow rightward from here, so sorted reads as a triangle at a glance
const W_MIN = 110;
const W_MAX = 600;
const ROW_H = 31;
const BAR_H = 23;
const BAR_R = BAR_H / 2;

const HOOK_Y = 392; // headline centre: three lines span 264..520, inside the safe band and above the table
const NOTE_Y = 330; // the stand-in note, and on line 6 the real numbers
const TABLE_TOP = 560; // below the hook headline, so it never sits across the bars
const IDX_TOP = 470; // the index settles higher, once the headline has gone
const UNDER_Y = 1288; // one slot under the index: only ever one thing in it
// While the copy is being made both columns move apart, not just the copy: 220px of daylight without pushing
// the longest bar (600) past safe.side. Table bottoms out at x=140, copy tops out at 360 + 600 = 960.
const TABLE_DX = -100;
const COPY_DX = 120;

/** Value of the bar that sits at sorted position i. */
const width = (i: number) => W_MIN + ((W_MAX - W_MIN) * i) / (N - 1);

/** Seeded shuffle: fixed, so a re-render never reshuffles. SHUFFLE[row] = sorted position of that row's value. */
const SHUFFLE = (() => {
  const a = Array.from({ length: N }, (_, i) => i);
  let s = 20250915;
  for (let i = N - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
})();
/** TABLE_ROW[sortedPos] = the table row that value starts in. */
const TABLE_ROW = (() => {
  const r = new Array<number>(N);
  SHUFFLE.forEach((sortedPos, row) => (r[sortedPos] = row));
  return r;
})();
const SCAN_ROW = TABLE_ROW[TARGET]; // how far an exhaustive scan has to go to reach the row we want

/** The binary search: the window that survives each step, and the bar probed inside it. */
const STEPS = (() => {
  const out: { lo: number; hi: number; mid: number }[] = [];
  let lo = 0, hi = N - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    out.push({ lo, hi, mid });
    if (TARGET <= mid) hi = mid;
    else lo = mid + 1;
  }
  return out; // 4 for this row: 24 -> 12 -> 6 -> 3 -> 1
})();
/** The window left once the last halving is done: one row, the answer. */
const FINAL = { lo: TARGET, hi: TARGET, mid: TARGET };
// Line 4 says "too big, drop everything below" and line 5 "too small, drop everything above": the first discard
// has to land on line 4, not line 3, or each line contradicts the frame under it.
const STEP_WIN: [number, number, number][] = [
  [4, 0.15, 0.95],
  [5, 0.1, 0.62],
  [5, 0.62, 1.0], // "and repeat"
  [6, 0.0, 0.2], // lands at 0.184, so the chip reads 4 for ~0.46s before the counter takes the slot
].slice(0, STEPS.length) as [number, number, number][];

const INS = 15; // sorted position the inserted row belongs at
const SHIFTED = N - INS; // how many rows it pushes down; the label states this number

type Bar = { x: number; y: number; w: number; fill: string; hollow?: number; o: number };

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", left: 0, top: 0 }}>
    <defs>
      <linearGradient id="trail" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor={C.fg} stopOpacity="0.2" />
        <stop offset="1" stopColor={C.fg} stopOpacity="0" />
      </linearGradient>
    </defs>
    {children}
  </svg>
);

const Rect: React.FC<Bar> = ({ x, y, w, fill, hollow = 0, o }) =>
  w > 1 && o > 0.01 ? (
    <>
      {hollow < 1 ? <rect x={x} y={y} width={w} height={BAR_H} rx={BAR_R} fill={fill} opacity={o * (1 - hollow)} /> : null}
      {hollow > 0 ? (
        <rect x={x} y={y} width={w} height={BAR_H} rx={BAR_R} fill="none" stroke={fill} strokeWidth={4} opacity={o * hollow} />
      ) : null}
    </>
  ) : null;

// ---------------------------------------------------------------- the diagram, every line
const Diagram: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const { t } = useT(); // this Beat starts at line 0, so t is global
  const last = tl.lines.length - 1;
  const L = (i: number) => tl.lines[Math.min(i, last)];
  /** 0..1 between fraction a and fraction b of line i. */
  const at = (i: number, a: number, b: number) => prog(t, L(i).start + a * L(i).dur, L(i).start + b * L(i).dur);
  const E = easeOut;

  // -- lines 0-1: the scan falls through the table, then every row it read recedes: all of them were looked at
  const scanning = t < L(2).start;
  const scanO = 1 - prog(t, L(2).start - 0.25, L(2).start); // the front leaves before the line does
  const scan = E(prog(t, 0.1, L(1).start + 0.25 * L(1).dur)) * SCAN_ROW;
  const scanW = width(SHUFFLE[Math.min(N - 1, Math.round(scan))]) + 80; // as wide as the row it is crossing
  const read = at(1, 0.4, 0.95); // the rows behind the front go faint, which is the claim line 1 makes

  // -- line 2: the two columns move apart, only the copy sorts, then it takes the table's place
  const born = easeInOut(at(2, 0.0, 0.3)); // a 0.15s pop here reads as a cut, not as a copy being made
  const sort = easeInOut(at(2, 0.36, 0.74));
  const settleIn = easeInOut(at(2, 0.7, 1.0));
  const tableGone = at(2, 0.66, 0.94);
  const apart = born * (1 - settleIn);
  const idxX = X0 + COPY_DX * apart;
  const idxTop = lerp(TABLE_TOP, IDX_TOP, settleIn);

  // -- lines 3-6: halve, one step per narration beat. Bars keep their width and mix towards faint across the
  //    whole of their step, so the shape of what was searched stays and nothing snaps in a single frame.
  let step = 0, settle = 0;
  STEP_WIN.forEach(([li, a, b], k) => {
    const p = at(li, a, b);
    if (p > 0) { step = k; settle = p; }
  });
  const halving = at(3, 0.25, 1) > 0; // colour rule; stays on past line 6 so line 7 can fade back out of it
  const searching = halving && t < L(7).start; // the marks that belong to the search
  const { lo, hi, mid } = STEPS[step];
  const next = step + 1 < STEPS.length ? STEPS[step + 1] : FINAL;
  const done = step + (settle > 0.92 ? 1 : 0); // ticks only once the bars have finished going
  const probing = searching && !(step === STEPS.length - 1 && settle >= 1); // gone by the answer frame
  const seek = easeInOut(at(3, 0.62, 0.95)); // line 3's second beat: a rule runs down to the middle row
  // lands well before the line ends: a frame must never show a number the narration is not saying yet
  const steps20 = Math.round(20 * E(at(6, 0.34, 0.64)));

  // -- line 7: the discarded rows come back over 0.2s, and the lookup lands on the row in one move
  const back = easeInOut(prog(t, L(7).start, L(7).start + 0.45));
  const drop = E(at(7, 0.3, 0.78));
  const hit = E(at(7, 0.72, 1.0));

  // -- line 8: an insert falls in, and every row below its sorted place shifts down to admit it
  const fall = E(at(8, 0.05, 0.5));
  const shift = easeInOut(at(8, 0.35, 0.85));
  const insW = lerp(width(INS - 1), width(INS), 0.5); // a new value between its neighbours, not a clone of one

  const ghost = easeInOut(at(9, 0, 0.16)); // done by 0.43s, before the headline starts fading in at 0.47s
  const exit = prog(t, L(9).start, L(9).start + 0.35); // the marks leave, before the headline fades in at 0.47s
  const fade = 1 - ghost * 0.8;

  // the table: arbitrary order, never reordered, gone once the copy exists
  const table: Bar[] = Array.from({ length: N }, (_, i) => {
    const row = TABLE_ROW[i];
    const recede = Math.max(row <= scan ? read : 0, at(2, 0.0, 0.3)); // monotonic across the line 1 -> 2 cut
    return {
      x: X0 + TABLE_DX * apart,
      y: TABLE_TOP + row * ROW_H,
      w: width(i),
      fill: i === TARGET ? C.fg : mix(C.dim, C.faint, recede),
      hollow: born, // hollows out as the copy lifts off it, so two columns read as two
      o: (row > scan && i !== TARGET ? 0.5 : 1) * (1 - tableGone),
    };
  });

  // the index: the sorted copy, from line 2 to the end
  const index: Bar[] = Array.from({ length: N }, (_, i) => {
    let row = lerp(TABLE_ROW[i], i, sort);
    let k = 0; // 0 live, 1 thrown away. One number, so nothing is ever switched by a boolean.
    if (halving) {
      const out = i < lo || i > hi; // thrown away by an earlier step
      const going = !out && (i < next.lo || i > next.hi); // this step is throwing it away now
      k = (out ? 1 : going ? clamp01((settle - 0.45) / 0.5) : 0) * (1 - back);
    }
    if (t >= L(8).start && i >= INS) row += shift;
    // ghosting rides the same number, so the takeaway recedes instead of cutting to a neutral residue
    const fill = i === TARGET ? mix(C.fg, C.faint, ghost) : mix(C.hero, C.faint, Math.max(k, ghost));

    return { x: idxX, y: idxTop + row * ROW_H, w: width(i), fill, o: lerp(1, 0.55, k) * born * fade };
  });

  const midY = idxTop + lerp(TABLE_ROW[mid], mid, sort) * ROW_H + BAR_H / 2;
  const seekRow = lerp(0, mid, seek);
  const insY = IDX_TOP + INS * ROW_H;
  const writesY = IDX_TOP + 19 * ROW_H + BAR_H / 2;
  // one slot under the column, as a timeline. The opacity dips to zero at every boundary, so the text changes
  // while nothing is on screen rather than swapping on a single frame.
  const slots: [number, string | null][] = [
    [L(2).start + 0.85 * L(2).dur, "index: a second column, sorted"],
    [L(3).start + 0.25 * L(3).dur, null], // the badge owns the slot while the search runs
    [L(7).start, "one step to the row"],
    [L(8).start, `${SHIFTED} rows moved`], // a quantity the caption does not already say
    [L(9).start, null],
  ];
  const under = slots.filter(([at0]) => t >= at0).pop()?.[1] ?? null;
  const underO = Math.min(...slots.map(([at0]) => clamp01(Math.abs(t - at0) / 0.18))) * fade;
  // the note holds the top slot on lines 3-5 and again on 7-8; line 6 borrows it for the real numbers
  const noteO = Math.min(1, E(at(3, 0.2, 0.5)) * (1 - at(6, 0.16, 0.34)) + E(at(7, 0.1, 0.4)) * (1 - ghost));

  return (
    <>
      <Svg>
        {table.map((b, i) => <Rect key={`t${i}`} {...b} />)}
        {index.map((b, i) => <Rect key={`i${i}`} {...b} />)}

        {/* the scan front, with a trail that fades out behind it so the hook frame shows direction */}
        {scanO > 0.01 && scan > 0 ? (
          <g opacity={scanO}>
            <rect x={X0 - 40} y={TABLE_TOP + scan * ROW_H + BAR_H / 2 - 62} width={scanW} height={60} fill="url(#trail)" />
            <rect x={X0 - 40} y={TABLE_TOP + scan * ROW_H + BAR_H / 2 - 2} width={scanW} height={4} rx={2}
              fill={C.fg} opacity={0.8} />
          </g>
        ) : null}

        {/* line 3's second beat: a quiet rule runs down the triangle to the row the probe is about to name */}
        {seek > 0 && t < L(4).start ? (
          <rect x={idxX - 40} y={idxTop + seekRow * ROW_H + BAR_H / 2 - 1} height={2} fill={C.dim}
            width={width(Math.round(seekRow)) + 80} />
        ) : null}

        {/* the probe: annotation ink pointing at the middle. Line 3 draws it; each step re-draws it lower. */}
        {probing ? (
          <MarkArrow x1={X0 - 152} y1={midY + 132} x2={X0 - 26} y2={midY}
            p={Math.max(E(at(3, 0.25, 0.6)), E(clamp01(settle / 0.4)))} bend={0.32} />
        ) : null}

        {/* line 7: the lookup travels in, stops clear of the bar, and the row rings */}
        {drop > 0 && t < L(8).start ? (
          <>
            <circle cx={lerp(X0 - 150, X0 - 34, drop)} r={13} fill={C.mark} opacity={1 - hit}
              cy={lerp(IDX_TOP - 70, IDX_TOP + TARGET * ROW_H + BAR_H / 2, drop)} />
            {hit > 0 ? (
              <rect x={X0 - 6} y={IDX_TOP + TARGET * ROW_H - 6} width={width(TARGET) + 12} height={BAR_H + 12}
                rx={BAR_R + 6} fill="none" stroke={C.fg} strokeWidth={4} opacity={hit} />
            ) : null}
            {/* the other half of the line: writes did not get fast, and the label is tied to a row */}
            {at(7, 0.55, 1) > 0 ? (
              <line x1={X0 + width(19) + 14} y1={writesY} x2={890} y2={writesY} stroke={C.dim} strokeWidth={2}
                opacity={E(at(7, 0.55, 0.9))} />
            ) : null}
          </>
        ) : null}

        {/* line 8: the new row falls in between its neighbours, and the gap it needs is the shift below it */}
        {fall > 0 ? (
          <>
            <Rect x={X0} y={lerp(IDX_TOP - 90, insY, fall)} w={insW} o={fade * Math.min(1, fall * 4)}
              fill={mix(C.hero, C.faint, ghost)} />
            {/* which row is new is annotation ink's job, not a colour on the bar */}
            {exit < 1 ? (
              <g opacity={1 - exit}>
                <MarkArrow x1={X0 - 152} y1={insY + 150} x2={X0 - 26} y2={insY + BAR_H / 2}
                  p={E(at(8, 0.5, 0.85))} bend={0.32} />
              </g>
            ) : null}
          </>
        ) : null}
      </Svg>

      {under && underO > 0.01 ? (
        <div style={{ opacity: underO }}>
          <Label x={WIDTH / 2} y={UNDER_Y} align="center">{under}</Label>
        </div>
      ) : null}

      {searching && done > 0 && at(6, 0.34, 1) === 0 ? (
        <Badge x={WIDTH / 2} y={UNDER_Y} n={done} align="center">
          {done === 1 ? "halving" : "halvings"}
        </Badge>
      ) : null}

      {/* 24 bars stand in for a million rows; say so whenever the numbers are not in that slot */}
      {noteO > 0.01 ? (
        <div style={{ opacity: noteO }}>
          <Label x={WIDTH / 2} y={NOTE_Y} align="center" dim>24 rows, not 1 million</Label>
        </div>
      ) : null}

      {/* line 6 reconciles the stand-in: the bars showed the mechanism, this counts out the real scale */}
      {at(6, 0.34, 1) > 0 && t < L(7).start ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: NOTE_Y - 50, textAlign: "center" }}>
          <div style={{ fontSize: F.headline, fontWeight: 600, letterSpacing: -1, color: C.fg, fontVariantNumeric: "tabular-nums" }}>
            {steps20} steps
          </div>
          <div style={{ marginTop: 12, fontSize: F.caption, fontWeight: 500, color: C.dim, opacity: E(at(6, 0.66, 0.86)) }}>
            1,048,576 rows
          </div>
        </div>
      ) : null}

      {at(7, 0.55, 1) > 0 && t < L(8).start ? (
        <div style={{ opacity: E(at(7, 0.55, 0.9)) * fade }}>
          <Label x={WIDTH - SAFE.side} y={writesY} align="right" dim>writes</Label>
        </div>
      ) : null}
    </>
  );
};

// ---------------------------------------------------------------- composition
const Video: React.FC<{ timeline: Timeline }> = ({ timeline: tl }) => {
  const { t } = useT(); // root: t is absolute
  const last = tl.lines.length - 1;
  // the takeaway ghosts the column to near-black, so the dust steps back for it
  const stars = 1 - 0.55 * prog(t, tl.lines[last].start, tl.lines[last].start + 0.35 * tl.lines[last].dur);
  return (
    <Stage stars={stars}>
      <Beat tl={tl} from={0} to={last}>
        <Diagram tl={tl} />
      </Beat>
      {/* the hook headline sits above the table, never across it */}
      <Beat tl={tl} from={0} to={1}>
        <Headline text={tl.lines[0].text} y={HOOK_Y} width={STYLE.caption.maxWidth} fade={false} fadeOut={0.35} />
      </Beat>
      <Beat tl={tl} from={last}>
        <Sequence from={14} layout="none">
          <Headline text={tl.lines[last].text} y={CONTENT_MID} width={STYLE.caption.maxWidth} />
        </Sequence>
      </Beat>
      <Captions tl={tl} hide={[0, last]} />
    </Stage>
  );
};

export const video: VideoEntry = {
  id: "database-index",
  component: Video,
  defaultTimeline: placeholder as Timeline,
};
