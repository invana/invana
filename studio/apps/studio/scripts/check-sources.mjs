/**
 * Fails when an `@source` in Studio's stylesheet matches no files.
 *
 * Tailwind generates a utility only when it finds the class in a scanned file,
 * so an `@source` glob that matches nothing drops every class only those files
 * use — silently, in `vite dev` and `vite build` alike. A pattern such as
 * `packages/*\/src` looks right and matches nothing; a bare directory works.
 *
 * Reads every `@source "<path>"` in `src/index.css` (not `@source inline(…)`,
 * not `@source not`), runs Tailwind's own scanner (`@tailwindcss/oxide`, the
 * one `@tailwindcss/vite` uses) on each, and fails with the pattern that came
 * back empty. A `node_modules/…/dist` source whose package is not installed
 * fails too: it is the same silent loss.
 *
 * Run: `node scripts/check-sources.mjs` from `apps/studio/` (part of `pnpm lint`).
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = path.join(STUDIO, "src", "index.css");

// The scanner the Vite plugin loads, so the check agrees with the build.
const require = createRequire(path.join(STUDIO, "package.json"));
const { Scanner } = createRequire(require.resolve("@tailwindcss/vite"))(
	"@tailwindcss/oxide",
);

const css = fs.readFileSync(CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const patterns = [...css.matchAll(/@source\s+"([^"]+)"\s*;/g)].map((m) => m[1]);

const base = path.dirname(CSS);
const empty = patterns.filter((pattern) => {
	const scanner = new Scanner({ sources: [{ base, pattern, negated: false }] });
	scanner.scan();
	return scanner.files.length === 0;
});

if (empty.length > 0) {
	for (const pattern of empty) {
		console.error(`src/index.css: @source "${pattern}" matches no files`);
	}
	process.exit(1);
}
console.log(
	`check-sources: ${patterns.length} @source paths, each matches files`,
);
