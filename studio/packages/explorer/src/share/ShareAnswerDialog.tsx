/**
 * **Share this answer** — with the Graph's members as a live link or a frozen
 * snapshot, or with anyone else as a file (feature file
 * `docs/for-developers/modules/explore/features/share-an-answer.md`).
 *
 * Opened from *Share* on a settled reply, through the action
 * `explorer.shareAnswer`; the shell's action host mounts it open and `onClose`
 * unmounts it.
 *
 * | Choice | What happens |
 * |---|---|
 * | Live link | The thread's own path is copied. Nothing is written. |
 * | Frozen snapshot | The answer as it stands — its records, citations and the dataset versions bound now — is kept as a report on the run, and the link that opens it is copied. While it is kept the button reads *Keeping…*; a refusal shows in the dialog in the engine's own words. |
 * | PNG | The board's last picture. Disabled, with its reason, while the board has none. |
 * | CSV | The answer's rows. Disabled, with its reason, when the answer has none. |
 * | Markdown | The whole answer in one file. |
 *
 * The answer's emissions and the Graph's dataset bindings are read once, when
 * the dialog opens. A link is never access — both open only for members — and
 * an export carries only what the member already sees.
 */

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
	Eyebrow,
	Item,
	ItemContent,
	ItemGroup,
	ItemMedia,
	ItemTitle,
	SegmentedControl,
} from "@invana/ui";
import { emissionsApi } from "@invana-studio/core";
import {
	boardReportsApi,
	boardReportsKey,
	useBoardsQuery,
	useCanvasBannerQuery,
} from "@invana-studio/shell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, ImageIcon, Link, Sheet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { explorerApi } from "../api";
import type { ShareAnswerArgs } from "../types";
import {
	answerCsv,
	answerMarkdown,
	fileSlug,
	liveLink,
	snapshotLink,
	snapshotSpec,
} from "./shareAnswer";

export interface ShareAnswerDialogProps {
	args: ShareAnswerArgs;
	onClose: () => void;
}

type Mode = "live" | "snapshot";

const MODES = [
	{ value: "live", label: "Live link" },
	{ value: "snapshot", label: "Frozen snapshot" },
];

const HOLDS = ["board image", "answer", "citations", "dataset versions"];

/** Hand the browser a file to save — a temporary anchor, never drawn. */
function download(name: string, blob: Blob) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A `data:image/png;base64,…` picture as a Blob. */
function dataUrlBlob(dataUrl: string): Blob {
	const [head, body = ""] = dataUrl.split(",");
	const type = /data:([^;]+)/.exec(head)?.[1] ?? "image/png";
	const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
	return new Blob([bytes], { type });
}

export function ShareAnswerDialog({ args, onClose }: ShareAnswerDialogProps) {
	const { username, graphSlug, runId, sessionId } = args;
	const qc = useQueryClient();
	const [mode, setMode] = useState<Mode>("snapshot");
	const [keeping, setKeeping] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	// The same cache entry as the reply's emission card and the console.
	const emissions = useQuery({
		queryKey: ["emissions", username, graphSlug, runId] as const,
		queryFn: () => emissionsApi.list(username, graphSlug, runId),
	});
	const datasets = useQuery({
		queryKey: ["explorer", "dataset-bindings", username, graphSlug] as const,
		queryFn: () => explorerApi.datasetBindings(username, graphSlug),
	});
	const boards = useBoardsQuery(username, graphSlug, {
		limit: 100,
		sort: "updated",
	});
	const board = boards.data?.items.find((b) => b.sessionId === sessionId);
	const banner = useCanvasBannerQuery(
		username,
		graphSlug,
		board?.hasBanner ? board.id : null,
	);

	const ready = emissions.isSuccess && datasets.isSuccess;
	const picture = banner.data ?? null;
	const csv = emissions.data ? answerCsv(emissions.data) : null;
	const slug = fileSlug(args.question);
	const readError = emissions.error ?? datasets.error;

	const input = () => ({
		args,
		emissions: emissions.data ?? [],
		datasets: datasets.data ?? [],
		takenAt: new Date(),
	});

	const copy = async (link: string, what: string) => {
		try {
			await navigator.clipboard.writeText(link);
			toast.success(`${what} copied`, {
				description: "It opens for members of this Graph.",
			});
		} catch {
			toast.info(`${what} ready`, { description: link });
		}
		onClose();
	};

	const share = async () => {
		const origin = window.location.origin;
		if (mode === "live") {
			await copy(liveLink(origin, args), "Live link");
			return;
		}
		setKeeping(true);
		setError(null);
		try {
			const version = await boardReportsApi.create(
				username,
				graphSlug,
				"run",
				runId,
				{
					label: `Snapshot — ${args.question}`,
					snapshot: snapshotSpec(input()) as unknown as Record<string, unknown>,
					banner: picture ?? undefined,
					message_id: args.messageId,
				},
			);
			qc.invalidateQueries({
				queryKey: boardReportsKey(username, graphSlug, "run", runId),
			});
			setKeeping(false);
			await copy(snapshotLink(origin, args, version.id), "Snapshot link");
		} catch (e) {
			setKeeping(false);
			setError(e instanceof Error ? e : new Error(String(e)));
		}
	};

	const reasons = [
		boards.isSuccess && !picture && !banner.isLoading
			? "PNG: Nothing drawn on the board yet"
			: null,
		ready && !csv ? "CSV: This answer has no rows" : null,
	].filter(Boolean);

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Share this answer</DialogTitle>
					<DialogDescription>{args.question}</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Eyebrow>With members</Eyebrow>
						<SegmentedControl
							aria-label="Share as"
							options={MODES}
							value={mode}
							onValueChange={(v) => setMode(v as Mode)}
							stretch
						/>
						<p className="text-sm text-muted-foreground">
							a snapshot never changes; a live link opens the same board and
							chat
						</p>
					</div>
					{mode === "snapshot" ? (
						<div className="flex flex-col gap-1">
							<Eyebrow>Snapshot holds</Eyebrow>
							<ItemGroup>
								{HOLDS.map((h) => (
									<Item key={h} size="xs" role="listitem">
										<ItemMedia>
											<Check className="size-4 text-success" />
										</ItemMedia>
										<ItemContent>
											<ItemTitle>{h}</ItemTitle>
										</ItemContent>
									</Item>
								))}
							</ItemGroup>
						</div>
					) : null}
					<div className="flex flex-col gap-2">
						<Eyebrow>Export</Eyebrow>
						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={!picture}
								title={picture ? undefined : "Nothing drawn on the board yet"}
								onClick={() =>
									picture && download(`${slug}.png`, dataUrlBlob(picture))
								}
							>
								<ImageIcon />
								PNG
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!csv}
								title={csv || !ready ? undefined : "This answer has no rows"}
								onClick={() =>
									csv &&
									download(
										`${slug}.csv`,
										new Blob([csv], { type: "text/csv;charset=utf-8" }),
									)
								}
							>
								<Sheet />
								CSV of the console rows
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!ready}
								onClick={() =>
									download(
										`${slug}.md`,
										new Blob([answerMarkdown(input())], {
											type: "text/markdown;charset=utf-8",
										}),
									)
								}
							>
								<FileText />
								Markdown
							</Button>
						</div>
						{reasons.map((r) => (
							<p key={r} className="text-sm text-muted-foreground">
								{r}
							</p>
						))}
					</div>
					<p className="text-sm text-muted-foreground">
						People outside Invana get the exported file, never access.
						Guardrails apply to what the export carries.
					</p>
					{error || readError ? (
						<Alert tone="destructive">
							<AlertDescription>
								{error
									? `Could not keep the snapshot — ${error.message}`
									: `Could not read the answer — ${readError?.message}`}
							</AlertDescription>
						</Alert>
					) : null}
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={keeping || (mode === "snapshot" && !ready)}
						onClick={share}
					>
						<Link />
						{keeping
							? "Keeping…"
							: mode === "snapshot"
								? "Copy snapshot link"
								: "Copy live link"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
