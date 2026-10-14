/**
 * A record opened on the board — the card that floats top-right of the
 * canvas when a node or relationship is clicked. The chat stays where it was:
 * opening a record never takes the right side from the assistant.
 *
 *   LHR  airport                                     ✕
 *   city        London
 *   country     GB
 *   source      airports.csv · import 9/27
 *   [★ Ask about LHR]  [Expand]  Hide
 *
 * Its provenance — which model and run wrote it — reads before its values,
 * because a value you cannot trace is a value you cannot use. A record the
 * Graph no longer holds stays drawn and is marked, never dropped.
 */
import {
	Badge,
	Button,
	Card,
	PropertyList,
	PropertyRow,
	ScrollArea,
} from "@invana/ui";
import type { QueryResultItem } from "@invana-studio/core";
import { EyeOff, Share2, Star, X } from "lucide-react";
import {
	isProvenanceKey,
	ProvenanceBlock,
	readProvenance,
} from "../ProvenanceBlock";

export interface RecordCardProps {
	item: QueryResultItem;
	/** The record's type on the board — `airport`, `route`. */
	recordType: string;
	/** No longer in the Graph; kept on the board so the exploration reads true. */
	missing?: boolean;
	modelName?: (modelId: string) => string | undefined;
	onOpenModel?: (modelId: string) => void;
	/** Ask the assistant about this record. */
	onAsk: () => void;
	/** Expand a node's neighbours. Absent on a relationship. */
	onExpand?: () => void;
	onHide: () => void;
	onClose: () => void;
}

/** The properties a record is known by, tried in order — `LHR`, not its id. */
const NAME_KEYS = ["name", "title", "code", "label"];

function recordName(item: QueryResultItem): string {
	for (const key of NAME_KEYS) {
		const v = item.properties[key];
		if (v != null && v !== "") return String(v);
	}
	return item.label;
}

function show(value: unknown): string {
	if (value == null) return "—";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

export function RecordCard({
	item,
	recordType,
	missing,
	modelName,
	onOpenModel,
	onAsk,
	onExpand,
	onHide,
	onClose,
}: RecordCardProps) {
	const name = recordName(item);
	const provenance = readProvenance(item.properties);
	const rows = Object.entries(item.properties).filter(
		([key]) => !isProvenanceKey(key),
	);
	return (
		<Card className="flex w-80 flex-col shadow-lg" data-testid="record-card">
			<div className="flex items-center gap-2 border-b border-border px-3 py-2">
				<span className="truncate font-semibold">{name}</span>
				<span className="truncate text-sm text-muted-foreground">
					{recordType}
				</span>
				{missing && (
					<Badge
						variant="outline"
						title="No longer in the graph — kept on the board so the exploration still reads true"
					>
						missing
					</Badge>
				)}
				<Button
					variant="ghost"
					size="icon-sm"
					className="ml-auto"
					aria-label="Close record"
					onClick={onClose}
				>
					<X />
				</Button>
			</div>
			<ScrollArea className="max-h-80">
				<div className="flex flex-col gap-3 px-3 py-2">
					<ProvenanceBlock
						provenance={provenance}
						modelName={provenance ? modelName?.(provenance.modelId) : undefined}
						onOpenModel={onOpenModel}
					/>
					{rows.length === 0 ? (
						<p className="text-muted-foreground">No properties</p>
					) : (
						<PropertyList>
							{item.type === "edge" && (
								<>
									<PropertyRow label="from" mono>
										{item.source ?? "—"}
									</PropertyRow>
									<PropertyRow label="to" mono>
										{item.target ?? "—"}
									</PropertyRow>
								</>
							)}
							{rows.map(([key, value]) => (
								<PropertyRow key={key} label={key}>
									{show(value)}
								</PropertyRow>
							))}
						</PropertyList>
					)}
				</div>
			</ScrollArea>
			<div className="flex items-center gap-1.5 border-t border-border px-3 py-2">
				<Button size="sm" onClick={onAsk}>
					<Star />
					Ask about {name}
				</Button>
				{onExpand && (
					<Button size="sm" variant="outline" onClick={onExpand}>
						<Share2 />
						Expand
					</Button>
				)}
				<Button size="sm" variant="ghost" onClick={onHide}>
					<EyeOff />
					Hide
				</Button>
			</div>
		</Card>
	);
}
