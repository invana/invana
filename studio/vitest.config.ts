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
				"packages/datasets/src/imports/journal.ts",
				"packages/modeller/src/govern/addressing.ts",
				"packages/shell/src/activity/events/eventSearch.ts",
				"packages/shell/src/activity/inbox/inbox.ts",
				"packages/shell/src/palette/rank.ts",
				"packages/shell/src/activity/runs/runSummary.ts",
				"packages/shell/src/activity/runs/boards/taskFlowFromRun.ts",
				"packages/agents/src/agents/agentDraft.ts",
				"packages/agents/src/plans/taskFlowFromTaskPlan.ts",
				"packages/agents/src/skills/taskFlowFromPlan.ts",
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
