/**
 * The emission card and its header
 * (docs/for-developers/modules/ask/features/the-answer-surface.md).
 *
 * Every emission a reader sees is this card: a 24px header — `kind` ·
 * `template@version` · `cite · N records` — over a body chosen by kind (AS8).
 * The header is the same component wherever an emission appears — the thread, a
 * task result, a scheduled answer (Ask K8) — which is why it knows nothing about
 * sessions or messages: it takes an `Emission` and nothing else.
 *
 * The template segment is absent until a projection chooses the rendering
 * (AS9). Nothing is defaulted in so the row looks complete.
 */

import {
	ChartBody,
	EmptyBody,
	MetricBody,
	ProseBody,
	SubgraphBody,
	TableEmissionBody,
} from "@/pages/graphs-detail/features/ask/answer-surface/EmissionBodies";
import type { Emission } from "@/types/emission";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	cn,
} from "@invana/ui";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

function EmissionHeader({
	emission,
	onSwitchTemplate,
	onOpenCitation,
}: {
	emission: Emission;
	onSwitchTemplate?: (templateId: string) => void;
	onOpenCitation?: () => void;
}) {
	const { template, citation } = emission;
	const offers = emission.templates ?? [];
	// Switching is a control *here*, on the header, not a setting elsewhere (P9).
	const canSwitch = Boolean(onSwitchTemplate) && offers.length > 1;

	return (
		<div className="flex h-6 items-center justify-between gap-2 border-b border-border bg-muted/50 px-2 text-meta leading-none">
			<div className="flex min-w-0 items-center gap-1.5">
				<span className="font-medium text-foreground">{emission.kind}</span>
				{canSwitch ? (
					<TemplatePicker
						emission={emission}
						onSwitchTemplate={onSwitchTemplate as (id: string) => void}
					/>
				) : (
					template && (
						<span className="truncate text-muted-foreground">
							{template.name}@{template.version}
						</span>
					)
				)}
			</div>
			<button
				type="button"
				disabled={!onOpenCitation}
				onClick={onOpenCitation}
				className={cn(
					"shrink-0 whitespace-nowrap text-muted-foreground",
					onOpenCitation && "hover:text-foreground hover:underline",
				)}
				title={citation.query ?? undefined}
			>
				cite · {citation.recordCount.toLocaleString()}{" "}
				{citation.recordCount === 1 ? "record" : "records"}
			</button>
		</div>
	);
}

/**
 * The template in use, and what else would render these same records.
 *
 * A template that cannot accept this shape is listed **disabled with its
 * reason** (P10) rather than hidden — a reader who expected a chart should be
 * told why there isn't one, not left to wonder. Choosing one re-renders from the
 * records already returned; the query never runs again (P5).
 */
function TemplatePicker({
	emission,
	onSwitchTemplate,
}: {
	emission: Emission;
	onSwitchTemplate: (templateId: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const offers = emission.templates ?? [];
	const label = emission.template
		? `${emission.template.name}@${emission.template.version}`
		: "no template";

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="flex min-w-0 items-center gap-0.5 truncate text-muted-foreground hover:text-foreground"
				>
					<span className="truncate">{label}</span>
					<ChevronDown className="h-3 w-3 shrink-0" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-64">
				{offers.map((offer) => (
					<DropdownMenuItem
						key={offer.templateId}
						disabled={!offer.available}
						onSelect={() => {
							if (offer.available) onSwitchTemplate(offer.templateId);
						}}
						className="flex flex-col items-start gap-0.5"
					>
						<span className="text-xs">
							{offer.name}
							<span className="ml-1.5 text-muted-foreground">
								{offer.surface}
							</span>
						</span>
						{offer.reason ? (
							<span className="text-meta text-muted-foreground">
								{offer.reason}
							</span>
						) : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function EmissionBody({ emission }: { emission: Emission }) {
	switch (emission.kind) {
		case "table":
			return <TableEmissionBody emission={emission} />;
		case "subgraph":
			return <SubgraphBody emission={emission} />;
		case "metric":
			return <MetricBody emission={emission} />;
		case "chart":
			return <ChartBody emission={emission} />;
		case "prose":
			return <ProseBody emission={emission} />;
		case "empty":
			return <EmptyBody emission={emission} />;
	}
}

export function EmissionCard({
	emission,
	className,
	onSwitchTemplate,
	onOpenCitation,
}: {
	emission: Emission;
	className?: string;
	/** Re-render these records through another template — never a re-run (P5). */
	onSwitchTemplate?: (templateId: string) => void;
	/** Open the trace at the step that produced this (AS3, RT1). */
	onOpenCitation?: () => void;
}) {
	return (
		<div
			// The kind is on the element because it is what an end-to-end test
			// asserts: which shape the answer took, not what the text says.
			data-testid="emission"
			data-emission-kind={emission.kind}
			className={cn(
				"overflow-hidden rounded-md border border-border bg-card",
				className,
			)}
		>
			<EmissionHeader
				emission={emission}
				onSwitchTemplate={onSwitchTemplate}
				onOpenCitation={onOpenCitation}
			/>
			<EmissionBody emission={emission} />
		</div>
	);
}

/** An answer's emissions, in the order the steps produced them (AS1, C2). */
export function EmissionList({
	emissions,
	onSwitchTemplate,
	onOpenCitation,
}: {
	emissions: Emission[];
	onSwitchTemplate?: (emissionId: string, templateId: string) => void;
	onOpenCitation?: (emissionId: string) => void;
}) {
	if (emissions.length === 0) return null;
	return (
		<div className="flex flex-col gap-2">
			{emissions.map((emission) => (
				<EmissionCard
					key={emission.id ?? emission.seq}
					emission={emission}
					onSwitchTemplate={
						emission.id && onSwitchTemplate
							? (templateId) =>
									onSwitchTemplate(emission.id as string, templateId)
							: undefined
					}
					onOpenCitation={
						emission.id && onOpenCitation
							? () => onOpenCitation(emission.id as string)
							: undefined
					}
				/>
			))}
		</div>
	);
}
