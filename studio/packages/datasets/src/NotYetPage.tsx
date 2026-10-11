/**
 * The Datasets sections the engine has no records for yet — Catalogue,
 * Validation and Standards (datasets.md).
 *
 * Each draws the kit's `EmptyState`: what the section will hold, and one lock
 * per record that opens it. A dataset record (origin, author chain, licence,
 * versions) opens all three; Standards also needs the standard record. Until
 * then the one live section is Imports, so each empty state links there.
 */

import { Button, EmptyState, EmptyStateLock } from "@invana/ui";
import { Library, Lock, ShieldCheck, Table2 } from "lucide-react";
import type { ComponentType } from "react";
import { Link } from "react-router-dom";

export type NotYetSection = "catalogue" | "validation" | "standards";

const DATASET_LOCK = "Opens when the engine records datasets";

const SECTIONS: Record<
	NotYetSection,
	{
		icon: ComponentType<{ className?: string }>;
		title: string;
		description: string;
		locks: string[];
	}
> = {
	catalogue: {
		icon: Table2,
		title: "No datasets yet",
		description:
			"Every dataset in the install, filtered by origin, publisher, standard, licence and the Graphs that bind it — each with where it came from, who authored it and how far it has been checked.",
		locks: [DATASET_LOCK],
	},
	validation: {
		icon: ShieldCheck,
		title: "Nothing to validate yet",
		description:
			"Conflicts with official data and constraint or standard violations wait here for a curator to decide, before anyone relies on the rows.",
		locks: [DATASET_LOCK],
	},
	standards: {
		icon: Library,
		title: "No standards yet",
		description:
			"Shipped packs and your lab's own — enforced on a dataset as block, warn or report, with a conformance score.",
		locks: [DATASET_LOCK, "Opens when the engine records standards"],
	},
};

export function NotYetPage({ section }: { section: NotYetSection }) {
	const { icon: Icon, title, description, locks } = SECTIONS[section];
	return (
		<EmptyState
			className="h-full"
			icon={<Icon className="size-6" />}
			title={title}
			description={description}
			actions={
				<Button asChild variant="outline" size="sm">
					<Link to="/datasets/imports">Watch imports</Link>
				</Button>
			}
			locks={locks.map((lock) => (
				<EmptyStateLock key={lock} icon={<Lock />}>
					{lock}
				</EmptyStateLock>
			))}
		/>
	);
}
