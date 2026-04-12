import { Badge } from "@invana/ui";
import type { GraphStatus } from "../../../types/graphs";

const STATUS_MAP: Record<GraphStatus, { label: string; className: string }> = {
	ACTIVE: {
		label: "Active",
		className:
			"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	},
	CONNECTING: {
		label: "Connecting",
		className:
			"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	},
	ERROR: {
		label: "Error",
		className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	},
	INACTIVE: {
		label: "Inactive",
		className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
	},
};

interface GraphStatusBadgeProps {
	status: GraphStatus;
}

export function GraphStatusBadge({ status }: GraphStatusBadgeProps) {
	const { label, className } = STATUS_MAP[status] ?? STATUS_MAP.INACTIVE;
	return (
		<Badge variant="outline" className={className}>
			{label}
		</Badge>
	);
}
