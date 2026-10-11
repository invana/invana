import { defineProject } from "vitest/config";

/**
 * The assistant's unit-test project: every `*.test.ts` / `*.test.tsx` under
 * src, in Node. The workspace's vitest.config.ts runs it and owns the coverage
 * report.
 */
export default defineProject({
	test: {
		name: "assistant",
		include: ["src/**/*.test.{ts,tsx}"],
		environment: "node",
	},
});
