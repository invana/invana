---
"studio": patch
---

Explorer: show all rows of an inline result, not just the first few.

The inline results table was wrapped in a fixed-height scroll area whose scrollbar stays hidden until hover, so a 10-row result looked like it stopped at ~5. The table already pages by row count ("Load more"), so the extra height clip is removed — every row in the current page now renders, and only horizontal overflow scrolls.
