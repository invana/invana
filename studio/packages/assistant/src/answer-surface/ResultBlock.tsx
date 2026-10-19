import type { Emission, QueryResponse } from "@invana-studio/core";
import { emissionsApi } from "@invana-studio/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { EmissionList } from "./AnswerEmission";
import { emissionsFromResult } from "./emissions";
import { TraceDialog } from "./TraceDialog";

// An assistant reply's result, rendered as the emissions it is
// (docs/for-developers/modules/ask/features/the-answer-surface.md). Every one
// of them goes through the emission card — header over a body — rather
// than a bare table under the reply.
//
// A subgraph is the one kind with no card: its body is the canvas, and the
// reply sentence and meta line already carry its counts and its records. The
// reply offers *Load to canvas* until it is drawn; the citation stays on the
// meta line, which opens the records in the console.
//
// An emission is a **record** now: given a run, this reads the
// emissions the `project` step wrote, so an answer survives a reload instead of
// living in the page until someone refreshes. A reply with no run — an
// older row, or one whose run was pruned — still falls back to folding one out of
// the query result it carries, and says nothing it cannot back up: no template
// name, because none chose the rendering.

export interface ResultBlockProps {
	result: QueryResponse | null | undefined;
	/** The run that produced the answer; without one there is nothing to read. */
	runId?: string;
}

export function ResultBlock({ result, runId }: ResultBlockProps) {
	// The citation opens the trace in place: "where did this number come from" is
	// a question about *this* emission, so the answer opens from its own header
	// rather than from a menu somewhere else.
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
		}: {
			emissionId: string;
			templateId: string;
		}) =>
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
			: emissionsFromResult(result);

	return (
		<>
			<EmissionList
				emissions={emissions.filter((e) => e.kind !== "subgraph")}
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
	if (result?.result_type !== "graph" || !result.data) return null;
	const { nodes, edges } = result.data;
	return nodes.length === 0 && edges.length === 0 ? null : result;
}
