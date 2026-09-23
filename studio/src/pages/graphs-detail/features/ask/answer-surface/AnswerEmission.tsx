/**
 * The emission card
 * (docs/for-developers/modules/ask/features/the-answer-surface.md).
 *
 * The card, its header and the template picker are all `@invana/ui`
 * (`EmissionCard` · `EmissionHeader` · `TemplatePicker`). The kit takes a
 * **kind, a template name and children — never a domain object** (DS6), so what
 * lives here is the one thing the kit cannot own: the mapping from Invana's
 * `Emission` onto those slots, and the body chosen by kind (AS8).
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
import type { Emission, TemplateOffer } from "@/types/emission";
import {
	EmissionCard,
	type EmissionKind,
	Popover,
	PopoverContent,
	PopoverTrigger,
	type TemplateOption,
	TemplatePicker,
} from "@invana/ui";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

/** The label a reader knows a template by — `table-compact@3`. */
const offerLabel = (offer: TemplateOffer) => `${offer.name}@${offer.version}`;

/**
 * The template in use, and what else would render these same records.
 *
 * A template that cannot accept this shape is listed **with its reason** (P10)
 * rather than hidden — a reader who expected a chart should be told why there
 * isn't one. Choosing one re-renders from the records already returned; the
 * query never runs again (P5).
 */
function TemplateSwitcher({
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

	// The kit's picker is keyed by the label it prints, so the label is the id
	// here and this maps it back to the template the engine switches on.
	const byLabel = useMemo(
		() => new Map(offers.map((o) => [offerLabel(o), o.templateId])),
		[offers],
	);
	const options = useMemo<TemplateOption[]>(
		() =>
			offers.map((o) => ({
				id: offerLabel(o),
				// A template's `surface` is the wider vocabulary an emission kind is
				// drawn from (`markdown`, `confirm`); the kit types this slot as the
				// narrower `EmissionKind` and only ever prints it.
				kind: o.surface as EmissionKind,
				unavailable: o.available
					? undefined
					: (o.reason ?? "cannot render this shape"),
			})),
		[offers],
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex min-w-0 items-center gap-0.5 truncate font-mono text-muted-foreground hover:text-foreground"
				>
					<span className="truncate">{label}</span>
					<ChevronDown className="h-3 w-3 shrink-0" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72 p-0">
				<TemplatePicker
					className="border-0"
					heading={`Render these ${emission.citation.recordCount.toLocaleString()} records as`}
					options={options}
					value={label}
					onSelect={(id) => {
						const templateId = byLabel.get(id);
						if (templateId) {
							onSwitchTemplate(templateId);
							setOpen(false);
						}
					}}
					footnote="Re-rendered from the records already returned — the query does not run again."
				/>
			</PopoverContent>
		</Popover>
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

export function AnswerEmission({
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
	const { template, citation } = emission;
	const offers = emission.templates ?? [];
	// Switching is a control *here*, on the header, not a setting elsewhere (P9).
	const canSwitch = Boolean(onSwitchTemplate) && offers.length > 1;

	return (
		<EmissionCard
			// The kind is on the element because it is what an end-to-end test
			// asserts: which shape the answer took, not what the text says.
			data-testid="emission"
			data-emission-kind={emission.kind}
			kind={emission.kind}
			className={className}
			template={
				canSwitch ? (
					<TemplateSwitcher
						emission={emission}
						onSwitchTemplate={onSwitchTemplate as (id: string) => void}
					/>
				) : template ? (
					`${template.name}@${template.version}`
				) : undefined
			}
			citation={
				<button
					type="button"
					disabled={!onOpenCitation}
					onClick={onOpenCitation}
					className={
						onOpenCitation ? "hover:text-foreground hover:underline" : undefined
					}
					title={citation.query ?? undefined}
				>
					cite · {citation.recordCount.toLocaleString()}{" "}
					{citation.recordCount === 1 ? "record" : "records"}
				</button>
			}
		>
			<EmissionBody emission={emission} />
		</EmissionCard>
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
				<AnswerEmission
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
