import { useQuery } from "@tanstack/react-query";
import { schemasApi } from "../../services/api/schemas";

export function useActiveVersionQuery(
	username: string | undefined,
	graphSlug: string | undefined,
) {
	return useQuery({
		queryKey: ["schemas", username, graphSlug, "active-version"] as const,
		queryFn: () =>
			schemasApi.getActiveVersion(username as string, graphSlug as string),
		enabled: !!username && !!graphSlug,
		staleTime: 60_000,
	});
}
