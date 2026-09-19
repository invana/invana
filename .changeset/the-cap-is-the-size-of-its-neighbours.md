---
"studio": patch
---

Size the onboarding cap like the header controls it sits with.

`OnboardingCap` hard-coded a `size-6` button box while `ThemeMenu` and
`FullscreenToggle` beside it are `h-7 w-7`. The glyph was already `size-4` in all
three, so the cap read as a smaller icon purely because its ghost hover square
was 4px short. It is now `h-7 w-7`.
