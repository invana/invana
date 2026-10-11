import { Button } from "@invana/ui";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { activityPath } from "../../activity/activityPath";
import { useOpenGraph } from "../../products";

/**
 * The header's bell: Activity › Inbox for the open Graph. Every product's
 * header draws it, so runs and events are one click from any screen inside a
 * Graph. Off a Graph there is no Activity, so there is no bell. It carries no
 * count until the engine records notifications.
 */
export function ActivityBell() {
	const graph = useOpenGraph();
	if (!graph) return null;
	return (
		<Button asChild variant="ghost" size="icon-sm" title="Notifications">
			<Link to={activityPath(graph, "inbox")} aria-label="Notifications">
				<Bell />
			</Link>
		</Button>
	);
}
