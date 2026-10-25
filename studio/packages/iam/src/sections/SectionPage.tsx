/**
 * The frame every IAM section page draws — the shared `SectionFrame`, filled
 * from this product's sections table: the section's rail icon and name, its
 * chips and acts, the line saying what it holds, and the body under them.
 *
 *     <SectionPage section="people" graph="airways" chips={…} actions={…}>
 *       <SectionBody>…</SectionBody>
 *     </SectionPage>
 *
 * With `graph`, the line names the Graph: *Members of airways, …*.
 */

import { SectionFrame } from "@invana-studio/ui";
import type { ReactNode } from "react";
import { type IamSectionKey, SECTIONS } from "./spec";

interface SectionPageProps {
	section: IamSectionKey;
	/** The Graph's name, said in the line under the head where it reads *this Graph*. */
	graph?: string;
	/** Beside the name — a count the engine returned, a state. */
	chips?: ReactNode;
	/** The page's acts, at the head's right. */
	actions?: ReactNode;
	children: ReactNode;
}

export function SectionPage({ section, graph, ...props }: SectionPageProps) {
	const spec = SECTIONS[section];
	const description = graph
		? spec.description.replace("this Graph", graph)
		: spec.description;
	return <SectionFrame {...spec} description={description} {...props} />;
}
