import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Unit tests only: every `*.test.ts` / `*.test.tsx` under src, in Node. Kept apart from
 * vite.config.ts so a test run needs neither the dev server's plugins nor the
 * local design-kit and canvas links. End-to-end specs run under Playwright.
 *
 * Coverage is gated at 80% over Studio's logic: the modules that decide
 * something and load without the kit. Screens, hooks and the API client are
 * I/O and are covered by the e2e specs instead. A module that cannot load
 * under Node — one that reaches a component barrel — stays out until it can.
 */
export default defineConfig({
	resolve: { alias: { "@": path.resolve(__dirname, "src") } },
	test: {
		include: ["src/**/*.test.{ts,tsx}"],
		environment: "node",
		coverage: {
			include: [
				"src/lib/**/*.ts",
				"src/stores/appearance.store.ts",
				"src/stores/auth.store.ts",
				"src/services/telemetry/*.ts",
				"src/pages/graphs-detail/features/agents/agentDraft.ts",
				"src/pages/graphs-detail/features/assistant/answer-surface/emissions.ts",
				"src/pages/graphs-detail/features/boards/boardKinds.ts",
				"src/pages/graphs-detail/features/events/eventSearch.ts",
				"src/pages/graphs-detail/features/explorer/canvasItems.ts",
				"src/pages/graphs-detail/features/explorer/stylingPatch.ts",
				"src/pages/graphs-detail/features/lenses/addressing.ts",
			],
			// The OpenTelemetry SDK boot — browser wiring with no decision in it.
			exclude: ["src/**/*.test.{ts,tsx}", "src/services/telemetry/setup.ts"],
			thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
		},
	},
});
