/**
 * Fails when Studio exports a component under a name the kit already exports.
 *
 * `@invana/ui` and `@invana/canvas-ui` are Studio's only component layers, so a
 * Studio component that shares a kit component's name is either a copy of it or
 * a second thing a reader will mistake for it. Either way the fix is the same:
 * use the kit's, or name Studio's for what it holds.
 *
 * Reads each package's published `dist/index.d.ts` for its export names, then
 * every `export function|const|class <Capitalised>` in Studio's `.tsx` files:
 * the app's `src/` and, in the workspace, each `packages/<name>/src/` and
 * `apps/<name>/src/` that exists. The kit is resolved from Studio's root
 * `node_modules` first, then from each workspace package's. A package that is
 * not built (no `dist/`) is skipped with a note rather than failed, so a fresh
 * checkout can still lint. Reported paths and `ALLOWED` keys are relative to
 * the Studio root.
 *
 * Run: `node scripts/check-kit-overlap.mjs` (part of `pnpm lint`).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_DIRS = ["packages", "apps"];
const KIT_PACKAGES = ["ui", "canvas-ui"];

// `file:Name` pairs that share a kit name on purpose, with the reason.
const ALLOWED = {};

// Studio's root, then each `packages/<name>` and `apps/<name>` that exists.
function workspaceRoots() {
	const roots = [STUDIO];
	for (const dir of WORKSPACE_DIRS) {
		const base = path.join(STUDIO, dir);
		if (!fs.existsSync(base)) continue;
		for (const e of fs.readdirSync(base, { withFileTypes: true })) {
			if (e.isDirectory()) roots.push(path.join(base, e.name));
		}
	}
	return roots;
}

function kitNames(roots) {
	const names = new Map();
	for (const pkg of KIT_PACKAGES) {
		const file = roots
			.map((root) =>
				path.join(root, "node_modules", "@invana", pkg, "dist", "index.d.ts"),
			)
			.find((f) => fs.existsSync(f));
		if (!file) {
			console.warn(`check-kit-overlap: @invana/${pkg} is not built; skipped`);
			continue;
		}
		const sf = ts.createSourceFile(
			file,
			fs.readFileSync(file, "utf8"),
			ts.ScriptTarget.Latest,
			true,
		);
		for (const st of sf.statements) {
			if (
				ts.isExportDeclaration(st) &&
				st.exportClause &&
				ts.isNamedExports(st.exportClause)
			) {
				for (const el of st.exportClause.elements) names.set(el.name.text, pkg);
			}
		}
	}
	return names;
}

function studioComponents(root) {
	const out = [];
	for (const e of fs.readdirSync(root, { withFileTypes: true })) {
		const p = path.join(root, e.name);
		if (e.isDirectory()) out.push(...studioComponents(p));
		else if (e.name.endsWith(".tsx")) {
			const text = fs.readFileSync(p, "utf8");
			for (const m of text.matchAll(
				/^export (?:function|const|class) ([A-Z]\w*)/gm,
			)) {
				out.push({
					file: path.relative(STUDIO, p).split(path.sep).join("/"),
					name: m[1],
				});
			}
		}
	}
	return out;
}

const roots = workspaceRoots();
const kit = kitNames(roots);
const errors = roots
	.map((root) => path.join(root, "src"))
	.filter((src) => fs.existsSync(src))
	.flatMap((src) => studioComponents(src))
	.filter(({ file, name }) => kit.has(name) && !(`${file}:${name}` in ALLOWED))
	.map(
		({ file, name }) =>
			`${file}: ${name} shadows @invana/${kit.get(name)}'s ${name}`,
	);

if (errors.length) {
	console.error(
		`check-kit-overlap: ${errors.length} problem(s)\n  ${errors.join("\n  ")}`,
	);
	process.exit(1);
}
console.log(
	`check-kit-overlap: no Studio component shares a name with the kit's ${kit.size} exports`,
);
