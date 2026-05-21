import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			// @invana/themes imports cn from '@invana/ui/lib/utils' which isn't a
			// published subpath export — redirect to the actual dist bundle.
			"@invana/ui/lib/utils": path.resolve(
				__dirname,
				"node_modules/@invana/ui/dist/index.js",
			),
			// Canvas engine packages aren't published — pulled from a sibling
			// checkout at ../../canvas. Their package.json `main` fields point
			// at non-existent `./src/index.js`; redirect to the built dist
			// bundles. Expect breaking changes — keep these in lock-step with
			// whichever branch `../../canvas` is on, and run `pnpm build` over
			// there after pulling.
			"@invana/canvas-react": path.resolve(
				__dirname,
				"../../canvas/packages/canvas-react/dist/index.js",
			),
			"@invana/canvas": path.resolve(
				__dirname,
				"../../canvas/packages/canvas/dist/index.js",
			),
			"@invana/graph": path.resolve(
				__dirname,
				"../../canvas/packages/graph/dist/index.js",
			),
			"@invana/graph-layout-d3-force": path.resolve(
				__dirname,
				"../../canvas/packages/graph-layout-d3-force/dist/index.js",
			),
		},
	},
	optimizeDeps: {
		// Force Vite to pre-bundle @invana packages during dev for fast HMR.
		// Canvas packages are intentionally NOT pre-bundled — they're aliased
		// to a sibling checkout's `dist/`, and pre-bundling would cache stale
		// copies when that checkout rebuilds.
		include: ["@invana/ui", "@invana/themes"],
	},
	server: {
		port: 8300,
	},
});
