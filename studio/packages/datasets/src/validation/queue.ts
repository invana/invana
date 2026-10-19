/**
 * The validation queue's helpers: an item's path and how a violation reads.
 * The queue itself — its items and every count — is the engine's
 * (`useValidationQueue`).
 *
 * An item is addressed by its dataset, record key and term — the path of its
 * page. Conflicts with official data are not here: they are found by a
 * validator agent, which the install does not run.
 */

import type { DatasetRef } from "../api";
import type { Violation } from "../types";

/** `/datasets/validation/<publisher>/<name>/<key>/<term>` */
export function itemPath(d: DatasetRef, key: string, term: string): string {
	return ["/datasets/validation", d.publisher, d.name, key, term]
		.map((p, i) => (i === 0 ? p : encodeURIComponent(p)))
		.join("/");
}

export const KIND_LABEL: Record<Violation["kind"], string> = {
	missing: "missing",
	not_allowed: "not a value it allows",
	wrong_type: "the wrong type",
};
