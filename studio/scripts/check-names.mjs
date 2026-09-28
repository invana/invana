/**
 * Keeps Studio's names on the module map, so the structure cannot drift again.
 *
 * Six checks over `src/`, each failing with the file and the name:
 *
 * 1. **Modules** — every `pages/graphs-detail/features/<m>/` is a module in `MODULES`,
 *    and the engine folder it maps to exists under `engine/src/invana/server/`.
 *    Every engine `server/<m>/` is claimed by a module or listed in `ENGINE_ONLY`.
 * 2. **Suffixes** — a `.tsx` under `features/` never ends in `Drawer`, `StackPanel`,
 *    `DashboardPage`, or a bare `Panel` (a region occupant is `*ViewPanel`).
 * 3. **Retired words** — no identifier contains one. Identifiers are read with the
 *    TypeScript parser, so strings, JSX text and comments (URL values, storage keys,
 *    test ids, UI copy) are never flagged.
 * 4. **Decision ids** — no comment cites one (`G41`, `SR72`, `(AD2)`). A comment
 *    says what the code does and why; the decision lives in its feature file, and
 *    a doc link names the file. Code spans in a comment (`EU · H1 2026`) are
 *    skipped, since they quote copy rather than cite a decision.
 * 5. **Tokens only** — no `hsl(` or `#rrggbb` in a string or a stylesheet, no
 *    Tailwind palette class (`text-emerald-600`), no arbitrary `text-[Npx]` size.
 *    Colour comes from `@invana/styling` tokens and size from the type ladder.
 *    Strings are read with the TypeScript parser, so comments are never flagged.
 * 6. **No PixiJS** — nothing in `src/` imports `pixi.js` or `@pixi/*`; graphs
 *    are drawn through `@invana/canvas`.
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

// Every prefix a feature file or module spec numbers its decisions with.
const DECISION_PREFIXES =
	"G SR MP SK B ST AG GV LB SU RU PM GR C GM WO AD AS PT ME W D GC CD BN CA CV TF LC EB R US SD SO A DS SP J CC RT T IW SS UC K P F BD CM SM SW AC OB DP AA LD ID L S O PL";
const DECISION_ID = new RegExp(
	`(?<![\\w.\`-])(?:${DECISION_PREFIXES.split(" ").join("|")})[0-9]{1,3}[a-z]?(?![\\w-])`,
);

const COLOUR_LITERAL = /hsl\(|#[0-9a-fA-F]{6}\b/;
const PALETTE_CLASS =
	/\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|decoration|shadow|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?\b/;
const PX_TEXT = /\btext-\[\d+(?:\.\d+)?px\]/;
// Files whose colour strings are not styling, with the reason.
const TOKEN_ALLOWED = {
	"components/SaturationBridge.tsx":
		"rebuilds hsl() from the theme's own triplets at runtime",
	"pages/graphs-detail/features/explorer/StylingPanel.tsx":
		"a colour input's default is the hex value a user edits, not a style",
};
const PIXI = /^(?:pixi\.js|@pixi\/)/;

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

function checkDecisionIds() {
	for (const f of files(SRC, /\.tsx?$/)) {
		const rel = path.relative(SRC, f).split(path.sep).join("/");
		const text = fs.readFileSync(f, "utf8");
		const sf = ts.createSourceFile(
			f,
			text,
			ts.ScriptTarget.Latest,
			true,
			f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
		);
		const comments = new Map();
		const visit = (node) => {
			if (node.kind !== ts.SyntaxKind.JsxText) {
				for (const r of ts.getLeadingCommentRanges(text, node.pos) ?? [])
					comments.set(r.pos, r.end);
				for (const r of ts.getTrailingCommentRanges(text, node.end) ?? [])
					comments.set(r.pos, r.end);
			}
			for (const c of node.getChildren(sf)) visit(c);
		};
		visit(sf);
		for (const [pos, end] of comments) {
			const body = text.slice(pos, end).replace(/`[^`\n]*`/g, "");
			const m = DECISION_ID.exec(body);
			if (m) {
				const { line } = sf.getLineAndCharacterOfPosition(pos);
				errors.push(`${rel}:${line + 1}: comment cites decision id ${m[0]}`);
			}
		}
	}
}

function checkTokensAndPixi() {
	for (const f of files(SRC, /\.(tsx?|css)$/)) {
		const rel = path.relative(SRC, f).split(path.sep).join("/");
		const text = fs.readFileSync(f, "utf8");
		if (f.endsWith(".css")) {
			const css = text.replace(/\/\*[\s\S]*?\*\//g, "");
			const m = COLOUR_LITERAL.exec(css);
			if (m) errors.push(`${rel}: colour literal ${m[0]} — use a token`);
			continue;
		}
		const sf = ts.createSourceFile(
			f,
			text,
			ts.ScriptTarget.Latest,
			true,
			f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
		);
		const visit = (node) => {
			if (
				ts.isImportDeclaration(node) &&
				PIXI.test(node.moduleSpecifier.text)
			) {
				errors.push(
					`${rel}: imports ${node.moduleSpecifier.text} — draw through @invana/canvas`,
				);
			}
			if (
				ts.isStringLiteral(node) ||
				ts.isNoSubstitutionTemplateLiteral(node) ||
				ts.isTemplateHead(node) ||
				ts.isTemplateMiddle(node) ||
				ts.isTemplateTail(node)
			) {
				const value = node.text;
				const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
				const colour = COLOUR_LITERAL.exec(value);
				if (colour && !(rel in TOKEN_ALLOWED))
					errors.push(
						`${rel}:${line + 1}: colour literal ${colour[0]} — use a token`,
					);
				const palette = PALETTE_CLASS.exec(value);
				if (palette)
					errors.push(
						`${rel}:${line + 1}: palette class ${palette[0]} — use a token`,
					);
				const px = PX_TEXT.exec(value);
				if (px)
					errors.push(
						`${rel}:${line + 1}: ${px[0]} — use text-base · text-sm · text-xs`,
					);
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
checkDecisionIds();
checkTokensAndPixi();

if (errors.length) {
	console.error(
		`check-names: ${errors.length} problem(s)\n  ${errors.join("\n  ")}`,
	);
	process.exit(1);
}
console.log(
	"check-names: modules, suffixes, identifiers, comments and tokens follow the rules",
);
