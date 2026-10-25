/**
 * A policy's **Statements** — one table, its rows grouped under the layer the
 * statement's first resource names (graph data · llm · third party · agents …),
 * in the engine's layer order. A layer row carries its label, its line and how
 * many rows sit under it; a row is effect · actions · resources · conditions.
 *
 * A draft's statements sit in a dashed box: they decide nothing until saved.
 * Under them, who the draft is meant for — the holders it is attached to.
 */

import {
	Eyebrow,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	TypographyInlineCode,
} from "@invana/ui";
import { Layers } from "lucide-react";
import { Fragment } from "react";
import type { LayerRead, PolicyRead, StatementRead } from "../types";
import { conditionsLine, EffectBadge } from "./policyParts";

interface Group {
	layer: LayerRead;
	rows: StatementRead[];
}

/** Statements under their layers, in the order the engine lists the layers. */
function byLayer(policy: PolicyRead): Group[] {
	const groups = new Map<string, Group>();
	for (const layer of policy.layers)
		groups.set(layer.layer, { layer, rows: [] });
	for (const s of policy.statements) {
		let group = groups.get(s.layer);
		if (!group) {
			group = { layer: { layer: s.layer, label: s.layer, line: "" }, rows: [] };
			groups.set(s.layer, group);
		}
		group.rows.push(s);
	}
	return [...groups.values()].filter((g) => g.rows.length > 0);
}

export function PolicyStatementsTab({ policy }: { policy: PolicyRead }) {
	const groups = byLayer(policy);
	const draft = policy.status === "draft";

	if (groups.length === 0)
		return (
			<p className="text-muted-foreground">
				No statements yet — this policy allows nothing.
				{policy.editable ? " Edit it to add one." : ""}
			</p>
		);

	return (
		<div className="flex flex-col gap-2">
			<div
				className={
					draft ? "rounded-md border border-dashed border-primary" : undefined
				}
			>
				<Table bordered={!draft} aria-label="Statements">
					<TableHeader>
						<TableRow>
							<TableHead className="w-20">Effect</TableHead>
							<TableHead>Actions</TableHead>
							<TableHead>Resources</TableHead>
							<TableHead>Conditions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{groups.map(({ layer, rows }) => (
							<Fragment key={layer.layer}>
								<TableRow className="bg-muted/60 hover:bg-muted/60">
									<TableCell colSpan={4}>
										<span className="flex items-center gap-2">
											<Layers className="size-3.5 text-muted-foreground" />
											<span className="font-mono font-semibold">
												{layer.label}
											</span>
											<span className="text-muted-foreground">
												{layer.line}
											</span>
											<span className="ml-auto text-muted-foreground">
												{rows.length} {rows.length === 1 ? "row" : "rows"}
											</span>
										</span>
									</TableCell>
								</TableRow>
								{rows.map((s, i) => (
									<TableRow
										// Statements have no id; their place in the layer is it.
										// biome-ignore lint/suspicious/noArrayIndexKey: see above
										key={`${layer.layer}-${i}`}
									>
										<TableCell>
											<EffectBadge />
										</TableCell>
										<TableCell>
											<TypographyInlineCode className="font-normal">
												{s.actions.join(" · ")}
											</TypographyInlineCode>
										</TableCell>
										<TableCell className="font-mono">
											{s.resources.join(" · ")}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{conditionsLine(s.conditions)}
										</TableCell>
									</TableRow>
								))}
							</Fragment>
						))}
					</TableBody>
				</Table>
			</div>
			{draft ? (
				<section className="flex flex-col gap-1 rounded-md border p-3">
					<Eyebrow>Held by</Eyebrow>
					<span>
						{policy.held_by.line === "nobody"
							? "Not attached to anyone yet — attach it on Held by."
							: policy.held_by.line}
					</span>
				</section>
			) : null}
			<p className="text-muted-foreground">
				A statement allows actions on resources. Resources are addressed by
				layer — graph data, llm, third party, cache, human — then name. Anything
				not allowed here, or by another policy the holder has, is refused.
			</p>
		</div>
	);
}
