import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Unit tests only: every `*.test.ts` / `*.test.tsx` under src, in Node. Kept apart from
 * vite.config.ts so a test run needs neither the dev server's plugins nor the
 * local design-kit and canvas links. End-to-end specs run under Playwright.
 *
 * Coverage is gated at 80% over Studio's logic: the modules that decide
 * something. Screens, hooks and the API client are I/O and are covered by the
 * e2e specs instead.
 *
 * A logic module may reach another module's barrel, and through it the kit, so
 * the `@invana/*` packages are transformed rather than loaded by Node (the
 * styling package ships TypeScript source), and `@invana/ui/lib/utils` is
 * redirected as in vite.config.ts — both point at `node_modules`, never at a
 * local checkout.
 */
export default defineConfig({
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
		include: ["src/**/*.test.{ts,tsx}"],
		environment: "node",
		server: { deps: { inline: [/@invana\//] } },
		coverage: {
			include: [
				"src/lib/**/*.ts",
				"src/stores/**/*.ts",
				"src/canvases/taskflow/taskFlowFromPlan.ts",
				"src/services/telemetry/*.ts",
				"src/pages/graphs-detail/features/agents/agentDraft.ts",
				"src/pages/graphs-detail/features/assistant/answer-surface/emissions.ts",
				"src/pages/graphs-detail/features/boards/boardKinds.ts",
				"src/pages/graphs-detail/features/events/eventSearch.ts",
				"src/pages/graphs-detail/features/explorer/canvasItems.ts",
				"src/pages/graphs-detail/features/lenses/addressing.ts",
				"src/pages/graphs-detail/features/plans/taskFlowFromTaskPlan.ts",
				"src/pages/graphs-detail/features/runs/runSummary.ts",
				"src/pages/graphs-detail/features/runs/boards/taskFlowFromRun.ts",
			],
			// The OpenTelemetry SDK boot — browser wiring with no decision in it.
			exclude: ["src/**/*.test.{ts,tsx}", "src/services/telemetry/setup.ts"],
			thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
		},
	},
});
