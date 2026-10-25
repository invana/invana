/**
 * A run › **Data touched** — graph data (type · read · written · refused),
 * the web (domain · pages · refused and why), LLMs (model · calls · tokens in
 * and out) and secrets (name · used by · where). Every count is the engine's;
 * each row is also a ledger row with its actor chain.
 */

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	TypographyInlineCode,
} from "@invana/ui";
import { PanelSection } from "@invana-studio/ui";
import type { ReactNode } from "react";
import { TabReadState } from "../../agents/agentParts";
import { tokens } from "../../overview/fleetParts";
import { useRunTouchedQuery } from "../queries";

function Section({
	title,
	empty,
	head,
	children,
	rows,
}: {
	title: string;
	empty: string;
	head: string[];
	children: ReactNode;
	rows: number;
}) {
	return (
		<PanelSection card title={title}>
			{rows ? (
				<Table bordered={false} density="compact">
					<TableHeader>
						<TableRow>
							{head.map((h) => (
								<TableHead key={h} className="whitespace-nowrap">
									{h}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>{children}</TableBody>
				</Table>
			) : (
				<p className="py-2 text-muted-foreground">{empty}</p>
			)}
		</PanelSection>
	);
}

/** `3 · robots` — a refusal count with the engine's reason. */
const refused = (n: number, line: string) =>
	n ? [n, line].filter(Boolean).join(" · ") : "0";

export function TouchedTab({
	username,
	graphSlug,
	runId,
	live,
}: {
	username: string;
	graphSlug: string;
	runId: string;
	live: boolean;
}) {
	const touched = useRunTouchedQuery(username, graphSlug, runId, live);
	const t = touched.data;
	if (!t)
		return (
			<TabReadState
				loading={touched.isLoading}
				error={touched.error}
				what="what this run touched"
				onRetry={() => void touched.refetch()}
			/>
		);
	return (
		<div className="flex flex-col gap-3 p-3">
			<div className="grid gap-3 lg:grid-cols-2">
				<Section
					title="Graph data"
					empty="It read and wrote nothing in the graph."
					head={["Type", "Read", "Written", "Refused"]}
					rows={t.graph.length}
				>
					{t.graph.map((g) => (
						<TableRow key={g.type}>
							<TableCell className="w-full">
								<TypographyInlineCode>{g.type}</TypographyInlineCode>
							</TableCell>
							<TableCell className="font-mono">{g.read}</TableCell>
							<TableCell className="font-mono">{g.written}</TableCell>
							<TableCell className="whitespace-nowrap font-mono">
								{refused(g.refused, g.refused_line)}
							</TableCell>
						</TableRow>
					))}
				</Section>
				<Section
					title="Web"
					empty="It reached no web page."
					head={["Domain", "Pages", "Refused"]}
					rows={t.web.length}
				>
					{t.web.map((w) => (
						<TableRow key={w.domain}>
							<TableCell className="w-full">
								<TypographyInlineCode>{w.domain}</TypographyInlineCode>
							</TableCell>
							<TableCell className="font-mono">{w.pages}</TableCell>
							<TableCell className="whitespace-nowrap font-mono">
								{refused(w.refused, w.refused_line)}
							</TableCell>
						</TableRow>
					))}
				</Section>
				<Section
					title="LLM"
					empty="It called no model."
					head={["Model", "Calls", "Tokens in", "Tokens out"]}
					rows={t.llm.length}
				>
					{t.llm.map((m, i) => (
						<TableRow key={m.model ?? `unrecorded-${i}`}>
							<TableCell className="w-full">
								{m.model ? (
									<TypographyInlineCode>{m.model}</TypographyInlineCode>
								) : (
									<span className="text-muted-foreground">not recorded</span>
								)}
							</TableCell>
							<TableCell className="whitespace-nowrap font-mono">
								{m.calls}
							</TableCell>
							<TableCell className="whitespace-nowrap font-mono">
								{tokens(m.tokens_in)}
							</TableCell>
							<TableCell className="whitespace-nowrap font-mono">
								{tokens(m.tokens_out)}
							</TableCell>
						</TableRow>
					))}
				</Section>
				<Section
					title="Secrets"
					empty="It used no secret."
					head={["Name", "Used by", "Where"]}
					rows={t.secrets.length}
				>
					{t.secrets.map((s) => (
						<TableRow key={s.name}>
							<TableCell>
								<TypographyInlineCode>{s.name}</TypographyInlineCode>
							</TableCell>
							<TableCell>{s.used_by || "—"}</TableCell>
							<TableCell className="text-muted-foreground">{s.where}</TableCell>
						</TableRow>
					))}
				</Section>
			</div>
			<p className="text-sm text-muted-foreground">
				Every row is in the ledger with its actor chain. A refused one shows the
				rule that held.
			</p>
		</div>
	);
}
