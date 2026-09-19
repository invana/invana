/**
 * Where this element came from — model · file · record · run.
 *
 * Every element an import writes carries its source record on itself
 * (docs/for-developers/modules/bring-data-in/features/load-data.md LD4), so this
 * block needs no request: it reads `_inv_model_id`, `_inv_file`,
 * `_inv_record_id` and `_inv_run_id` off the node the inspector already has.
 *
 * That is the whole point of stamping them. "Where did this number come from"
 * ends at a record rather than at a shrug (IW1), and it ends there even when the
 * run that wrote it was months ago.
 *
 * A node with no stamps is not an error: it was written by `invana loader`, the
 * fast path, which validates nothing and stamps nothing. The block says that
 * rather than showing an empty table.
 */

import { FileText } from "lucide-react";

const KEYS = {
	model: "_inv_model_id",
	record: "_inv_record_id",
	run: "_inv_run_id",
	file: "_inv_file",
} as const;

export interface Provenance {
	modelId: string;
	recordId: string;
	runId: string | null;
	file: string | null;
}

/** Read the stamps off an element's properties, or null when it carries none. */
export function readProvenance(
	properties: Record<string, unknown> | undefined,
): Provenance | null {
	if (!properties) return null;
	const modelId = properties[KEYS.model];
	const recordId = properties[KEYS.record];
	if (typeof modelId !== "string" || typeof recordId !== "string") return null;
	return {
		modelId,
		recordId,
		runId:
			typeof properties[KEYS.run] === "string"
				? (properties[KEYS.run] as string)
				: null,
		file:
			typeof properties[KEYS.file] === "string"
				? (properties[KEYS.file] as string)
				: null,
	};
}

/** The property keys provenance uses — hidden from the ordinary property list. */
export function isProvenanceKey(key: string): boolean {
	return key.startsWith("_inv_");
}

export function ProvenanceBlock({
	provenance,
	modelName,
	onOpenModel,
}: {
	provenance: Provenance | null;
	/** Resolved name, when the models list is to hand; the id otherwise. */
	modelName?: string;
	onOpenModel?: (modelId: string) => void;
}) {
	if (!provenance) {
		return (
			<div>
				<p className="mb-1.5 text-muted-foreground">Provenance</p>
				<p className="text-muted-foreground italic">
					No source record. This was written by <code>invana loader</code>, the
					fast path — it validates nothing and stamps nothing.
				</p>
			</div>
		);
	}

	const line = [
		modelName ?? provenance.modelId,
		provenance.file,
		`record #${provenance.recordId}`,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div>
			<p className="mb-1.5 text-muted-foreground">Provenance</p>
			<button
				type="button"
				disabled={!onOpenModel}
				onClick={() => onOpenModel?.(provenance.modelId)}
				className="flex w-full items-start gap-2 text-left"
			>
				<FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
				<span className="min-w-0">
					<span className="block break-all font-mono text-foreground">
						{line}
					</span>
					{provenance.runId ? (
						<span className="block font-mono text-meta text-muted-foreground">
							run {provenance.runId.slice(0, 8)}
						</span>
					) : null}
				</span>
			</button>
		</div>
	);
}
