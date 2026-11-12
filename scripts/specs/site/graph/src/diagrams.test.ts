// @vitest-environment jsdom
// mermaid sanitises labels with DOMPurify, which needs a DOM even to parse.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import mermaid from "mermaid";
import { describe, expect, it } from "vitest";

/**
 * Every mermaid diagram in `specs/` parses with mermaid 11 — the major the site loads (Material pulls
 * `mermaid@11` from unpkg). A diagram that fails shows an error box on its page while `mkdocs build` and the
 * parser stay green, so this test is the only gate that catches it. `specs/_stale/` is left out, as the site
 * leaves it out. `SPECS_DIR` points it at another tree (a fixture, a branch's checkout).
 */
const SPECS = resolve(
	process.env.SPECS_DIR ?? resolve(import.meta.dirname, "../../../../../specs"),
);
const FENCE = /^```mermaid[^\n]*\n([\s\S]*?)^```/gm;

/** Every `.md` under `dir`, skipping `_stale/`, sorted so the report is stable. */
function markdown(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true })
		.flatMap((e) => {
			const path = join(dir, e.name);
			if (e.isDirectory()) return e.name === "_stale" ? [] : markdown(path);
			return e.name.endsWith(".md") ? [path] : [];
		})
		.sort();
}

/** Each mermaid block of a page, with the line its fence opens on. */
function diagrams(text: string): { line: number; source: string }[] {
	return [...text.matchAll(FENCE)].map((m) => ({
		line: text.slice(0, m.index).split("\n").length,
		source: m[1],
	}));
}

/** The parse error of one diagram — where, and what the parser expected — or `null` when it parses. */
async function parseError(source: string): Promise<string | null> {
	try {
		await mermaid.parse(source);
		return null;
	} catch (e) {
		const lines = (e instanceof Error ? e.message : String(e)).split("\n");
		return [...new Set([lines[0], lines.at(-1)])].join(" ");
	}
}

describe("mermaid diagrams in specs/", () => {
	it("refuses a broken diagram and accepts a sound one", async () => {
		expect(await parseError("flowchart LR\n  a --> b")).toBeNull();
		expect(
			await parseError('flowchart LR\n  a["x"] --> b("y"]'),
		).not.toBeNull();
		expect(
			await parseError("sequenceDiagram\n  A->>B: hi\n  end"),
		).not.toBeNull();
	});

	it("finds each fenced diagram with its line", () => {
		const page = "# T\n\n```mermaid\nflowchart LR\n  a --> b\n```\n\ntext\n";
		expect(diagrams(page)).toEqual([
			{ line: 3, source: "flowchart LR\n  a --> b\n" },
		]);
	});

	it("every diagram parses", async () => {
		const failures: string[] = [];
		let count = 0;
		for (const file of markdown(SPECS)) {
			for (const d of diagrams(readFileSync(file, "utf-8"))) {
				count++;
				const error = await parseError(d.source);
				if (error)
					failures.push(`specs/${relative(SPECS, file)}:${d.line} — ${error}`);
			}
		}
		expect(count).toBeGreaterThan(0);
		expect(failures).toEqual([]);
	}, 60_000);
});
