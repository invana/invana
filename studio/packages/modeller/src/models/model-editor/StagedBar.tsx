/**
 * The floating bar over a draft's canvas: how many changes are staged, and
 * the two acts on them. Publish opens the confirm; nothing commits here.
 */

import { Card } from "@invana/ui";
import { ActButton } from "@invana-studio/shell";

interface Props {
	/** The staged set's own count. */
	staged: number;
	/** The version the draft publishes as, once the engine has said — `Publish v1.1.0`. */
	version: string | null;
	onPublish: () => void;
	onDiscard: () => void;
}

export function StagedBar({ staged, version, onPublish, onDiscard }: Props) {
	return (
		<Card className="flex w-fit items-center gap-2.5 py-1.5 pr-2 pl-3 shadow-md">
			<span className="flex items-center gap-2">
				<span
					className={
						staged > 0
							? "size-1.5 rounded-full bg-warning"
							: "size-1.5 rounded-full bg-muted-foreground"
					}
				/>
				{staged > 0 ? `${staged} staged` : "Nothing staged"}
			</span>
			<ActButton
				area="model"
				size="xs"
				variant="ghost"
				disabled={staged === 0}
				onClick={onDiscard}
			>
				Discard
			</ActButton>
			<ActButton
				area="model"
				size="xs"
				disabled={staged === 0}
				onClick={onPublish}
			>
				{version ? `Publish v${version}` : "Publish"}
			</ActButton>
		</Card>
	);
}
