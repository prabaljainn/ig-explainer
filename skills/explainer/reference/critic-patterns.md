# What the critic docks points for

`.venv/bin/python tools/check.py videos/<slug>` now decides the mechanical half of this list in four seconds:
the output contract, the script rules, dead holds, discontinuities at narration line starts, and colour left
under the takeaway. Run it until it prints `0 FAIL` before you look at a single frame. What follows is what it
cannot decide.

Each item below has cost a critic round on a real video. Check them against the self-check contact sheet
(`tools/frames.sh`) before invoking `video-critic`; all of them are cheap before round 1 and expensive after.

## Hook and cover
- The 0.0 s, 0.4 s and 1.2 s (cover) frames must all show the thing the hook claims. Render the hook headline with
  no fade-in and start the hero animation slightly before t=0.
- The takeaway headline sits over a ghosted diagram: dim the diagram to at most 2% (yuv420 lifts 6% to about 10%)
  and finish dimming before the headline starts fading in. Overlapping ramps get flagged.

## Motion
- A line whose narration makes a claim needs motion that demonstrates it; a 3 s static hold gets flagged.
- Draw order follows word order inside a line, and word order differs by language (Japanese says コンテナ before
  アプリ). Keep such beats in a per-language config.
- Sub-beat timing is a fraction of the line's duration, never seconds; absolute delays tuned to English run early
  on longer lines in another language and leave dead holds.
- The exception is a handoff fade: when one scene's text must be gone before the next scene's text appears, fade
  over a fixed 0.3 to 0.4 s (in the gap between the lines if there is one). A fraction of a 3 s line is a 1 s
  crossfade, and text over half-faded text is a readability cap.
- When a moving object must fail to enter something, park it on the edge of what it cannot enter. Showing it
  inside contradicts the line (cap 6.5).
- A moving accent object must not share a y-band with a static label (cap 6.0).
- Labels beside a moving object wait until it has settled; a label left floating after its object moved gets flagged.

## Colour and glow
- The starfield is behind everything and is never the subject. If a frame reads as "stars plus text", the diagram
  is missing, not quiet.
- Only the hero glows, and only while its line is the subject. A glow left on while the narration has moved to
  another object reads as the wrong thing being emphasised.
- `mark` (annotation ink) never draws part of the diagram, and `badge` never appears when the content is not a
  sequence or a checklist. A role colour outside its role caps at 7.0.
- Glow bleeds: keep about 60 px between a glowing hero and any text, or the bloom eats the text's contrast.
- The takeaway ghosts the diagram to near-black, which was tuned against an empty ground. Render the last second
  and look: if the dust is brighter than the ghost, the takeaway reads as "stars plus text". Dim the field for
  that scene (`<Stage stars={0.4}>`) rather than brightening the ghost, which would fight the headline.
- A `Pop` entrance still has to land before the line's next beat. An overshoot that is still settling while the
  next element arrives reads as jitter.

## Diagram
- Labels need a colour rule: white while the object is the subject of the current line, dim from the next line on.
- One stroke weight (`stroke` in brand/style.json); hierarchy by colour, never by three line widths.
- Nested boxes need one consistent inset; lines that cross a dim outline get flagged; grid fills refill the
  vacated slot first and fill in one direction.
- Loop arrows land on the object they loop through; branch arrows end on the obvious target, not a middle box.
- A box-sized accent record with its label inside (ink = background) solves most tag-collision problems at once.
- SVG dash trap: `<rect pathLength={1}>` with `strokeDasharray="14 12"` renders solid, because dash units are
  path-length units. Dashed outlines drop `pathLength` or scale the dashes to it.

## Numbers and geometry
- One axis. The diagram's centre, the headline, the captions and any big number share x = WIDTH / 2; a 60 px offset
  to make room for a label reads as the caption sitting beside the wrong thing. Make room by moving the label instead.
- Exaggerated geometry must be reconciled before the narration counts on it: if an angle is drawn at 24 deg so it
  reads on a phone, slide it to the true value on the line that names the number, or the fifty arcs will not fit.
- Labels on a circle go just inside the rim (empty space, no rays, no sticks), never across the stroke.
- When the narration compares two numbers, both are on screen; the second one in dim at caption size keeps two sizes.
- A headline over the hero diagram collides with it. Put the hook headline above the diagram (and the diagram's
  centre a little below CONTENT_MID); ghost the diagram under the takeaway, and start the takeaway's fade only
  after the ghosting has finished (a Sequence offset of about 0.35 s).
- The hook needs motion for its whole duration: draw the hero over the first second, then let the first element of
  line 1 travel in slowly for the rest of line 0.

## CJK captions
- A trailing 。 or 、carries a full em of advance, so centred text looks nudged left. Trim it with a -0.5em margin
  span, then give the caption box a fixed width so it does not re-wrap by a pixel.
- Keep every Japanese clause at or under 19 full-width characters; longer clauses fall through to word-segmenter
  breaks that split compounds such as 過去|データ.
