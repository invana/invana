/**
 * The guardrail inspector — the Guardrails page's right column while
 * `?guardrail=` names one.
 *
 * A shield and the guardrail's name, then three tabs over its detail read:
 *
 * | Tab | Reads |
 * |---|---|
 * | Rule | Applies to (each type carrying the property) · the rule as a sentence · the worlds it does not bind in · Refused (who · where · when) with the engine's count for the week · *Edit rule* · *Delete* |
 * | Refusals | every request it filed — a row opens the request bar over the canvas |
 * | History | its events |
 *
 * *Edit rule* and *Delete* are the modeller's; without the role they are
 * absent and a line says who may edit. The detail read is also what the
 * breadcrumb names the guardrail from.
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
	Button,
	EmptyState,
	Eyebrow,
	PropertyList,
	PropertyRow,
	RecordHeader,
	Spinner,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@invana/ui";
import { formatGrouped, formatRelativeTime } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { Pencil, Shield, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDeleteGuardrailMutation, useGuardrailQuery } from "../queries";
import type { GuardrailDetail, GuardrailRefusal } from "../types";
import { ruleSentence } from "./ruleText";

export interface GuardrailInspectorProps {
	username: string;
	graphSlug: string;
	guardrailId: string;
	/** The reader holds the modeller role. */
	mayEdit: boolean;
	onClose: () => void;
	/** A refusal row — opens its request over the canvas. */
	onOpenRequest: (requestId: string) => void;
	onEditRule: (guardrail: GuardrailDetail) => void;
	onDeleted: () => void;
}

const REFUSED_SHOWN = 5;

const EVENT_LABEL: Record<string, string> = {
	"lens.create": "Created",
	"lens.update": "Edited",
	"lens.delete": "Deleted",
};

const when = (iso: string) => formatRelativeTime(new Date(iso));

export function GuardrailInspector({
	username,
	graphSlug,
	guardrailId,
	mayEdit,
	onClose,
	onOpenRequest,
	onEditRule,
	onDeleted,
}: GuardrailInspectorProps) {
	const detail = useGuardrailQuery(username, graphSlug, guardrailId);
	const remove = useDeleteGuardrailMutation(username, graphSlug);
	const [confirm, setConfirm] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (detail.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Spinner />
			</div>
		);
	}
	const g = detail.data;
	if (!g) {
		return (
			<div className="flex h-full flex-col">
				<RecordHeader
					variant="page"
					size="md"
					icon={<Shield />}
					crumbs={["Guardrail"]}
					actions={<CloseButton onClose={onClose} />}
				/>
				<EmptyState
					className="flex-1"
					title="This guardrail is not here"
					description="It was deleted, or it is not in this Graph."
				/>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<RecordHeader
				variant="page"
				size="md"
				icon={<Shield />}
				crumbs={[g.name]}
				actions={<CloseButton onClose={onClose} />}
			/>

			<Tabs
				size="sm"
				defaultValue="rule"
				className="flex min-h-0 flex-1 flex-col"
			>
				<TabsList className="shrink-0 justify-start border-b px-3">
					<TabsTrigger value="rule">Rule</TabsTrigger>
					<TabsTrigger value="refusals">Refusals</TabsTrigger>
					<TabsTrigger value="history">History</TabsTrigger>
				</TabsList>

				<TabsContent
					value="rule"
					className="mt-0 min-h-0 flex-1 overflow-y-auto"
				>
					<div className="flex flex-col gap-3 p-3">
						<section className="flex flex-col gap-1">
							<Eyebrow>Applies to</Eyebrow>
							{g.applies_to.length ? (
								<PropertyList labelWidth="auto">
									{g.applies_to.map((a) => (
										<PropertyRow
											key={`${a.model}.${a.type}.${a.property}`}
											label={`${a.type}.${a.property}`}
											mono
										>
											{a.model}
										</PropertyRow>
									))}
								</PropertyList>
							) : (
								<p className="text-sm text-muted-foreground">
									No published type carries this property today.
								</p>
							)}
						</section>

						<section className="flex flex-col gap-1">
							<Eyebrow>Rule</Eyebrow>
							<p>{ruleSentence(g)}</p>
							{g.allowed_in.length ? (
								<p className="text-sm text-muted-foreground">
									Does not bind in {g.allowed_in.map((w) => w.name).join(" · ")}
									.
								</p>
							) : null}
						</section>

						<section className="flex flex-col gap-1">
							<Eyebrow aside={`${formatGrouped(g.refused_7d)} this week`}>
								Refused
							</Eyebrow>
							<Refusals
								rows={g.refusals.slice(0, REFUSED_SHOWN)}
								onOpen={onOpenRequest}
							/>
						</section>

						{mayEdit ? (
							<div className="flex items-center gap-2">
								<Button
									size="sm"
									variant="outline"
									onClick={() => onEditRule(g)}
								>
									<Pencil />
									Edit rule
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => {
										setError(null);
										setConfirm(true);
									}}
								>
									<Trash2 />
									Delete
								</Button>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								Guardrails are edited by a member with the modeller role.
							</p>
						)}
						<FormError error={error} />
					</div>
				</TabsContent>

				<TabsContent
					value="refusals"
					className="mt-0 min-h-0 flex-1 overflow-y-auto"
				>
					<div className="flex flex-col gap-1 p-3">
						<Eyebrow aside={formatGrouped(g.refusals_total)}>
							Requests it filed
						</Eyebrow>
						<Refusals rows={g.refusals} onOpen={onOpenRequest} />
					</div>
				</TabsContent>

				<TabsContent
					value="history"
					className="mt-0 min-h-0 flex-1 overflow-y-auto"
				>
					<div className="p-3">
						{g.history.length ? (
							<PropertyList labelWidth={84}>
								{g.history.map((e) => (
									<PropertyRow
										key={`${e.action}:${e.at}`}
										label={EVENT_LABEL[e.action] ?? e.action}
										mono
									>
										{e.actor ?? "—"} · {when(e.at)}
									</PropertyRow>
								))}
							</PropertyList>
						) : (
							<p className="text-sm text-muted-foreground">
								No events are recorded for this guardrail.
							</p>
						)}
					</div>
				</TabsContent>
			</Tabs>

			<AlertDialog open={confirm} onOpenChange={setConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {g.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							The next run in this Graph may read and send {g.target}. Runs in
							flight keep the lens they froze.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep it</AlertDialogCancel>
						<AlertDialogAction
							onClick={() =>
								remove
									.mutateAsync(g.id)
									.then(() => {
										toast.success("Guardrail deleted");
										onDeleted();
									})
									.catch((err: unknown) =>
										setError(
											err instanceof Error
												? err.message
												: "The delete was refused.",
										),
									)
							}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function Refusals({
	rows,
	onOpen,
}: {
	rows: GuardrailRefusal[];
	onOpen: (requestId: string) => void;
}) {
	if (!rows.length) {
		return (
			<p className="text-sm text-muted-foreground">
				Nothing has been refused by this rule.
			</p>
		);
	}
	return (
		<div className="flex flex-col">
			{rows.map((r) => (
				<Button
					key={r.request_id}
					variant="ghost"
					size="sm"
					className="justify-between font-normal"
					onClick={() => onOpen(r.request_id)}
				>
					<span className="truncate font-mono">
						{r.who} · {r.where}
					</span>
					<span className="text-sm text-muted-foreground">{when(r.at)}</span>
				</Button>
			))}
		</div>
	);
}

function CloseButton({ onClose }: { onClose: () => void }) {
	return (
		<Button
			variant="ghost"
			size="icon-xs"
			aria-label="Close the guardrail"
			onClick={onClose}
		>
			<X />
		</Button>
	);
}
