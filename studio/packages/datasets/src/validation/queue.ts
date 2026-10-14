/**
 * The validation queue, as items: every standard violation on the current
 * version of every dataset the person can read, flattened from `useClaims`.
 *
 * An item is addressed by its dataset, record key and term — the path of its
 * page. Conflicts with official data are not here: they are found by a
 * validator agent, which the install does not run.
 */

import type { DatasetRef } from "../api";
import type { Claim } from "../queries";
import type { Violation } from "../types";

export interface QueueItem {
	claim: Claim;
	violation: Violation;
	/** The column the term is mapped to; the term itself when unmapped. */
	column: string;
}

export function queueOf(claims: Claim[]): QueueItem[] {
	return claims.flatMap((claim) =>
		(claim.attachment.conformance?.violations ?? []).map((violation) => ({
			claim,
			violation,
			column: claim.attachment.mapping[violation.term] ?? violation.term,
		})),
	);
}

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
