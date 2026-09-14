import React from "react";
import { Composition } from "remotion";
import { videos } from "./registry";
import { FPS, HEIGHT, WIDTH } from "./style";

export const RemotionRoot: React.FC = () => (
  <>
    {videos.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={v.component}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={Math.ceil(v.defaultTimeline.total_duration * FPS)}
        defaultProps={{ timeline: v.defaultTimeline }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.ceil(props.timeline.total_duration * FPS),
        })}
      />
    ))}
  </>
);
