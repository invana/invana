/**
 * The request bar — over the Guardrails page's canvas while `?request=` names
 * an open request a guardrail filed.
 *
 * *`<who>` asked from `<where>`: "`<ask>`" · blocked by `<guardrail>`*, then
 * the two ways a modeller resolves it: *Decline*, or *Allow in a world*, which
 * puts a world in the guardrail's `allowed_in` (the request's own dialog).
 * A request already resolved draws no bar; without the modeller role the bar
 * reads the request and offers no act.
 */

import { Alert, AlertDescription, Button } from "@invana/ui";
import { ApiError } from "@invana-studio/core";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AllowInWorldDialog } from "../../requests/AllowInWorldDialog";
import {
	useRequestQuery,
	useResolveRequestMutation,
} from "../../requests/queries";
import type { ModelRequest } from "../../requests/types";

export interface RequestBarProps {
	username: string;
	graphSlug: string;
	requestId: string;
	/** The reader holds the modeller role. */
	mayResolve: boolean;
	/** The request is resolved, or the bar is dismissed. */
	onDone: () => void;
}

const WHERE: Record<ModelRequest["source"], string> = {
	explorer: "Explorer",
	agent: "an agent",
	schedule: "a schedule",
	api: "the API",
};

const whoOf = (r: ModelRequest) => r.asked_by ?? r.agent ?? "Someone";

export function RequestBar({
	username,
	graphSlug,
	requestId,
	mayResolve,
	onDone,
}: RequestBarProps) {
	const request = useRequestQuery(username, graphSlug, requestId);
	const resolve = useResolveRequestMutation(username, graphSlug);
	const [allowing, setAllowing] = useState<ModelRequest | null>(null);

	const r = request.data;
	if (r?.status !== "open") return null;

	const decline = () =>
		resolve
			.mutateAsync({ id: r.id, data: { action: "decline" } })
			.then(() => {
				toast.success("Declined");
				onDone();
			})
			.catch((err: unknown) =>
				toast.error(
					err instanceof ApiError ? err.message : "The decline was refused.",
				),
			);

	return (
		<>
			<Alert tone="warning" className="flex items-center gap-3 py-2 shadow-md">
				<ShieldAlert className="size-4" />
				<AlertDescription className="min-w-0 flex-1">
					<span className="font-semibold">{whoOf(r)}</span> asked from{" "}
					{r.source === "agent" && r.agent ? r.agent : WHERE[r.source]}: “
					{r.title}”
					{r.blocked_by ? (
						<>
							{" "}
							· blocked by <span className="font-mono">{r.blocked_by}</span>
						</>
					) : null}
				</AlertDescription>
				{mayResolve ? (
					<div className="flex shrink-0 items-center gap-2">
						<Button
							size="sm"
							variant="ghost"
							disabled={resolve.isPending}
							onClick={decline}
						>
							Decline
						</Button>
						<Button size="sm" variant="outline" onClick={() => setAllowing(r)}>
							Allow in a world
						</Button>
					</div>
				) : null}
			</Alert>
			<AllowInWorldDialog
				username={username}
				graphSlug={graphSlug}
				request={allowing}
				onClose={() => setAllowing(null)}
			/>
		</>
	);
}
