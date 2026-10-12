/**
 * **Impact** — what an option reaches over the graph, hop by hop, before it is
 * decided (projects.md PJ-10, board `projects.impact`).
 *
 * The reach starts from the evidence: the graph records the option's findings
 * cite, of every stance. From there each hop is what the hop before reached
 * through any relationship, minus what was already reached — read through the
 * Explorer's expand, so every read is a run under the Graph's lens and a type
 * the world denies is never reached. The walk is bounded (`reach.ts`), and
 * when a bound trims a hop the drawing and the words say *more lies beyond*.
 *
 * Drawn left to right on the shared layered canvas: a column is a hop, a node
 * is one type at that hop with its count, an edge is a relationship type that
 * joins two groups. Clicking a group lists its records under the drawing.
 * **Links** says every group in words, for a reader who cannot see the canvas;
 * **Most reached** names the records reached by the most relationships; **How
 * sure** says how far the evidence it starts from was reviewed and where its
 * datasets come from. Reach only — no what-if value and no figure in any
 * currency: those belong to a simulator.
 */

import {
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Button,
	CaveatNote,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import {
	LayeredCanvas,
	type LayeredEdge,
	type LayeredNode,
} from "@invana-studio/canvases";
import { RecordRow, type Tone } from "@invana-studio/ui";
import { useState } from "react";
import { Box, CanvasFrame, Muted, ReadState } from "../project/parts";
import { useLineageDatasets } from "../records/queries";
import {
	parseDatasetRef,
	type useProjectRecords,
} from "../records/useProjectRecords";
import {
	branchLabel,
	branchWord,
	evidenceWord,
	plural,
} from "../records/words";
import type { Branch, Finding, Project } from "../types";
import { MAX_HOPS, type Reach, type ReachGroup } from "./reach";
import { useReach } from "./useReach";

const HOP_CHOICES = Array.from({ length: MAX_HOPS }, (_, i) => i + 1);
const hopWord = (n: number) => plural(n, "hop");
const groupId = (hop: number, label: string) => `${hop}:${label}`;
const article = (w: string) => (/^[aeiou]/i.test(w) ? "an" : "a");
/** `findings cite` · `evidence cites` — a mass noun takes no plural. */
const evidenceCite = (w: string) =>
	w.toLowerCase() === "evidence"
		? "evidence cites"
		: `${w.toLowerCase()}s cite`;

/** The branch reached from: the one named, the newest decided, the first live, the root. */
function pickBranch(
	branches: Branch[],
	decisions: { number: number; branch_number: number | null }[],
	of: number | null,
): Branch | undefined {
	const named = branches.find((b) => b.number === of);
	if (named) return named;
	const decided = [...decisions]
		.sort((a, b) => b.number - a.number)
		.find((d) => d.branch_number !== null)?.branch_number;
	return (
		branches.find((b) => b.number === decided) ??
		branches.find((b) => b.status !== "dropped" && b.status !== "merged") ??
		branches.find((b) => b.parent_number === null) ??
		branches[0]
	);
}

/** The graph records the findings cite, each once, in the order first cited. */
function recordCites(findings: Finding[]): string[] {
	return [
		...new Set(
			findings.flatMap((f) =>
				f.cites.filter((c) => c.kind === "record").map((c) => c.ref),
			),
		),
	];
}

/** `via LOCATED_AT from Accession, SERVES from Route` — how a group was reached. */
function viaOf(reach: Reach, hop: number, g: ReachGroup): string {
	const into = reach.links.filter(
		(l) => l.fromHop === hop - 1 && l.toLabel === g.label,
	);
	const via = into.length
		? `via ${into.map((l) => `${l.edgeLabel} from ${l.fromLabel}`).join(", ")}`
		: "reached";
	return g.cut ? `${via} · more lies beyond` : via;
}

export function ImpactTab({
	username,
	graphSlug,
	project,
	records,
	of,
	hops,
	onReach,
	onOpenFinding,
}: {
	username: string;
	graphSlug: string;
	project: Project;
	records: ReturnType<typeof useProjectRecords>;
	/** The branch reached from; a sensible default when none is named. */
	of: number | null;
	/** How far the reach walks, 1–3. */
	hops: number;
	onReach: (next: { of?: number | null; hops?: number | null }) => void;
	onOpenFinding: (n: number, branch: number) => void;
}) {
	const [selected, setSelected] = useState<string | null>(null);
	const branch = pickBranch(records.branches, records.decisions, of);
	const findings =
		records.details.find((d) => d.branch.number === branch?.number)?.findings ??
		[];
	const seeds = recordCites(findings);
	const depth = Math.max(1, Math.min(MAX_HOPS, hops));
	const { reach, reading, walking, error, retrace } = useReach({
		username,
		graphSlug,
		projectKey: project.key,
		branch: branch?.number ?? null,
		hops: depth,
		seeds,
	});

	const from = findings.filter((f) => f.cites.some((c) => c.kind === "record"));
	const addresses = [
		...new Set(
			from.flatMap((f) =>
				f.cites.flatMap((c) => {
					const d = c.kind === "dataset" ? parseDatasetRef(c.ref) : null;
					return d ? [`${d.publisher}/${d.name}`] : [];
				}),
			),
		),
	];
	const datasets = useLineageDatasets(addresses);

	if (
		records.branchesLoading ||
		records.detailsLoading ||
		records.branchesError
	)
		return (
			<ReadState
				loading={records.branchesLoading || records.detailsLoading}
				error={records.branchesError}
			/>
		);
	if (!branch) return null;

	const word = branchWord(project);
	const evidence = evidenceWord(project);
	const optionTitle = `${branchLabel(project, branch.number)} · ${branch.title}`;

	const pickers = (
		<div className="flex flex-wrap items-center gap-3">
			<Label>{word}</Label>
			<Select
				value={String(branch.number)}
				onValueChange={(v) => {
					setSelected(null);
					onReach({ of: Number(v) });
				}}
			>
				<SelectTrigger aria-label={word} className="w-80">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{records.branches.map((b) => (
						<SelectItem key={b.id} value={String(b.number)}>
							{branchLabel(project, b.number)} · {b.title}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Label>Reach</Label>
			<Select
				value={String(depth)}
				onValueChange={(v) => {
					setSelected(null);
					onReach({ hops: Number(v) });
				}}
			>
				<SelectTrigger aria-label="Reach" className="w-32">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{HOP_CHOICES.map((n) => (
						<SelectItem key={n} value={String(n)}>
							{hopWord(n)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{seeds.length ? (
				<>
					<Button variant="ghost" onClick={retrace} disabled={walking}>
						Trace again
					</Button>
					<span className="text-sm text-muted-foreground">
						{walking
							? `Reading hop ${reading ?? 1} of ${depth}…`
							: reach
								? `Traced in ${plural(reach.reads, "read")} of the graph`
								: null}
					</span>
				</>
			) : null}
		</div>
	);

	if (seeds.length === 0)
		return (
			<div className="flex flex-col gap-3 p-3">
				{pickers}
				<Muted>
					Impact starts from the graph records {article(word)}{" "}
					{word.toLowerCase()}'s {evidenceCite(evidence)}. Add{" "}
					{article(evidence)} {evidence.toLowerCase()} that cites a graph
					record, and what it reaches shows here.
				</Muted>
			</div>
		);

	if (error && !reach)
		return (
			<div className="flex flex-col gap-3 p-3">
				{pickers}
				<ReadState loading={false} error={error} />
			</div>
		);

	// Who cites each seed — a hop-0 record opens the finding that cites it.
	const citedBy = new Map<string, Finding[]>();
	for (const f of from)
		for (const c of f.cites)
			if (c.kind === "record")
				citedBy.set(c.ref, [...(citedBy.get(c.ref) ?? []), f]);

	const groups = (reach?.hops ?? []).flatMap((h) =>
		h.groups.map((g) => ({ hop: h.hop, group: g })),
	);
	const toneOf = (hop: number, g: ReachGroup): Tone =>
		hop === 0 ? "success" : g.cut ? "warning" : "info";
	const nodes: LayeredNode[] = groups.map(({ hop, group }) => ({
		id: groupId(hop, group.label),
		label: `${group.count} · ${group.label}`,
		sub: hop === 0 ? "cited" : hopWord(hop),
		column: hop,
		tone: toneOf(hop, group),
	}));
	const joined = new Map<string, LayeredEdge>();
	for (const l of reach?.links ?? []) {
		const source = groupId(l.fromHop, l.fromLabel);
		const target = groupId(l.fromHop + 1, l.toLabel);
		const id = `${source}->${target}`;
		const seen = joined.get(id);
		joined.set(id, {
			id,
			source,
			target,
			label: seen ? `${seen.label} · ${l.edgeLabel}` : l.edgeLabel,
		});
	}
	const edges = [...joined.values()];

	const totals = new Map<string, number>();
	for (const { hop, group } of groups)
		if (hop > 0)
			totals.set(group.label, (totals.get(group.label) ?? 0) + group.count);
	const reached = [...totals.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([label, n]) => `${n} ${label}`)
		.join(" · ");

	const picked = groups.find(
		({ hop, group }) => groupId(hop, group.label) === selected,
	);
	const reviewed = from.filter((f) => f.reviewed_by_id).length;
	const origins = [
		...new Set(
			addresses.flatMap((a) => {
				const o = datasets.get(a)?.origin;
				return o ? [o] : [];
			}),
		),
	].sort();

	return (
		<div className="flex flex-col gap-3 p-3">
			{pickers}
			<p>
				What {optionTitle} reaches:{" "}
				{reached || (walking ? "reading…" : "nothing past what it cites")}
				{reached ? ` over ${hopWord(depth)}` : ""}
			</p>
			{reach?.errors.length ? (
				<Alert variant="destructive">
					<AlertTitle>The graph refused a read</AlertTitle>
					<AlertDescription>{reach.errors.join(" · ")}</AlertDescription>
				</Alert>
			) : null}
			<CanvasFrame>
				<LayeredCanvas
					kind="impact"
					layout="fixed"
					nodes={nodes}
					edges={edges}
					selectedNodeId={selected}
					onSelectNode={(id) => setSelected(id)}
				/>
			</CanvasFrame>
			{picked && reach ? (
				<Box
					title={`${picked.hop === 0 ? "cited" : hopWord(picked.hop)} · ${picked.group.label}`}
					count={picked.group.count}
				>
					<ul>
						{picked.group.ids.map((id) => {
							const by = citedBy.get(id) ?? [];
							return (
								<li key={id}>
									<RecordRow
										tone={toneOf(picked.hop, picked.group)}
										title={
											<span className="truncate">
												{reach.names.get(id) ?? id}
											</span>
										}
										subtitle={
											by.length ? (
												<span className="truncate">
													cited by {by.map((f) => `f${f.number}`).join(", ")}
												</span>
											) : undefined
										}
										onClick={
											by.length
												? () => onOpenFinding(by[0].number, branch.number)
												: undefined
										}
									/>
								</li>
							);
						})}
					</ul>
				</Box>
			) : null}
			<Box title="Links" count={groups.length}>
				<ul>
					{groups.map(({ hop, group }) => (
						<li key={groupId(hop, group.label)}>
							<RecordRow
								tone={toneOf(hop, group)}
								active={selected === groupId(hop, group.label)}
								title={
									<span className="truncate">
										{hop === 0 ? "cited" : hopWord(hop)} · {group.count}{" "}
										{group.label}
									</span>
								}
								subtitle={
									<span className="truncate">
										{hop === 0
											? `what the ${evidence.toLowerCase()} cites`
											: reach
												? viaOf(reach, hop, group)
												: ""}
									</span>
								}
								onClick={() => setSelected(groupId(hop, group.label))}
							/>
						</li>
					))}
				</ul>
			</Box>
			<Box title="Most reached" count={reach?.top.length ?? 0}>
				{reach?.top.length ? (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-[40%]">Record</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Hop</TableHead>
								<TableHead>Relationships</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{reach.top.map((r) => (
								<TableRow key={r.id}>
									<TableCell className="truncate">{r.name}</TableCell>
									<TableCell>{r.label}</TableCell>
									<TableCell>{r.hop}</TableCell>
									<TableCell>{r.degree}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				) : (
					<Muted>
						{walking
							? "Reading the graph…"
							: "Nothing reached past what it cites."}
					</Muted>
				)}
			</Box>
			<CaveatNote label="how sure" tone="info">
				Starts from {plural(seeds.length, "record")} cited by{" "}
				{evidence.toLowerCase() === "evidence"
					? plural(from.length, "piece of evidence", "pieces of evidence")
					: plural(from.length, evidence.toLowerCase())}
				, {reviewed} of them person-reviewed;{" "}
				{addresses.length === 0
					? "they cite no dataset."
					: origins.length
						? `their datasets are ${origins.join(", ")}.`
						: `they cite ${plural(addresses.length, "dataset")}.`}
			</CaveatNote>
		</div>
	);
}
