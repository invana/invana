/**
 * `<PlatformWorkbook>` — the `mainSection` of a platform product: its section
 * as the first tab, and the records opened from it as tabs beside it.
 *
 * A platform product (Fleet, Settings) routes off any Graph, so it is not
 * drawn by the graph product host; the shell draws its rail as `leftNav` and
 * this fills `mainSection`. The section tab is always there and does not
 * close. `?page=<kind>:<id>` names the record in front, so a link and a
 * reload land on it; the other record tabs are this session's.
 *
 *     <PlatformWorkbook
 *       section={{ id: "workers", title: "Workers", icon: ServerCog, content: <WorkersPage /> }}
 *       records={{ worker_pool: { icon: Boxes, render: (id) => <PoolPage pool={id} /> } }}
 *     />
 *
 * A page deep in the section opens a record with `useOpenPlatformRecord()`.
 */
import { ErrorBoundary, Workbook, type WorkbookPage } from "@invana/ui";
import { type ProductIcon, reportBoundaryError } from "@invana-studio/core";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const PAGE = "page";

/** One kind of record a platform product opens as a tab. */
interface PlatformRecordKind {
	icon: ProductIcon;
	/** The tab's title; the record's id when absent. */
	title?: (id: string) => string;
	render: (id: string) => ReactNode;
}

interface Section {
	id: string;
	title: string;
	icon: ProductIcon;
	content: ReactNode;
}

interface OpenRecord {
	kind: string;
	id: string;
}

const keyOf = (r: OpenRecord) => `${r.kind}:${r.id}`;

function parse(
	value: string | null,
	records: Record<string, PlatformRecordKind>,
): OpenRecord | null {
	if (!value) return null;
	const at = value.indexOf(":");
	if (at <= 0) return null;
	const kind = value.slice(0, at);
	const id = value.slice(at + 1);
	return kind in records && id ? { kind, id } : null;
}

/** Opens a record as a tab in front, by writing `?page=`. */
export function useOpenPlatformRecord(): (kind: string, id: string) => void {
	const [, setParams] = useSearchParams();
	return useCallback(
		(kind, id) =>
			setParams((prev) => {
				const next = new URLSearchParams(prev);
				next.set(PAGE, `${kind}:${id}`);
				return next;
			}),
		[setParams],
	);
}

export function PlatformWorkbook({
	section,
	records,
}: {
	section: Section;
	records: Record<string, PlatformRecordKind>;
}) {
	const [params, setParams] = useSearchParams();
	const front = parse(params.get(PAGE), records);
	const [open, setOpen] = useState<OpenRecord[]>([]);

	// The record the path names joins the open tabs, once.
	useEffect(() => {
		if (!front) return;
		setOpen((tabs) =>
			tabs.some((t) => keyOf(t) === keyOf(front)) ? tabs : [...tabs, front],
		);
	}, [front]);

	const showRecord = (key: string | null) =>
		setParams((prev) => {
			const next = new URLSearchParams(prev);
			if (key) next.set(PAGE, key);
			else next.delete(PAGE);
			return next;
		});

	const shown =
		front && !open.some((t) => keyOf(t) === keyOf(front))
			? [...open, front]
			: open;
	const pages: WorkbookPage[] = [
		{
			id: `section:${section.id}`,
			title: section.title,
			icon: section.icon,
			content: section.content,
		},
		...shown.map((r) => {
			const kind = records[r.kind];
			return {
				id: keyOf(r),
				title: kind.title?.(r.id) ?? r.id,
				icon: kind.icon,
				closable: true,
				content: (
					<ErrorBoundary onError={reportBoundaryError}>
						{kind.render(r.id)}
					</ErrorBoundary>
				),
			};
		}),
	];

	return (
		<Workbook
			className="h-full"
			pages={pages}
			activeId={front ? keyOf(front) : `section:${section.id}`}
			keepMounted={false}
			onSelect={(id) => showRecord(id.startsWith("section:") ? null : id)}
			onClose={(id) => {
				setOpen((tabs) => tabs.filter((t) => keyOf(t) !== id));
				if (front && keyOf(front) === id) showRecord(null);
			}}
		/>
	);
}
