---
"studio": minor
---

One param names the right side (docs/for-developers/building-studio/graph-detail-page.md G16).

**`?right=` replaces `?ai=1` and `inspectorClosed`.** The right side had two occupants and two mechanisms: a boolean URL param opened the assistant, a component-local flag opened the inspector, and nothing said which of them was on screen — the inspector did not survive a reload. Now the param is the region and the value is the occupant: `?right=assistant`, `?right=inspector`, absent means closed. `?ai=` and `?inspector=open` are read once and normalised away on the next write, so old links keep working and are never written again.

**`rightSection` is a registry, not a ternary.** Each occupant owns its own size triple in one object literal, so a third occupant is one more entry rather than one more branch. `useRightSection` lives in `shell/` beside `useSettingsPanel`, because it names a region rather than belonging to one of the things in it.

**The attachment chip moved into the composer** (the-assistant-drawer.md AD10). `AD2` says the selection rides above the composer; it was rendering above the whole panel, a session list's length away from the ask it qualified. `SessionComposer` owns it now, on both the natural-language and query-language surfaces, and `AssistantDrawerShell` — a wrapper whose only job was to hold that chip — is deleted.

Opening one occupant replaces the other and closing closes the region: the right side no longer restores what was there before, which is the second piece of state one param per region exists to remove.

**`SessionsPanel` is `AssistantPanel`.** A panel is named for the occupant, not for its contents (terminology.md · Panel) — the occupant of the right side is the Assistant, and sessions are what it holds. Nothing inside is renamed: a session belongs to the graph, not to the assistant, so `Session*` components, `useSessions` and `sessionsApi` keep their names. Two stale names went with it: `closeSessions` closed the *left* panel and is now `closeLeftPanel`, and `sessionsContent` is `assistantContent`.

**"Drawer" is gone.** A drawer overlays what is behind it; this is `rightSection` — docked, resizable, and it moves the canvas over rather than covering it. `terminology.md` already banned the word for naming neither the place nor the thing, and `refactor-plan.md` already had the sweep as a step. `the-assistant-drawer.md` is now `the-assistant.md`, with every inbound link repointed; the `AD` decision ids are unchanged and now read *assistant decision*.

**The assistant is a graph-page feature, not an Explore one.** It is Ask's surface — one assistant on the right of every left panel (Explorer, Model, Projects, Tasks, Agents, Workflows), and the active panel is what supplies the subject. Filing it under Explore made the one surface read like one panel's affordance. `the-assistant.md` moves to `modules/ask/features/`, the index row moves from 4.4 to 3.10, and the code moves from `features/explore/assistant/` to `features/ask/assistant/`.
