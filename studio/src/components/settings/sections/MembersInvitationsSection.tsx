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
	headerActions?: HeaderActions;
	className?: string;
}

/**
 * Combined Members + Invitations view rendered as a `TabbedPanel`. Invitations
 * are part of the member-management flow, so they live as a tab here rather
 * than a separate rail icon. Non-admins see only the Members tab. Rendered
 * inside the docked `SettingsPanel` — chrome (expand / close) comes from
 * `headerActions`.
 */
export function MembersInvitationsSection({
	username,
	graphSlug,
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
			headerActions={headerActions}
		/>
	);
}
