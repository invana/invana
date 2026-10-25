/**
 * IAM's Settings — the gear at the rail's foot. The Graph's settings are one
 * panel, drawn in the Modeller; its Members tab is where people join the
 * Graph and take their roles. This page names that and opens it there.
 */

import { Button, EmptyState } from "@invana/ui";
import { Link } from "react-router-dom";
import { SectionPage } from "../sections/SectionPage";
import type { SectionPageProps } from "../sections/spec";

export function IamSettingsPage({ username, graphSlug }: SectionPageProps) {
	const graphSettings = `/u/${username}/${graphSlug}/modeller/settings`;
	return (
		<SectionPage section="settings">
			<EmptyState
				className="h-full"
				title="The Graph's settings"
				description="Members, roles and the Graph itself are set in one place."
				actions={
					<>
						<Button asChild size="sm">
							<Link to={`${graphSettings}?tab=members`}>Open Members</Link>
						</Button>
						<Button asChild size="sm" variant="outline">
							<Link to={graphSettings}>Open Graph settings</Link>
						</Button>
					</>
				}
			/>
		</SectionPage>
	);
}
