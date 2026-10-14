import { defineProject } from "vitest/config";

/**
 * Core's unit-test project: every `*.test.ts` under src, in Node. The
 * workspace's vitest.config.ts runs it and owns the coverage report.
 */
export default defineProject({
	test: {
		name: "core",
		include: ["src/**/*.test.ts"],
		environment: "node",
	},
});
