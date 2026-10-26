/**
 * The Requests page — `/modeller/requests`, one inbox of what analysts and
 * agents asked to be modelled or allowed.
 *
 * The engine files a request where an ask fails — a guardrail refusal, an ask
 * the Graph could not answer — and when someone asks for a change; this page
 * reads them in two groups. **Open** lists what is waiting, each row with its
 * acts; **Done** starts folded, each row saying what resolving did.
 *
 * | Act | What it does |
 * |---|---|
 * | *Decline* | resolves the request as declined |
 * | *Allow in a world* | a guardrail request: picks the world the guardrail stops binding in |
 * | *Model it* | any other: opens *New model*; creating the draft resolves the request as modelled, then lands on the draft |
 *
 * Every member reads the inbox; resolving is the modeller role's, so without it
 * the rows carry no acts. The `N open` chip is the engine's count, never a
 * count of the rows listed. A request someone else resolved first is refused
 * with *already resolved*, and the list is read again.
 */

import {
	Badge,
	EmptyState,
	RecordHeader,
	SectionHeader,
	Skeleton,
} from "@invana/ui";
import { ApiError } from "@invana-studio/core";
import { useAccess } from "@invana-studio/shell";
import { ChevronDown, ChevronRight, Inbox } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { NewModelDialog } from "../models/model-editor/components/NewModelDialog";
import { modelPagePath } from "../models/model-page/useModelsView";
import { AllowInWorldDialog } from "./AllowInWorldDialog";
import { useRequestsQuery, useResolveRequestMutation } from "./queries";
import { RequestRow } from "./RequestRow";
import type { ModelRequest, RequestResolve } from "./types";

export interface RequestsPageProps {
	username: string;
	graphSlug: string;
}

const SUBTITLE =
	'From Explorer\'s "Ask for a change" and from asks the Graph could not answer';

/** A group of rows under a header that folds it. */
function Group({
	title,
	count,
	defaultOpen = true,
	children,
}: {
	title: string;
	count: number;
	/** Done starts folded: what was resolved is looked up, not read. */
	defaultOpen?: boolean;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<section className="flex flex-col">
			<SectionHeader
				bare
				title={
					<button
						type="button"
						aria-expanded={open}
						onClick={() => setOpen((o) => !o)}
						className="flex items-center gap-1.5"
					>
						{open ? (
							<ChevronDown className="size-3.5" />
						) : (
							<ChevronRight className="size-3.5" />
						)}
						{title}
					</button>
				}
				count={count}
			/>
			{open ? children : null}
		</section>
	);
}

function Rows({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-col divide-y rounded-control border bg-card">
			{children}
		</div>
	);
}

export function RequestsPage({ username, graphSlug }: RequestsPageProps) {
	const navigate = useNavigate();
	const openQuery = useRequestsQuery(username, graphSlug, { status: "open" });
	const doneQuery = useRequestsQuery(username, graphSlug, { status: "done" });
	const resolve = useResolveRequestMutation(username, graphSlug);
	const modelGate = useAccess().gate("model").allowed;
	const [allowing, setAllowing] = useState<ModelRequest | null>(null);
	const [modelling, setModelling] = useState<ModelRequest | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);

	const openPage = openQuery.data;
	const donePage = doneQuery.data;
	const mayResolve = openPage?.may_resolve ?? modelGate;
	const openRows = openPage?.items ?? [];
	const doneRows = donePage?.items ?? [];

	const settle = async (request: ModelRequest, data: RequestResolve) => {
		setBusyId(request.id);
		try {
			const done = await resolve.mutateAsync({ id: request.id, data });
			toast.success(done.resolution_note ?? "Resolved");
			return done;
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				toast.error("Already resolved — the list is read again.");
				void openQuery.refetch();
				void doneQuery.refetch();
			} else {
				toast.error(
					err instanceof ApiError ? err.message : "The request was refused.",
				);
			}
			return null;
		} finally {
			setBusyId(null);
		}
	};

	const head = (
		<div className="flex flex-col">
			<RecordHeader
				variant="page"
				icon={<Inbox />}
				crumbs={["Requests"]}
				chips={
					openPage ? (
						<Badge variant="outline" size="sm">
							{openPage.open} open
						</Badge>
					) : null
				}
			/>
			<p className="px-3 pb-2 text-sm text-muted-foreground">{SUBTITLE}</p>
		</div>
	);

	const loading = openQuery.isLoading || doneQuery.isLoading;
	const failed = openQuery.isError ? openQuery.error : null;
	const empty = !loading && !failed && !openRows.length && !doneRows.length;

	return (
		<div className="flex h-full min-h-0 flex-col">
			{head}
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-3">
					{loading ? (
						<>
							<Skeleton className="h-24 w-full" />
							<Skeleton className="h-24 w-full" />
						</>
					) : failed ? (
						<EmptyState
							title="The requests could not be read"
							description={
								failed instanceof Error
									? failed.message
									: "The engine did not answer for this Graph."
							}
						/>
					) : empty ? (
						<EmptyState
							icon={<Inbox className="size-6" />}
							title="Nothing asked yet — refusals and asks the Graph could not answer land here"
						/>
					) : (
						<>
							<Group title="Open" count={openPage?.total ?? openRows.length}>
								{openRows.length ? (
									<Rows>
										{openRows.map((r) => (
											<RequestRow
												key={r.id}
												request={r}
												username={username}
												graphSlug={graphSlug}
												mayResolve={mayResolve}
												busy={busyId === r.id}
												onDecline={(req) =>
													void settle(req, { action: "decline" })
												}
												onAllow={setAllowing}
												onModel={setModelling}
											/>
										))}
									</Rows>
								) : (
									<p className="px-3 text-sm text-muted-foreground">
										Nothing is waiting.
									</p>
								)}
							</Group>
							<Group
								title="Done"
								count={donePage?.total ?? doneRows.length}
								defaultOpen={false}
							>
								{doneRows.length ? (
									<Rows>
										{doneRows.map((r) => (
											<RequestRow
												key={r.id}
												request={r}
												username={username}
												graphSlug={graphSlug}
												mayResolve={false}
												busy={false}
												onDecline={() => {}}
												onAllow={() => {}}
												onModel={() => {}}
											/>
										))}
									</Rows>
								) : (
									<p className="px-3 text-sm text-muted-foreground">
										No request has been resolved.
									</p>
								)}
							</Group>
						</>
					)}
				</div>
			</div>

			<AllowInWorldDialog
				username={username}
				graphSlug={graphSlug}
				request={allowing}
				onClose={() => setAllowing(null)}
			/>
			<NewModelDialog
				open={modelling !== null}
				username={username}
				graphSlug={graphSlug}
				initialDescription={modelling?.title}
				onClose={() => setModelling(null)}
				onCreated={(modelId) => {
					const request = modelling;
					setModelling(null);
					// Creating the draft is what resolves the request; the page then
					// lands on the draft, as New model does everywhere.
					if (request)
						void settle(request, { action: "model", model_id: modelId });
					navigate(
						modelPagePath(username, graphSlug, modelId, { schema: true }),
					);
				}}
			/>
		</div>
	);
}
