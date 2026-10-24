/**
 * Two versions of one record, side by side — board `shell.change.compare`,
 * at `/activity/changes/<kind>/<record>?a=&b=`.
 *
 * One page for every versioned record on a Graph: the change rows, a model's
 * History tab and a model's *Compare* all open it. The header names the
 * record, where it lives, who made `b` and why, and the two versions as
 * selects over the record's history. Under it, one pair of cards per changed
 * field — a text field as its unified lines split into the side each line
 * belongs to, any other field as its value before and after — then the plan
 * diff or the schema diff when the engine has one, and the effect after of
 * each side as tiles.
 *
 * It only reads. Restoring an older version is the record's own write, on
 * its own page.
 */

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	DiffList,
	DiffRow,
	EmptyState,
	MetricGrid,
	MetricTile,
	RecordHeader,
	Skeleton,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import { ArrowRight, History } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useProducts } from "../../products";
import {
	type ChangeCompare,
	type ChangeEntry,
	type ChangeField,
	PRODUCT_OF,
	type RecordKind,
	type SchemaDiff,
	tokensPerRun,
	useCompareQuery,
	useRecordHistoryQuery,
} from "./history";

const KIND_LABEL: Record<RecordKind, string> = {
	skill: "Skills",
	agent: "Agents",
	plan: "Plans",
	rule: "Rules",
	model: "Models",
};

const day = (iso: string | null | undefined) =>
	iso
		? new Date(iso).toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
			})
		: "—";

const label = (field: string) => field.replaceAll("_", " ");

/** A value as one line — text stays text, anything else is its JSON. */
const shown = (v: unknown): string =>
	v == null ? "—" : typeof v === "string" ? v : JSON.stringify(v);

/** `a` older than `b` reads forwards; the selects allow either way round. */
export function ComparePage({
	username,
	graphSlug,
	kind,
	recordId,
}: {
	username: string;
	graphSlug: string;
	kind: RecordKind;
	recordId: string;
}) {
	const graph = { username, graphSlug };
	const products = useProducts();
	const [params, setParams] = useSearchParams();
	const history = useRecordHistoryQuery(graph, kind, recordId);
	const items = history.data?.items ?? [];
	const b = params.get("b") ?? items[0]?.version ?? null;
	const bAt = items.findIndex((v) => v.version === b);
	const a =
		params.get("a") ?? (bAt >= 0 ? (items[bAt + 1]?.version ?? null) : null);
	const compare = useCompareQuery(
		graph,
		kind,
		recordId,
		items.length > 1 ? b : null,
		a,
	);
	const entryA = items.find((v) => v.version === a) ?? null;
	const entryB = items.find((v) => v.version === b) ?? null;

	const pick = (key: "a" | "b", version: string) =>
		setParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				next.set(key, version);
				if (key === "b" && !next.get("a") && a) next.set("a", a);
				return next;
			},
			{ replace: true },
		);

	if (history.isLoading) {
		return (
			<div className="space-y-3 p-4">
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-48 w-full" />
			</div>
		);
	}
	if (history.isError || !history.data) {
		return (
			<EmptyState
				className="h-full"
				icon={<History className="size-6" />}
				title="Nothing to compare here"
				description={`No ${kind} with this id is versioned on this Graph. It may have been deleted, or the link may be from another Graph.`}
			/>
		);
	}

	const product =
		products.find((p) => p.id === PRODUCT_OF[kind])?.name ?? PRODUCT_OF[kind];
	const versionSelect = (key: "a" | "b", value: string | null) => (
		<Select value={value ?? undefined} onValueChange={(v) => pick(key, v)}>
			<SelectTrigger
				aria-label={key === "a" ? "From version" : "To version"}
				className="w-24"
			>
				<SelectValue placeholder="—" />
			</SelectTrigger>
			<SelectContent>
				{items.map((v) => (
					<SelectItem key={v.version} value={v.version}>
						v{v.version}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				// Agents › Agents says one thing twice: a kind named as its product drops out.
				crumbs={[
					product,
					...(KIND_LABEL[kind] === product ? [] : [KIND_LABEL[kind]]),
					history.data.name,
				]}
				chips={
					items.length > 1 ? (
						<>
							{versionSelect("a", a)}
							<ArrowRight className="size-3.5 text-muted-foreground" />
							{versionSelect("b", b)}
						</>
					) : null
				}
			/>
			<div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
				{entryB ? (
					<p className="text-muted-foreground">
						v{entryB.version} · changed by{" "}
						{entryB.actor_name ?? entryB.actor_kind ?? "someone"} ·{" "}
						{day(entryB.at)}
						{entryB.why ? ` · “${entryB.why}”` : ""}
					</p>
				) : null}
				{items.length < 2 ? (
					<EmptyState
						icon={<History className="size-6" />}
						title="Only one version"
						description={`${history.data.name} has not changed since it was made, so there is nothing to compare yet.`}
					/>
				) : compare.isLoading ? (
					<Skeleton className="h-48 w-full" />
				) : compare.data ? (
					<CompareBody compare={compare.data} entryA={entryA} entryB={entryB} />
				) : (
					<EmptyState
						title="These two versions could not be read"
						description="Pick two versions from the selects above."
					/>
				)}
			</div>
		</div>
	);
}

function CompareBody({
	compare,
	entryA,
	entryB,
}: {
	compare: ChangeCompare;
	entryA: ChangeEntry | null;
	entryB: ChangeEntry | null;
}) {
	const a = compare.a ? `v${compare.a}` : "nothing";
	const b = `v${compare.b}`;
	const nothing =
		!compare.fields.length && !compare.plan && !hasSchema(compare.schema_diff);
	return (
		<>
			{nothing ? (
				<EmptyState
					title="No difference"
					description={compare.summary || `${a} and ${b} read the same.`}
				/>
			) : null}
			{compare.fields.map((f) => (
				<FieldPair key={f.field} field={f} a={a} b={b} />
			))}
			{compare.plan ? (
				<PanelSection card title="Plan" hint={compare.plan.summary}>
					<DiffList>
						{compare.plan.added.map((s) => (
							<DiffRow key={`+${s}`} op="add" kind="step">
								<span className="font-mono">{s}</span>
							</DiffRow>
						))}
						{compare.plan.removed.map((s) => (
							<DiffRow key={`-${s}`} op="remove" kind="step">
								<span className="font-mono">{s}</span>
							</DiffRow>
						))}
						{compare.plan.changed.map((s) => (
							<DiffRow key={`~${s.step_key}`} op="change" kind="step">
								<span className="font-mono">{s.step_key}</span> ·{" "}
								{s.fields.map(label).join(", ")}
							</DiffRow>
						))}
						{compare.plan.moved.map((s) => (
							<DiffRow key={`>${s}`} op="moved" kind="step">
								<span className="font-mono">{s}</span> moved
							</DiffRow>
						))}
					</DiffList>
				</PanelSection>
			) : null}
			{compare.schema_diff && hasSchema(compare.schema_diff) ? (
				<PanelSection
					card
					title="Schema"
					hint={`${a} → ${b} · ${compare.schema_diff.classification}`}
				>
					<SchemaDiffList diff={compare.schema_diff} />
				</PanelSection>
			) : null}
			<EffectTiles a={entryA} b={entryB} compare={compare} />
		</>
	);
}

/** One field's before and after, each in its own card. */
function FieldPair({
	field,
	a,
	b,
}: {
	field: ChangeField;
	a: string;
	b: string;
}) {
	const text = field.lines.length > 0;
	// A unified diff: `-` lines are the old side's, `+` the new side's, and the
	// context lines belong to both. File and hunk headers are dropped.
	const body = field.lines.filter(
		(l) => !l.startsWith("---") && !l.startsWith("+++") && !l.startsWith("@@"),
	);
	const side = (mark: "-" | "+"): ReactNode =>
		text ? (
			<DiffList className="font-mono">
				{body
					.filter((l) => l[0] === mark || l[0] === " " || l === "")
					.map((l, i) => (
						<DiffRow
							// biome-ignore lint/suspicious/noArrayIndexKey: lines repeat
							key={i}
							op={l[0] === mark ? (mark === "+" ? "add" : "remove") : "same"}
						>
							{l.slice(1) || " "}
						</DiffRow>
					))}
			</DiffList>
		) : (
			<p className="font-mono">
				{shown(mark === "-" ? field.before : field.after)}
			</p>
		);
	return (
		<div className="grid gap-3 lg:grid-cols-2">
			<PanelSection card title={`${a} · ${label(field.field)}`}>
				{side("-")}
			</PanelSection>
			<PanelSection card title={`${b} · ${label(field.field)}`}>
				{side("+")}
			</PanelSection>
		</div>
	);
}

function hasSchema(d: SchemaDiff | null): d is SchemaDiff {
	if (!d) return false;
	return [
		d.added_node_types,
		d.removed_node_types,
		d.modified_node_types,
		d.added_edge_types,
		d.removed_edge_types,
		d.modified_edge_types,
		d.added_property_keys,
		d.removed_property_keys,
		d.added_constraints,
		d.removed_constraints,
		d.added_indexes,
		d.removed_indexes,
	].some((list) => list.length > 0);
}

function SchemaDiffList({ diff }: { diff: SchemaDiff }) {
	const rows: (readonly [string, "add" | "remove" | "change", string])[] = [
		...diff.added_node_types.map((n) => [n, "add", "node type"] as const),
		...diff.removed_node_types.map((n) => [n, "remove", "node type"] as const),
		...diff.modified_node_types.map(
			(n) => [n.name, "change", "node type"] as const,
		),
		...diff.added_edge_types.map((n) => [n, "add", "edge type"] as const),
		...diff.removed_edge_types.map((n) => [n, "remove", "edge type"] as const),
		...diff.modified_edge_types.map(
			(n) => [n.name, "change", "edge type"] as const,
		),
		...diff.added_property_keys.map((n) => [n, "add", "property"] as const),
		...diff.removed_property_keys.map(
			(n) => [n, "remove", "property"] as const,
		),
		...diff.added_constraints.map((n) => [n, "add", "constraint"] as const),
		...diff.removed_constraints.map(
			(n) => [n, "remove", "constraint"] as const,
		),
		...diff.added_indexes.map((n) => [n, "add", "index"] as const),
		...diff.removed_indexes.map((n) => [n, "remove", "index"] as const),
	];
	return (
		<DiffList>
			{rows.map(([name, op, kind]) => (
				<DiffRow key={`${op}${kind}${name}`} op={op} kind={kind}>
					<span className="font-mono">{name}</span>
				</DiffRow>
			))}
		</DiffList>
	);
}

/** What ran on each side, counted — tokens, never currency. */
function EffectTiles({
	a,
	b,
	compare,
}: {
	a: ChangeEntry | null;
	b: ChangeEntry | null;
	compare: ChangeCompare;
}) {
	const tiles = useMemo(() => {
		if (!b) return null;
		const pair = (f: (e: ChangeEntry) => number | null) =>
			`${a ? (f(a)?.toLocaleString() ?? "—") : "—"} → ${f(b)?.toLocaleString() ?? "—"}`;
		// The change in tokens per run is the engine's (`tokens_per_run_change`).
		const change = compare.tokens_per_run_change;
		return {
			runs: pair((e) => e.effect.runs),
			failed: pair((e) => e.effect.failed),
			perRun: pair((e) => tokensPerRun(e.effect)),
			change,
			basis:
				b.effect.basis === "window"
					? "the Graph's runs while each was published"
					: "runs that recorded the version",
		};
	}, [a, b, compare]);
	if (!tiles) return null;
	return (
		<MetricGrid columns={3}>
			<MetricTile label="Runs" value={tiles.runs} caption={tiles.basis} />
			<MetricTile label="Failed" value={tiles.failed} caption="of those runs" />
			<MetricTile
				label="Tokens per run"
				value={tiles.perRun}
				caption={
					tiles.change
						? `${(1 + tiles.change.by).toFixed(1)}×`
						: "nothing ran on one side"
				}
				captionTone={tiles.change?.tone === "worse" ? "warning" : undefined}
			/>
		</MetricGrid>
	);
}
