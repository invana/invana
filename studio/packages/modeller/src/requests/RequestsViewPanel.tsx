/**
 * Requests — what analysts and agents asked to be modelled or allowed
 * (modeller.md).
 *
 * The engine records no requests yet, so the panel draws the kit's
 * `EmptyState` naming what opens it — never an empty list.
 */

import { EmptyState, EmptyStateLock } from "@invana/ui";
import { Lock, MessageSquarePlus } from "lucide-react";

export function RequestsViewPanel() {
	return (
		<EmptyState
			className="h-full"
			icon={<MessageSquarePlus />}
			title="Requests"
			description="A type an analyst could not find, a property a guardrail kept from an agent — each ask lands here, so a gap gets fixed instead of lost."
			locks={[
				<EmptyStateLock key="engine" icon={<Lock />}>
					Opens with engine support
				</EmptyStateLock>,
			]}
		/>
	);
}
