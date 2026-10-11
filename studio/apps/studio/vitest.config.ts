import path from "node:path";
import { defineProject } from "vitest/config";

/**
 * The app's unit-test project: every `*.test.ts` / `*.test.tsx` under src, in
 * Node. Kept apart from vite.config.ts so a test run needs neither the dev
 * server's plugins nor the local design-kit and canvas links. End-to-end specs
 * run under Playwright. The workspace's vitest.config.ts runs it beside every
 * package and owns the one coverage report.
 *
 * A logic module may reach another module's barrel, and through it the kit, so
 * the `@invana/*` packages are transformed rather than loaded by Node (the
 * styling package ships TypeScript source), and `@invana/ui/lib/utils` is
 * redirected as in vite.config.ts — both point at `node_modules`, never at a
 * local checkout.
 */
export default defineProject({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
			"@invana/ui/lib/utils": path.resolve(
				__dirname,
				"node_modules/@invana/ui/dist/index.js",
			),
		},
	},
	test: {
		name: "studio",
		include: ["src/**/*.test.{ts,tsx}"],
		environment: "node",
		server: { deps: { inline: [/@invana\//] } },
	},
});
