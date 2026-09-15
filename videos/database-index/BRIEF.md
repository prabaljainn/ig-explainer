# database-index

Topic: why a database index makes a lookup fast, and what it costs.
Audience: people who write queries and have heard "add an index" without knowing what the index is.
The one surprising idea: the index is not a shortcut into the table, it is a second, sorted copy of one column —
and sorted is the whole trick, because sorted is what lets you throw away half the rows per step.
Hero diagram (the single visual the whole video is built around): one column of rows, drawn as horizontal bars
whose length is the value. The table scans; a second column slides clear of it, sorts itself into a triangle,
halves away, and opens a gap to admit a new row. The table is never reordered — that is what makes the second
column a copy. Nothing else appears; the same 24 bars carry all 10 lines.
Engine: remotion
Why this engine: the hero is a stack of bars and labels that reorder and shrink — layout motion, not geometry.
Manim would fight the row-by-row bookkeeping for no gain.
Accent color: none. The four diagram states are fg (the row being searched for), hero (the index), dim (the
unsorted table) and faint (discarded). A fifth colour would not be a fifth idea.
Notes / overrides to CLAUDE.md:
- 24 bars stand in for a million rows, so the halving is watchable. A dim note says so whenever the numbers are
  not in that slot, and line 6 reconciles it: the bars show the mechanism, the number states the real scale (2^20).
- First video in the starfield house style. The takeaway dims the field (`stars={0.5}`) so the ghosted column is
  not out-read by the dust.
