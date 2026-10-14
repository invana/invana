import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@invana/ui";
import type { ReactNode } from "react";

interface Props {
	open: boolean;
	title: string;
	description?: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	/** Tints the confirm button as a destructive action. */
	destructive?: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
}

/**
 * Small reusable confirm/cancel dialog over `@invana/ui`'s `AlertDialog`. Mirrors
 * the `DeleteModelDialog` pattern so destructive/irreversible actions get a
 * proper modal instead of a native `window.confirm`.
 */
export function ConfirmDialog({
	open,
	title,
	description,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	destructive = false,
	onConfirm,
	onOpenChange,
}: Props) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					{description && (
						<AlertDialogDescription>{description}</AlertDialogDescription>
					)}
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						className={
							destructive
								? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
								: undefined
						}
					>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
