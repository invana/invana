/**
 * What this model *is*, on one line — and everything else behind `More` (ME21).
 *
 * The panel is a stack of drawers whose column belongs to the type lists
 * (ME13/ME15). A model's own metadata — description, validation mode, origin,
 * dates — still has to read somewhere, and the surface that would otherwise
 * carry it is `ModelFormDialog`, which nobody opens to *read*.
 *
 * So it reads here, collapsed to the one field a person actually scans (the
 * description) with the rest one click away. Collapsed it costs a single row;
 * expanded it is a `PropertyList`, the same label/value grammar the inspector
 * uses everywhere else.
 *
 * The version chips ride in the expanded block too, on the `Version` row. They
 * had a border-to-border row of their own above the drawers, which spent the
 * full width of the rail on two chips that change once per publish.
 */

import { formatRelativeTime } from "@/lib/time";
import type { GraphModelResponse, GraphModelSummary } from "@/types/models";
import { Button, PropertyList, PropertyRow, cn } from "@invana/ui";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";

/** Absolute, for the `title` — the row itself reads relative. */
const absolute = (iso: string) =>
	new Date(iso).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});

const relative = (iso: string) => formatRelativeTime(new Date(iso));

function Value({ children }: { children: ReactNode }) {
	return <span className="text-xs text-foreground">{children}</span>;
}

export function ModelMetaLine({
	/** The list summary renders immediately; the detail fills in the rest. */
	model,
	detail,
	/** The draft/active chips (`VersionBar`) — the `Version` row's value. */
	version,
	className,
}: {
	model: GraphModelSummary;
	detail?: GraphModelResponse;
	version?: ReactNode;
	className?: string;
}) {
	const [open, setOpen] = useState(false);

	const isSystem = model.origin === "introspected";
	const description =
		model.description ||
		detail?.description ||
		(isSystem ? "Live database schema." : "No description.");

	return (
		<div
			className={cn("flex shrink-0 flex-col border-b px-3 py-1.5", className)}
		>
			{/* `items-start` with both children on the same 20px line box: the
			    toggle sits on the description's *first* line and stays there when
			    an expanded description wraps. Baseline alignment cannot do it —
			    the button is a flex box whose baseline is its own content's. */}
			<div className="flex items-start gap-2">
				<p
					className={cn(
						"min-w-0 flex-1 text-sm leading-5 text-muted-foreground",
						// Collapsed is one line, always — a two-line description would
						// move the drawers under the reader between models.
						!open && "truncate",
					)}
					title={description}
				>
					{description}
				</p>
				<Button
					variant="ghost"
					size="sm"
					className="h-5 shrink-0 gap-1 px-1 text-xs leading-5 text-muted-foreground"
					aria-expanded={open}
					title={
						open
							? "Hide this model's details"
							: "Validation mode, origin, dates"
					}
					onClick={() => setOpen((v) => !v)}
				>
					{open ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					)}
					{open ? "Less" : "More"}
				</Button>
			</div>

			{open ? (
				<PropertyList labelWidth={96} className="pt-1.5 pb-0.5">
					<PropertyRow label="Validation">
						<Value>{detail?.validation_mode ?? "—"}</Value>
					</PropertyRow>
					<PropertyRow label="Origin">
						<Value>{model.origin}</Value>
					</PropertyRow>
					<PropertyRow label="Status">
						<Value>{model.status}</Value>
					</PropertyRow>
					<PropertyRow label="Version">
						{version ?? (
							<Value>
								{model.active_version?.version
									? `v${model.active_version.version} active`
									: "never published"}
							</Value>
						)}
					</PropertyRow>
					<PropertyRow label="Created">
						<Value>
							{detail ? (
								<span title={absolute(detail.created_at)}>
									{relative(detail.created_at)}
								</span>
							) : (
								"—"
							)}
						</Value>
					</PropertyRow>
					<PropertyRow label="Updated">
						<Value>
							<span title={absolute(model.updated_at)}>
								{relative(model.updated_at)}
							</span>
						</Value>
					</PropertyRow>
					{detail?.yaml_path ? (
						<PropertyRow label="YAML path" mono>
							<span className="break-all">{detail.yaml_path}</span>
						</PropertyRow>
					) : null}
				</PropertyList>
			) : null}
		</div>
	);
}
