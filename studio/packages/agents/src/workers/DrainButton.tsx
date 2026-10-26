/**
 * **Drain** — an install admin's act; anyone else sees it disabled, naming
 * the role. The confirmation is built in: a drain stops the worker(s) taking
 * leases, they finish what they hold, then report `stopped`.
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
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { useState } from "react";
import { AdminButton } from "./parts";

export function DrainButton({
	label,
	title,
	description,
	pending,
	error,
	onConfirm,
}: {
	label: string;
	title: string;
	description: string;
	pending: boolean;
	error: Error | null;
	onConfirm: () => void;
}) {
	const [asking, setAsking] = useState(false);
	return (
		<>
			<AdminButton
				variant="outline"
				disabled={pending}
				onClick={() => setAsking(true)}
			>
				{label}
			</AdminButton>
			<AlertDialog open={asking} onOpenChange={setAsking}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{title}</AlertDialogTitle>
						<AlertDialogDescription>{description}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setAsking(false);
								onConfirm();
							}}
						>
							{label}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<FormError error={error} />
		</>
	);
}
