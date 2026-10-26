/**
 * The Guardrails page — what no run in this Graph may see or send.
 *
 * The lens canvas under the guardrails alone (`GET …/govern/view` with no
 * world): no type hidden, every guarded property chipped. With `?guardrail=`
 * the page's right column is that guardrail's inspector; with `?request=` the
 * request bar sits over the canvas, so a refusal is resolved where the rule
 * that caused it is read.
 *
 * | Region | What |
 * |---|---|
 * | over the canvas | the request bar — *Decline* · *Allow in a world* |
 * | the canvas's strip | `Guardrails · N guarded` |
 * | the right column | the guardrail inspector — Rule · Refusals · History |
 * | a modal | the rule dialog, while `?edit=1` or *Edit rule* |
 *
 * *New rule* is the Govern panel's; this page edits the one it reads.
 */

import { Card } from "@invana/ui";
import type { CanvasBackend } from "@invana-studio/canvases";
import { usePageParams } from "@invana-studio/shell";
import { useCallback } from "react";
import { GuardrailInspector } from "../guardrails/GuardrailInspector";
import { RequestBar } from "../guardrails/RequestBar";
import { RuleDialog } from "../guardrails/RuleDialog";
import { LensCanvas } from "../lens-canvas/LensCanvas";
import {
	useGuardrailQuery,
	useGuardrailsQuery,
	useLensViewQuery,
} from "../queries";
import { EDIT_PARAM, useLensesViewPanel } from "../useLensesViewPanel";

export interface GuardrailsPageProps {
	username: string;
	graphSlug: string;
	backend?: CanvasBackend;
}

const REQUEST_PARAM = "request";

export function GuardrailsPage({
	username,
	graphSlug,
	backend,
}: GuardrailsPageProps) {
	const govern = useLensesViewPanel();
	const [params, setParams] = usePageParams();
	const guardrailId = govern.guardrailId;
	const requestId = params.get(REQUEST_PARAM);
	const view = useLensViewQuery(username, graphSlug, null);
	const list = useGuardrailsQuery(username, graphSlug);
	// The inspector's read — also what the breadcrumb names the guardrail from.
	const detail = useGuardrailQuery(
		username,
		graphSlug,
		guardrailId ?? undefined,
	);
	const mayEdit = !!list.data?.may_edit;

	// The page may stay mounted behind another; only its own section edits.
	const editing =
		params.get(EDIT_PARAM) === "1" &&
		govern.sectionKey === "guardrails" &&
		mayEdit &&
		!!detail.data;

	const write = useCallback(
		(key: string, value: string | null) =>
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					if (value) next.set(key, value);
					else next.delete(key);
					return next;
				},
				{ replace: true },
			),
		[setParams],
	);

	const v = view.data;
	const none = list.data?.total === 0;

	return (
		<div className="flex h-full min-h-0 w-full">
			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				{requestId ? (
					<div className="shrink-0 border-b p-2">
						<RequestBar
							username={username}
							graphSlug={graphSlug}
							requestId={requestId}
							mayResolve={mayEdit}
							onDone={() => write(REQUEST_PARAM, null)}
						/>
					</div>
				) : null}
				<div className="relative min-h-0 flex-1">
					<LensCanvas
						username={username}
						graphSlug={graphSlug}
						view={v}
						backend={backend}
						title="Guardrails"
						summary={v ? `${v.guarded} guarded` : undefined}
					>
						{none ? (
							<Card className="px-3 py-1.5 shadow-md">
								No guardrails — every property may be read and may leave
							</Card>
						) : null}
					</LensCanvas>
				</div>
			</div>
			{guardrailId ? (
				<aside className="flex min-h-0 w-104 shrink-0 flex-col border-l bg-card">
					<GuardrailInspector
						key={guardrailId}
						username={username}
						graphSlug={graphSlug}
						guardrailId={guardrailId}
						mayEdit={mayEdit}
						onClose={() => govern.openGuardrail(null)}
						onOpenRequest={(id) => write(REQUEST_PARAM, id)}
						onEditRule={() => write(EDIT_PARAM, "1")}
						onDeleted={() => govern.openGuardrail(null)}
					/>
				</aside>
			) : null}
			<RuleDialog
				username={username}
				graphSlug={graphSlug}
				open={editing}
				guardrail={editing ? (detail.data ?? null) : null}
				onClose={() => write(EDIT_PARAM, null)}
				onSaved={(id) => govern.openGuardrail(id)}
			/>
		</div>
	);
}
