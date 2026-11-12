/// <reference types="vitest/config" />
import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/** The repo root, where `check.py --graph` writes `specs-graph.json`. */
const REPO_ROOT = path.resolve(__dirname, "../../../..");

/**
 * Under `pnpm dev`, serve the repo root's `specs-graph.json` (run `python3 scripts/specs/check.py --graph` first).
 * The built app never needs this: the site's build hook writes the parse beside it.
 */
const devGraph = (): Plugin => ({
	name: "spec-graph:dev-data",
	apply: "serve",
	configureServer(server) {
		server.middlewares.use("/specs-graph.json", (_req, res) => {
			const file = path.join(REPO_ROOT, "specs-graph.json");
			if (!fs.existsSync(file)) {
				res.statusCode = 404;
				res.end("Run python3 scripts/specs/check.py --graph first");
				return;
			}
			res.setHeader("Content-Type", "application/json");
			res.end(fs.readFileSync(file));
		});
	},
});

export default defineConfig({
	// Relative, so the build works wherever the site puts it (`<site>/graph/app/`).
	base: "./",
	plugins: [react(), tailwindcss(), devGraph()],
	resolve: {
		// One React, one PixiJS, one copy of each kit package — two break hooks and the renderer.
		dedupe: [
			"react",
			"react-dom",
			"pixi.js",
			"pixi-viewport",
			"@invana/canvas",
			"@invana/canvas-react",
			"@invana/canvas-ui",
			"@invana/graph",
			"@invana/ui",
			"@invana/themes",
			"@invana/forms",
			"react-hook-form",
		],
		alias: {
			// @invana/themes imports `@invana/ui/lib/utils`, which @invana/ui does not export.
			"@invana/ui/lib/utils": path.resolve(
				__dirname,
				"node_modules/@invana/ui/dist/index.js",
			),
		},
	},
	optimizeDeps: {
		// elkjs' API entry is CommonJS; pre-bundle it so its default import resolves.
		include: ["elkjs/lib/elk-api.js"],
		// The layouts start Web Workers from `new URL(…, import.meta.url)`; pre-bundling breaks those URLs.
		exclude: ["@invana/graph-layout-d3-force", "@invana/graph-layout-elkjs"],
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
		chunkSizeWarningLimit: 6000,
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
