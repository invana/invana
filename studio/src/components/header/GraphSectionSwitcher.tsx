import { ToggleGroup, ToggleGroupItem } from "@invana/ui";
import { Boxes, Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface GraphSectionSwitcherProps {
	username: string;
	graphSlug: string;
	/** Which section is currently rendering — drives the active toggle. */
	active: "explorer" | "modeller";
}

/**
 * Header switcher between the two graph views (Explorer / Modeller). Rendered
 * as `leftExtras` in the graph-detail header; selecting a view routes to
 * `/u/:username/:graphSlug/<view>`.
 */
export function GraphSectionSwitcher({
	username,
	graphSlug,
	active,
}: GraphSectionSwitcherProps) {
	const navigate = useNavigate();
	const root = `/u/${username}/${graphSlug}`;

	return (
		<ToggleGroup
			type="single"
			size="sm"
			value={active}
			// Radix fires `""` when the active item is re-clicked; ignore that so a
			// view is always selected.
			onValueChange={(v) => {
				if (v && v !== active) navigate(`${root}/${v}`);
			}}
		>
			<ToggleGroupItem
				value="explorer"
				aria-label="Explorer"
				className="gap-1.5"
			>
				<Compass className="size-4" />
				Explorer
			</ToggleGroupItem>
			<ToggleGroupItem
				value="modeller"
				aria-label="Modeller"
				className="gap-1.5"
			>
				<Boxes className="size-4" />
				Modeller
			</ToggleGroupItem>
		</ToggleGroup>
	);
}
