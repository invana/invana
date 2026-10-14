/**
 * The reach of one option, read from the graph: `walkReach` over the
 * Explorer's expand, cached per option, hop count and seed set.
 *
 * Every expand is a run, so a reach is read once and kept (`staleTime:
 * Infinity`); *Trace again* is a refetch. While a walk is under way the hook
 * hands back what the hops so far reached and the hop being read, so the tab
 * can draw the reach as it lands rather than wait for the last read.
 */

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { reachApi } from "../api";
import { NEIGHBOURS, type Reach, walkReach } from "./reach";

export function useReach({
	username,
	graphSlug,
	projectKey,
	branch,
	hops,
	seeds,
}: {
	username: string;
	graphSlug: string;
	projectKey: string;
	branch: number | null;
	hops: number;
	seeds: string[];
}) {
	const [progress, setProgress] = useState<{
		key: string;
		reach: Reach;
		/** The hop being read; null once the walk is done. */
		next: number | null;
	} | null>(null);
	const seedKey = seeds.join(",");
	const progressKey = `${branch}|${hops}|${seedKey}`;

	const query = useQuery({
		queryKey: [
			"projects",
			username,
			graphSlug,
			projectKey,
			"reach",
			branch,
			hops,
			seedKey,
		],
		queryFn: () =>
			walkReach({
				seeds,
				hops,
				read: (id) => reachApi.neighbours(username, graphSlug, id, NEIGHBOURS),
				onHop: (reach, next) => setProgress({ key: progressKey, reach, next }),
			}),
		staleTime: Number.POSITIVE_INFINITY,
		enabled: seeds.length > 0,
		retry: false,
	});

	const live = progress?.key === progressKey ? progress : null;
	const walking = query.isFetching;
	return {
		/** The settled reach, or — while walking — what the hops so far reached. */
		reach: walking
			? (live?.reach ?? null)
			: (query.data ?? live?.reach ?? null),
		/** The hop being read, while a walk is under way. */
		reading: walking ? (live?.next ?? 1) : null,
		walking,
		error: query.error,
		retrace: () => {
			query.refetch();
		},
	};
}
