/**
 * *Add person* — the membership act, from IAM › People. An existing account,
 * found by email or username, joins the Graph holding the managed policies
 * ticked here (its Graph roles). There is no invitation: an address with no
 * account is refused in place, in the engine's words.
 *
 * It writes through the Graph's own `…/members`, the same route Graph
 * settings › Members uses, so both pages show the new member at once.
 */

import { Checkbox, Input, Label } from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@invana/ui";
import {
	GRAPH_ROLES,
	type GraphRole,
	ROLE_MAY,
	useMemberMutations,
} from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { iamKey } from "../queries";

/** `viewer` is every member's; the rest are ticked. */
const PICKABLE = GRAPH_ROLES.filter((r) => r !== "viewer");

export function AddPersonDialog({
	username,
	graphSlug,
	open,
	onOpenChange,
}: {
	username: string;
	graphSlug: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { add } = useMemberMutations({ username, graphSlug });
	const qc = useQueryClient();
	const [user, setUser] = useState("");
	const [roles, setRoles] = useState<GraphRole[]>([]);

	useEffect(() => {
		if (open) {
			setUser("");
			setRoles([]);
		}
	}, [open]);

	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (!user.trim()) return;
		add.mutate(
			{ user: user.trim(), roles },
			{
				onSuccess: () => {
					// A member is a person on every IAM page, and on Home's tile.
					void qc.invalidateQueries({ queryKey: iamKey(username, graphSlug) });
					onOpenChange(false);
				},
			},
		);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (next) add.reset();
				onOpenChange(next);
			}}
		>
			<DialogContent>
				<form onSubmit={submit} className="space-y-4" noValidate>
					<DialogHeader>
						<DialogTitle>Add person</DialogTitle>
						<DialogDescription>
							Someone with an Invana account joins {graphSlug}. Every member
							holds viewer; tick the managed policies they also hold.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-1.5">
						<Label htmlFor="add-person-user">Email or username</Label>
						<Input
							id="add-person-user"
							value={user}
							autoFocus
							onChange={(e) => setUser(e.target.value)}
						/>
					</div>
					<fieldset className="space-y-2">
						<Label asChild>
							<legend>Managed policies</legend>
						</Label>
						{PICKABLE.map((role) => {
							const id = `add-person-${role}`;
							return (
								<div key={role} className="flex items-start gap-2">
									<Checkbox
										id={id}
										checked={roles.includes(role)}
										onCheckedChange={(on) =>
											setRoles((prev) =>
												on === true
													? [...prev, role]
													: prev.filter((r) => r !== role),
											)
										}
									/>
									<Label htmlFor={id} className="font-normal">
										<span className="font-medium">{role}</span>{" "}
										<span className="text-muted-foreground">
											— {ROLE_MAY[role]}
										</span>
									</Label>
								</div>
							);
						})}
					</fieldset>
					<FormError error={add.error} />
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={add.isPending || !user.trim()}>
							Add person
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
