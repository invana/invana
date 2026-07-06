import { Button } from "@invana/ui";
import { Pencil, Plus, X } from "lucide-react";
import type { ReactNode } from "react";

export interface CanvasTab {
	id: string;
	title: string;
}

interface Props {
	tabs: CanvasTab[];
	activeId: string | null;
	onSelect: (id: string) => void;
	onClose: (id: string) => void;
	onEdit: (id: string) => void;
	onNew: () => void;
	/** True while a new-canvas create is in flight (disables "+"). */
	isCreating: boolean;
	/** The canvas toolbar (magnet / backend), rendered on the right. */
	toolbar?: ReactNode;
}

/**
 * The Explorer main-section header (RFC-043): a strip of open-canvas tabs on the
 * left with a "+" to start a blank canvas, and the canvas toolbar on the right.
 * A single click selects a tab (switching the active canvas + its session); the
 * pencil edits its title/purpose; the × closes it (without deleting the canvas).
 */
export function CanvasTabsBar({
	tabs,
	activeId,
	onSelect,
	onClose,
	onEdit,
	onNew,
	isCreating,
	toolbar,
}: Props) {
	return (
		<div className="flex h-9 shrink-0 items-center gap-1 border-b bg-background/80 px-2">
			<div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
				{tabs.map((t) => {
					const active = t.id === activeId;
					return (
						<div
							key={t.id}
							className={`group flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-sm ${
								active
									? "border-primary/30 bg-primary/10 text-primary"
									: "border-transparent hover:bg-primary/5"
							}`}
						>
							<button
								type="button"
								className="max-w-[160px] truncate text-left"
								onClick={() => onSelect(t.id)}
								title={t.title || "Untitled canvas"}
							>
								{t.title || "Untitled canvas"}
							</button>
							<button
								type="button"
								className="opacity-0 group-hover:opacity-100"
								onClick={() => onEdit(t.id)}
								title="Edit title & purpose"
							>
								<Pencil className="h-3 w-3" />
							</button>
							<button
								type="button"
								className="opacity-0 group-hover:opacity-100"
								onClick={() => onClose(t.id)}
								title="Close tab"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						</div>
					);
				})}
				<Button
					size="icon"
					variant="ghost"
					className="h-7 w-7 shrink-0"
					onClick={onNew}
					disabled={isCreating}
					title="New canvas"
				>
					<Plus className="h-4 w-4" />
				</Button>
			</div>
			{toolbar && <div className="flex shrink-0 items-center">{toolbar}</div>}
		</div>
	);
}
