import { TabbedPanel } from "@invana/ui";
import { Mail, Users } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { InvitationsSection } from "./InvitationsSection";
import { MembersSection } from "./MembersSection";

// `NavHorizontalProps` from @invana/ui re-exported via @invana/themes —
// declared loosely here to avoid pulling the dependency for typing alone.
type HeaderActions = {
	left?: React.ReactNode;
	center?: React.ReactNode;
	right?: React.ReactNode;
};

interface Props {
	username: string;
	graphSlug: string;
	/** Render TabbedPanel's built-in close button. SettingsPanel sets this
	 *  true with onClose; the full-page wrapper leaves it false. */
	showClose?: boolean;
	onClose?: () => void;
	headerActions?: HeaderActions;
	className?: string;
}

/**
 * Combined Members + Invitations view rendered as a `TabbedPanel`.
 * Invitations are part of the member-management flow, so they live as a tab
 * here rather than a separate rail icon. Non-admins see only the Members tab.
 *
 * Reused in two contexts:
 * - Sidebar (`SettingsPanel`) — passes showClose + onClose + maximize button
 *   in headerActions so the section's own TabbedPanel hosts the panel chrome.
 * - Full-page (`GraphMembersSettingsPage`) — embeds inside page chrome, so
 *   no close button and no headerActions.
 */
export function MembersInvitationsSection({
	username,
	graphSlug,
	showClose = false,
	onClose,
	headerActions,
	className,
}: Props) {
	const { rolesForGraph } = useAuth();
	const { isAdmin } = rolesForGraph(username, graphSlug);
	const [activeTab, setActiveTab] = useState<"members" | "invitations">(
		"members",
	);

	const inPad = (c: React.ReactNode) => <div className="p-5">{c}</div>;

	const tabs = [
		{
			value: "members",
			label: "Members",
			icon: Users,
			content: inPad(
				<MembersSection username={username} graphSlug={graphSlug} />,
			),
		},
		...(isAdmin
			? [
					{
						value: "invitations",
						label: "Invitations",
						icon: Mail,
						content: inPad(
							<InvitationsSection username={username} graphSlug={graphSlug} />,
						),
					},
				]
			: []),
	];

	return (
		<TabbedPanel
			className={className ?? "min-h-[300px]"}
			tabs={tabs}
			activeTab={activeTab}
			onTabChange={(v) => setActiveTab(v as "members" | "invitations")}
			showClose={showClose}
			onClose={onClose}
			headerActions={headerActions}
		/>
	);
}
