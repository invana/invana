/**
 * A group's page, opened as a tab of its own (`?page=iam_group:<name>`) — its
 * members and the policies attached to it.
 */

import { EmptyState } from "@invana/ui";

export interface GroupPageProps {
	username: string;
	graphSlug: string;
	/** The group's name — its address in the Graph. */
	name: string;
}

export function GroupPage({ name }: GroupPageProps) {
	return <EmptyState className="h-full" title={name} />;
}
