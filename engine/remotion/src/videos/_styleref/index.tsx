import React from "react";
import type { VideoEntry } from "../../registry";
import { Stage } from "../../components/Stage";
import { Badge, Glow, MarkArrow, Packet, Pop } from "../../components/Annotate";
import { Box, Line } from "../../components/Diagram";
import { Headline } from "../../components/Text";
import { easeOut, prog, Timeline, useT } from "../../lib/timeline";
import { C, CONTENT_MID, HEIGHT, SAFE, WIDTH } from "../../style";

/*
 * The house style, on screen and moving, so a change to brand/style.json or the annotation primitives can be
 * looked at instead of argued about. Not a real video: no narration, no timeline, no captions.
 *   npx remotion render src/index.ts styleref /tmp/styleref.mp4
 */

const CX = WIDTH / 2;
const CY = CONTENT_MID;
const R = 190;

const Video: React.FC<{ timeline: Timeline }> = () => {
  const { t } = useT();
  const E = easeOut;

  const hero = E(prog(t, 0.0, 0.9)); // hero arrives
  const lit = E(prog(t, 0.6, 1.4)); // and lights up
  const arrow = E(prog(t, 1.3, 2.0));
  const flow = prog(t, 2.2, 3.4);
  const wire = E(prog(t, 2.0, 2.6));

  return (
    <Stage>
      <Headline text="The house style" y={SAFE.top + 90} />

      {/* hero: the only thing that glows, and only while it is the subject */}
      <div style={{ position: "absolute", left: 0, top: 0 }}>
        <Pop p={hero}>
          <Glow k={lit}>
            <svg width={WIDTH} height={HEIGHT}>
              <circle cx={CX} cy={CY} r={R} fill={C.hero} />
              <circle cx={CX - 30} cy={CY} r={R * 0.42} fill={C.bg} />
            </svg>
          </Glow>
        </Pop>
      </div>

      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", left: 0, top: 0 }}>
        {/* annotation ink points at the hero from outside it */}
        <MarkArrow x1={CX - 340} y1={CY + 300} x2={CX - R - 34} y2={CY + 70} p={arrow} bend={0.28} />

        {/* the diagram's own ink stays fg/dim, and carries something along it */}
        <Line x1={SAFE.side + 60} y1={CY + 470} x2={WIDTH - SAFE.side - 60} y2={CY + 470} p={wire} color={C.dim} />
        <Packet x1={SAFE.side + 60} y1={CY + 470} x2={WIDTH - SAFE.side - 60} y2={CY + 470} p={flow} />
        <Box x={SAFE.side + 60} y={CY + 560} w={280} h={140} p={wire} color={C.dim} />
      </svg>

      <Badge x={CX} y={CY + 360} n={1} p={E(prog(t, 1.8, 2.3))} align="center">
        numbered, only for a real sequence
      </Badge>
      <Badge x={CX} y={CY + 420} p={E(prog(t, 2.1, 2.6))} align="center">
        a tick, when there is no order
      </Badge>
    </Stage>
  );
};

export const video: VideoEntry = {
  id: "styleref",
  component: Video,
  defaultTimeline: { fps: 30, total_duration: 5, lines: [] } as Timeline,
};
