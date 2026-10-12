import type { Gate } from "@invana-studio/core";
import { toast } from "sonner";

/**
 * A stack section's header act as the `model` gate allows it — unchanged when
 * allowed; otherwise disabled, its tooltip the reason, and its name still the
 * act's so it is found by what it does.
 *
 *     headerActions: [gateSectionAction(newWorld, gate)]
 */
export function gateSectionAction<
	T extends { name: string; onClick: () => void },
>(item: T, gate: Gate): T {
	if (gate.allowed || !gate.reason) return item;
	const reason = gate.reason;
	return {
		...item,
		tooltip: `${item.name} · ${reason}`,
		disabled: true,
		onClick: () => toast.info(reason),
	};
}
