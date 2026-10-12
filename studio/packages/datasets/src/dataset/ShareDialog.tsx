/**
 * **Share** (board `datasets.share`, DS-12): who can find and reuse the
 * dataset — only its publisher, or everyone in the install.
 *
 * Sharing is metadata, never a version. A licence is required and lives on
 * the current version, so a dataset with no version yet cannot be shared — the
 * engine refuses it and the dialog shows why. Reusers read every version; a
 * bind or a derived dataset names this one as its source.
 */

import { Label } from "@invana/forms";
import {
	Alert,
	AlertDescription,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	PropertyList,
	PropertyRow,
	SegmentedControl,
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { Share2 } from "lucide-react";
import { useState } from "react";
import { useUpdateDataset } from "../queries";
import type { Dataset, Visibility } from "../types";

export function ShareDialog({
	dataset,
	open,
	onClose,
}: {
	dataset: Dataset;
	open: boolean;
	onClose: () => void;
}) {
	const update = useUpdateDataset(dataset);
	const [visibility, setVisibility] = useState<Visibility>(dataset.visibility);

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Share</DialogTitle>
					<DialogDescription>
						{dataset.title || dataset.address}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-1.5">
						<Label>Who can find and reuse it</Label>
						<SegmentedControl
							value={visibility}
							onValueChange={(v) => setVisibility(v as Visibility)}
							options={[
								{ value: "private", label: "Only me" },
								{ value: "install", label: "Everyone in this install" },
							]}
						/>
					</div>
					<PropertyList labelWidth={100}>
						<PropertyRow label="published by" mono>
							{dataset.publisher}
						</PropertyRow>
						<PropertyRow label="licence" mono>
							{dataset.licence ?? "none yet — import a version with a licence"}
						</PropertyRow>
					</PropertyList>
					<p className="text-sm text-muted-foreground">
						A licence is required. Reusers see it, and findings that cite this
						dataset carry the citation. A new licence is a new version.
					</p>
					{visibility === "install" ? (
						<Alert tone="info">
							<AlertDescription>
								Everyone in the install can read every version. They can bind
								one into their Graph or derive a dataset from it; either names
								this one as its source.
							</AlertDescription>
						</Alert>
					) : null}
					<FormError error={update.error} />
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={visibility === dataset.visibility || update.isPending}
						onClick={() =>
							update.mutate({ visibility }, { onSuccess: onClose })
						}
					>
						<Share2 />
						{visibility === "install"
							? "Share with the install"
							: "Keep it to me"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
