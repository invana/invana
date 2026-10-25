/**
 * The frame every IAM section page draws — the shared `SectionFrame`, filled
 * from this product's sections table: the section's rail icon and name, its
 * chips and acts, the line saying what it holds, and the body under them.
 *
 *     <SectionPage section="policies" chips={…} actions={…}>
 *       <SectionBody>…</SectionBody>
 *     </SectionPage>
 */

import { SectionFrame } from "@invana-studio/ui";
import type { ReactNode } from "react";
import { type IamSectionKey, SECTIONS } from "./spec";

interface SectionPageProps {
	section: IamSectionKey;
	/** Beside the name — a count the engine returned, a state. */
	chips?: ReactNode;
	/** The page's acts, at the head's right. */
	actions?: ReactNode;
	children: ReactNode;
}

export function SectionPage({ section, ...props }: SectionPageProps) {
	return <SectionFrame {...SECTIONS[section]} {...props} />;
}
