import { Badge, Button } from "@invana/ui";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { activityPath } from "../../activity/activityPath";
import { useInbox } from "../../activity/inbox/useInbox";
import { useOpenGraph } from "../../products";

/**
 * The header's Notifications: Activity › Inbox for the open Graph, with the
 * number of things in it that need the person — unread notifications,
 * approvals waiting on them and runs waiting on their answer. Every product's header draws
 * it, so what needs someone is one click from any screen inside a Graph. Off
 * a Graph there is no Activity, so there is no bell.
 */
export function ActivityBell() {
	const graph = useOpenGraph();
	const { count } = useInbox(graph);
	if (!graph) return null;
	return (
		<Button asChild variant="ghost" size="sm">
			<Link to={activityPath(graph, "inbox")} aria-label="Notifications">
				<Bell />
				Notifications
				{count > 0 && <Badge>{count}</Badge>}
			</Link>
		</Button>
	);
}
