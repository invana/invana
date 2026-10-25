/**
 * Approvals › Waiting: every ask an agent or a run makes of a person, as one
 * table — Kind · Asked by · Wants · Routed to · Waiting · Run.
 *
 * `For you · N` is what the reader may decide, `All · N` every pending ask
 * they can see, `Answered` the decided and expired ones, newest first; the
 * view is `?f.view=` and the counts are the engine's. On the reader's own
 * asks Decline · Approve sit in the row — a delegation adds *Allow always* —
 * and anyone else's reads *waiting on them*. A row opens the ask: exactly what
 * it holds, and a note with the decision. The run cell opens the run's page.
 */

import {
	Button,
	EmptyState,
	SegmentedControl,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@invana/ui";
import { useAuth, useListParams } from "@invana-studio/core";
import type { Approval } from "@invana-studio/shell";
import { FormError } from "@invana-studio/ui";
import { Check } from "lucide-react";
import { useState } from "react";
import { ActorChain } from "../ledger/ledgerParts";
import { filterValue, PAGE, setOne } from "../lists";
import { useAgentsOpen } from "../open";
import { FleetReadState } from "../overview/fleetParts";
import { AskDialog } from "./AskDialog";
import { answer, KindBadge, RunLink, routedTo, waited } from "./askParts";
import { useAsksQuery, useDecideMutation } from "./queries";
import type { ApprovalsView } from "./types";

const VIEWS: ApprovalsView[] = ["for_you", "all", "answered"];

export function WaitingTab({
	username,
	graphSlug,
}: {
	username: string;
	graphSlug: string;
}) {
	const open = useAgentsOpen();
	const list = useListParams();
	const { user } = useAuth();
	const raw = filterValue(list, "view") as ApprovalsView;
	const view: ApprovalsView = VIEWS.includes(raw) ? raw : "for_you";
	const query = useAsksQuery(username, graphSlug, {
		filters: { ...list.query.filters, view: [view] },
		limit: PAGE,
	});
	const page = query.data;
	const decide = useDecideMutation({ username, graphSlug });
	const [reviewing, setReviewing] = useState<Approval | null>(null);

	const options = [
		{
			value: "for_you",
			label: page ? `For you · ${page.for_you}` : "For you",
		},
		{ value: "all", label: page ? `All · ${page.pending}` : "All" },
		{ value: "answered", label: "Answered" },
	];

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<SegmentedControl
					size="sm"
					aria-label="Showing"
					value={view}
					onValueChange={(v) => setOne(list, "view", v === "for_you" ? "" : v)}
					options={options}
				/>
				<span className="ml-auto text-muted-foreground">
					A waiting step holds; the rest of its run carries on
				</span>
			</div>
			<FormError error={decide.error} />

			{query.isLoading ? (
				<FleetReadState loading error={null} what="the asks" />
			) : query.error ? (
				<FleetReadState loading={false} error={query.error} what="the asks" />
			) : !page?.items.length ? (
				<EmptyState
					title={
						view === "for_you"
							? "Nothing waits on you"
							: view === "all"
								? "Nothing waits on anyone"
								: "No ask answered yet"
					}
					description="An agent asks when it needs access, budget, a delegation, a send or an answer."
				/>
			) : (
				<div className="rounded-sm border">
					<Table density="compact">
						<TableHeader>
							<TableRow>
								<TableHead>Kind</TableHead>
								<TableHead>Asked by</TableHead>
								<TableHead>Wants</TableHead>
								<TableHead>Routed to</TableHead>
								<TableHead>
									{view === "answered" ? "Answered" : "Waiting"}
								</TableHead>
								<TableHead>Run</TableHead>
								<TableHead>
									<span className="sr-only">Decision</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{page.items.map((ask) => (
								<TableRow
									key={ask.id}
									className="cursor-pointer"
									onClick={() => setReviewing(ask)}
								>
									<TableCell>
										<KindBadge kind={ask.kind ?? ask.subject_kind} />
									</TableCell>
									<TableCell>
										<ActorChain chain={ask.asked_by ?? []} />
									</TableCell>
									<TableCell>{ask.wants || ask.title}</TableCell>
									<TableCell className="text-muted-foreground">
										{routedTo(ask, user?.username) || "—"}
									</TableCell>
									<TableCell className="whitespace-nowrap text-muted-foreground">
										{waited(ask)}
									</TableCell>
									<TableCell>
										<RunLink ask={ask} onOpen={open.run} />
									</TableCell>
									<TableCell
										className="whitespace-nowrap text-right"
										onClick={(e) => e.stopPropagation()}
									>
										{ask.status !== "pending" ? (
											<span className="text-muted-foreground">
												{answer(ask)}
											</span>
										) : ask.can_decide ? (
											<span className="inline-flex gap-1">
												<Button
													variant="ghost"
													size="sm"
													disabled={decide.isPending}
													onClick={() =>
														decide.mutate({ id: ask.id, decision: "decline" })
													}
												>
													Decline
												</Button>
												{ask.kind === "delegation" && (
													<Button
														variant="ghost"
														size="sm"
														disabled={decide.isPending}
														onClick={() =>
															decide.mutate({
																id: ask.id,
																decision: "approve",
																scope: "always",
															})
														}
													>
														Allow always
													</Button>
												)}
												<Button
													variant="outline"
													size="sm"
													disabled={decide.isPending}
													onClick={() =>
														decide.mutate({
															id: ask.id,
															decision: "approve",
															scope: "run",
														})
													}
												>
													<Check />
													Approve
												</Button>
											</span>
										) : (
											<span className="text-muted-foreground">
												waiting on them
											</span>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}

			<AskDialog
				username={username}
				graphSlug={graphSlug}
				ask={reviewing}
				me={user?.username}
				onClose={() => setReviewing(null)}
				onOpenRun={open.run}
			/>
		</div>
	);
}
