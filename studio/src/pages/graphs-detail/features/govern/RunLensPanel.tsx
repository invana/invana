/**
 * **Legacy — a renderer kept for documents that already name it.**
 *
 * A run's lens is drawn by the kit's `lens` panel now: one `LayerSection` per
 * layer with a `ParticipantRow` inside it, which is the drawing
 * [SR53](../../../../../docs/for-developers/modules/operate/features/see-what-ran.md#decisions)
 * asks for and this panel's three verdict buckets never were. Live pages
 * compose it through [`runLensOptions`](./runLens.ts); nothing new should
 * register `runLens`.
 *
 * It stays because a **frozen report** renders whatever document was kept
 * ([B16](../../../../../docs/for-developers/building-engine/boards-migration.md)),
 * and a report frozen before the swap carries `kind: "runLens"` with these
 * options. Deleting the renderer would draw *No renderer for panel kind
 * `runLens`* where a reader's saved reading of a run used to be — a report is
 * the one surface that cannot be migrated by recomposing it.
 *
 * Delete this file once no stored board names the kind.
 */

import type { PanelRendererProps } from "@invana/dashboard";
import {
	AddressChip,
	Button,
	Eyebrow,
	MetricGrid,
	MetricTile,
} from "@invana/ui";

export interface RunLensOptions {
	/** The world the run froze, or absent — which reads `Everything`. */
	lensName?: string | null;
	allowed: string[];
	touched: string[];
	neverTouched: string[];
	refused: string[];
	/** Emitted with no context — opens `?panel=govern`. */
	retuneAction?: string;
	/** Emitted with `{ itemId: address }` — opens that participant. */
	openAction?: string;
}

export type WithRunLens = { runLens: RunLensOptions };

export function RunLensPanel({
	options,
	onAction,
}: PanelRendererProps<RunLensOptions>) {
	const {
		lensName,
		allowed,
		touched,
		neverTouched,
		refused,
		retuneAction,
		openAction,
	} = options;

	const open = openAction
		? (address: string) => onAction(openAction, { itemId: address })
		: undefined;

	return (
		<div className="flex min-w-0 flex-col gap-3">
			<div className="flex min-w-0 items-baseline gap-2">
				<span className="truncate text-base">
					{/* `Everything` is a real world and the default one — never a blank
					    or a dash, which would read as *not recorded*. */}
					{lensName ?? "Everything"}
				</span>
				<Eyebrow className="ml-auto shrink-0">as frozen at open</Eyebrow>
				{retuneAction ? (
					<Button
						variant="outline"
						size="xs"
						onClick={() => onAction(retuneAction)}
					>
						Retune
					</Button>
				) : null}
			</div>

			<MetricGrid minTileWidth={120}>
				<MetricTile
					label="Allowed"
					value={String(allowed.length)}
					caption="what the frozen lens permits"
				/>
				<MetricTile
					label="Touched"
					value={String(touched.length)}
					caption={
						allowed.length
							? `${Math.round((touched.length / allowed.length) * 100)}% of what it could`
							: "nothing was bounded"
					}
					meter={allowed.length ? touched.length / allowed.length : undefined}
				/>
				<MetricTile
					label="Refused"
					value={String(refused.length)}
					caption={
						refused.length ? "widen, or accept it" : "nothing was blocked"
					}
					tone={refused.length ? "warning" : undefined}
				/>
			</MetricGrid>

			<AddressGroup
				title="Refused"
				hint="the run continued without it — the answer says so"
				tone="refused"
				addresses={refused}
				onOpen={open}
			/>
			<AddressGroup
				title="Allowed, never touched"
				hint="not carrying the answer — a candidate to narrow"
				tone="untouched"
				addresses={neverTouched}
				onOpen={open}
			/>
			<AddressGroup
				title="Touched"
				hint="what actually grounded this"
				tone="allowed"
				addresses={touched}
				onOpen={open}
			/>
		</div>
	);
}

function AddressGroup({
	title,
	hint,
	tone,
	addresses,
	onOpen,
}: {
	title: string;
	hint: string;
	tone: "allowed" | "refused" | "untouched";
	addresses: string[];
	onOpen?: (address: string) => void;
}) {
	// An empty group is absent, because each one already has a tile above it
	// carrying its count — a heading over nothing would say the list failed to
	// load rather than that it is zero.
	if (!addresses.length) return null;

	return (
		<div className="flex min-w-0 flex-col gap-1">
			{/* The label is the eyebrow; the reading beside it is a sentence. An
			    eyebrow uppercases, and *the run continued without it — the answer
			    says so* in caps reads as an alarm rather than as the note it is. */}
			<div className="flex min-w-0 items-baseline gap-2">
				<Eyebrow>{title}</Eyebrow>
				<span className="truncate text-sm text-muted-foreground">{hint}</span>
			</div>
			<div className="flex min-w-0 flex-col gap-0.5">
				{addresses.map((address) => (
					<AddressChip
						key={address}
						address={address}
						tone={tone}
						onOpen={onOpen}
					/>
				))}
			</div>
		</div>
	);
}
