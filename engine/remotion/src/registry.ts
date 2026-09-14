import type React from "react";
import type { Timeline } from "./lib/timeline";

export type VideoEntry = {
  id: string;
  component: React.FC<{ timeline: Timeline }>;
  defaultTimeline: Timeline;
};

// Every src/videos/<slug>/index.tsx that exports `video` is a composition; nothing to register by hand.
// A folder that is not checked in (private videos, see .gitignore) simply does not exist here.
// Render with:
//   npx remotion render src/index.ts <id> ../../videos/<id>/out/video.mp4 --props=../../videos/<id>/audio/props.json
type Ctx = { keys(): string[]; (key: string): { video?: VideoEntry } };
const ctx = (require as unknown as { context(dir: string, deep: boolean, filter: RegExp): Ctx }).context(
  "./videos",
  true,
  /^\.\/[^/]+\/index\.tsx$/,
);
export const videos: VideoEntry[] = ctx
  .keys()
  .sort()
  .map((k) => ctx(k).video)
  .filter((v): v is VideoEntry => Boolean(v));
