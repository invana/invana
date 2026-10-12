/**
 * Who a record names — a principal id → a name, for *By* on a decision and
 * *added by* on a finding.
 *
 * A record carries only the id of the person or agent behind it. The names
 * come from the people and agents staffed on the projects being read, and the
 * signed-in person; someone who has since left every project is not in the
 * map, and the caller says *a person*.
 */

import { useAuthStore } from "@invana-studio/core";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { projectsApi } from "../api";

export function usePeople(
	username: string,
	graphSlug: string,
	projectKeys: string[],
): Map<string, string> {
	const me = useAuthStore((s) => s.user);
	const staff = useQueries({
		queries: projectKeys.map((key) => ({
			queryKey: ["projects", username, graphSlug, key, "assignments"],
			queryFn: () => projectsApi.assignments(username, graphSlug, key),
		})),
	});
	const names = staff.flatMap((q) =>
		(q.data?.items ?? []).flatMap((a) =>
			a.principal_name ? [`${a.principal_id}\t${a.principal_name}`] : [],
		),
	);
	const key = names.join("\n");
	return useMemo(() => {
		const people = new Map<string, string>(
			key ? key.split("\n").map((l) => l.split("\t") as [string, string]) : [],
		);
		if (me)
			people.set(
				me.id,
				[me.first_name, me.last_name].filter(Boolean).join(" ") || me.username,
			);
		return people;
	}, [key, me]);
}
