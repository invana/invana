/**
 * Keeps Studio's names on the module map, so the structure cannot drift again.
 *
 * Three checks over `src/`, each failing with the file and the name:
 *
 * 1. **Modules** — every `pages/graphs-detail/features/<m>/` is a module in `MODULES`,
 *    and the engine folder it maps to exists under `engine/src/invana/server/`.
 *    Every engine `server/<m>/` is claimed by a module or listed in `ENGINE_ONLY`.
 * 2. **Suffixes** — a `.tsx` under `features/` never ends in `Drawer`, `StackPanel`,
 *    `DashboardPage`, or a bare `Panel` (a region occupant is `*ViewPanel`).
 * 3. **Retired words** — no identifier contains one. Identifiers are read with the
 *    TypeScript parser, so strings, JSX text and comments (URL values, storage keys,
 *    test ids, UI copy) are never flagged.
 *
 * Every exception is a line in an allow-list below, with its reason.
 *
 * Run: `node scripts/check-names.mjs` (part of `pnpm lint`).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(STUDIO, "src");
const FEATURES = path.join(SRC, "pages", "graphs-detail", "features");
const ENGINE_SERVER = path.join(
	STUDIO,
	"..",
	"engine",
	"src",
	"invana",
	"server",
);

// Studio module → the engine `server/` folder that serves it. The target name is the
// module's own; a different spelling here is an engine folder not yet renamed.
const MODULES = {
	agents: "agents",
	assistant: "sessions",
	boards: "boards",
	events: "events",
	explorer: "explorer",
	graphs: "graphs",
	lenses: "govern",
	llms: "llm_providers",
	models: "modeller",
	plans: "task_plans",
	projections: "runtime",
	projects: "work",
	rules: "rules",
	runs: "runtime",
	setup: "graphs", // no routes of its own
	skills: "skills",
};

// Engine `server/` folders that are not a Studio module.
const ENGINE_ONLY = {
	admin: "platform operations, no Graph page",
	auth: "accounts, served outside the Graph page",
	routes: "shared route helpers",
	__pycache__: "bytecode",
};

const RETIRED_SUFFIX = /(Drawer|StackPanel|DashboardPage|(?<!View)Panel)\.tsx$/;
const SUFFIX_ALLOWED = {
	"explorer/LayersPanel.tsx":
		"replaced by canvas-ui LayersViewPanel in phase K",
	"explorer/StylingPanel.tsx":
		"replaced by canvas-ui StylingViewPanel in phase K",
};

const RETIRED_WORDS =
	/drawer|StackPanel|DashboardPage|journal|thinking|railItem/i;
// `file:identifier` pairs that keep a retired word, with the reason.
const WORD_ALLOWED = {};

const errors = [];

function checkModules() {
	// A Studio-only checkout (the studio image) has no engine to compare against.
	const engine = fs.existsSync(ENGINE_SERVER);
	const studio = dirs(FEATURES);
	for (const m of studio) {
		if (!(m in MODULES)) {
			errors.push(`features/${m}/ is not a module in MODULES`);
		} else if (engine && !fs.existsSync(path.join(ENGINE_SERVER, MODULES[m]))) {
			errors.push(
				`features/${m}/ maps to engine server/${MODULES[m]}/, which does not exist`,
			);
		}
	}
	for (const m of Object.keys(MODULES)) {
		if (!studio.includes(m))
			errors.push(`MODULES names ${m}, but features/${m}/ does not exist`);
	}
	if (!engine) return;
	const claimed = new Set(Object.values(MODULES));
	for (const e of dirs(ENGINE_SERVER)) {
		if (!claimed.has(e) && !(e in ENGINE_ONLY)) {
			errors.push(
				`engine server/${e}/ has no Studio module and is not in ENGINE_ONLY`,
			);
		}
	}
}

function checkSuffixes() {
	for (const f of files(FEATURES, /\.tsx$/)) {
		const rel = path.relative(FEATURES, f).split(path.sep).join("/");
		if (RETIRED_SUFFIX.test(rel) && !(rel in SUFFIX_ALLOWED)) {
			errors.push(
				`features/${rel}: retired suffix (Drawer · StackPanel · DashboardPage · bare Panel)`,
			);
		}
	}
}

function checkWords() {
	for (const f of files(SRC, /\.tsx?$/)) {
		const rel = path.relative(SRC, f).split(path.sep).join("/");
		const sf = ts.createSourceFile(
			f,
			fs.readFileSync(f, "utf8"),
			ts.ScriptTarget.Latest,
			true,
			f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
		);
		const seen = new Set();
		const visit = (node) => {
			if (
				ts.isIdentifier(node) &&
				RETIRED_WORDS.test(node.text) &&
				!seen.has(node.text)
			) {
				seen.add(node.text);
				if (!(`${rel}:${node.text}` in WORD_ALLOWED)) {
					const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
					errors.push(
						`${rel}:${line + 1}: identifier ${node.text} carries a retired word`,
					);
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(sf);
	}
}

function dirs(root) {
	return fs
		.readdirSync(root, { withFileTypes: true })
		.filter((e) => e.isDirectory())
		.map((e) => e.name);
}

function files(root, pattern) {
	const out = [];
	for (const e of fs.readdirSync(root, { withFileTypes: true })) {
		const p = path.join(root, e.name);
		if (e.isDirectory()) out.push(...files(p, pattern));
		else if (pattern.test(e.name)) out.push(p);
	}
	return out;
}

checkModules();
checkSuffixes();
checkWords();

if (errors.length) {
	console.error(
		`check-names: ${errors.length} problem(s)\n  ${errors.join("\n  ")}`,
	);
	process.exit(1);
}
console.log(
	"check-names: modules, suffixes and identifiers follow the module map",
);
