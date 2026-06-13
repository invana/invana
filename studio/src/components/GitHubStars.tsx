import { Button } from "@invana/ui";
import { Github, Star } from "lucide-react";
import { useGitHubStarsQuery } from "../hooks/queries/useGitHubStars";

const REPO_URL = "https://github.com/invana/invana";

/** Compact star count (e.g. 1234 → "1.2k"). */
function formatStars(count: number): string {
	if (count < 1000) return String(count);
	return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

/**
 * "Star on GitHub" badge linking to the Invana repo. Reads as a GitHub
 * call-to-action — repo logo + "Star" label + the live star count from the
 * public GitHub API. While loading or on error it still links out, just
 * without a number.
 */
export function GitHubStars() {
	const { data: stars } = useGitHubStarsQuery();
	return (
		<Button asChild variant="outline" size="sm" className="h-7 gap-1.5 px-2.5">
			<a
				href={REPO_URL}
				target="_blank"
				rel="noopener noreferrer"
				title="Star Invana on GitHub"
			>
				<Github className="h-4 w-4" />
				<span>Star</span>
				<span className="flex items-center gap-1 border-l border-border pl-1.5 text-muted-foreground">
					<Star className="h-3.5 w-3.5" />
					<span className="tabular-nums">
						{stars === undefined ? "—" : formatStars(stars)}
					</span>
				</span>
			</a>
		</Button>
	);
}
