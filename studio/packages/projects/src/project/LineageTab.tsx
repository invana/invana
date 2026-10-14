/**
 * **Lineage** — a decision traced back to the original authors of the data it
 * rests on (projects.md PJ-11, board `projects.lineage`).
 *
 * Drawn left to right on the shared layered canvas: the **original authors**
 * of each dataset (its author chain), the **datasets** and **runs** the
 * findings cite, the **findings** the decision cites, and the **decision**.
 * Every edge is a record — an authorship on the dataset, a cite on the
 * finding, a cite on the decision — so following the edges is following the
 * records. Lineage is built from the records, never inferred.
 *
 * *Show* narrows the datasets to one origin (official, observed, collected …)
 * and takes their authors with them; findings and runs stay, because the
 * decision still stands on them. Under the drawing, **Links** says every hop
 * in words — what each node cites and what cites it — for a reader who cannot
 * see the canvas and for one who wants the full text a node's label clips.
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
	LayeredCanvas,
	type LayeredEdge,
	type LayeredNode,
} from "@invana-studio/canvases";
import { RecordRow, type Tone } from "@invana-studio/ui";
import { useState } from "react";
import { useFindings, useLineageDatasets } from "../records/queries";
import {
	parseDatasetRef,
	type useProjectRecords,
} from "../records/useProjectRecords";
import { branchLabel, choiceLabel, plural, shortDate } from "../records/words";
import type { Project } from "../types";
import { Box, CanvasFrame, Muted } from "./parts";

const ALL = "all";

/** A node of the drawing, with what it links to in words. */
interface Hop {
	id: string;
	column: number;
	label: string;
	sub: string;
	tone: Tone;
	/** Every hop this node makes, named — `cites run 8195c5e8 · cited by d1`. */
	links: string;
	open?: () => void;
}

const list = (xs: string[]) => xs.join(", ");

export function LineageTab({
	username,
	graphSlug,
	project,
	records,
	decision,
	onPick,
	onOpenFinding,
	onOpenRun,
	onOpenDataset,
}: {
	username: string;
	graphSlug: string;
	project: Project;
	records: ReturnType<typeof useProjectRecords>;
	/** The decision traced; the newest when none is named. */
	decision: number | null;
	onPick: (n: number) => void;
	onOpenFinding: (n: number, branch: number) => void;
	onOpenRun?: (runId: string) => void;
	onOpenDataset?: (address: string) => void;
}) {
	const [origin, setOrigin] = useState(ALL);
	const ref = { username, graphSlug, key: project.key };
	const decisions = [...records.decisions].sort((a, b) => b.number - a.number);
	const picked = decisions.find((d) => d.number === decision) ?? decisions[0];
	const { findings } = useFindings(ref, picked?.cites ?? []);
	const addressOf = (r: string) => {
		const d = parseDatasetRef(r);
		return d ? `${d.publisher}/${d.name}` : null;
	};
	const allAddresses = [
		...new Set(
			findings.flatMap((f) =>
				f.cites.flatMap((c) => {
					const a = c.kind === "dataset" ? addressOf(c.ref) : null;
					return a ? [a] : [];
				}),
			),
		),
	];
	const datasets = useLineageDatasets(allAddresses);
	const origins = [
		...new Set(
			allAddresses.flatMap((a) => {
				const o = datasets.get(a)?.origin;
				return o ? [o] : [];
			}),
		),
	].sort();

	if (!picked)
		return (
			<div className="p-3">
				<Muted>
					Lineage starts from a decision. Decide a branch, and what it rests on
					is traced here back to the people who first wrote the data.
				</Muted>
			</div>
		);

	const shown = allAddresses.filter(
		(a) => origin === ALL || datasets.get(a)?.origin === origin,
	);
	const fLabel = (n: number) => `f${n}`;
	const dLabel = `d${picked.number}`;
	const runLabel = (r: string) => `run ${r.slice(0, 8)}`;
	const dsLabel = (a: string) => datasets.get(a)?.title || a;

	const hops: Hop[] = [];
	const edges: LayeredEdge[] = [];

	// The decision, and the findings it cites.
	hops.push({
		id: "decision",
		column: 4,
		label:
			`${choiceLabel(project, picked.choice)} ${picked.branch_number !== null ? branchLabel(project, picked.branch_number) : ""}`.trim(),
		sub: `${dLabel} · ${shortDate(picked.created_at)}`,
		tone: "success",
		links: [
			dLabel,
			findings.length
				? `cites ${list(findings.map((f) => fLabel(f.number)))}`
				: "cites no finding",
			shortDate(picked.created_at),
			"rationale kept",
		].join(" · "),
	});
	for (const f of findings) {
		const ranOn = f.cites.filter((c) => c.kind === "run").map((c) => c.ref);
		const cited = f.cites.flatMap((c) => {
			const a = c.kind === "dataset" ? addressOf(c.ref) : null;
			return a ? [a] : [];
		});
		const recordCites = f.cites.filter((c) => c.kind === "record").length;
		hops.push({
			id: `f:${f.number}`,
			column: 3,
			label: f.statement,
			sub: `${fLabel(f.number)} · ${f.stance}`,
			tone: f.reviewed_by_id ? "success" : "warning",
			links: [
				`${fLabel(f.number)} · ${f.stance} · ${f.reviewed_by_id ? "reviewed" : "not reviewed"}`,
				ranOn.length || cited.length || recordCites
					? `cites ${list([
							...ranOn.map(runLabel),
							...cited.map(dsLabel),
							...(recordCites ? [plural(recordCites, "record")] : []),
						])}`
					: "cites nothing",
				`cited by ${dLabel}`,
			].join(" · "),
			open: () =>
				onOpenFinding(f.number, f.branch_number ?? picked.branch_number ?? 1),
		});
		edges.push({
			id: `f${f.number}-d`,
			source: `f:${f.number}`,
			target: "decision",
			label: "cited by",
		});
	}

	// The runs and datasets the findings cite.
	const citers = (match: (kind: string, r: string) => boolean) =>
		findings.filter((f) => f.cites.some((c) => match(c.kind, c.ref)));
	const runs = [
		...new Set(
			findings.flatMap((f) =>
				f.cites.filter((c) => c.kind === "run").map((c) => c.ref),
			),
		),
	];
	for (const r of runs) {
		const by = citers((k, x) => k === "run" && x === r);
		hops.push({
			id: `r:${r}`,
			column: 2,
			label: runLabel(r),
			sub: "derived output",
			tone: "info",
			links: `derived output · cited by ${list(by.map((f) => fLabel(f.number)))}`,
			open: onOpenRun ? () => onOpenRun(r) : undefined,
		});
		for (const f of by)
			edges.push({
				id: `r:${r}-f${f.number}`,
				source: `r:${r}`,
				target: `f:${f.number}`,
				label: "cited by",
			});
	}
	const authorsOf = (a: string) =>
		(datasets.get(a)?.author_chain ?? []).filter(
			(s) => s.role === "original" || s.role === "collected_by",
		);
	for (const a of shown) {
		const d = datasets.get(a);
		const by = citers((k, x) => k === "dataset" && addressOf(x) === a);
		const authors = authorsOf(a);
		hops.push({
			id: `ds:${a}`,
			column: 1,
			label: dsLabel(a),
			sub: [d?.origin, d?.licence].filter(Boolean).join(" · ") || a,
			tone: "info",
			links: [
				d?.origin ?? "dataset",
				authors.length
					? `by ${list(authors.map((s) => s.name))}`
					: "names no author",
				`cited by ${list(by.map((f) => fLabel(f.number)))}`,
			].join(" · "),
			open: onOpenDataset ? () => onOpenDataset(a) : undefined,
		});
		for (const f of by)
			edges.push({
				id: `ds:${a}-f${f.number}`,
				source: `ds:${a}`,
				target: `f:${f.number}`,
				label: "cited by",
			});
	}

	// The original authors of the datasets shown, each once.
	const wrote = new Map<string, { name: string; kind: string; of: string[] }>();
	for (const a of shown)
		for (const s of authorsOf(a)) {
			const id = `a:${s.kind}:${s.name}`;
			const entry = wrote.get(id) ?? { name: s.name, kind: s.kind, of: [] };
			entry.of.push(a);
			wrote.set(id, entry);
			edges.push({
				id: `${id}-${a}`,
				source: id,
				target: `ds:${a}`,
				label: s.role === "original" ? "author" : "collected",
				dashed: true,
			});
		}
	for (const [id, w] of wrote)
		hops.push({
			id,
			column: 0,
			label: w.name,
			sub: w.kind,
			tone: "muted",
			links: `${w.kind} · wrote ${list(w.of.map(dsLabel))}`,
			open: onOpenDataset ? () => onOpenDataset(w.of[0]) : undefined,
		});

	const nodes: LayeredNode[] = hops.map((h) => ({
		id: h.id,
		label: h.label,
		sub: h.sub,
		column: h.column,
		tone: h.tone,
	}));
	const byId = new Map(hops.map((h) => [h.id, h]));

	return (
		<div className="flex flex-col gap-3 p-3">
			<div className="flex flex-wrap items-center gap-3">
				<Label>Decision</Label>
				<Select
					value={String(picked.number)}
					onValueChange={(v) => onPick(Number(v))}
				>
					<SelectTrigger aria-label="Decision" className="w-80">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{decisions.map((d) => (
							<SelectItem key={d.id} value={String(d.number)}>
								d{d.number} · {choiceLabel(project, d.choice)}{" "}
								{d.branch_number !== null
									? branchLabel(project, d.branch_number)
									: ""}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Label>Show</Label>
				<Select value={origin} onValueChange={setOrigin}>
					<SelectTrigger aria-label="Show" className="w-48">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>all origins</SelectItem>
						{origins.map((o) => (
							<SelectItem key={o} value={o}>
								{o} only
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<span className="text-sm text-muted-foreground">
					click any node to open it
				</span>
			</div>
			<CanvasFrame>
				<LayeredCanvas
					kind="provenance"
					layout="fixed"
					nodes={nodes}
					edges={edges}
					onSelectNode={(id) => {
						if (id) byId.get(id)?.open?.();
					}}
				/>
			</CanvasFrame>
			<Box title="Links" count={edges.length}>
				<ul>
					{hops.map((h) => (
						<li key={h.id}>
							<RecordRow
								tone={h.tone}
								title={<span className="truncate">{h.label}</span>}
								subtitle={<span className="truncate">{h.links}</span>}
								onClick={h.open}
							/>
						</li>
					))}
				</ul>
			</Box>
		</div>
	);
}
