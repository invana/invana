#!/usr/bin/env node
/**
 * Fails when a Studio workspace package imports something its layer may not.
 *
 * Every package under `apps/*` and `packages/*` declares its layer as a tag in its own
 * `turbo.json` (`{ "extends": ["//"], "tags": ["core"] }`). A package with no tag, or more
 * than one, fails the check — a new package cannot slip in unclassified.
 *
 * The rules are the *Allowed imports* table in docs/products/migration-plan.md §2:
 *
 *   app       → core · ui · canvases · assistant · shell · product · @invana/*
 *   product   → core · ui · canvases · assistant · shell · @invana/*   (never another product)
 *   shell     → core · ui · canvases · assistant · @invana/*
 *   assistant → core · ui · canvases · @invana/*
 *   canvases  → core · ui · @invana/*
 *   ui        → @invana/*
 *   core      → nothing of ours, and no @invana/* (non-UI libraries only)
 *
 * Nothing imports the app. A package may always import itself. Every `import … from`,
 * `export … from`, side-effect `import "…"` and dynamic `import("…")` in a package's
 * `src/` is read; a relative import that leaves the package, or the app's `@/` alias used
 * outside the app, counts as a breach too, since either would bypass the table. Third-party
 * modules are not this check's business.
 *
 * Usage: `node scripts/check-boundaries.mjs` from the workspace root (`pnpm check-boundaries`;
 * `turbo run lint` runs it first). Exits 1 and lists each breach as `file:line`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KIT = "@invana/*";

const ALLOWED = {
	app: ["core", "ui", "canvases", "assistant", "shell", "product", KIT],
	product: ["core", "ui", "canvases", "assistant", "shell", KIT],
	shell: ["core", "ui", "canvases", "assistant", KIT],
	assistant: ["core", "ui", "canvases", KIT],
	canvases: ["core", "ui", KIT],
	ui: [KIT],
	core: [],
};

const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const SPECIFIER =
	/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm;

function workspaces() {
	const found = [];
	for (const group of ["apps", "packages"]) {
		const dir = join(ROOT, group);
		if (!existsSync(dir)) continue;
		for (const name of readdirSync(dir)) {
			const path = join(dir, name);
			const manifest = join(path, "package.json");
			if (!statSync(path).isDirectory() || !existsSync(manifest)) continue;
			found.push({
				path,
				name: JSON.parse(readFileSync(manifest, "utf8")).name,
			});
		}
	}
	return found;
}

function tagOf(pkg) {
	const config = join(pkg.path, "turbo.json");
	const tags = existsSync(config)
		? (JSON.parse(readFileSync(config, "utf8")).tags ?? [])
		: [];
	const known = tags.filter((t) => t in ALLOWED);
	return known.length === 1 && tags.length === 1 ? known[0] : null;
}

function* files(dir) {
	if (!existsSync(dir)) return;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* files(path);
		else if (SOURCE.test(entry.name)) yield path;
	}
}

/** The layer a specifier reaches, `self`, or `null` for a third-party module. */
function target(spec, file, pkg, byName) {
	if (spec.startsWith(".")) {
		const to = resolve(dirname(file), spec);
		return to === pkg.path || to.startsWith(pkg.path + "/")
			? "self"
			: "outside";
	}
	if (spec === "@/" || spec.startsWith("@/"))
		return pkg.tag === "app" ? "self" : "app";
	if (spec.startsWith("@invana/")) return KIT;
	if (spec.startsWith("@invana-studio/")) {
		const name = spec.split("/").slice(0, 2).join("/");
		const other = byName.get(name);
		if (!other) return "unknown";
		return other === pkg ? "self" : other.tag;
	}
	return null;
}

const packages = workspaces();
const byName = new Map(packages.map((p) => [p.name, p]));
const breaches = [];

for (const pkg of packages) {
	pkg.tag = tagOf(pkg);
	if (!pkg.tag) {
		breaches.push(
			`${relative(ROOT, pkg.path)}/turbo.json: needs exactly one tag of ${Object.keys(ALLOWED).join(", ")}`,
		);
	}
}

for (const pkg of packages.filter((p) => p.tag)) {
	for (const file of files(join(pkg.path, "src"))) {
		const text = readFileSync(file, "utf8");
		for (const match of text.matchAll(SPECIFIER)) {
			const spec = match[1];
			const layer = target(spec, file, pkg, byName);
			if (layer === null || layer === "self") continue;
			if (ALLOWED[pkg.tag].includes(layer)) continue;
			const line = text.slice(0, match.index).split("\n").length;
			breaches.push(
				`${relative(ROOT, file)}:${line}: ${pkg.tag} may not import ${layer} ("${spec}")`,
			);
		}
	}
}

if (breaches.length) {
	console.error(`check-boundaries: ${breaches.length} breach(es)\n`);
	for (const b of breaches) console.error(`  ${b}`);
	console.error(
		"\nAllowed imports: docs/products/migration-plan.md §2 (Allowed imports).",
	);
	process.exit(1);
}
console.log(
	`check-boundaries: ${packages.length} packages clean (${packages.map((p) => `${p.name}=${p.tag}`).join(", ")})`,
);
