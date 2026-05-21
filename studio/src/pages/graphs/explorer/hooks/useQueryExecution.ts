import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { graphsApi } from "../../../../services/api/graphs";
import type { QueryHistoryEntry, QueryResponse } from "../../../../types/query";

export function useQueryExecution(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	const [history, setHistory] = useState<QueryHistoryEntry[]>([]);
	const [lastResult, setLastResult] = useState<QueryResponse | null>(null);

	const mutation = useMutation({
		mutationFn: ({
			query,
		}: { query: string; language: "cypher" | "gremlin" }) =>
			graphsApi.query(username as string, graphSlug as string, { query }),
		onSuccess: (data, variables) => {
			setLastResult(data);
			const entry: QueryHistoryEntry = {
				id: crypto.randomUUID(),
				query: variables.query,
				language: variables.language,
				executedAt: new Date(),
				rowCount: data.row_count,
				executionTimeMs: data.execution_time_ms,
			};
			setHistory((prev) => [entry, ...prev]);
		},
	});

	return { mutation, history, lastResult };
}
