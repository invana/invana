import { defineConfig } from "@playwright/test";

/** End-to-end specs over the built site: `pnpm build`, build the site, then `pnpm test:e2e`. */
const PORT = 8792;

export default defineConfig({
	testDir: "e2e",
	timeout: 60_000,
	use: {
		baseURL: `http://127.0.0.1:${PORT}/`,
		viewport: { width: 1600, height: 1000 },
	},
	webServer: {
		command: `node e2e/serve.mjs ${PORT}`,
		url: `http://127.0.0.1:${PORT}/graph/`,
		reuseExistingServer: true,
	},
});
