import type {
	Agent,
	LifecycleAct,
	LifecycleEffect,
	LifecycleItem,
} from "@/types/work";
import { type ColumnDef, DataTable } from "@invana/tables";
/**
 * A4 · what pausing or retiring would do to an agent's open work — **item by
 * item, never a count alone**
 * ([LC6](../../../../../docs/for-developers/modules/agents/features/lifecycle.md)).
 *
 * > **As** someone whose agent is behaving badly, **I want** to see what
 * > stopping it disturbs, **so that** I find out before the click rather than
 * > from the task that went quiet.
 *
 * One dialog for both acts ([LC8](../../../../../docs/for-developers/modules/agents/features/lifecycle.md)):
 * the work is the same list either way and only the **effects** differ — a todo
 * in review is untouched by a pause and blocked by a retire, which is the one
 * thing two counts could never say. Resume opens nothing: it takes nothing
 * away (LC10).
 */
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Badge,
	Skeleton,
} from "@invana/ui";
import { useMemo } from "react";

/** The effect's tone, so the reassuring case and the disturbing one differ. */
const TONE: Record<
	LifecycleEffect,
	{ label: string; variant: "secondary" | "outline" | "destructive" }
> = {
	finishes: { label: "Finishes", variant: "secondary" },
	unchanged: { label: "Untouched", variant: "outline" },
	blocked: { label: "Blocked", variant: "destructive" },
	refused: { label: "Refuses", variant: "destructive" },
};

const KIND: Record<LifecycleItem["kind"], string> = {
	run: "Run",
	task: "Todo",
	session: "Thread",
};

interface LifecycleDialogProps {
	agent: Agent | null;
	act: LifecycleAct | null;
	items: LifecycleItem[] | undefined;
	isLoading: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}

export function LifecycleDialog({
	agent,
	act,
	items,
	isLoading,
	onCancel,
	onConfirm,
}: LifecycleDialogProps) {
	const columns = useMemo<ColumnDef<LifecycleItem>[]>(
		() => [
			{
				accessorKey: "title",
				header: "Open work",
				cell: ({ row }) => (
					<div className="min-w-0">
						<div className="truncate font-medium">{row.original.title}</div>
						<div className="text-sm text-muted-foreground">
							{KIND[row.original.kind]} · {row.original.note}
						</div>
					</div>
				),
			},
			{
				accessorKey: "effect",
				header: "Becomes",
				cell: ({ row }) => {
					const tone = TONE[row.original.effect];
					return <Badge variant={tone.variant}>{tone.label}</Badge>;
				},
			},
		],
		[],
	);

	const isRetire = act === "retire";

	return (
		<AlertDialog
			open={agent !== null && act !== null}
			onOpenChange={(open) => !open && onCancel()}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{isRetire ? "Retire" : "Pause"} {agent?.name}?
					</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="space-y-3 text-base">
							<p>
								{isRetire
									? "Retiring is not deleting — the row stays so lineage and every trace entry still read by name. It cannot be undone."
									: "Pausing takes nothing new. What is already in flight finishes, and resuming unblocks what this stops."}
							</p>
							{isLoading ? (
								<Skeleton className="h-16 w-full" />
							) : items?.length ? (
								// An agent with thirty open threads would push the
								// confirm off the screen; the list stays whole and
								// scrolls, because the count is what it must not become.
								<div className="max-h-[40vh] overflow-y-auto">
									<DataTable
										columns={columns}
										data={items}
										enableSorting={false}
										enablePagination={false}
										// A confirm dialog is not a place to choose columns.
										enableColumnVisibility={false}
									/>
								</div>
							) : (
								<p className="text-muted-foreground">
									Nothing open — there is nothing to disturb.
								</p>
							)}
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm}>
						{isRetire ? "Retire" : "Pause"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
