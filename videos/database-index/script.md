# database-index

## Narration

Your database just checked 1 million rows to find 1.
Without an index, that is the only way it can look.
An index is a sorted copy of one column.
Sorted means you can throw away half the rows every step.
Start in the middle: too big, drop everything below.
Too small, drop everything above, and repeat.
20 of those halvings is enough for 1 million rows.
So the lookup gets instant. The writes do not.
Every insert has to keep the sorted copy sorted.
An index trades slower writes for a search that halves.

## Scenes

- 0 (hook): the table as 24 dim bars in arbitrary order, one white bar somewhere low is the row we want. A white
  scan line falls from the top, lighting each bar as it passes. Headline above the column.
- 1: the scan reaches the white bar at the bottom and stops. Every bar behind it is dim: all of them were looked at.
- 2: a second column of hero bars slides clear of the table, sorts itself into a triangle, then moves back onto
  the axis as the table fades to faint and goes. The table itself is never reordered. Label "index: a second
  column, sorted".
- 3: a coral MarkArrow swings in and points at the middle bar. Dim note under the column: "32 rows, not 1 million".
- 4: the middle bar is compared; everything below it collapses to faint and loses its width.
- 5: the arrow moves to the middle of what is left, and the half on the other side collapses. Badge counts the step.
- 6: the surviving bar is the white one, still inside the faint shape of everything that was searched. A
  headline-size "20 steps" and a label-size "1,048,576 rows" resolve the 24-bar stand-in.
- 7: the column returns whole and hero; a lookup dot travels in and lands on the target, which rings once. The
  word "writes" appears dim on the right, waiting for line 8.
- 8: a new bar falls in from the top; the column opens a gap at its sorted position and every bar below shifts
  down to admit it. That shifting is the cost.
- 9 (takeaway): the column ghosts, the starfield dims, the takeaway headline resolves alone.
