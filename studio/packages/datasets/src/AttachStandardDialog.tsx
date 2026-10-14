/**
 * **Attach a standard** (board `datasets.standard.attach`, DS-09): a dataset
 * claims one pinned standard version, with a `term → column` mapping and what
 * happens when a row breaks it — block, warn or report.
 *
 * Opened from a dataset (the standard is picked) or from a standard (the
 * dataset is picked, from those the person can write). Each term defaults to
 * the same-named column; a term left without one is `missing` on every record,
 * never guessed. The engine scores the current version as it attaches, and a
 * `block` claim the current data already breaks is refused, naming why.
 */

import {
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	SegmentedControl,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { useAuth } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { useEffect, useMemo, useState } from "react";
import { parseAddress } from "./api";
import { MODE_LABEL } from "./labels";
import {
	useAttachStandard,
	useCatalogueQuery,
	useStandardsQuery,
	useVersionsQuery,
} from "./queries";
import type { Dataset, Enforcement, Standard } from "./types";

const NONE = "__none__";

export function AttachStandardDialog({
	open,
	onClose,
	dataset: fixedDataset,
	standard: fixedStandard,
}: {
	open: boolean;
	onClose: () => void;
	dataset?: Dataset;
	standard?: Standard;
}) {
	const { user, isSuperuser } = useAuth();
	const library = useStandardsQuery();
	const catalogue = useCatalogueQuery();
	const [datasetAddress, setDatasetAddress] = useState(
		fixedDataset?.address ?? "",
	);
	const [standardAddress, setStandardAddress] = useState(
		fixedStandard?.address ?? "",
	);
	const [mode, setMode] = useState<Enforcement>("warn");
	const [mapping, setMapping] = useState<Record<string, string>>({});

	const writable = (catalogue.data?.items ?? []).filter(
		(d) => isSuperuser || d.created_by_id === user?.id,
	);
	const target = parseAddress(datasetAddress);
	const attach = useAttachStandard(target);
	const versions = useVersionsQuery(target);
	const dataset =
		fixedDataset ?? writable.find((d) => d.address === datasetAddress);
	const currentVersion = dataset?.current_version;
	const columns = useMemo(
		() =>
			versions.data?.items.find((v) => v.version === currentVersion)?.columns ??
			[],
		[versions.data, currentVersion],
	);
	const standard =
		fixedStandard ??
		library.data?.items.find((s) => s.address === standardAddress);
	const terms = useMemo(() => standard?.terms ?? [], [standard]);

	// Each term starts on the column of its own name, when there is one.
	useEffect(() => {
		setMapping(
			Object.fromEntries(
				terms.map((t) => [t.name, columns.includes(t.name) ? t.name : NONE]),
			),
		);
	}, [terms, columns]);

	const submit = () => {
		if (!standard) return;
		attach.mutate(
			{
				standard: `${standard.address}${standard.current_version ? `@${standard.current_version}` : ""}`,
				mode,
				mapping: Object.fromEntries(
					Object.entries(mapping).filter(([, c]) => c !== NONE),
				),
			},
			{ onSuccess: onClose },
		);
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>Attach a standard</DialogTitle>
					<DialogDescription>
						{fixedDataset
							? fixedDataset.title || fixedDataset.address
							: fixedStandard
								? fixedStandard.title || fixedStandard.address
								: null}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3">
					{fixedDataset ? null : (
						<div className="flex flex-col gap-1.5">
							<Label>Dataset</Label>
							<Select value={datasetAddress} onValueChange={setDatasetAddress}>
								<SelectTrigger>
									<SelectValue placeholder="A dataset you publish" />
								</SelectTrigger>
								<SelectContent>
									{writable.map((d) => (
										<SelectItem key={d.id} value={d.address}>
											{d.title || d.address}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
					{fixedStandard ? null : (
						<div className="flex flex-col gap-1.5">
							<Label>Standard</Label>
							<Select
								value={standardAddress}
								onValueChange={setStandardAddress}
							>
								<SelectTrigger>
									<SelectValue placeholder="From the library" />
								</SelectTrigger>
								<SelectContent>
									{(library.data?.items ?? []).map((s) => (
										<SelectItem key={s.id} value={s.address}>
											{s.title || s.address}
											{s.current_version ? ` · v${s.current_version}` : ""}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{terms.length ? (
						<div className="flex flex-col gap-1.5">
							<Label>Terms → columns</Label>
							<Table density="compact">
								<TableHeader>
									<TableRow>
										<TableHead>Term</TableHead>
										<TableHead>Column</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{terms.map((t) => (
										<TableRow key={t.name}>
											<TableCell className="font-mono">
												{t.name}
												{t.required ? " · required" : ""}
											</TableCell>
											<TableCell>
												<Select
													value={mapping[t.name] ?? NONE}
													onValueChange={(c) =>
														setMapping((m) => ({ ...m, [t.name]: c }))
													}
												>
													<SelectTrigger aria-label={`Column for ${t.name}`}>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value={NONE}>no column</SelectItem>
														{columns.map((c) => (
															<SelectItem key={c} value={c}>
																{c}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					) : null}

					<div className="flex flex-col gap-1.5">
						<Label>When a row breaks it</Label>
						<SegmentedControl
							stretch
							value={mode}
							onValueChange={(v) => setMode(v as Enforcement)}
							options={(["block", "warn", "report"] as const).map((m) => ({
								value: m,
								label: MODE_LABEL[m],
							}))}
						/>
					</div>
					<FormError error={attach.error} />
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!standard || !dataset || attach.isPending}
						onClick={submit}
					>
						Attach in {mode}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
