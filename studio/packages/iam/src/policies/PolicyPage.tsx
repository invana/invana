/**
 * A policy's page, opened as a tab of its own (`?page=policy:<name>`) — what
 * it allows, who holds it, its limits and its versions.
 */

import { EmptyState } from "@invana/ui";

export interface PolicyPageProps {
	username: string;
	graphSlug: string;
	/** The policy's name — its address in the Graph. */
	name: string;
}

export function PolicyPage({ name }: PolicyPageProps) {
	return <EmptyState className="h-full" title={name} />;
}
