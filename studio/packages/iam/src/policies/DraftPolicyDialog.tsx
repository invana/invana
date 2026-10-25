/**
 * *Draft with the assistant* — one sentence in, a draft policy out. The engine
 * asks the Graph's model once for statements in the grammar, checks them and
 * writes a draft marked as the assistant's; its page opens with the banner
 * *Draft by the assistant — nothing changes until you save*. A reply outside
 * the grammar is refused in place, naming the line.
 */

import { Field, FieldDescription, FieldLabel, Textarea } from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import { FormError } from "@invana-studio/ui";
import { useState } from "react";
import { usePolicyMutations } from "../queries";

/** Mounted only while it is open. */
export function DraftPolicyDialog({
	username,
	graphSlug,
	onClose,
	onDrafted,
}: {
	username: string;
	graphSlug: string;
	onClose: () => void;
	/** The draft is written: open its page. */
	onDrafted: (name: string) => void;
}) {
	const { draft } = usePolicyMutations({ username, graphSlug });
	const [prompt, setPrompt] = useState("");
	const sentence = prompt.trim();

	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Draft with the assistant</DialogTitle>
					<DialogDescription>
						Say what it should allow. The assistant writes a draft; nothing
						changes until you save it.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<Field>
						<FieldLabel htmlFor="policy-prompt">
							The policy, in a sentence
						</FieldLabel>
						<Textarea
							id="policy-prompt"
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							placeholder="Route agents can read routes and airports and think with haiku, nothing else."
						/>
						<FieldDescription>
							Statements, conditions and limits come back in the policy grammar,
							for you to read before saving.
						</FieldDescription>
					</Field>
					<FormError error={draft.error} />
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!sentence || draft.isPending}
						onClick={() =>
							draft.mutate(
								{ prompt: sentence },
								{ onSuccess: (policy) => onDrafted(policy.name) },
							)
						}
					>
						{draft.isPending ? "Drafting…" : "Draft"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
