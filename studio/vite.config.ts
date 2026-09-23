import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

/**
 * Work against a local `design-kit` checkout instead of the published packages.
 *
 * Opt-in, and off by default — `INVANA_DESIGN_KIT=../../design-kit pnpm dev`.
 * Unset (a fresh clone, CI, every contributor who has never cloned design-kit)
 * resolves every `@invana/*` from npm exactly as before, so no local link ever
 * reaches a committed manifest (design-system.md DS3/DS10). The path is read
 * relative to this file, so it works the same on every OS.
 *
 * **It is all seven packages or none.** The kit releases in lockstep and its
 * packages are built against each other, so redirecting some and fetching the
 * rest is the one state that genuinely breaks: a local `@invana/ui` built
 * against the three-rung type ladder beside a published `@invana/styling` that
 * still aliases `text-sm` onto the base renders every kit component one step
 * too large, and nothing fails. Half a hatch is worse than no hatch, so the
 * list below is the whole manifest and the Tailwind scan moves with it.
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
//
// **A bare specifier must alias to a FILE, not a folder.** An alias is a prefix
// rewrite, not a resolver: it never consults the package's `exports`, so
// `@invana/styling` → `packages/styling/src` hands Tailwind a directory and the
// dev server 500s with `EISDIR` on the very first `@import`. The bare id gets
// the entry file, and each subpath group keeps its own folder entry above it.
const designKitAlias: Record<string, string> = designKitRoot
	? {
			"@invana/styling/themes.config": dk(
				"packages/styling/src/themes.config.ts",
			),
			"@invana/styling/themes": dk("packages/styling/src/themes"),
			"@invana/styling": dk("packages/styling/src/index.css"),
			"@invana/ui/styles.css": dk("packages/ui/dist/styles.css"),
			"@invana/ui/lib/utils": dk("packages/ui/dist/index.js"),
			"@invana/ui": dk("packages/ui/dist/index.js"),
			"@invana/themes/styles.css": dk("packages/themes/dist/styles.css"),
			"@invana/themes": dk("packages/themes/dist/index.js"),
			"@invana/forms": dk("packages/forms/dist/index.js"),
			"@invana/tables": dk("packages/tables/dist/index.js"),
			"@invana/dashboard": dk("packages/dashboard/dist/index.js"),
			"@invana/editor": dk("packages/editor/dist/index.js"),
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

// **It is every canvas package Studio depends on, or none** — the same rule as
// the kit's. A linked `@invana/canvas-react` beside an npm `@invana/canvas-ui`
// gives each its own React context, and the chrome silently stops finding the
// canvas.
//
// A string alias matches the id exactly or `id + "/"`, so `@invana/canvas` does
// not swallow `@invana/canvas-react` — but `@invana/canvas-core` *does* swallow
// `@invana/canvas-core/specs` (which `canvas-store` and `graph` import) and would
// rewrite it onto `dist/index.js/specs`. So the one subpath is listed first and
// wins, the same way the kit's are above.
const canvasAlias: Record<string, string> = canvasRoot
	? {
			"@invana/canvas": cv("packages/canvas/dist/index.js"),
			"@invana/canvas-core/specs": cv(
				"packages/canvas-core/dist/specs/index.js",
			),
			"@invana/canvas-core": cv("packages/canvas-core/dist/index.js"),
			"@invana/canvas-store": cv("packages/canvas-store/dist/index.js"),
			"@invana/canvas-react": cv("packages/canvas-react/dist/index.js"),
			"@invana/canvas-ui": cv("packages/canvas-ui/dist/index.js"),
			"@invana/graph": cv("packages/graph/dist/index.js"),
			"@invana/renderer-pixijs": cv("packages/renderer-pixijs/dist/index.js"),
			"@invana/graph-layout-d3-force": cv(
				"packages/graph-layout-d3-force/dist/index.js",
			),
			"@invana/graph-layout-elkjs": cv(
				"packages/graph-layout-elkjs/dist/index.js",
			),
			"@invana/graph-layout-d3-sankey": cv(
				"packages/graph-layout-d3-sankey/dist/index.js",
			),
			"@invana/graph-layer-d3-contour": cv(
				"packages/graph-layer-d3-contour/dist/index.js",
			),
			"@invana/graph-layer-maplibre": cv(
				"packages/graph-layer-maplibre/dist/index.js",
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

// The packages `src/index.css` hands to Tailwind as `@source`, because they ship
// utility classes in their dist JS and no CSS of their own. An alias is a module
// resolution and Tailwind's scanner never sees it, so with a hatch open those
// packages would still be scanned in `node_modules` — the npm copies — and a
// class only a locally-edited component uses would never be generated. That is
// the same silent half-state the hatches exist to avoid, one layer down: the
// page renders, mostly correctly, with a handful of rules missing.
//
// So move the scan with the alias. `pre` puts this ahead of `@tailwindcss/vite`,
// which reads the `@source` paths out of the CSS text. Paths stay relative and
// POSIX-separated so the rewrite reads the same on every OS.
const scannedLinkedPackages: Array<[pkg: string, dist: string]> = [
	...(designKitRoot
		? ["forms", "dashboard", "editor"].map((pkg): [string, string] => [
				pkg,
				dk(`packages/${pkg}/dist`),
			])
		: []),
	...(canvasRoot
		? [["canvas-ui", cv("packages/canvas-ui/dist")] as [string, string]]
		: []),
];

const linkedTailwindSources = (): Plugin | null =>
	scannedLinkedPackages.length > 0
		? {
				name: "invana:linked-tailwind-sources",
				enforce: "pre",
				transform(code, id) {
					// Vite hands CSS ids with a query (`?used`, `?direct`), so match on
					// the path alone.
					const file = id.split("?")[0];
					if (!file.endsWith("/src/index.css")) return null;
					const from = path.dirname(file);
					return scannedLinkedPackages.reduce((css, [pkg, dist]) => {
						const source = `@source "../node_modules/@invana/${pkg}/dist"`;
						// A quiet no-match is the exact failure this plugin exists to
						// prevent — the hatch would look open while Tailwind kept
						// scanning npm. If `index.css` renames a `@source`, say so here
						// rather than three wrong fixes later.
						if (!css.includes(source)) {
							throw new Error(
								`Linked checkout: no \`${source}\` in src/index.css — the Tailwind scan can no longer follow the checkout (design-system.md DS10).`,
							);
						}
						return css.replace(
							source,
							`@source "${path.relative(from, dist).split(path.sep).join("/")}"`,
						);
					}, code);
				},
			}
		: null;

// The workspace packages the two hatches redirect: filtered out of
// `optimizeDeps.include` and force-excluded, so edits are never served from a
// stale `.vite/deps` copy. `pixiPin` is deliberately absent — it is a *pin*, not
// a link, and PixiJS should still be pre-bundled.
const linkedIds = [...Object.keys(designKitAlias), ...Object.keys(canvasAlias)];

export default defineConfig({
	// `linkedTailwindSources()` is null unless a hatch is open, and Vite
	// drops a falsy plugin — so a fresh clone gets exactly the two plugins it
	// always had.
	plugins: [linkedTailwindSources(), react(), tailwindcss()],
	resolve: {
		// `@invana/canvas` depends on pixi.js/pixi-viewport directly (0.0.9 — they
		// were peers before), so ensure the app only ever loads ONE PixiJS instance.
		// Two copies break the renderer's batch system (null `batcher.geometry` /
		// `textureBatch.clear`).
		// React is here for the two local-checkout hatches below: a linked
		// `design-kit` or `canvas` resolves `react` from **its own**
		// `node_modules`, and two React copies mean every kit component throws
		// "Invalid hook call" the moment it uses a hook. Without a hatch it is a
		// no-op — Studio has exactly one copy either way.
		//
		// The kit packages are here for the same reason, one repo down: a linked
		// canvas checkout carries its *own* (older) kit under `canvas/node_modules`,
		// so `canvas-ui`'s `import "@invana/forms"` would otherwise resolve there —
		// and the optimizer pre-bundles whichever copy it meets first as *the*
		// `@invana/forms`, so every Studio import loses what the newer kit added
		// ("does not provide an export named 'ParamRow'"). They are canvas-ui's
		// peers: there is meant to be exactly one, and it is Studio's.
		dedupe: [
			"react",
			"react-dom",
			"pixi.js",
			"pixi-viewport",
			"@invana/styling",
			"@invana/ui",
			"@invana/themes",
			"@invana/forms",
			"@invana/tables",
			"@invana/dashboard",
			"@invana/editor",
		],
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
