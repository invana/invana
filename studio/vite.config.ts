import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Work against a local `design-kit` checkout instead of the published packages.
 *
 * Opt-in, and off by default — `INVANA_DESIGN_KIT=../../design-kit pnpm dev`.
 * Unset (a fresh clone, CI, every contributor who has never cloned design-kit)
 * resolves every `@invana/*` from npm exactly as before, so no local link ever
 * reaches a committed manifest (design-system.md DS3/DS10). The path is read
 * relative to this file, so it works the same on every OS.
 *
 * `@invana/styling` ships source — its exports already point at `src/*.css` —
 * so it aliases to `src`. The rest alias to their local **build**, so what runs
 * here is what npm would ship: run `pnpm build` in design-kit after editing one.
 */
const designKitRoot = process.env.INVANA_DESIGN_KIT
	? path.resolve(__dirname, process.env.INVANA_DESIGN_KIT)
	: null;

const dk = (...segments: string[]) =>
	path.resolve(designKitRoot as string, ...segments);

// Order matters: `@invana/ui` also matches `@invana/ui/styles.css`, so the
// specific subpaths are listed first and win.
const designKitAlias: Record<string, string> = designKitRoot
	? {
			"@invana/styling": dk("packages/styling/src"),
			"@invana/ui/styles.css": dk("packages/ui/dist/styles.css"),
			"@invana/ui/lib/utils": dk("packages/ui/dist/index.js"),
			"@invana/ui": dk("packages/ui/dist/index.js"),
			"@invana/themes/styles.css": dk("packages/themes/dist/styles.css"),
			"@invana/themes": dk("packages/themes/dist/index.js"),
			"@invana/forms": dk("packages/forms/dist/index.js"),
		}
	: {};

/**
 * The same hatch for the `canvas` checkout — `INVANA_CANVAS=../../canvas pnpm dev`.
 *
 * Identical contract to `INVANA_DESIGN_KIT` (design-system.md DS10): opt-in, off
 * by default, aliases to each package's **build**, and never touches a committed
 * manifest. Run `pnpm build` in the canvas repo after editing one.
 *
 * It exists because the canvas packages release in lockstep across a whole repo,
 * so seeing an unreleased engine change otherwise means publishing every package.
 */
const canvasRoot = process.env.INVANA_CANVAS
	? path.resolve(__dirname, process.env.INVANA_CANVAS)
	: null;

const cv = (...segments: string[]) =>
	path.resolve(canvasRoot as string, ...segments);

// Bare specifiers only — Studio imports no `@invana/canvas/*` subpath. A string
// alias matches the id exactly or `id + "/"`, so `@invana/canvas` does not
// swallow `@invana/canvas-react`; no ordering hazard here.
const canvasAlias: Record<string, string> = canvasRoot
	? {
			"@invana/canvas": cv("packages/canvas/dist/index.js"),
			"@invana/canvas-core": cv("packages/canvas-core/dist/index.js"),
			"@invana/canvas-store": cv("packages/canvas-store/dist/index.js"),
			"@invana/canvas-react": cv("packages/canvas-react/dist/index.js"),
			"@invana/graph": cv("packages/graph/dist/index.js"),
			"@invana/renderer-pixijs": cv("packages/renderer-pixijs/dist/index.js"),
			"@invana/graph-layout-d3-force": cv(
				"packages/graph-layout-d3-force/dist/index.js",
			),
			"@invana/graph-layout-elkjs": cv(
				"packages/graph-layout-elkjs/dist/index.js",
			),
		}
	: {};

// `resolve.dedupe` only reaches this app's own `node_modules`, and the canvas
// checkout carries its own copy under `packages/renderer-pixijs/node_modules`.
// Linking it would therefore load PixiJS twice — the exact breakage `dedupe`
// below guards against — so pin both to Studio's copy while the hatch is open.
const pixiPin: Record<string, string> = canvasRoot
	? {
			"pixi.js": path.resolve(__dirname, "node_modules/pixi.js"),
			"pixi-viewport": path.resolve(__dirname, "node_modules/pixi-viewport"),
		}
	: {};

// The workspace packages the two hatches redirect: filtered out of
// `optimizeDeps.include` and force-excluded, so edits are never served from a
// stale `.vite/deps` copy. `pixiPin` is deliberately absent — it is a *pin*, not
// a link, and PixiJS should still be pre-bundled.
const linkedIds = [...Object.keys(designKitAlias), ...Object.keys(canvasAlias)];

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		// `@invana/canvas` depends on pixi.js/pixi-viewport directly (0.0.9 — they
		// were peers before), so ensure the app only ever loads ONE PixiJS instance.
		// Two copies break the renderer's batch system (null `batcher.geometry` /
		// `textureBatch.clear`).
		dedupe: ["pixi.js", "pixi-viewport"],
		alias: {
			// `@/` is `src/`. Deep relative imports are positional — a file move
			// rewrites every neighbour that pointed at it — so cross-module imports
			// name the module (`@/features/agents`) and only same-folder imports
			// stay relative. Mirrored in `tsconfig.app.json` `paths`.
			"@": path.resolve(__dirname, "src"),
			// @invana/themes imports cn from '@invana/ui/lib/utils' which isn't a
			// published subpath export — redirect to the actual dist bundle.
			"@invana/ui/lib/utils": path.resolve(
				__dirname,
				"node_modules/@invana/ui/dist/index.js",
			),
			// Overrides the line above when a local checkout is pointed at.
			...designKitAlias,
			...canvasAlias,
			...pixiPin,
		},
	},
	optimizeDeps: {
		// Force Vite to pre-bundle @invana packages during dev for fast HMR.
		// A package pointed at a local checkout drops out of this list — Vite
		// errors if the same id is both included and excluded.
		include: [
			"@invana/ui",
			"@invana/themes",
			"@invana/canvas",
			"@invana/canvas-react",
			"@invana/graph",
			// `@invana/graph-layout-elkjs` is excluded (below) for its worker, so it's
			// served as raw ESM — but it does `import ELK from 'elkjs/lib/elk-api.js'`,
			// a default import from a CJS module. Pre-bundle that entry so Vite
			// synthesises the default export (otherwise: "Importing binding name
			// 'default' cannot be resolved by star export entries"). d3-force is ESM,
			// so its wrapper needs no such help.
			"elkjs/lib/elk-api.js",
		].filter((id) => !linkedIds.includes(id)),
		// The layout packages spawn Web Workers via
		// `new Worker(new URL("…worker.js", import.meta.url))`. Pre-bundling them
		// (esbuild) rewrites `import.meta.url` into node_modules/.vite/deps, so the
		// worker asset 404s (forceSolver.worker.js; elkjs' elk-worker). Excluding
		// them lets Vite serve them as source, where its worker plugin resolves the
		// URLs correctly.
		exclude: [
			"@invana/graph-layout-d3-force",
			"@invana/graph-layout-elkjs",
			// A linked package must not be pre-bundled, or edits to the local
			// checkout are served from a stale `.vite/deps` copy.
			...linkedIds,
		],
	},
	server: {
		port: 8300,
	},
});
