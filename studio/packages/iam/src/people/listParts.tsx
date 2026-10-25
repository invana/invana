/**
 * What IAM's lists and record pages share: the list contract's pieces (the
 * kind tabs, the applied-filters strip, the count beside the name), the read
 * state a page shows while it waits or after a refusal, and the small
 * name-and-description modal *New service account* and *New group* open.
 *
 * The engine searches, filters and counts every list (list-contract.md); the
 * browser never narrows a row. A kind tab's count is the engine's `kinds`,
 * `all` included.
 */

import { Input, Label, Textarea } from "@invana/forms";
import {
	AppliedFilters,
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	EmptyState,
	SegmentedControl,
	Spinner,
} from "@invana/ui";
import type { ListUrl, Page } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { CircleAlert } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

/** A list that shows its rows asks for a full page. */
export const PAGE = 200;

/** `sam · lee · 2 more` — names in a cell, `—` for none. */
export function joined(names: string[], show = names.length): string {
	if (!names.length) return "—";
	const head = names.slice(0, show).join(" · ");
	const rest = names.length - show;
	return rest > 0 ? `${head} · ${rest} more` : head;
}

/** The first value of `?f.kind=`, or empty. */
export function kindOf(list: ListUrl): string {
	return list.query.filters?.kind?.[0] ?? "";
}

/**
 * The kind tabs over a list — `All 12 · People 10 · Service accounts 2` —
 * writing `?f.kind=`. Counts are the engine's `kinds`; a tab shows no count
 * until they arrive.
 */
export function KindTabs({
	list,
	kinds,
	tabs,
	label,
}: {
	list: ListUrl;
	kinds: Record<string, number> | undefined;
	/** The engine's kind value and its tab's name; `all` is drawn first. */
	tabs: { value: string; label: string }[];
	label: string;
}) {
	const counted = (value: string, name: string) =>
		kinds ? `${name} ${kinds[value] ?? 0}` : name;
	return (
		<SegmentedControl
			size="sm"
			aria-label={label}
			value={kindOf(list) || "all"}
			onValueChange={(v) => list.setFilter("kind", v === "all" ? [] : [v])}
			options={[{ value: "all", label: "All" }, ...tabs].map((t) => ({
				value: t.value,
				label: counted(t.value, t.label),
			}))}
		/>
	);
}

/** The count beside a section's name: `12 people`, or `2 of 12 match`. */
export function CountChip({
	page,
	noun,
}: {
	page: Page<unknown> | undefined;
	noun: string;
}) {
	if (!page) return null;
	return (
		<Badge variant="outline" tone="muted" size="xs">
			{page.applied.length
				? `${page.total} of ${page.unfiltered_total} match`
				: `${page.total} ${noun}`}
		</Badge>
	);
}

/** The applied-filters strip above a list's rows; nothing when nothing is applied. */
export function ListStrip({
	page,
	list,
}: {
	page: Page<unknown> | undefined;
	list: ListUrl;
}) {
	return (
		<AppliedFilters
			filters={page?.applied ?? list.pending}
			onRemove={list.remove}
			onClearAll={list.clear}
			setBy={list.viaAssistant ? "the assistant" : undefined}
		/>
	);
}

/** A read in flight, or one the engine refused, named in its words. */
export function ReadState({
	loading,
	error,
	what,
	onRetry,
}: {
	loading: boolean;
	error: unknown;
	/** What is being read — `the people of this Graph`. */
	what: string;
	onRetry?: () => void;
}) {
	if (loading)
		return (
			<div className="flex items-center justify-center p-6">
				<Spinner />
			</div>
		);
	if (!error) return null;
	return (
		<EmptyState
			icon={<CircleAlert className="size-6" />}
			title={`Could not read ${what}`}
			description={error instanceof Error ? error.message : undefined}
			actions={
				onRetry ? (
					<Button variant="outline" size="sm" onClick={onRetry}>
						Try again
					</Button>
				) : undefined
			}
		/>
	);
}

/**
 * A modal asking for a name and a description — *New service account*,
 * *New group*. The engine's refusal (a name taken) shows in it, in the
 * engine's words; the modal closes only when the write lands.
 */
export function NameDialog({
	open,
	title,
	description,
	nameLabel,
	submitLabel,
	pending,
	error,
	onOpenChange,
	onSubmit,
}: {
	open: boolean;
	title: string;
	description: string;
	nameLabel: string;
	submitLabel: string;
	pending: boolean;
	error: Error | null;
	onOpenChange: (open: boolean) => void;
	onSubmit: (name: string, description: string) => void;
}) {
	const [name, setName] = useState("");
	const [about, setAbout] = useState("");

	useEffect(() => {
		if (open) {
			setName("");
			setAbout("");
		}
	}, [open]);

	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (name.trim()) onSubmit(name.trim(), about.trim());
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={submit} className="space-y-4" noValidate>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>
					<div className="space-y-1.5">
						<Label htmlFor="iam-name">{nameLabel}</Label>
						<Input
							id="iam-name"
							value={name}
							autoFocus
							onChange={(e) => setName(e.target.value)}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="iam-description">Description</Label>
						<Textarea
							id="iam-description"
							rows={2}
							value={about}
							onChange={(e) => setAbout(e.target.value)}
						/>
					</div>
					<FormError error={error} />
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={pending || !name.trim()}>
							{submitLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
