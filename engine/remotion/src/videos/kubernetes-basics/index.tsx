import React from "react";
import type { VideoEntry } from "../../registry";
import { Stage } from "../../components/Stage";
import { Captions } from "../../components/Captions";
import { Headline } from "../../components/Text";
import { Beat, clamp01, easeOut, prog, Timeline, useT } from "../../lib/timeline";
import { cjkNodes, sentences } from "../../lib/fonts";
import { C, F, HEIGHT, STROKE, WIDTH } from "../../style";
import placeholder from "./timeline.json";

/*
 * One diagram, built up over lines 0..9 and then exercised, inside a single <Beat> from line 0 (so local t == global t).
 * Every sub-animation is P(line, f, seconds): 0..1 over `seconds`, starting a fraction f of the way into that narration
 * line, so beats land on the same words whatever the language and line length. Labels and the two line-2 beats come
 * from a per-language config so the same composition renders other languages (see ../kubernetes-basics-ja).
 */

export type Labels = { pod: string; container: string; app: string; node: string; cluster: string; controlPlane: string; want: string; have: string; you: string; service: string; traffic: string };
export const EN: Labels = { pod: "pod", container: "container", app: "app", node: "node", cluster: "cluster", controlPlane: "control plane", want: "want", have: "have", you: "you", service: "service", traffic: "traffic" };
/** Where certain words fall in their line, as fractions of the line's duration, so each beat lands on its word in any
 * language: "app" and "container" in line 2 (English says app first, Japanese container first), "you" in line 5,
 * "notices" in line 7, the count from 3 to 10 and the seven births in line 8, the fan lines and the traffic arrow in line 9. */
export type Beats = { app: number; container: number; you?: number; nodeLabel?: number; pulse?: number; count?: number; births?: number; birthGap?: number; fan?: number; traffic?: number };
export const EN_BEATS: Beats = { app: 0.37, container: 0.6, you: 0.45, pulse: 0.4, count: 0.25, births: 0.5, birthGap: 0.06, fan: 0.19, traffic: 0.42 };
export type Config = { L: Labels; beats?: Beats; cpW?: number; font?: string | (() => string) };

// ---------------------------------------------------------------- geometry
const CX = WIDTH / 2;
const POD = 100; // pod at slot size
const ROW_Y0 = 1010, ROW_Y = 840, HEAD_Y = 600; // hook: headline above, pod row below; the row rises to ROW_Y on line 1
const ZOOM = 360, CONT = 240, APP = 120; // the pod opened up (line 2): 60px insets both ways
const LEADER_X = 760; // where the pod / container / app labels sit
const CP_Y = 470, CP_H = 120, CP_W = 700; // control plane; width is per language (Config.cpW)
const CL = { x: 72, y: 650, w: 936, h: 400 }; // cluster
const NODE = { w: 274, h: 300, y: 710 };
const NODE_X = [101, 403, 705];
const SVC = { x: 340, y: 1140, w: 400, h: 80 }; // service pill
const slot = (n: number, s: number) => ({ x: NODE_X[n] + 27 + (s % 2) * 120, y: NODE.y + 60 + Math.floor(s / 2) * 120 });
const HERO = slot(1, 0); // where the hook's pod ends up

type PodSpec = { n: number; s: number; born: [number, number]; dies?: [number, number] }; // [line, fraction of the line]
const PODS: PodSpec[] = [
  { n: 0, s: 0, born: [6, 0.5], dies: [7, 0] },
  { n: 2, s: 0, born: [6, 0.65] },
  { n: 0, s: 1, born: [7, 0.62] },
];
/** Scale-up order: the vacated slot refills first, then round-robin; end state 3 + 4 + 3 with both gaps bottom-right. */
const SCALE_UP = [[0, 0], [1, 1], [2, 1], [1, 2], [2, 2], [0, 2], [1, 3]] as const;

// ---------------------------------------------------------------- primitives
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, p: number) => `rgb(${hex(a).map((v, i) => Math.round(lerp(v, hex(b)[i], p))).join(",")})`;

type BoxProps = { x: number; y: number; w: number; h: number; p: number; fill?: number; r?: number; width?: number; color?: string };
/** Rounded rect whose outline draws itself as p goes 0..1. `fill` 0..1 grows a solid inner rect out of the centre. */
const Box: React.FC<BoxProps> = ({ x, y, w, h, p, fill = 0, r = 14, width = STROKE, color = C.fg }) => (
  <>
    {p > 0 ? (
      <rect x={x} y={y} width={w} height={h} rx={r} pathLength={1} fill="none" stroke={color} strokeWidth={width}
        strokeLinejoin="round" strokeDasharray={1} strokeDashoffset={1 - p} />
    ) : null}
    {fill > 0 ? <rect x={x + (w * (1 - fill)) / 2} y={y + (h * (1 - fill)) / 2} width={w * fill} height={h * fill} rx={r * fill} fill={color} /> : null}
  </>
);

type LineProps = { x1: number; y1: number; x2: number; y2: number; p: number; width?: number; color?: string };
const Line: React.FC<LineProps> = ({ x1, y1, x2, y2, p, width = STROKE, color = C.fg }) =>
  p > 0 ? (
    <line x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - p} />
  ) : null;

/** Line with a head that pops once the shaft has arrived. Points along +x or +y only (that is all we need). */
const Arrow: React.FC<LineProps> = (a) => {
  const dx = Math.sign(a.x2 - a.x1), dy = Math.sign(a.y2 - a.y1), k = 14 * clamp01((a.p - 0.85) / 0.15);
  const head = `${a.x2 - dx * k - dy * k},${a.y2 - dy * k - dx * k} ${a.x2},${a.y2} ${a.x2 - dx * k + dy * k},${a.y2 - dy * k + dx * k}`;
  return (
    <>
      <Line {...a} />
      {k > 0 ? <polyline points={head} fill="none" stroke={a.color ?? C.fg} strokeWidth={a.width ?? STROKE} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </>
  );
};

/** A pod: outline draws (b 0..0.7) then fills (0.7..1). Death d 0..1: fill drains, an X draws; gone 0..1 fades it away. */
const Pod: React.FC<{ x: number; y: number; b: number; d?: number; gone?: number }> = ({ x, y, b, d = 0, gone = 0 }) => {
  const k = 26;
  return (
    <g opacity={1 - gone}>
      <Box x={x} y={y} w={POD} h={POD} p={clamp01(b / 0.7)} fill={clamp01((b - 0.7) / 0.3) * (1 - clamp01(d / 0.5))} />
      <Line x1={x + k} y1={y + k} x2={x + POD - k} y2={y + POD - k} p={clamp01((d - 0.3) / 0.5)} />
      <Line x1={x + POD - k} y1={y + k} x2={x + k} y2={y + POD - k} p={clamp01((d - 0.5) / 0.5)} />
    </g>
  );
};

/** A pod that is crossed out at tD (0.4 s), holds, fades just before tR and is drawn again from tR: Pod props at time t. */
const cycle = (t: number, tD: number, tR: number) =>
  t < tR ? { b: 1, d: prog(t, tD, tD + 0.4), gone: prog(t, tR - 0.4, tR) } : { b: easeOut(prog(t, tR, tR + 0.5)), d: 0, gone: 0 };

/** Label text, positioned by its vertical centre. `dim` 0..1 mixes fg towards the dim grey. */
const Txt: React.FC<{ x: number; y: number; o?: number; align?: "left" | "center" | "right"; dim?: number; children: React.ReactNode }> = ({
  x, y, o = 1, align = "left", dim = 0, children,
}) => (
  <div
    style={{
      position: "absolute", left: x, top: y, opacity: o, whiteSpace: "nowrap",
      transform: `translate(${align === "center" ? "-50%" : align === "right" ? "-100%" : "0"}, -50%)`,
      fontSize: F.label, fontWeight: 500, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: mix(C.fg, C.dim, dim),
    }}
  >
    {children}
  </div>
);

// ---------------------------------------------------------------- the diagram, lines 0..10
const Diagram: React.FC<{ tl: Timeline; L: Labels; B: Beats; cpW: number }> = ({ tl, L, B, cpW }) => {
  const { t } = useT();
  const CP = { x: CX - cpW / 2, y: CP_Y, w: cpW, h: CP_H };
  const S = (i: number) => tl.lines[i].start;
  const D = (i: number) => tl.lines[i].dur;
  const at = (i: number, f: number) => S(i) + f * D(i); // a fraction of the way into line i
  const Plin = (i: number, f: number, secs: number) => prog(t, at(i, f), at(i, f) + secs);
  const P = (i: number, f = 0, secs = 1) => easeOut(Plin(i, f, secs));

  // hook: the middle pod is already crossed out at frame 0 and is back for "your app didn't"; on line 1 the outer two do the same
  const hero = cycle(t, -0.2, at(0, 0.55));
  const left = cycle(t, at(1, 0.4), at(1, 0.75)), right = cycle(t, at(1, 0.5), at(1, 0.82)); // right pod is whole again before the line ends
  const rowY = lerp(ROW_Y0, ROW_Y, P(1, 0, 0.8));
  const outerO = 1 - P(2, 0, 0.5);

  // hero pod: opens up on line 2, collapses and travels into the middle node on line 3
  const z = P(2, 0, 0.7), col = P(3, 0, 0.4), mv = P(3, 0.04, 0.9); // shrink overlaps the fill: no solid 360px flash
  const size = lerp(lerp(POD, ZOOM, z), POD, mv);
  const hx = lerp(CX, HERO.x + POD / 2, mv), hy = lerp(rowY, HERO.y + POD / 2, mv);
  const heroFill = Math.min(1, clamp01((hero.b - 0.7) / 0.3) * (1 - clamp01(hero.d / 0.5)) * (1 - z) + col * Math.max(mv, 0.3)); // fill grows as the box shrinks: no solid slab
  const app = Math.min(P(2, B.app, 0.5), 1 - col); // on the word "app"
  const inner = Math.min(P(2, B.container, 0.7), 1 - col); // on the word "container"
  const lbl = (p: number) => Math.min(clamp01((p - 0.6) / 0.4), 1 - col); // label lands as its shape completes, all gone on line 3

  // cluster, control plane, service
  const node = [P(4, 0, 0.8), P(3, 0.26, 0.8), P(4, 0.05, 0.8)];
  const nodeLbl = [node[0], Math.min(node[1], P(3, B.nodeLabel ?? 0.45, 0.4)), node[2]]; // the middle label waits for the pod to land under it
  const cl = P(4, 0.32, 0.9);
  const cp = P(5, 0, 0.8), you = P(5, B.you ?? 0.45, 0.6);
  const wantO = P(6, 0, 0.3);
  const want = Math.round(lerp(3, 10, P(8, B.count ?? 0.25, 0.6)));
  const pulse = Math.sin(Math.PI * Plin(7, B.pulse ?? 0.4, 0.6));
  const svc = P(9, 0, 0.8), fan = P(9, B.fan ?? 0.19, 0.7), traffic = P(9, B.traffic ?? 0.42, 0.6);
  const dimAll = 1 - 0.98 * P(10, 0, 0.26); // fully dark before the takeaway headline starts (0.3 s into line 10)
  const cpDim = P(9, 0, 0.5); // the whole control-plane group steps back when the service is introduced

  const specs: PodSpec[] = [...PODS, ...SCALE_UP.map(([n, s], k) => ({ n, s, born: [8, (B.births ?? 0.5) + (B.birthGap ?? 0.06) * k] as [number, number] }))];
  const pods = specs.map((p) => {
    const tD = p.dies ? at(p.dies[0], p.dies[1]) : null;
    return { ...slot(p.n, p.s), b: P(p.born[0], p.born[1], 0.5), d: tD === null ? 0 : prog(t, tD, tD + 0.5), gone: tD === null ? 0 : prog(t, tD + 0.6, tD + 1.0) };
  });
  const have = 1 + pods.filter((p) => p.b > 0.85 && p.d < 0.3).length;

  // leader from a shape's right edge to the label column, broken 8px either side of every drawn outline it crosses
  const lead = (yy: number, edge: number, o: number) => {
    const xs = ([[CX + CONT / 2, inner], [CX + ZOOM / 2, z]] as const).filter(([x, drawn]) => x > edge + 1 && drawn > 0).map(([x]) => x);
    const stops = [edge, ...xs.flatMap((x) => [x - 8, x + 8]), LEADER_X - 16];
    return <>{stops.slice(0, -1).map((x1, k) => (k % 2 === 0 ? <Line key={k} x1={x1} y1={yy} x2={stops[k + 1]} y2={yy} p={o} width={3} color={C.dim} /> : null))}</>;
  };

  return (
    <div style={{ position: "absolute", inset: 0, opacity: dimAll }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", left: 0, top: 0 }}>
        {/* leader lines sit under everything */}
        {lead(ROW_Y - ZOOM / 2 + 30, CX + ZOOM / 2, Math.min(z, 1 - col))}
        {lead(ROW_Y - CONT / 2 + 30, CX + CONT / 2, inner)}
        {lead(ROW_Y - APP / 2 + 30, CX + APP / 2, app)}
        {/* hook row, outer pods */}
        <g opacity={outerO}>
          <Pod x={CX - 140 - POD / 2} y={rowY - POD / 2} {...left} />
          <Pod x={CX + 140 - POD / 2} y={rowY - POD / 2} {...right} />
        </g>
        {/* the opened-up pod's inside */}
        <Box x={CX - CONT / 2} y={ROW_Y - CONT / 2} w={CONT} h={CONT} p={inner} />
        <Box x={CX - APP / 2} y={ROW_Y - APP / 2} w={APP} h={APP} p={clamp01(app / 0.7)} fill={clamp01((app - 0.7) / 0.3)} />
        {/* hero pod */}
        <g opacity={1 - hero.gone}>
          <Box x={hx - size / 2} y={hy - size / 2} w={size} h={size} p={clamp01(hero.b / 0.7)} fill={heroFill} />
          <Line x1={hx - 24} y1={hy - 24} x2={hx + 24} y2={hy + 24} p={clamp01((hero.d - 0.3) / 0.5)} />
          <Line x1={hx + 24} y1={hy - 24} x2={hx - 24} y2={hy + 24} p={clamp01((hero.d - 0.5) / 0.5)} />
        </g>
        {/* nodes, cluster */}
        {NODE_X.map((x, n) => <Box key={n} x={x} y={NODE.y} w={NODE.w} h={NODE.h} p={node[n]} />)}
        <Box x={CL.x} y={CL.y} w={CL.w} h={CL.h} p={cl} r={24} width={3} color={C.dim} />
        {pods.map((p, k) => <Pod key={k} {...p} />)}
        {/* control plane */}
        <Box x={CP.x} y={CP.y} w={CP.w} h={CP.h} p={cp} width={STROKE + 6 * pulse} color={mix(C.fg, C.dim, cpDim)} />
        <Arrow x1={CX} y1={430} x2={CX} y2={CP.y - 6} p={you} color={mix(C.fg, C.dim, cpDim)} />
        {/* service: fan lines leave from the cluster's edge so they cross nothing */}
        {NODE_X.map((x, n) => <Line key={n} x1={x + NODE.w / 2} y1={CL.y + CL.h} x2={CX + (n - 1) * 120} y2={SVC.y} p={fan} width={3} color={C.dim} />)}
        <Box x={SVC.x} y={SVC.y} w={SVC.w} h={SVC.h} p={svc} r={SVC.h / 2} />
        <Arrow x1={240} y1={SVC.y + SVC.h / 2} x2={SVC.x - 6} y2={SVC.y + SVC.h / 2} p={traffic} />
      </svg>

      <Txt x={LEADER_X} y={ROW_Y - ZOOM / 2 + 30} o={lbl(z)}>{L.pod}</Txt>
      <Txt x={LEADER_X} y={ROW_Y - CONT / 2 + 30} o={lbl(inner)}>{L.container}</Txt>
      <Txt x={LEADER_X} y={ROW_Y - APP / 2 + 30} o={lbl(app)}>{L.app}</Txt>
      {NODE_X.map((x, n) => <Txt key={n} x={x + 20} y={NODE.y + 26} o={nodeLbl[n]} dim={P(4, 0, 0.5)}>{L.node}</Txt>)}
      <Txt x={CL.x + 24} y={CL.y + 30} o={cl} dim={P(5, 0, 0.5)}>{L.cluster}</Txt>
      <Txt x={CP.x + 28} y={CP.y + CP.h / 2} o={cp} dim={cpDim}>{L.controlPlane}</Txt>
      <Txt x={CP.x + CP.w - 28} y={CP.y + CP.h / 2} o={wantO} align="right" dim={cpDim}>{L.want} {want}&nbsp;&nbsp;&nbsp;{L.have} {have}</Txt>
      <Txt x={CX} y={400} o={you} align="center" dim={cpDim}>{L.you}</Txt>
      <Txt x={CX} y={SVC.y + SVC.h / 2} o={svc} align="center">{L.service}</Txt>
      <Txt x={72} y={SVC.y + SVC.h / 2} o={traffic}>{L.traffic}</Txt>
    </div>
  );
};

// ---------------------------------------------------------------- composition
/** Hook headline, one sentence per line: on screen from frame 0, fades out as line 1 starts. */
const HookHeadline: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const { t } = useT();
  const s1 = tl.lines[1].start;
  return (
    <div style={{ opacity: 1 - easeOut(prog(t, s1, s1 + 0.5)) }}>
      <Headline text={cjkNodes(sentences(tl.lines[0].text))} y={HEAD_Y} fade={false} />
    </div>
  );
};

/** Takeaway headline: fades in only after the diagram has gone dark (0.3 s into the last line). */
const Takeaway: React.FC<{ text: string }> = ({ text }) => {
  const { t } = useT();
  return (
    <div style={{ opacity: easeOut(prog(t, 0.3, 0.6)) }}>
      <Headline text={cjkNodes(sentences(text))} fade={false} />
    </div>
  );
};

/** The composition for one language: labels, two beats and typeface differ, timing and geometry do not. `font` may be a thunk so a CJK face loads only when its video renders. */
export const makeVideo = (id: string, defaultTimeline: Timeline, cfg: Config): VideoEntry => ({
  id,
  defaultTimeline,
  component: ({ timeline: tl }) => {
    const last = tl.lines.length - 1;
    return (
      <Stage debug={false} font={typeof cfg.font === "function" ? cfg.font() : cfg.font}>
        <Beat tl={tl} from={0} to={last}>
          <Diagram tl={tl} L={cfg.L} B={cfg.beats ?? EN_BEATS} cpW={cfg.cpW ?? CP_W} />
          <HookHeadline tl={tl} />
        </Beat>
        <Beat tl={tl} from={last}>
          <Takeaway text={tl.lines[last].text} />
        </Beat>
        <Captions tl={tl} hide={[0, last]} />
      </Stage>
    );
  },
});

export const video = makeVideo("kubernetes-basics", placeholder as Timeline, { L: EN });
