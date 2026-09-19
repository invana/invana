import { EmissionList } from "@/pages/graphs-detail/features/ask/answer-surface/EmissionCard";
import { TraceDialog } from "@/pages/graphs-detail/features/ask/answer-surface/TraceDialog";
import { emissionsFromResult } from "@/pages/graphs-detail/features/ask/answer-surface/emissions";
import { emissionsApi } from "@/services/api/runs";
import type { Emission } from "@/types/emission";
import type { QueryResponse } from "@/types/query";
import { Button } from "@invana/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Network } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

// An assistant reply's result, rendered as the emissions it is
// (docs/for-developers/modules/ask/features/the-answer-surface.md). Every one
// of them goes through the emission card — header over a body (AS8) — rather
// than a bare table under the reply.
//
// A graph result is the one that waits: until it is on the canvas it is an
// offer on the reply's own line (see `LoadToCanvasAction`), because the counts
// are already in the reply sentence and the Project step above it. Once it has
// landed, the subgraph emission states what landed and what it did not replace
// (AS5).
// An emission is a **record** now (AS10): given a run, this reads the
// emissions the `project` step wrote, so an answer survives a reload instead of
// living in the page until someone refreshes. A reply with no run — an
// older row, or one whose run was pruned — still falls back to folding one out of
// the query result it carries, and says nothing it cannot back up: no template
// name, because none chose the rendering (AS9).

export interface ResultBlockProps {
	result: QueryResponse | null | undefined;
	/** This reply's graph result is already painted on the canvas. */
	onCanvas?: boolean;
	/** The run that produced the answer; without one there is nothing to read. */
	runId?: string;
}

export function ResultBlock({
	result,
	onCanvas = false,
	runId,
}: ResultBlockProps) {
	// The citation opens the trace in place: "where did this number come from" is
	// a question about *this* emission, so the answer opens from its own header
	// rather than from a menu somewhere else (RT1).
	const [traceOpen, setTraceOpen] = useState(false);
	// The scope comes from the route rather than from six layers of props: this
	// card is rendered deep inside a thread, and every one of those layers would
	// carry the pair only to hand it down.
	const { username, graphSlug } = useParams();
	const scoped = Boolean(runId && username && graphSlug);
	const persisted = useQuery({
		queryKey: ["emissions", username, graphSlug, runId] as const,
		queryFn: () =>
			emissionsApi.list(
				username as string,
				graphSlug as string,
				runId as string,
			),
		enabled: scoped,
		// The run has finished by the time a reply renders; re-reading on every
		// focus would flicker a table for nothing.
		staleTime: 60_000,
	});

	const qc = useQueryClient();
	const switchTemplate = useMutation({
		mutationFn: ({
			emissionId,
			templateId,
		}: { emissionId: string; templateId: string }) =>
			emissionsApi.switchTemplate(
				username as string,
				graphSlug as string,
				runId as string,
				emissionId,
				templateId,
			),
		onSuccess: () =>
			qc.invalidateQueries({
				queryKey: ["emissions", username, graphSlug, runId],
			}),
	});

	const emissions: Emission[] =
		scoped && persisted.data?.length
			? persisted.data
			: emissionsFromResult(result, { onCanvas });

	return (
		<>
			<EmissionList
				emissions={emissions.filter((e) => e.kind !== "subgraph" || e.onCanvas)}
				onSwitchTemplate={
					scoped
						? (emissionId, templateId) =>
								switchTemplate.mutate({ emissionId, templateId })
						: undefined
				}
				onOpenCitation={scoped ? () => setTraceOpen(true) : undefined}
			/>
			{scoped ? (
				<TraceDialog
					open={traceOpen}
					onClose={() => setTraceOpen(false)}
					username={username as string}
					graphSlug={graphSlug as string}
					runId={runId as string}
				/>
			) : null}
		</>
	);
}

/** The graph result a reply can paint, or `null` when it has nothing to load. */
export function loadableGraph(
	result: QueryResponse | null | undefined,
): QueryResponse | null {
	if (!result || result.result_type !== "graph" || !result.data) return null;
	const { nodes, edges } = result.data;
	return nodes.length === 0 && edges.length === 0 ? null : result;
}

/**
 * "Load to canvas" as a question the reply asks, answered in place: it sits on
 * the reply's own line ("Returned 10 nodes and 0 relationships. [Load to
 * canvas]") rather than in a bordered panel underneath, and once answered the
 * line below records what happened — the same asked / you-answered grammar the
 * clarifying steps use (docs/for-developers/modules/ask/features/streaming-and-the-workflow.md).
 */
export function LoadToCanvasAction({ onLoad }: { onLoad: () => void }) {
	return (
		<Button
			variant="secondary"
			size="sm"
			className="h-6 shrink-0 px-2 font-normal"
			onClick={onLoad}
		>
			<Network className="mr-1.5 h-3.5 w-3.5" />
			Load to canvas
		</Button>
	);
}
