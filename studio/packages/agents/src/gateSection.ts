/**
 * A stack section's own acts, drawn as the member's role allows them.
 *
 * `stackSection` builds a section's header from its spec and adds Search and
 * the filter funnel beside the section's own acts, so the gate is applied to
 * the built section, by key: only the acts named are gated, and reading the
 * list (search, filter, back) stays open to every member.
 *
 *     gateSection(agentsSection({...}), ["new"], gate("build"))
 */

import type { PanelStackSection } from "@invana/ui";
import type { Gate } from "@invana-studio/core";
import { gateItem } from "@invana-studio/shell";

export function gateSection(
	section: PanelStackSection,
	keys: string[],
	gate: Gate,
): PanelStackSection {
	if (gate.allowed || !section.headerActions) return section;
	return {
		...section,
		headerActions: section.headerActions.map((item) =>
			keys.includes(String(item.key)) ? gateItem(item, gate) : item,
		),
	};
}
