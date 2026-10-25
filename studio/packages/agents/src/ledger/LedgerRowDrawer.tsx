/**
 * One ledger row, in a drawer over the table that lists it (`?row=<id>`): the
 * chain of custody, the act and the rule that allowed or refused it, its
 * integrity — the row's hash, the previous row's and whether the chain held
 * through it — and the rows around it in its run. *Open step in run #N* opens
 * the run's page on Stages with that step; *Copy link* copies this URL, drawer
 * open.
 *
 * The drawer is a `FloatingPanel` over the right of the open workbook page —
 * it anchors to the page, so the app header, the leftSection and the
 * assistant stay uncovered. It is not a modal: the rows stay readable and
 * clickable beside it, and a row in *Around it* moves the drawer without
 * closing it. Escape closes it.
 */

import {
	Button,
	Eyebrow,
	FloatingPanel,
	PropertyList,
	PropertyRow,
	TypographyInlineCode,
} from "@invana/ui";
import {
	Bot,
	Copy,
	Play,
	Server,
	Shield,
	SquareFunction,
	User,
} from "lucide-react";
import { useEffect } from "react";
import { useAgentsOpen } from "../open";
import { FleetReadState } from "../overview/fleetParts";
import {
	Act,
	clock,
	rowTime,
	runLabel,
	touchedLine,
	VerdictBadge,
} from "./ledgerParts";
import { useLedgerRowQuery } from "./queries";

const CUSTODY_ICON: Record<string, typeof User> = {
	person: User,
	agent: Bot,
	function: SquareFunction,
	worker: Server,
	lens: Shield,
};

/** `9f3c…a21e` — enough of a hash to compare by eye. */
const short = (hash: string) =>
	hash.length > 12 ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : hash;

const argsLine = (args: Record<string, unknown>) =>
	Object.entries(args)
		.map(([k, v]) => `${k} ${typeof v === "string" ? v : JSON.stringify(v)}`)
		.join(" · ");

export function LedgerRowDrawer({
	username,
	graphSlug,
	rowId,
	onRow,
}: {
	username: string;
	graphSlug: string;
	/** The open row; null closes the drawer. */
	rowId: string | null;
	/** Open another row, or close with null. */
	onRow: (id: string | null) => void;
}) {
	const open = useAgentsOpen();
	const detail = useLedgerRowQuery(username, graphSlug, rowId);
	const d = detail.data;
	const row = d?.row;

	useEffect(() => {
		if (!rowId) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !e.defaultPrevented) onRow(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [rowId, onRow]);

	if (!rowId) return null;

	return (
		<FloatingPanel
			aria-label={row ? `Ledger row #${row.seq}` : "Ledger row"}
			className="absolute inset-y-3 right-3 z-20 w-md max-w-full"
			bodyClassName="flex flex-col gap-3 p-3"
			title={row ? `Ledger row #${row.seq}` : "Ledger row"}
			aside={row ? `${rowTime(row.at)} · ${row.verdict}` : undefined}
			onClose={() => onRow(null)}
		>
			{!d || !row ? (
				<FleetReadState
					loading={detail.isLoading}
					error={detail.error}
					what="the row"
				/>
			) : (
				<>
					<Eyebrow>Chain of custody</Eyebrow>
					<div className="flex flex-col gap-1.5">
						{d.custody.map((c) => {
							const Icon = CUSTODY_ICON[c.kind] ?? User;
							return (
								<div
									key={`${c.kind}:${c.name}:${c.line}`}
									className="flex items-baseline gap-1.5"
								>
									<Icon className="size-3.5 shrink-0 self-center text-muted-foreground" />
									<span className="font-medium">{c.name}</span>
									<span className="min-w-0 truncate text-muted-foreground">
										{c.line}
									</span>
								</div>
							);
						})}
					</div>

					<Eyebrow>The act</Eyebrow>
					<PropertyList labelWidth="auto">
						<PropertyRow label="Function">
							<Act act={row.act} />
						</PropertyRow>
						<PropertyRow label="Arguments">
							{Object.keys(d.args).length ? argsLine(d.args) : "—"}
						</PropertyRow>
						<PropertyRow label="Touched">{touchedLine(row)}</PropertyRow>
						<PropertyRow
							label={
								row.verdict === "refused"
									? "Rule that refused it"
									: "Rule that allowed it"
							}
						>
							<span className="inline-flex flex-wrap items-center gap-1.5">
								<VerdictBadge
									verdict={row.verdict}
									refusedBy={row.refused_by}
								/>
								{row.rule || "—"}
							</span>
						</PropertyRow>
					</PropertyList>

					<Eyebrow>Integrity</Eyebrow>
					<PropertyList labelWidth="auto">
						<PropertyRow label="Row hash">
							<TypographyInlineCode title={d.hash}>
								{short(d.hash)}
							</TypographyInlineCode>
						</PropertyRow>
						<PropertyRow label="Previous">
							<TypographyInlineCode title={d.prev_hash}>
								{short(d.prev_hash)}
							</TypographyInlineCode>
						</PropertyRow>
						<PropertyRow label="Chain">
							{d.verified ? (
								<span className="text-success">
									verified ✓ at {clock(d.verified_at)}
								</span>
							) : d.verified_at ? (
								<span className="text-destructive">
									not verified through this row
								</span>
							) : (
								<span className="text-muted-foreground">not checked yet</span>
							)}
						</PropertyRow>
					</PropertyList>

					{d.around.length > 0 && (
						<>
							<Eyebrow>Around it</Eyebrow>
							<div className="flex flex-col gap-0.5">
								{d.around.map((a) => (
									<Button
										key={a.id}
										variant="ghost"
										size="sm"
										className="justify-start"
										onClick={() => onRow(a.id)}
									>
										<span className="text-muted-foreground">#{a.seq}</span>
										<span className="font-mono">{a.act}</span>
										<span className="truncate text-muted-foreground">
											{a.actor_chain.at(-1)?.name ?? ""}
										</span>
									</Button>
								))}
							</div>
						</>
					)}

					<div className="flex flex-wrap gap-2">
						{row.run_id && (
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									open.run(row.run_id as string, row.step_run_id ?? undefined)
								}
							>
								<Play />
								{row.step_run_id ? "Open step in run " : "Open run "}
								{runLabel(row.run_number, row.run_id)}
							</Button>
						)}
						<Button
							variant="ghost"
							size="sm"
							onClick={() =>
								navigator.clipboard?.writeText(window.location.href)
							}
						>
							<Copy />
							Copy link
						</Button>
					</div>
				</>
			)}
		</FloatingPanel>
	);
}
