import { defineProject } from "vitest/config";

/**
 * Explorer's unit-test project: every `*.test.ts` / `*.test.tsx` under src, in
 * Node. The workspace's vitest.config.ts runs it and owns the coverage report.
 */
export default defineProject({
	test: {
		name: "explorer",
		include: ["src/**/*.test.{ts,tsx}"],
		environment: "node",
	},
});
