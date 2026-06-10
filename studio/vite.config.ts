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
			"@invana/graph-layout-d3-force",
		],
	},
	server: {
		port: 8300,
	},
});
