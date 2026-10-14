import { Label, Switch } from "@invana/forms";
import { Wrench } from "lucide-react";
import { useId } from "react";
import { useExplorerTools } from "./useExplorerTools";

/**
 * The header's *Tools* switch — first in `header.right`, on the Explorer
 * only. On, the floating toolbar grows from select · lasso · pan to the full
 * set and the legend shows; off, the board is the analyst's.
 */
export function ToolsSwitch() {
	const [on, setOn] = useExplorerTools();
	const id = useId();
	return (
		<div className="mr-2 flex items-center gap-1.5 text-sm text-muted-foreground">
			<Wrench className="size-3.5" aria-hidden />
			<Label htmlFor={id} className="font-normal text-muted-foreground">
				Tools
			</Label>
			<Switch id={id} checked={on} onCheckedChange={setOn} />
		</div>
	);
}
