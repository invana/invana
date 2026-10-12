/**
 * A dataset's **Versions** (board `datasets.dataset.versions`, DS-03 · DS-14):
 * every version newest first — when, why, how many records, its hash, and a
 * retraction where there is one. A refresh schedule is stated above them,
 * because each refresh is a new version and consumers stay on theirs.
 *
 * *Compare* reads the change log's compare of the newest two versions. An
 * install Admin can retract a version with a reason; it stays readable and
 * is marked, never deleted.
 */

import { Label, Textarea } from "@invana/forms";
import {
	Alert,
	AlertDescription,
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Badge,
	Button,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { useAuth } from "@invana-studio/core";
import { FormError, PanelSection } from "@invana-studio/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { datasetsApi } from "../api";
import { dayLabel, shortHash } from "../labels";
import { PageBody } from "../parts";
import { useRetractVersion, useVersionsQuery } from "../queries";
import type { DatasetVersion } from "../types";
import { useDatasetOutlet } from "./context";

function RetractDialog({
	version,
	onClose,
}: {
	version: DatasetVersion | null;
	onClose: () => void;
}) {
	const { ref } = useDatasetOutlet();
	const retract = useRetractVersion(ref);
	const [reason, setReason] = useState("");

	return (
		<AlertDialog open={version !== null} onOpenChange={(o) => !o && onClose()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Retract {version?.address}?</AlertDialogTitle>
					<AlertDialogDescription>
						The version stays readable for audit and is marked retracted. It can
						no longer be bound or derived from; the Graphs and datasets that
						cite it are flagged.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="retract-reason">Reason</Label>
					<Textarea
						id="retract-reason"
						value={reason}
						maxLength={500}
						onChange={(e) => setReason(e.target.value)}
					/>
				</div>
				<FormError error={retract.error} />
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={!reason.trim() || retract.isPending}
						onClick={(e) => {
							e.preventDefault();
							if (!version) return;
							retract.mutate(
								{ version: version.version, reason: reason.trim() },
								{ onSuccess: onClose },
							);
						}}
					>
						Retract v{version?.version}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export function VersionsTab() {
	const { dataset, ref } = useDatasetOutlet();
	const { isSuperuser } = useAuth();
	const versions = useVersionsQuery(ref);
	const items = [...(versions.data?.items ?? [])].sort(
		(a, b) => b.version - a.version,
	);
	const [compareOn, setCompareOn] = useState(false);
	const [retracting, setRetracting] = useState<DatasetVersion | null>(null);
	const [newest, previous] = items;
	const compare = useQuery({
		queryKey: [
			"datasets",
			ref.publisher,
			ref.name,
			"compare",
			previous?.version,
			newest?.version,
		],
		queryFn: () =>
			datasetsApi.compare(ref, previous?.version ?? 0, newest?.version ?? 0),
		enabled: compareOn && !!newest && !!previous,
	});

	return (
		<PageBody>
			{dataset.refresh_schedule ? (
				<Alert tone="info">
					<AlertDescription>
						Refreshes on{" "}
						<strong className="font-mono">{dataset.refresh_schedule}</strong>
						{dataset.refresh_source ? ` from ${dataset.refresh_source}` : ""}.
						Each refresh is a new version; Graphs and findings stay on theirs
						until someone moves them.
					</AlertDescription>
				</Alert>
			) : null}

			<PanelSection
				card
				title="Versions"
				action={
					<span className="text-sm text-muted-foreground">
						a version never changes · a fix is a new version
					</span>
				}
			>
				{versions.isLoading ? (
					<Spinner />
				) : (
					<Table bordered={false} density="compact">
						<TableHeader>
							<TableRow>
								<TableHead>Version</TableHead>
								<TableHead>When</TableHead>
								<TableHead className="w-full">What changed</TableHead>
								<TableHead>Records</TableHead>
								<TableHead>Hash</TableHead>
								<TableHead>Licence</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((v) => (
								<TableRow key={v.id}>
									<TableCell className="font-mono">v{v.version}</TableCell>
									<TableCell className="whitespace-nowrap">
										{dayLabel(v.published_at)}
									</TableCell>
									<TableCell>
										{v.retracted ? (
											<Badge variant="soft" tone="destructive" size="xs">
												retracted
												{v.retracted.reason ? ` · ${v.retracted.reason}` : ""}
											</Badge>
										) : (
											(v.why ?? "—")
										)}
									</TableCell>
									<TableCell className="font-mono">
										{v.record_count.toLocaleString()}
									</TableCell>
									<TableCell
										className="whitespace-nowrap font-mono"
										title={v.content_hash}
									>
										{shortHash(v.content_hash)}
									</TableCell>
									<TableCell className="whitespace-nowrap">
										{v.licence}
									</TableCell>
									<TableCell>
										{isSuperuser && !v.retracted ? (
											<Button
												variant="ghost"
												size="xs"
												onClick={() => setRetracting(v)}
											>
												Retract
											</Button>
										) : null}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</PanelSection>

			{newest && previous ? (
				<div className="flex flex-col gap-2">
					<Button
						variant="outline"
						size="sm"
						className="self-start"
						onClick={() => setCompareOn(true)}
					>
						Compare v{previous.version} and v{newest.version}
					</Button>
					{compare.data ? (
						<p className="text-sm text-muted-foreground">
							{compare.data.summary}
						</p>
					) : null}
				</div>
			) : null}

			<RetractDialog version={retracting} onClose={() => setRetracting(null)} />
		</PageBody>
	);
}
