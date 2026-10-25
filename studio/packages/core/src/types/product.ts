/**
 * The product contract — what a Studio product hands the shell.
 *
 * Each product package default-exports one `ProductDefinition`. The app
 * passes the list to `<StudioShell>`, which draws the launcher, the
 * `Invana <Product>` wordmark and the `leftNav` from it, and resolves
 * cross-product actions by id. The shell never imports a product, and a
 * product never imports another: a button that opens another product's
 * dialog asks the shell for the action and renders nothing when that
 * product is not registered.
 *
 * Types only — the shell owns the behaviour.
 */

import type { ComponentType, ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import type { SetupGate } from "./graphs";

/** A product's path segment and launcher key. */
export type ProductId =
	| "datasets"
	| "modeller"
	| "explorer"
	| "projects"
	| "agents"
	| "iam";

/** An icon component — a lucide icon fits. */
export type ProductIcon = ComponentType<{ className?: string }>;

/** One icon in a product's `leftNav`. */
export interface NavItem {
	id: string;
	/** The tooltip; names the section. */
	label: string;
	icon: ProductIcon;
	/** Path relative to the product's base; the item is lit while it matches. */
	to: string;
}

/** What an action is invoked with. */
export interface ActionContext<A = unknown> {
	args: A;
	navigate: (to: string) => void;
	/** Opens a dialog over the current page; the shell hosts it. */
	openDialog: (render: (close: () => void) => ReactNode) => void;
}

/** Something another product may invoke — a navigation or a dialog. */
export interface ActionDef<A = unknown> {
	label: string;
	icon?: ProductIcon;
	/** `false` while the owning product cannot do it yet; callers then render nothing. */
	available?: boolean;
	run: (ctx: ActionContext<A>) => void;
}

/** One entry in ⌘K. */
interface CommandDef {
	id: string;
	label: string;
	/** Extra words the search matches on. */
	keywords?: string[];
	icon?: ProductIcon;
	/** Path relative to the product's base. */
	to: string;
}

/** A Graph, as a product's search is handed it. */
export interface GraphRef {
	username: string;
	graphSlug: string;
}

/** One record ⌘K can open. */
export interface SearchHit {
	id: string;
	/** The record's name — what a query is matched against. */
	label: string;
	/** What it is, right-aligned: `model`, `agent · paused`. */
	detail?: string;
	icon?: ProductIcon;
	/** Path relative to the product's base. */
	to: string;
	/** `related` — matched on meaning, not on the name; drawn below every name. */
	match?: "name" | "related";
}

/** The Graph's set-up state a gate reads. */
interface ProductSetup {
	isGateOpen: (gate: SetupGate) => boolean;
}

/** Why a product is locked, and where the step that unlocks it lives. */
export interface ProductLock {
	/** The heading — what opens it: `Asking opens once a model is published`. */
	reason: string;
	/** The line under it — what is true now, and the step to take. */
	detail?: string;
	/** Where that step lives, relative to the Graph's base. */
	to?: string;
	/** The button that goes there — `Open the Modeller`. */
	action?: string;
}

export interface ProductDefinition {
	id: ProductId;
	/** The launcher row and the wordmark: `Invana <name>`. */
	name: string;
	tagline: string;
	icon: ProductIcon;
	/** `install` hides the Graph picker. */
	scope: "graph" | "install";
	/** The product's routes; each route's `handle.crumb` feeds the breadcrumbs. */
	routes: RouteObject[];
	/** The product's `leftNav` icons; `null` draws none. */
	nav: { groups: NavItem[][]; bottom: NavItem[] } | null;
	/**
	 * The counts pinned to `nav` icons, by item id — a hook the shell calls
	 * while the product is open. An item with no count, or a count of 0, has
	 * no badge. The engine owns each number; the hook only reads it.
	 */
	useNavBadges?: () => Partial<Record<string, number>>;
	/** Where the launcher and the Graph name go, relative to the product's base. */
	landing: string;
	actions?: Record<string, ActionDef>;
	commands?: CommandDef[];
	/**
	 * The records ⌘K matches names against, read from the product's own list
	 * endpoints. Called once each time the palette opens — with the open Graph
	 * for a graph product, which is not asked off a Graph.
	 */
	search?: (graph: GraphRef) => Promise<SearchHit[]>;
	/** Locks the product until a set-up step is done. */
	gate?: (setup: ProductSetup) => ProductLock | null;
}
