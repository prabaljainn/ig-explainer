import { getInfo, loadFont } from "@remotion/google-fonts/NotoSansJP";
import { subsetsCovering } from "../../lib/fonts";
import type { Timeline } from "../../lib/timeline";
import { STYLE } from "../../style";
import { Labels, makeVideo } from "../kubernetes-basics";
import placeholder from "./timeline.json";

/*
 * Japanese cut of kubernetes-basics: same diagram and timing, Japanese labels, CJK typeface (brand/style.json font.family_ja).
 * Only the font slices covering the script and labels are loaded, so keep ./timeline.json in sync with audio/timeline.json.
 */
const JA: Labels = {
  pod: "ポッド", container: "コンテナ", app: "アプリ", node: "ノード", cluster: "クラスター",
  controlPlane: "コントロールプレーン", want: "望み", have: "実際", you: "あなた", service: "サービス", traffic: "アクセス",
};

const tl = placeholder as Timeline;
const glyphs = [...Object.values(JA), ...tl.lines.map((l) => l.text), "0123456789 ,.:?!。、「」"].join("");
type Subsets = NonNullable<Parameters<typeof loadFont>[1]>["subsets"];
const FONT_JA = () => {
  const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600"], subsets: subsetsCovering(getInfo(), glyphs) as Subsets, ignoreTooManyRequestsWarning: true });
  return `${fontFamily}, ${STYLE.font.fallback.join(", ")}`;
};

// line 2 says コンテナ before アプリ, the reverse of English; the control plane box is wider because its label is 10 full-width glyphs
export const video = makeVideo("kubernetes-basics-ja", tl, {
  L: JA, cpW: 936, font: FONT_JA,
  // Japanese word order: コンテナ before アプリ; 気づいて, the numbers and the second sentence of line 9 all come later in their lines than in English
  beats: { container: 0.36, app: 0.72, you: 0.45, pulse: 0.3, count: 0.4, births: 0.69, birthGap: 0.04, fan: 0.46, traffic: 0.78 },
});
