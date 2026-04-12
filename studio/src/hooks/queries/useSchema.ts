import { useQuery } from "@tanstack/react-query";
import { schemasApi } from "../../services/api/schemas";

export function useActiveVersionQuery(schemaId: string | null | undefined) {
	return useQuery({
		queryKey: ["schemas", schemaId, "active-version"] as const,
		queryFn: () => schemasApi.getActiveVersion(schemaId as string),
		enabled: !!schemaId,
		staleTime: 60_000,
	});
}
