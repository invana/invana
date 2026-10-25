/**
 * The link card — an ask for a list, answered by opening it
 * (docs/for-developers/modules/ask/features/the-assistant-opens-boards.md).
 *
 * `<List> · N filters` in the header, the row count where a citation sits,
 * the filters as the list's own chips, what did not resolve in the engine's
 * words, and one outline button that opens the list. Opening it is a read:
 * the list arrives filtered and says *set by the assistant*.
 */

import { AppliedFilters, Button, EmissionCard } from "@invana/ui";
import type { LinkEmission } from "@invana-studio/core";
import { ListFilter } from "lucide-react";

export function LinkCard({
	link,
	onOpen,
}: {
	link: LinkEmission;
	/** Opens the list at the link's address; absent where nothing can open it. */
	onOpen?: () => void;
}) {
	const n = link.chips.length;
	const [one, many] = link.noun;
	return (
		<EmissionCard
			data-testid="emission"
			data-emission-kind="link"
			kind="link"
			title={`${link.label} · ${n} ${n === 1 ? "filter" : "filters"}`}
			citation={`${link.total.toLocaleString()} ${link.total === 1 ? one : many}`}
		>
			<div className="flex flex-col gap-2 px-[9px] py-2">
				<AppliedFilters filters={link.chips} />
				{link.unresolved.map((u) => (
					<p
						key={`${u.field}:${u.word}`}
						className="text-sm text-muted-foreground"
					>
						{u.reason}
					</p>
				))}
				<div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={!onOpen}
						onClick={onOpen}
					>
						<ListFilter aria-hidden="true" />
						Open {link.label}
					</Button>
				</div>
			</div>
		</EmissionCard>
	);
}
