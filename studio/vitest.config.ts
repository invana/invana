import { defineConfig } from "vitest/config";

/**
 * The workspace's unit tests: one run over the app and every package, each a
 * Vitest project with its own config, and one coverage report.
 *
 * Coverage is gated at 80% over Studio's logic: the modules that decide
 * something. Screens, hooks and the API client are I/O and are covered by the
 * e2e specs instead.
 */
export default defineConfig({
	test: {
		projects: ["apps/*/vitest.config.ts", "packages/*/vitest.config.ts"],
		coverage: {
			include: [
				"packages/core/src/lib/**/*.ts",
				"packages/core/src/stores/**/*.ts",
				"packages/core/src/services/telemetry/*.ts",
				"packages/assistant/src/answer-surface/emissions.ts",
				"packages/shell/src/activity/events/eventSearch.ts",
				"packages/shell/src/activity/runs/runSummary.ts",
				"packages/shell/src/activity/runs/boards/taskFlowFromRun.ts",
				"apps/studio/src/pages/graphs-detail/features/agents/agentDraft.ts",
				"apps/studio/src/pages/graphs-detail/features/boards/boardKinds.ts",
				"apps/studio/src/pages/graphs-detail/features/explorer/canvasItems.ts",
				"apps/studio/src/pages/graphs-detail/features/lenses/addressing.ts",
				"apps/studio/src/pages/graphs-detail/features/plans/taskFlowFromTaskPlan.ts",
				"apps/studio/src/pages/graphs-detail/features/skills/taskFlowFromPlan.ts",
			],
			// The OpenTelemetry SDK boot — browser wiring with no decision in it.
			exclude: [
				"**/*.test.{ts,tsx}",
				"packages/core/src/services/telemetry/setup.ts",
			],
			thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
		},
	},
});
