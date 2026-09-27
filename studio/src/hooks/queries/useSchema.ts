import { schemasApi } from "@/services/api/schemas";
import { useQuery } from "@tanstack/react-query";

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

/** The Database tab: the mirror, drift marked, at All models or one (MP9). */
export function usePhysicalSchemaQuery(
	username: string | undefined,
	graphSlug: string | undefined,
	model: string | null,
	enabled = true,
) {
	return useQuery({
		queryKey: ["schemas", username, graphSlug, "physical", model] as const,
		queryFn: () =>
			schemasApi.getPhysical(username as string, graphSlug as string, model),
		enabled: !!username && !!graphSlug && enabled,
	});
}
