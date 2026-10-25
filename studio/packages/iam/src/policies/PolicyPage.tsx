/**
 * A policy's page, opened as a tab of its own (`?page=policy:<name>`) — what
 * it allows, its limits, who holds it and its versions (policies.md ›
 * `iam.policy.*`).
 *
 * *As an iam-admin, I want a policy as statements grouped by layer, with its
 * limits, its impact before I save it and a way to test it, so that I grant
 * exactly what is needed and never break an agent by accident.*
 *
 * - **Head** — *Policies › name*, the kind, `vN · held by … · owner …`;
 *   *Test access* for every member, *Edit* for a custom or boundary policy.
 *   A managed policy is built in and has no *Edit*; an inline one belongs to
 *   its token.
 * - **Tabs** — Statements · Limits · Held by · History, as `?tab=` while the
 *   page is in front.
 * - **A draft** — the banner, one `draft` badge, *Discard* · *Edit* ·
 *   *Review impact*. Saving is *Save anyway* in the impact modal, so the
 *   impact is always read before anything is saved.
 * - **Modals** — `?dialog=test` · `impact` · `edit` · `attach` · `discard`, so
 *   a link or a reload opens the same one.
 *
 * Without iam-admin every write is drawn disabled with the reason; reads and
 * Test access stay open.
 */

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
	Button,
	RecordHeader,
	TabbedPanel,
} from "@invana/ui";
import { ActButton, ReadOnlyNotice } from "@invana-studio/shell";
import { Check, Pencil, ScrollText, ShieldCheck } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useIamOpen } from "../open";
import { usePolicyMutations, usePolicyQuery } from "../queries";
import type { PolicyRead } from "../types";
import { EditPolicyDialog, type PolicyEdit } from "./EditPolicyDialog";
import { ImpactDialog } from "./ImpactDialog";
import { PolicyHeldByTab } from "./PolicyHeldByTab";
import { PolicyHistoryTab } from "./PolicyHistoryTab";
import { PolicyLimitsTab } from "./PolicyLimitsTab";
import { PolicyStatementsTab } from "./PolicyStatementsTab";
import {
	DraftBadge,
	KindBadge,
	ReadState,
	statementIn,
	usePageParam,
} from "./policyParts";
import { TestAccessDialog } from "./TestAccessDialog";

export interface PolicyPageProps {
	username: string;
	graphSlug: string;
	/** The policy's name — its address in the Graph. */
	name: string;
}

const TABS = [
	{ value: "statements", label: "Statements" },
	{ value: "limits", label: "Limits" },
	{ value: "held_by", label: "Held by" },
	{ value: "history", label: "History" },
] as const;
type PolicyTab = (typeof TABS)[number]["value"];
const TAB_KEYS = TABS.map((t) => t.value);

const DIALOGS = ["test", "impact", "edit", "attach", "discard"] as const;

/**
 * `v4 · held by group fare-team · 4 agents · owner sam` — the engine's lines,
 * joined. A draft has no version yet: `custom · not held by anyone yet`.
 */
function metaLine(policy: PolicyRead): string {
	const held = `held by ${policy.held_by.line}`;
	const owner = policy.owner ? `owner ${policy.owner}` : null;
	if (policy.status === "draft")
		return `${policy.kind} · ${held === "held by nobody" ? "not held by anyone yet" : held}`;
	const parts = [
		policy.kind === "managed" ? "managed — built in" : `v${policy.version}`,
		held,
		owner,
		policy.kind === "inline" ? "belongs to one token" : null,
	];
	return parts.filter(Boolean).join(" · ");
}

export function PolicyPage({ username, graphSlug, name }: PolicyPageProps) {
	const open = useIamOpen();
	const [params] = useSearchParams();
	const inFront = params.get("page") === `policy:${name}`;
	const [tab, setTab] = usePageParam<PolicyTab>(
		"tab",
		inFront,
		TAB_KEYS,
		"statements",
	);
	const [dialog, setDialog] = usePageParam("dialog", inFront, DIALOGS, null);
	const [edit, setEdit] = useState<PolicyEdit | null>(null);
	const query = usePolicyQuery(username, graphSlug, name);
	const { update, save, remove } = usePolicyMutations({ username, graphSlug });

	const crumbs = [
		{ label: "Policies", onClick: () => open.section("policies") },
		name,
	];
	const policy = query.data;
	if (!policy)
		return (
			<div className="flex h-full min-h-0 flex-col">
				<RecordHeader variant="page" icon={<ScrollText />} crumbs={crumbs} />
				<ReadState
					loading={query.isLoading}
					error={query.error ?? new Error("This policy is not in the Graph.")}
					what="this policy"
					onRetry={() => void query.refetch()}
				/>
			</div>
		);

	const draft = policy.status === "draft";
	const changeable = policy.kind === "custom" || policy.kind === "boundary";
	const close = () => {
		setDialog(null);
		setEdit(null);
	};

	const onEdited = (next: PolicyEdit) => {
		if (draft) {
			update.mutate(
				{
					name,
					data: {
						description: next.description,
						statements: next.statements,
						limits: next.limits,
					},
				},
				{ onSuccess: close },
			);
			return;
		}
		update.reset();
		setEdit(next);
		setDialog("impact");
	};

	const onSave = () => {
		if (edit) {
			update.mutate(
				{
					name,
					data: {
						description: edit.description,
						statements: edit.statements,
						limits: edit.limits,
						why: edit.why || null,
					},
				},
				{ onSuccess: close },
			);
			return;
		}
		save.mutate({ name, data: {} }, { onSuccess: close });
	};

	const openImpact = () => {
		save.reset();
		setEdit(null);
		setDialog("impact");
	};

	let acts: ReactNode;
	if (draft)
		acts = (
			<>
				<ActButton
					area="iam"
					size="sm"
					variant="ghost"
					onClick={() => setDialog("discard")}
				>
					Discard
				</ActButton>
				<ActButton
					area="iam"
					size="sm"
					variant="outline"
					onClick={() => setDialog("edit")}
				>
					<Pencil />
					Edit
				</ActButton>
				<ActButton area="iam" size="sm" onClick={openImpact}>
					<Check />
					Review impact
				</ActButton>
			</>
		);
	else
		acts = (
			<>
				<Button size="sm" variant="outline" onClick={() => setDialog("test")}>
					<ShieldCheck />
					Test access
				</Button>
				{changeable ? (
					<ActButton area="iam" size="sm" onClick={() => setDialog("edit")}>
						<Pencil />
						Edit
					</ActButton>
				) : null}
			</>
		);

	const body = (value: PolicyTab) => {
		switch (value) {
			case "statements":
				return <PolicyStatementsTab policy={policy} />;
			case "limits":
				return (
					<PolicyLimitsTab
						username={username}
						graphSlug={graphSlug}
						name={name}
					/>
				);
			case "held_by":
				return (
					<PolicyHeldByTab
						username={username}
						graphSlug={graphSlug}
						policy={policy}
						attaching={dialog === "attach"}
						onAttaching={(o) => setDialog(o ? "attach" : null)}
					/>
				);
			case "history":
				return (
					<PolicyHistoryTab
						username={username}
						graphSlug={graphSlug}
						name={name}
					/>
				);
		}
	};
	const shown: PolicyTab =
		dialog === "attach" ? "held_by" : (tab ?? "statements");

	return (
		// `h-full`: the page host is not a flex column, so without it the head
		// and the tabs would scroll away with the body.
		<div className="flex h-full min-h-0 flex-col">
			{draft ? (
				<div className="shrink-0 px-3.5 pt-3.5">
					<Alert tone="info">
						<Pencil className="size-4" />
						<AlertDescription>
							{policy.drafted_by === "assistant"
								? "Draft by the assistant — nothing changes until you save."
								: "Draft — nothing changes until you save."}
						</AlertDescription>
					</Alert>
				</div>
			) : null}
			<RecordHeader
				variant="page"
				icon={<ScrollText />}
				crumbs={crumbs}
				chips={
					<>
						{draft ? <DraftBadge /> : <KindBadge kind={policy.kind} />}
						<span className="truncate text-muted-foreground">
							{metaLine(policy)}
						</span>
					</>
				}
				actions={acts}
			/>
			{changeable ? (
				<div className="shrink-0 px-3.5 pt-3.5 empty:hidden">
					<ReadOnlyNotice area="iam" noun="policy" />
				</div>
			) : null}
			<TabbedPanel
				className="min-h-0 flex-1 border-0 bg-transparent shadow-none"
				bodyClassName="p-3"
				activeTab={shown}
				onTabChange={(v) => setTab(v as PolicyTab)}
				tabs={TABS.map((t) => ({
					value: t.value,
					label: t.label,
					content: t.value === shown ? body(t.value) : null,
				}))}
			/>
			{dialog === "test" ? (
				<TestAccessDialog
					username={username}
					graphSlug={graphSlug}
					onClose={close}
				/>
			) : null}
			{dialog === "edit" && changeable ? (
				<EditPolicyDialog
					policy={policy}
					pending={draft && update.isPending}
					error={draft ? update.error : null}
					onCancel={close}
					onDone={onEdited}
				/>
			) : null}
			{dialog === "impact" && (draft || edit) ? (
				<ImpactDialog
					username={username}
					graphSlug={graphSlug}
					policy={policy}
					candidate={
						edit
							? { statements: edit.statements, limits: edit.limits }
							: {
									statements: policy.statements.map(statementIn),
									limits: policy.limits,
								}
					}
					saving={update.isPending || save.isPending}
					saveError={edit ? update.error : save.error}
					onCancel={() => (edit ? setDialog("edit") : close())}
					onSave={onSave}
				/>
			) : null}
			<AlertDialog
				open={dialog === "discard" && draft}
				onOpenChange={(o) => !o && close()}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard {name}?</AlertDialogTitle>
						<AlertDialogDescription>
							{remove.error instanceof Error
								? remove.error.message
								: "A draft decides nothing, so it is deleted, with whatever holds it."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep it</AlertDialogCancel>
						<AlertDialogAction
							disabled={remove.isPending}
							onClick={(e) => {
								e.preventDefault();
								remove.mutate(name, {
									onSuccess: () => open.section("policies"),
								});
							}}
						>
							Discard draft
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
