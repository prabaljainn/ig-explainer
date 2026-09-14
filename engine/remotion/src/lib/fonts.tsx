import React from "react";

/**
 * Google Fonts split CJK families into 100+ unicode-range slices. Loading all of them per render is slow and fragile;
 * this returns just the subset names whose ranges contain a character of `text`, for loadFont({ subsets }).
 */
export const subsetsCovering = (info: { unicodeRanges: Record<string, string> }, text: string): string[] => {
  const cps = [...new Set([...text].map((c) => c.codePointAt(0) as number))];
  const covers = (range: string) => {
    const [lo, hi] = range.trim().slice(2).split("-"); // "U+4E00-9FFF", "U+3042", "U+30??"
    const a = parseInt(lo.replace(/\?/g, "0"), 16), b = parseInt((hi ?? lo).replace(/\?/g, "F"), 16);
    return cps.some((cp) => cp >= a && cp <= b);
  };
  return Object.entries(info.unicodeRanges)
    .filter(([, ranges]) => ranges.split(",").some(covers))
    .map(([name]) => name);
};

const CJK = /[\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;
const em = (s: string) => [...s].reduce((w, c) => w + (CJK.test(c) ? 1 : 0.5), 0); // full-width glyphs are 1 em, Latin about half

/**
 * Caption line breaking. A caption wider than `maxEm` breaks once after a sentence boundary when both halves then fit
 * (the most balanced such cut), so no single word is stranded on the second line. Japanese (no spaces) additionally
 * gets break opportunities at word boundaries only (zero-width spaces from Intl.Segmenter), never before punctuation
 * or after an opening bracket. Pair with `whiteSpace: "pre-line"` and `wordBreak: "keep-all"`.
 */
export const cjkBreaks = (text: string, maxEm = Infinity): string => {
  if (em(text) <= maxEm) return text;
  const cuts = [...text.matchAll(/[、。？！]|[.?!:,] /g)].map((m) => (m.index as number) + 1).filter((i) => i < text.length);
  const fits = cuts.map((i) => [text.slice(0, i), text.slice(i).trimStart()]).filter(([a, b]) => em(a) <= maxEm && em(b) <= maxEm);
  if (fits.length) return fits.sort((p, q) => Math.abs(em(p[0]) - em(p[1])) - Math.abs(em(q[0]) - em(q[1])))[0].join("\n");
  if (!CJK.test(text) || typeof Intl === "undefined" || !("Segmenter" in Intl)) return text;
  const parts = [...new Intl.Segmenter("ja", { granularity: "word" }).segment(text)];
  return parts.map((s, i) => (i === 0 || !s.isWordLike || /[「（(]$/.test(parts[i - 1].segment) ? "" : "\u200B") + s.segment).join("");
};

/** First sentence on its own line, for hook and takeaway headlines ("." or "。"). */
export const sentences = (text: string): string => text.replace(/([.。])\s*(?=\S)/, "$1\n");

/**
 * Text with "\n" breaks as React nodes. A full-width 。or 、at the end of a line carries a whole em of advance with
 * ink only in its left third, which nudges centred text left; its advance is trimmed so the ink, not the box, centres.
 */
export const cjkNodes = (text: string): React.ReactNode =>
  text.split("\n").map((line, i) => {
    const trim = /[。、]$/.test(line);
    return (
      <React.Fragment key={i}>
        {i > 0 ? <br /> : null}
        {trim ? line.slice(0, -1) : line}
        {trim ? <span style={{ marginRight: "-0.5em" }}>{line.slice(-1)}</span> : null}
      </React.Fragment>
    );
  });