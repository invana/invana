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
import { GRAPH_ROLES, type GraphRole } from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { type FormEvent, useEffect, useState } from "react";

/**
 * The five roles as checkboxes. `viewer` is held by every member, so it shows
 * checked and cannot be cleared; the others are the member's to hold in any
 * combination.
 */
function RolePicker({
	idPrefix,
	value,
	onChange,
}: {
	idPrefix: string;
	value: GraphRole[];
	onChange: (roles: GraphRole[]) => void;
}) {
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
			{GRAPH_ROLES.map((role) => {
				const id = `${idPrefix}-${role}`;
				const always = role === "viewer";
				return (
					<div key={role} className="flex items-center gap-1.5">
						<Checkbox
							id={id}
							checked={always || value.includes(role)}
							disabled={always}
							onCheckedChange={(on) =>
								onChange(
									on === true
										? [...value, role]
										: value.filter((r) => r !== role),
								)
							}
						/>
						<Label htmlFor={id}>{role}</Label>
					</div>
				);
			})}
		</div>
	);
}

/** Roles as the engine stores them: `viewer` is implied, so it is not sent. */
const held = (roles: GraphRole[]) =>
	GRAPH_ROLES.filter((r) => r !== "viewer" && roles.includes(r));

/**
 * *Add member* — a person found by email or username, with the roles they
 * start with. The engine's refusal (no such account, already a member) shows
 * in the dialog in its own words.
 */
export function AddMemberDialog({
	open,
	pending,
	error,
	onOpenChange,
	onAdd,
}: {
	open: boolean;
	pending: boolean;
	error: Error | null;
	onOpenChange: (open: boolean) => void;
	onAdd: (user: string, roles: GraphRole[]) => void;
}) {
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
		if (user.trim()) onAdd(user.trim(), held(roles));
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={submit} className="space-y-4" noValidate>
					<DialogHeader>
						<DialogTitle>Add member</DialogTitle>
						<DialogDescription>
							Every member reads everything in this graph. A role is the right
							to change one part of it.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-1.5">
						<Label htmlFor="add-member-user">Email or username</Label>
						<Input
							id="add-member-user"
							value={user}
							autoFocus
							onChange={(e) => setUser(e.target.value)}
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Roles</Label>
						<RolePicker idPrefix="add-role" value={roles} onChange={setRoles} />
					</div>
					<FormError error={error} />
					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={pending || !user.trim()}>
							{pending ? "Adding…" : "Add member"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/**
 * *Edit* — replace one member's roles. Taking `owner` from the last owner is
 * the engine's to refuse, and the refusal shows here.
 */
export function EditRolesDialog({
	username,
	roles: current,
	pending,
	error,
	onOpenChange,
	onSave,
}: {
	/** The member being edited; `null` closes the dialog. */
	username: string | null;
	roles: GraphRole[];
	pending: boolean;
	error: Error | null;
	onOpenChange: (open: boolean) => void;
	onSave: (roles: GraphRole[]) => void;
}) {
	const [roles, setRoles] = useState<GraphRole[]>(current);

	useEffect(() => {
		if (username) setRoles(current);
	}, [username, current]);

	return (
		<Dialog open={username !== null} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Roles of {username}</DialogTitle>
					<DialogDescription>
						Each role is the right to change one part of this graph.
					</DialogDescription>
				</DialogHeader>
				<RolePicker idPrefix="edit-role" value={roles} onChange={setRoles} />
				<FormError error={error} />
				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button disabled={pending} onClick={() => onSave(held(roles))}>
						{pending ? "Saving…" : "Save roles"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
