import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Unit tests only: every `*.test.ts` / `*.test.tsx` under src, in Node. Kept apart from
 * vite.config.ts so a test run needs neither the dev server's plugins nor the
 * local design-kit and canvas links. End-to-end specs run under Playwright.
 */
export default defineConfig({
	resolve: { alias: { "@": path.resolve(__dirname, "src") } },
	test: {
		include: ["src/**/*.test.{ts,tsx}"],
		environment: "node",
		// Measured over all of src, not only the files a test happens to load.
		coverage: {
			include: ["src/**/*.{ts,tsx}"],
			exclude: ["src/**/*.test.{ts,tsx}"],
		},
	},
});
