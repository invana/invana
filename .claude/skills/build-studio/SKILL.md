---
name: build-studio
description: How Studio UI and design-kit components are built — compose from @invana/design-kit and @invana/canvas only, tokens only, density and the type ladder, the shell, where a new component goes, one story per file. Use before writing or changing anything in studio/, ~/Projects/invana/design-kit or ~/Projects/invana/canvas, and when reviewing such code or a board's components. Load build-feature too.
---

# Build Studio and the kit

**Every hi-fi design is composed from `@invana/design-kit`.** Designs and code share one component set, so a screen
that can be drawn can be built, and a screen that cannot be built cannot be drawn. The designer draws by these rules
(with the **`design-story`** skill); the coder builds by them; QA's design review checks them.

## 1. Design rules

| Rule | Detail |
|---|---|
| Compose, don't draw | A hi-fi screen is `@invana/ui` + `@invana/forms` + `@invana/tables` + `@invana/themes` + `@invana/canvas` components. No hand-written HTML with inline styles, no one-off CSS, no ad-hoc colours. |
| Tokens only | Colour, spacing, radius and control heights come from `@invana/styling` tokens (`--primary`, `--muted-foreground`, `--border`, `--success`, …). Never a literal `hsl()`/hex in a design or in Studio. |
| Missing component → build it in the kit first | If a design needs something the kit does not have, add it to `~/Projects/invana/design-kit` **with a story**, then use it. Never inline it into the design and never reimplement it in Studio. The one exception: a composition built **exclusively for Studio** from `@invana/*` and tokens may live in `@invana-studio/ui`, under the rules of [migration-plan §4](../../../docs/products/migration-plan.md#4-the-studio-ui-package). Primitives still go to `design-kit` with a story. |
| Three repos, one direction | `design-kit` (`~/Projects/invana/design-kit`) → `canvas` (`~/Projects/invana/canvas`) → `invana` (here). `@invana/canvas-ui` peer-depends on `@invana/ui`; nothing depends back up. A component belongs in the **lowest layer that can own it** — if canvas-ui invents something general, promote it down into `@invana/ui` and have canvas-ui consume it. |
| Where it goes | shadcn-style primitive → `design-kit/packages/ui/src/components/ui/`. Composition of primitives, **including Invana-domain ones** (emissions, citations, charts) → `ui-extended/`. Form field → `@invana/forms`. Needs an external JS library (editor, uploader, heavy picker) → its own package. Anything bound to canvas state (toolbars, layers, minimap, context menus, canvas status bar) → `@invana/canvas-ui` — **check there before building it**, it already ships most canvas chrome. |
| Density is a token, not a prop | `@invana/styling` ships `data-density="compact"`; Studio and the board set it on the root. Components read `--control-h*` / `--font-size-*` — never a hard-coded `h-8`/`h-9`, never a `size="xs"` at every call site. |
| One story per file | `apps/storybook/stories/…` — one exported story per `*.stories.tsx`, folder mirroring `packages/ui/src/components/`. A new component without a story is not done. Whole *screens* are not stories — they live on the board. |
| A story adds no classes | A story composes **default** kit components — `<Eyebrow>`, `<SectionHeader>`, `<PropertyList>` — never a raw `<h4 className="…">` or a `<div>` dressed with utilities. The one exception is a story whose subject *is* `className` passthrough, and its name says so. **Match the job, not the tag**: a small muted label is `Eyebrow`, not `TypographyH4` (which is `text-xl`). A story that needs classes is a gap in the kit — build the component there. |
| Type ladder | Three rungs, and the root is the only dial: `text-base` · `text-sm` · `text-xs` = **13 / 12 / 11** at the 13px root. Default text declares **no size**; `text-sm` is deliberately subordinate, `text-xs` is genuinely small and rare. There is no `text-meta` — it was retired as a fourth name over a second size. |
| The board | `.design/board/` is the hi-fi board: React artboards composed only from `@invana/*`, compiled by `build.mjs` into one self-contained HTML file, published as the Artifact `invana-hifi-with-design-kit`. The build fails on a raw `hsl(`, a hex colour, a `style={{}}` literal, or any element outside `@invana/*`. |
| The map | `docs/for-developers/building-studio/design-kit-coverage.md` is the authoritative board element → design-kit component map, the decisions, and the build order. The product-manager updates it whenever a component ships or an artboard changes. |
| The screen index | `docs/for-developers/the-screens.md` lists all 42 hi-fi artboards with their status — is the screen built, is it on the kit, which feature it draws. **The product-manager flips a row the moment a screen ships.** It is to screens what `for-developers/README.md` is to features. |
| The shell | `docs/for-developers/building-studio/the-shell.md` — one `AppLayoutV2`, and `mainSection` is `Workbook` (the open boards, `keepMounted`). Reference: `canvas-ui/apps/AppLayoutV2` in the canvas Storybook. Every screen fills its regions; no screen builds a layout. |
| How Studio is built | `docs/for-developers/building-studio/` — `code-shape.md` (feature modules, deletion lists, routing, guardrails) and `refactor-plan.md` (the phases, the ui/canvas-ui substitution tables, how a move is made safely). |
| Journeys still lead | The journey-first process (`CLAUDE.md` › *How to respond*) comes first. Naming design-kit components is step 4 (*name the surfaces*, the journey-first step), not step 1. |

## 2. Studio standards (React 19 · TypeScript · pnpm · Biome)

- UI only from `@invana/design-kit` (`@invana/ui`, `forms`, `tables`, `themes`, `styling`) and `@invana/canvas` / `canvas-ui`; tokens only — no hex, no `hsl(`, no `style={{}}`, no hard-coded control heights. A missing component is built in `~/Projects/invana/design-kit` with a story; a Studio-only composition may live in `@invana-studio/ui`. No PixiJS in Studio.
- Every screen fills the shell (`AppLayoutV2`: leftNav · leftSection · mainSection `Workbook` · assistant right). Use the kit's names — leftNav, leftSection — never "rail" or "panel" in code.
- Server state in TanStack Query, client state in Zustand. Studio formats numbers; it never derives them.
- `pnpm lint`, `pnpm check-types` (`tsc -b --noEmit`), `pnpm test` green. Sibling `link:` overrides are local only — never commit them.
- Studio uses `@invana/canvas` for all graph rendering — no PixiJS code in Studio.

## 3. Design-kit components

Only from a component request Ravi approved, in `~/Projects/invana/design-kit` at the home the request names (re-check `git status` there first — another session may be working).

- Compose, don't draw. Density is a token, never a `size` prop; the type ladder is `text-base` · `text-sm` · `text-xs` (13/12/11), default text declares no size.
- **A component without a story is not done.** One story per file, folder mirroring `packages/ui/src/components/`; a story composes default kit components and adds no classes.
- Name the component and its home in your report — the product manager records it in `design-kit-coverage.md`; send the **designer** a `review` row for its look.
- A kit release is `./release.sh <version>` from its `main` — Ravi's call; until then Studio links the local kit.
