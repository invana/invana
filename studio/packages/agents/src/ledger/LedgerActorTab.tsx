/**
 * Ledger › By actor (`?actor=agent:<id>&since=7d`): one person or agent over
 * a window — tiles Acts · Writes · Third-party · Secrets · Refused, then what
 * it touched in Graph data, on the web and through LLMs, and the helpers it
 * acted through. An agent's numbers include every row whose chain names it,
 * so the helpers it spawned or delegated to count too.
 */

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	EmptyState,
	MetricGrid,
	MetricTile,
	TypographyInlineCode,
} from "@invana/ui";
import { FleetReadState, tokens } from "../overview/fleetParts";
import { useActorOptions } from "./actors";
import { CountTable } from "./CountTable";
import { byReason, n, SINCE_OPTIONS, sinceLabel } from "./ledgerParts";
import { useLedgerActorQuery } from "./queries";
import { SinceSelect } from "./SinceSelect";
import { useSearchParam } from "./useSearchParam";

export function LedgerActorTab({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const [actor, setActor] = useSearchParam("actor");
	const [sinceParam, setSince] = useSearchParam("since");
	const since = sinceParam || "7d";
	const options = useActorOptions(username, graphSlug);
	const read = useLedgerActorQuery(username, graphSlug, actor || null, since);
	const d = read.data;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<Select value={actor} onValueChange={setActor}>
					<SelectTrigger className="w-72" aria-label="Actor">
						<SelectValue placeholder="Pick a person or an agent" />
					</SelectTrigger>
					<SelectContent>
						{options.map((o) => (
							<SelectItem key={o.value} value={o.value}>
								{o.label}
								<span className="text-muted-foreground"> · {o.kind}</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<SinceSelect
					value={since}
					options={SINCE_OPTIONS}
					onChange={setSince}
				/>
				<span className="ml-auto text-muted-foreground">
					includes acts by the helpers it spawned or delegated to
				</span>
			</div>

			{!actor ? (
				<EmptyState
					title="Pick a person or an agent"
					description="Every act it made, and every act made through it, over the window."
				/>
			) : !d ? (
				<FleetReadState
					loading={read.isLoading}
					error={read.error}
					what="the actor"
				/>
			) : (
				<>
					<MetricGrid minTileWidth={160}>
						<MetricTile
							label="Acts"
							value={n(d.acts)}
							caption={sinceLabel(d.since).toLowerCase()}
							captionTone="muted"
						/>
						<MetricTile
							label="Writes"
							value={n(d.writes)}
							caption={`${n(d.writes_refused)} refused`}
							captionTone="muted"
						/>
						<MetricTile
							label="Third-party"
							value={n(d.third_party)}
							caption="web reads"
							captionTone="muted"
						/>
						<MetricTile
							label="Secrets"
							value={n(d.secrets)}
							caption={d.secret_names.join(" · ") || undefined}
							captionTone="muted"
						/>
						<MetricTile
							label="Refused"
							value={n(d.refused)}
							caption={byReason(d.refused_by) || undefined}
							captionTone="muted"
						/>
					</MetricGrid>
					<div className="grid gap-3 lg:grid-cols-2">
						<CountTable
							title="Graph data"
							rows={d.graph}
							rowKey={(r) => r.key}
							empty="No Graph data touched"
							columns={[
								{
									header: "Type",
									cell: (r) => (
										<TypographyInlineCode>{r.key}</TypographyInlineCode>
									),
								},
								{ header: "Read", cell: (r) => n(r.a), numeric: true },
								{ header: "Written", cell: (r) => n(r.b), numeric: true },
								{
									header: "Refused",
									cell: (r) => (r.line ? `${n(r.c)} · ${r.line}` : n(r.c)),
									numeric: true,
								},
							]}
						/>
						<CountTable
							title="Web"
							rows={d.web}
							rowKey={(r) => r.key}
							empty="No web reads"
							columns={[
								{
									header: "Domain",
									cell: (r) => (
										<TypographyInlineCode>{r.key}</TypographyInlineCode>
									),
								},
								{ header: "Reads", cell: (r) => n(r.a), numeric: true },
								{
									header: "Refused",
									cell: (r) => (r.line ? `${n(r.b)} · ${r.line}` : n(r.b)),
									numeric: true,
								},
							]}
						/>
						<CountTable
							title="LLM"
							rows={d.llm}
							rowKey={(r) => r.key}
							empty="No model calls"
							columns={[
								{
									header: "Model",
									cell: (r) => (
										<TypographyInlineCode>{r.key}</TypographyInlineCode>
									),
								},
								{ header: "Calls", cell: (r) => n(r.a), numeric: true },
								{ header: "Tokens", cell: (r) => tokens(r.b), numeric: true },
							]}
						/>
						<CountTable
							title="Acted through"
							rows={d.acted_through}
							rowKey={(r) => r.key}
							empty="Acted through no helper"
							columns={[
								{ header: "Agent", cell: (r) => r.key },
								{ header: "Kind", cell: (r) => r.line || "—" },
								{ header: "Acts", cell: (r) => n(r.a), numeric: true },
							]}
						/>
					</div>
				</>
			)}
		</div>
	);
}
