/**
 * R3 · two runs, one question, two worlds — **the diff is the deliverable**.
 *
 * *As someone whose answer changed when the world changed, I want to see what
 * the second run read that the first did not, so that I know why the answers
 * differ rather than guessing from two pieces of prose.*
 *
 * **Compare is two runs, not a diff engine**
 * ([WO4](../../../../../docs/for-developers/modules/govern/features/worlds.md)).
 * Both runs happened for real, under their own lenses, and their traces are
 * placed side by side. Nothing here is simulated and no answer is synthesised
 * from another — which is also why comparing costs money, and why the page
 * refuses rather than inventing when one of the two is missing.
 *
 * **What B touched that A did not is the only part a person cannot reconstruct
 * by reading both.** The two answers are already on their own run pages; this
 * page exists for the middle column.
 *
 * It is a **page**, id `compare:<runA>:<runB>` — a declared board bound to a
 * pair rather than a row, because there is nothing to key it on that is not the
 * two runs themselves.
 */

import { useCompareRunsQuery } from "@/hooks/queries/useGovern";
import type { AppliedDiff, AppliedField, CompareSide } from "@/types/govern";
import {
	AddressChip,
	Button,
	DiffList,
	DiffRow,
	EmptyState,
	MetricGrid,
	MetricTile,
	PanelBox,
	PropertyList,
	PropertyRow,
	RecordHeader,
	Spinner,
} from "@invana/ui";

export interface ComparePageProps {
	username: string;
	graphSlug: string;
	runA: string;
	runB: string;
	/** Open either run's own dashboard — the answers live there, not here. */
	onOpenRun: (runId: string) => void;
}

export function ComparePage({
	username,
	graphSlug,
	runA,
	runB,
	onOpenRun,
}: ComparePageProps) {
	const compare = useCompareRunsQuery(username, graphSlug, runA, runB);

	if (compare.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	if (compare.error || !compare.data) {
		return (
			<EmptyState
				className="h-full"
				title="These two runs cannot be compared"
				description={
					compare.error instanceof Error
						? compare.error.message
						: "One of them is not in this Graph, or its trace has been pruned. A comparison is two real runs — there is nothing to synthesise from the one that is left."
				}
			/>
		);
	}

	const { a, b, only_in_a, only_in_b, shared, differed } = compare.data;
	const differedCount = Object.keys(differed ?? {}).length;

	return (
		<div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
			<RecordHeader
				crumbs={[`${sideName(a)} vs ${sideName(b)}`]}
				chips={[<span key="kind">compare</span>]}
				actions={
					<>
						<Button
							variant="outline"
							size="sm"
							onClick={() => onOpenRun(a.run_id)}
						>
							Open {sideName(a)}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => onOpenRun(b.run_id)}
						>
							Open {sideName(b)}
						</Button>
					</>
				}
			/>

			<MetricGrid minTileWidth={150}>
				<MetricTile
					label={`${sideName(a)} touched`}
					value={String(a.touched.length)}
					caption={
						a.cost_usd != null
							? `$${a.cost_usd.toFixed(4)}`
							: "no published rate"
					}
				/>
				<MetricTile
					label={`${sideName(b)} touched`}
					value={String(b.touched.length)}
					caption={
						b.cost_usd != null
							? `$${b.cost_usd.toFixed(4)}`
							: "no published rate"
					}
				/>
				<MetricTile
					label="Shared"
					value={String(shared.length)}
					caption="read by both"
				/>
				{/* WO18 — two counts, because they are two facts. *Only one reached
				    it* and *both reached it and read it differently* are different
				    findings, and one number covering both is how *differed 0* got
				    printed for two runs that narrowed the same model two ways. */}
				<MetricTile
					label="Only one reached"
					value={String(only_in_a.length + only_in_b.length)}
					caption="engaged by one run, not the other"
					tone={only_in_a.length + only_in_b.length ? "warning" : undefined}
				/>
				<MetricTile
					label="Read differently"
					value={String(differedCount)}
					caption="shared, but not narrowed the same way"
					tone={differedCount ? "warning" : undefined}
				/>
			</MetricGrid>

			<PanelBox title="What they touched differently" aside="the deliverable">
				<div className="pt-1">
					{only_in_a.length || only_in_b.length ? (
						<DiffList>
							{only_in_b.map((address) => (
								<DiffRow key={`b-${address}`} op="add" kind={sideName(b)}>
									<AddressChip address={address} tone="allowed" />
								</DiffRow>
							))}
							{only_in_a.map((address) => (
								<DiffRow key={`a-${address}`} op="remove" kind={sideName(a)}>
									<AddressChip address={address} tone="untouched" />
								</DiffRow>
							))}
						</DiffList>
					) : (
						// A sentence, not an empty list. *They touched the same things*
						// is a real and interesting result — it means the difference in
						// the answers is not in what grounded them.
						<p className="text-sm text-muted-foreground">
							{differedCount
								? "Both runs engaged exactly the same participants — but not in the same way. What each world did to them is below."
								: "Both runs engaged exactly the same participants, and narrowed them identically. Whatever differs in the answers does not come from what grounded them — look at the cast."}
						</p>
					)}
				</div>
			</PanelBox>

			<PanelBox title="Shared" aside={`${shared.length} read by both`}>
				<div className="flex min-w-0 flex-col gap-0.5 pt-1">
					{shared.length ? (
						shared.map((address) => (
							<SharedAddress
								key={address}
								address={address}
								diff={differed?.[address]}
								nameA={sideName(a)}
								nameB={sideName(b)}
							/>
						))
					) : (
						// A sentence, not an eyebrow: `Eyebrow` uppercases, and a whole
						// sentence in caps reads as an alarm rather than as the fact it
						// is.
						<p className="text-sm text-muted-foreground">
							Nothing was read by both runs.
						</p>
					)}
				</div>
			</PanelBox>
		</div>
	);
}

/**
 * One participant both runs reached — and, where they narrowed it differently,
 * what each one did to it (WO18).
 *
 * The chip alone is the honest drawing when the two runs read it the same way:
 * there is nothing more to say, and a row of empty diffs under every shared
 * address would bury the ones that do differ. Only the fields that are not
 * equal are listed, on both sides, because *what B did* is unreadable without
 * *what A did* beside it.
 */
function SharedAddress({
	address,
	diff,
	nameA,
	nameB,
}: {
	address: string;
	diff?: AppliedDiff;
	nameA: string;
	nameB: string;
}) {
	if (!diff?.differs.length) {
		return <AddressChip address={address} tone="allowed" />;
	}
	return (
		<div className="flex min-w-0 flex-col gap-0.5">
			{/* Still `allowed`: both runs were let through to it, and the tone
			    says what the verdict was, not what the diff found. */}
			<AddressChip address={address} tone="allowed" />
			<DiffList>
				{diff.differs.map((field) => (
					<DiffRow key={`${address}-${field}`} op="change" kind={field}>
						<PropertyList labelWidth={140}>
							<PropertyRow label={nameA}>
								{describeApplied(field, diff.a[field])}
							</PropertyRow>
							<PropertyRow label={nameB}>
								{describeApplied(field, diff.b[field])}
							</PropertyRow>
						</PropertyList>
					</DiffRow>
				))}
			</DiffList>
		</div>
	);
}

/**
 * One field of `applied`, as a sentence.
 *
 * **Absent is stated, never blank.** *Nothing* is the finding half the time —
 * one run sliced and the other did not — and an empty cell reads as a value
 * that failed to load rather than as the answer.
 */
function describeApplied(field: AppliedField, value: unknown): string {
	if (value == null) return "nothing";
	if (Array.isArray(value)) {
		return value.length ? value.join(" · ") : "nothing";
	}
	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>);
		if (!entries.length) return "nothing";
		// Keyed by type for `select` and `properties_excluded` (WO17), so the
		// type is named rather than left for the reader to infer from the shape.
		return entries
			.map(([type, detail]) =>
				field === "properties_excluded" && Array.isArray(detail)
					? `${type}: ${detail.join(", ")}`
					: `${type}: ${JSON.stringify(detail)}`,
			)
			.join(" · ");
	}
	return String(value);
}

/** A run reads by the world it ran under; unnamed, by its short id. */
function sideName(side: CompareSide): string {
	return side.lens_name ?? `run ${side.run_id.slice(0, 8)}`;
}

/** `compare:<runA>:<runB>` → the pair, or null when the subject is not one. */
export function parseComparePair(
	subjectId: string,
): { runA: string; runB: string } | null {
	const [runA, runB] = subjectId.split(":");
	return runA && runB ? { runA, runB } : null;
}
