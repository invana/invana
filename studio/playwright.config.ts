import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for Studio (docs/for-developers/modules/platform/spec.md §7a).
 *
 * These run against a Studio that is already up, talking to an engine and a
 * real graph database — nothing is mocked (CLAUDE.md rule 7). Start the stack
 * with `docker compose up -d` and load a dataset before running them; `e2e/
 * README.md` has the two commands.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8300";

export default defineConfig({
	testDir: "./e2e",
	// A run drives one live engine and one graph database; parallel files would
	// race each other's sessions on the same Graph.
	workers: 1,
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	// A run always writes the HTML report `pnpm test:e2e:report` opens; the
	// live reporter is what you watch while it runs.
	reporter: [[process.env.CI ? "github" : "list"], ["html", { open: "never" }]],
	use: {
		baseURL: BASE_URL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "setup",
			testMatch: /auth\.setup\.ts/,
		},
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				storageState: "e2e/.auth/user.json",
			},
			dependencies: ["setup"],
		},
	],
});
