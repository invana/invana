import type { AccessAreaName, GraphAccess, GraphRole } from "../types/access";

/**
 * Whether the signed-in member may change an area, and if not, why and who to
 * ask (docs/for-developers/modules/identity-and-access/features/roles.md).
 *
 *     gateOf(access, "build", "arjun")
 *     // → { allowed: false, role: "builder", holders: ["ravi"],
 *     //     reason: "Needs the builder role — ask ravi." }
 *
 * Until `…/access` has loaded — or when it fails — every area reads as
 * allowed: the engine re-checks every write, so a guess never blocks anyone,
 * and a refused write still names the role and its holders.
 */
export interface Gate {
	allowed: boolean;
	/** The role the area needs; `null` until access has loaded. */
	role: GraphRole | null;
	/** Who holds it, the signed-in member left out. */
	holders: string[];
	/** The one line a disabled act shows; `null` when allowed. */
	reason: string | null;
}

const OPEN: Gate = { allowed: true, role: null, holders: [], reason: null };

/** Names as one phrase: `ravi` · `ravi or meera` · `ravi, meera or 2 others`. */
export function whoToAsk(holders: string[]): string {
	if (holders.length === 0) return "an owner of this Graph";
	if (holders.length === 1) return holders[0];
	if (holders.length <= 3)
		return `${holders.slice(0, -1).join(", ")} or ${holders.at(-1)}`;
	return `${holders.slice(0, 2).join(", ")} or ${holders.length - 2} others`;
}

export function gateOf(
	access: GraphAccess | undefined,
	area: AccessAreaName,
	me?: string,
): Gate {
	const found = access?.areas.find((a) => a.area === area);
	if (!found) return OPEN;
	const holders = found.holders.filter((h) => h !== me);
	if (found.allowed)
		return { allowed: true, role: found.role, holders, reason: null };
	return {
		allowed: false,
		role: found.role,
		holders,
		reason: `Needs the ${found.role} role — ask ${whoToAsk(holders)}.`,
	};
}
