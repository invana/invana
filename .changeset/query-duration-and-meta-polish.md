---
"invana": patch
"studio": patch
---

Report real query execution time, and polish the Explorer message footer.

The engine now times the driver round-trip and stamps it onto the result metadata — previously the serializers never set it, so every query reported `0ms`. Sub-millisecond queries (which round to 0) now render as `<1ms` in the studio instead of a misleading `0ms`.

Explorer message footer: the re-run / view-query / copy icons are smaller and more spaced out.
