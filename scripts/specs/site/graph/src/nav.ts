/**
 * The way between the graph and the site's pages.
 *
 * The built app sits at `<site>/graph/app/`, inside an iframe on the site's `/graph/` page, so the site root is two
 * folders up and a page opens in the top window. Under `vite` (`pnpm dev`) there is no site around it: the root is
 * the local `mkdocs serve`, and the page opens in a new tab.
 */
import { focusFrom } from "./model";

/** The site root the app links to. */
export const SITE_ROOT = import.meta.env.DEV
	? "http://127.0.0.1:8000/"
	: new URL("../../", window.location.href).href;

/** The window the site is in: the page around the iframe when there is one on the same origin, else this one. */
function siteWindow(): Window {
	try {
		if (window.top && window.top !== window && window.top.location.href)
			return window.top;
	} catch {
		// Another origin around us — stay in this window.
	}
	return window;
}

/** The node `?focus=` names — on the page around the iframe (the site's `/graph/?focus=…`), or on the app's own URL. */
export function initialFocus(): string | null {
	return (
		focusFrom(siteWindow().location.search) ?? focusFrom(window.location.search)
	);
}

/** The two views: every journey as one graph (the default), or the whole spec graph. */
export type ViewId = "journeys" | "spec";

/**
 * The view the page opens on: the spec graph when `?focus=` names a node (only it holds every node) or
 * `?view=spec` asks for it; else the Journeys view.
 */
export function initialView(): ViewId {
	const params = [siteWindow().location.search, window.location.search].map(
		(s) => new URLSearchParams(s),
	);
	if (initialFocus()) return "spec";
	return params.some((p) => p.get("view") === "spec") ? "spec" : "journeys";
}

/** A query parameter of the address — the page around the iframe first, then the app's own. */
export function addressParam(key: string): string | null {
	for (const w of [siteWindow(), window]) {
		const v = new URLSearchParams(w.location.search).get(key);
		if (v !== null) return v;
	}
	return null;
}

/**
 * Keep `key=value` in the address the reader sees (the site's `/graph/?…`), so a reload or a shared link opens the
 * same way; `null` removes it. Replaces the entry — a choice is not a step back.
 */
export function setAddressParam(key: string, value: string | null): void {
	for (const w of new Set([siteWindow(), window])) {
		const url = new URL(w.location.href);
		if (value === null) url.searchParams.delete(key);
		else url.searchParams.set(key, value);
		w.history.replaceState(w.history.state, "", url);
	}
}

/** Open a site page (`products/…/feature/`) where the site is. */
export function openPage(url: string): void {
	const href = new URL(url, SITE_ROOT).href;
	if (import.meta.env.DEV) window.open(href, "_blank", "noopener");
	else siteWindow().location.href = href;
}
