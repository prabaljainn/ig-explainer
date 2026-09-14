import type { Timeline } from "../../lib/timeline";
import { EN, makeVideo } from "../kubernetes-basics";
import placeholder from "./timeline.json";

/* Hinglish cut of kubernetes-basics: Roman-script captions, English diagram labels, house typeface; only the narration changes. */
// Hinglish word positions measured by the video critic: "aapka app" and "Aap batao" sit later than their English
// counterparts, and "3 ko 10 karo. 7 aur add" puts the numbers and the additions later in line 8
export const video = makeVideo("kubernetes-basics-hinglish", placeholder as Timeline, {
  L: EN,
  beats: { app: 0.55, container: 0.73, you: 0.52, nodeLabel: 0.55, pulse: 0.4, count: 0.36, births: 0.68, birthGap: 0.04, fan: 0.19, traffic: 0.42 },
});
