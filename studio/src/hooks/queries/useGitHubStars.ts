import { useQuery } from "@tanstack/react-query";

const REPO = "invana/invana";
const KEY = ["github", "stars", REPO] as const;

/**
 * Star count for the Invana GitHub repo, read straight from the public
 * GitHub REST API (no engine round-trip). The number barely moves, so it's
 * cached for an hour and never refetched on focus to stay well clear of the
 * unauthenticated rate limit.
 */
export function useGitHubStarsQuery() {
	return useQuery({
		queryKey: KEY,
		queryFn: async () => {
			const res = await fetch(`https://api.github.com/repos/${REPO}`);
			if (!res.ok) {
				throw new Error(`GitHub API responded ${res.status}`);
			}
			const data = (await res.json()) as { stargazers_count: number };
			return data.stargazers_count;
		},
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
	});
}
