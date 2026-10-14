import path from "node:path";
import { defineProject } from "vitest/config";

/**
 * The shell's unit-test project: every `*.test.ts` / `*.test.tsx` under src,
 * in Node. The workspace's vitest.config.ts runs it and owns the coverage
 * report.
 *
 * A run's flow reaches `@invana-studio/canvases`, and through it the kit, so
 * the `@invana/*` packages are transformed rather than loaded by Node (the
 * styling package ships TypeScript source), and `@invana/ui/lib/utils` is
 * redirected as in the app's vite.config.ts.
 */
export default defineProject({
	resolve: {
		alias: {
			"@invana/ui/lib/utils": path.resolve(
				__dirname,
				"node_modules/@invana/ui/dist/index.js",
			),
		},
	},
	test: {
		name: "shell",
		include: ["src/**/*.test.{ts,tsx}"],
		environment: "node",
		server: { deps: { inline: [/@invana\//] } },
	},
});
