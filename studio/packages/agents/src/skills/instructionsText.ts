/**
 * What the skill page reads off `instructions.md` as it is on screen.
 *
 * The plan names each step's `source_span` and each handler's `span` verbatim;
 * the page draws them against the text by line number, so a reader sees which
 * line became which step. A span that no longer reads in the text has no line.
 * Adding a function writes a step line under `## Steps`, so the need lives in
 * the prose and the next draw maps it.
 */

/** The four headings a new skill opens with, under its name. */
export function newSkillContent(name: string): string {
	return `# ${name}\n\n## Goal\n\n\n## Arguments\n\n\n## Steps\n\n\n## When things go wrong\n`;
}

/** A line with its list marker stripped — `- `, `* `, `1. `. */
function bare(line: string): string {
	return line
		.trim()
		.replace(/^([-*+]|\d+[.)])\s+/, "")
		.trim();
}

/**
 * The 1-based line `span` reads on, or null when it no longer appears.
 *
 * A span matches a line that contains it, or a line whose words (without the
 * list marker) it contains — a sentence the planner trimmed still finds its line.
 */
export function lineOf(text: string, span: string | null): number | null {
	const want = (span ?? "").trim();
	if (!want) return null;
	const lines = text.split("\n");
	const exact = lines.findIndex((l) => l.includes(want));
	if (exact >= 0) return exact + 1;
	const loose = lines.findIndex((l) => {
		const b = bare(l);
		return b.length > 0 && !b.startsWith("#") && want.includes(b);
	});
	return loose >= 0 ? loose + 1 : null;
}

/**
 * The text with one step line per function appended at the end of
 * `## Steps` — before the next heading — or a new `## Steps` section when
 * there is none. A function the text already names is not added twice.
 */
export function addFunctionLines(text: string, functions: string[]): string {
	const fresh = functions.filter((f) => !text.includes(f));
	if (fresh.length === 0) return text;
	const added = fresh.map((f) => `- Use ${f} to …`);
	const lines = text.split("\n");
	const start = lines.findIndex((l) => /^##\s+Steps\s*$/i.test(l.trim()));
	if (start < 0) {
		const base = text.endsWith("\n") || text === "" ? text : `${text}\n`;
		return `${base}\n## Steps\n${added.join("\n")}\n`;
	}
	let end = lines.findIndex((l, i) => i > start && /^#{1,6}\s/.test(l.trim()));
	if (end < 0) end = lines.length;
	// Land after the section's last written line, not after its blank tail.
	let at = end;
	while (at > start + 1 && lines[at - 1].trim() === "") at--;
	lines.splice(at, 0, ...added);
	return lines.join("\n");
}

/** `text` with line `n` (1-based) replaced. */
export function replaceLine(text: string, n: number, next: string): string {
	const lines = text.split("\n");
	if (n < 1 || n > lines.length) return text;
	lines[n - 1] = next;
	return lines.join("\n");
}
