/**
 * An answer template's page — board `template`, opened from Functions ›
 * Templates as a tab of its own.
 *
 * *As a builder, I want one template read end to end — what it renders to,
 * the shape it accepts, how often answers cite it and whether it is
 * published — so that I know what an answer will look like before it is
 * asked.*
 *
 * It is a statement of fact, not a disabled form: a published template is
 * read-only, because an answer rendered with it must not change shape after
 * the fact, and a shipped one belongs to every Graph. The page says which,
 * and offers the one act that applies — Publish for a draft, Remove for one
 * this Graph owns (refused by the engine while answers still cite it).
 */

import {
	EmptyState,
	PropertyList,
	PropertyRow,
	RecordHeader,
	Spinner,
} from "@invana/ui";
import { ActButton } from "@invana-studio/shell";
import { DetailStatus, FormError, PanelSection } from "@invana-studio/ui";
import { Trash2 } from "lucide-react";
import { useTemplateMutations, useTemplatesQuery } from "./templates";

export function TemplatePage({
	username,
	graphSlug,
	templateId,
}: {
	username: string;
	graphSlug: string;
	templateId: string;
}) {
	const templates = useTemplatesQuery(username, graphSlug);
	const { publish, remove } = useTemplateMutations(username, graphSlug);
	const t = templates.data?.find((x) => x.id === templateId);

	if (templates.isLoading)
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	if (!t)
		return (
			<EmptyState
				className="h-full"
				title="That template is gone"
				description={
					templates.error?.message ??
					"It was removed, or it belongs to another Graph. Close this page, or pick a template in Functions › Templates."
				}
			/>
		);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				crumbs={["Functions", t.name]}
				chips={
					<>
						<DetailStatus>{t.kind}</DetailStatus>
						<DetailStatus>v{t.version}</DetailStatus>
						<DetailStatus
							tone={t.status === "published" ? "success" : "warning"}
						>
							{t.status}
						</DetailStatus>
					</>
				}
				actions={
					t.shipped ? null : (
						<>
							{t.status === "draft" ? (
								<ActButton
									area="build"
									size="sm"
									disabled={publish.isPending}
									onClick={() => publish.mutate(t.id)}
								>
									Publish
								</ActButton>
							) : null}
							<ActButton
								area="build"
								size="sm"
								variant="ghost"
								disabled={remove.isPending}
								onClick={() => remove.mutate(t.id)}
								title="Remove — refused while answers still cite it"
							>
								<Trash2 />
								Remove
							</ActButton>
						</>
					)
				}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto p-3.5">
				<div className="flex flex-col gap-2.5">
					<FormError error={publish.error ?? remove.error} />
					<PanelSection card title="The template">
						<PropertyList>
							<PropertyRow label="Name" mono>
								{t.name}
							</PropertyRow>
							<PropertyRow label="What it shows">
								{t.intent || "no intent stated"}
							</PropertyRow>
							<PropertyRow label="Kind">{t.kind}</PropertyRow>
							<PropertyRow label="Surface">{t.surface}</PropertyRow>
							<PropertyRow label="Version">{`v${t.version}`}</PropertyRow>
							<PropertyRow label="Answers citing it">
								{t.used.toLocaleString()}
							</PropertyRow>
							<PropertyRow label="Owner">
								{t.shipped ? "ships with Invana — every Graph" : "this Graph"}
							</PropertyRow>
						</PropertyList>
					</PanelSection>
					<PanelSection card title="Accepts" hint="what it can render">
						{/* The shape it accepts is why selection can rank it against the shipped templates. */}
						<pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm text-muted-foreground">
							{JSON.stringify(t.accepts, null, 2)}
						</pre>
					</PanelSection>
					{Object.keys(t.spec ?? {}).length ? (
						<PanelSection card title="Shape">
							<pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm text-muted-foreground">
								{JSON.stringify(t.spec, null, 2)}
							</pre>
						</PanelSection>
					) : null}
				</div>
			</div>
		</div>
	);
}
