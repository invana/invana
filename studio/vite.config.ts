import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		// `@invana/canvas` depends on pixi.js/pixi-viewport directly (0.0.9 — they
		// were peers before), so ensure the app only ever loads ONE PixiJS instance.
		// Two copies break the renderer's batch system (null `batcher.geometry` /
		// `textureBatch.clear`).
		dedupe: ["pixi.js", "pixi-viewport"],
		alias: {
			// @invana/themes imports cn from '@invana/ui/lib/utils' which isn't a
			// published subpath export — redirect to the actual dist bundle.
			"@invana/ui/lib/utils": path.resolve(
				__dirname,
				"node_modules/@invana/ui/dist/index.js",
			),
		},
	},
	optimizeDeps: {
		// Force Vite to pre-bundle @invana packages during dev for fast HMR.
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
		],
		// The layout packages spawn Web Workers via
		// `new Worker(new URL("…worker.js", import.meta.url))`. Pre-bundling them
		// (esbuild) rewrites `import.meta.url` into node_modules/.vite/deps, so the
		// worker asset 404s (forceSolver.worker.js; elkjs' elk-worker). Excluding
		// them lets Vite serve them as source, where its worker plugin resolves the
		// URLs correctly.
		exclude: ["@invana/graph-layout-d3-force", "@invana/graph-layout-elkjs"],
	},
	server: {
		port: 8300,
	},
});
