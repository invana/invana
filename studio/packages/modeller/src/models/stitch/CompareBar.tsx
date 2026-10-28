/**
 * The Comparing bar over the global model — any two versions of one model, on
 * the map. It is presentational: the page owns the pair and the one diff read
 * whose marks the map draws, so the counts here and the chips there are the
 * same answer.
 */

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import { Badge, Button, Card } from "@invana/ui";
import { ArrowRight, X } from "lucide-react";
import type { SchemaDiff, VersionSummary } from "../types";

interface CompareModelOption {
	id: string;
	name: string;
}

export interface CompareBarProps {
	models: CompareModelOption[];
	modelId: string;
	onModel: (modelId: string) => void;
	/** The model's published versions and its draft. */
	versions: VersionSummary[];
	from: string | undefined;
	to: string | undefined;
	onFrom: (versionId: string) => void;
	onTo: (versionId: string) => void;
	/** The pair's diff; its counts are the bar's. */
	diff: SchemaDiff | undefined;
	/** *Review and publish* — shown only when `to` is the draft. */
	onReview: () => void;
	onClose: () => void;
}

/** A draft reads as the version it publishes as, once the diff has said. */
const versionLabel = (v: VersionSummary, next: string | null | undefined) =>
	v.status !== "draft" ? `v${v.version}` : next ? `v${next} draft` : "draft";

function VersionSelect({
	label,
	value,
	versions,
	next,
	onChange,
}: {
	label: string;
	value: string | undefined;
	versions: VersionSummary[];
	next: string | null | undefined;
	onChange: (versionId: string) => void;
}) {
	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger aria-label={label} className="w-28">
				<SelectValue placeholder={label} />
			</SelectTrigger>
			<SelectContent>
				{versions.map((v) => (
					<SelectItem key={v.id} value={v.id}>
						{versionLabel(v, next)}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export function CompareBar({
	models,
	modelId,
	onModel,
	versions,
	from,
	to,
	onFrom,
	onTo,
	diff,
	onReview,
	onClose,
}: CompareBarProps) {
	const toDraft = versions.find((v) => v.id === to)?.status === "draft";
	return (
		<Card className="flex w-fit items-center gap-2.5 py-1.5 pr-2 pl-3 shadow-md">
			<span className="text-muted-foreground">Comparing</span>
			<Select value={modelId} onValueChange={onModel}>
				<SelectTrigger aria-label="Model" className="w-40">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{models.map((m) => (
						<SelectItem key={m.id} value={m.id}>
							{m.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<VersionSelect
				label="From"
				value={from}
				versions={versions}
				next={diff?.next_version}
				onChange={onFrom}
			/>
			<ArrowRight className="size-3.5 text-muted-foreground" />
			<VersionSelect
				label="To"
				value={to}
				versions={versions}
				next={diff?.next_version}
				onChange={onTo}
			/>
			{diff ? (
				<span className="flex items-center gap-1.5">
					<Badge variant="soft" tone="success" size="xs">
						+ {diff.added} added
					</Badge>
					<Badge variant="soft" tone="warning" size="xs">
						~ {diff.changed} changed
					</Badge>
					<Badge variant="soft" tone="destructive" size="xs">
						− {diff.removed} removed
					</Badge>
				</span>
			) : null}
			{toDraft ? <Button onClick={onReview}>Review and publish</Button> : null}
			<Button
				variant="ghost"
				size="icon"
				aria-label="Close compare"
				onClick={onClose}
			>
				<X />
			</Button>
		</Card>
	);
}
