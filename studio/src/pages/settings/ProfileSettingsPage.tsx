import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	TabbedPanel,
} from "@invana/ui";
import { AlertTriangle, KeyRound, User } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../hooks/useAuth";
import { authApi } from "../../services/api/auth";
import { ApiError } from "../../services/api/client";

export function ProfileSettingsPage() {
	const { user, setUser, clear } = useAuth();
	if (!user) return null;

	return (
		<div className="max-w-2xl mx-auto px-6 py-10">
			<header className="mb-8">
				<h1 className="text-2xl font-semibold">Account settings</h1>
				<p className="text-muted-foreground text-sm">
					Update your profile, change your password, or close your account.
				</p>
			</header>
			<TabbedPanel
				defaultTab="basic"
				tabs={[
					{
						value: "basic",
						label: "Basic info",
						icon: User,
						content: (
							<BasicInfoTab
								initial={{
									email: user.email,
									first_name: user.first_name,
									last_name: user.last_name,
								}}
								onSaved={(updated) => setUser({ ...user, ...updated })}
							/>
						),
					},
					{
						value: "password",
						label: "Password",
						icon: KeyRound,
						content: <PasswordTab />,
					},
					{
						value: "danger",
						label: "Danger zone",
						icon: AlertTriangle,
						content: (
							<DangerZoneTab email={user.email} onDeleted={() => clear()} />
						),
					},
				]}
			/>
		</div>
	);
}

// ─── Basic info ─────────────────────────────────────────────────────────────

function BasicInfoTab({
	initial,
	onSaved,
}: {
	initial: { email: string; first_name: string; last_name: string | null };
	onSaved: (u: { first_name: string; last_name: string | null }) => void;
}) {
	const [firstName, setFirstName] = useState(initial.first_name);
	const [lastName, setLastName] = useState(initial.last_name ?? "");
	const [submitting, setSubmitting] = useState(false);

	const dirty =
		firstName.trim() !== initial.first_name ||
		(lastName.trim() || null) !== (initial.last_name ?? null);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSubmitting(true);
		try {
			const updated = await authApi.patchMe({
				first_name: firstName.trim(),
				last_name: lastName.trim() || null,
			});
			onSaved({
				first_name: updated.first_name,
				last_name: updated.last_name,
			});
			toast.success("Profile updated.");
		} catch (err) {
			toast.error(err instanceof ApiError ? err.message : "Update failed.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form className="space-y-5 pt-4" onSubmit={onSubmit}>
			<div className="space-y-2">
				<Label htmlFor="email">Email</Label>
				<Input id="email" value={initial.email} disabled readOnly />
				<p className="text-xs text-muted-foreground">
					Email cannot be changed.
				</p>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-2">
					<Label htmlFor="firstName">First name</Label>
					<Input
						id="firstName"
						required
						value={firstName}
						onChange={(e) => setFirstName(e.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="lastName">Last name (optional)</Label>
					<Input
						id="lastName"
						value={lastName}
						onChange={(e) => setLastName(e.target.value)}
					/>
				</div>
			</div>
			<Button type="submit" disabled={!dirty || submitting}>
				{submitting ? "Saving…" : "Save changes"}
			</Button>
		</form>
	);
}

// ─── Password ───────────────────────────────────────────────────────────────

function PasswordTab() {
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [confirm, setConfirm] = useState("");
	const [submitting, setSubmitting] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (next !== confirm) {
			toast.error("New passwords don't match.");
			return;
		}
		setSubmitting(true);
		try {
			await authApi.changePassword(current, next);
			toast.success(
				"Password updated. You'll need to sign in again on other devices.",
			);
			setCurrent("");
			setNext("");
			setConfirm("");
		} catch (err) {
			toast.error(
				err instanceof ApiError ? err.message : "Password update failed.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form className="space-y-5 pt-4 max-w-md" onSubmit={onSubmit}>
			<div className="space-y-2">
				<Label htmlFor="current">Current password</Label>
				<Input
					id="current"
					type="password"
					autoComplete="current-password"
					required
					value={current}
					onChange={(e) => setCurrent(e.target.value)}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="next">New password (min 12 chars)</Label>
				<Input
					id="next"
					type="password"
					autoComplete="new-password"
					required
					minLength={12}
					value={next}
					onChange={(e) => setNext(e.target.value)}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="confirm">Confirm new password</Label>
				<Input
					id="confirm"
					type="password"
					autoComplete="new-password"
					required
					minLength={12}
					value={confirm}
					onChange={(e) => setConfirm(e.target.value)}
				/>
			</div>
			<Button type="submit" disabled={submitting}>
				{submitting ? "Updating…" : "Update password"}
			</Button>
		</form>
	);
}

// ─── Danger zone ────────────────────────────────────────────────────────────

function DangerZoneTab({
	email,
	onDeleted,
}: {
	email: string;
	onDeleted: () => void;
}) {
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [emailConfirm, setEmailConfirm] = useState("");
	const [password, setPassword] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const canDelete = emailConfirm.trim().toLowerCase() === email.toLowerCase();

	async function onConfirm() {
		setSubmitting(true);
		try {
			await authApi.deleteMe(password);
			toast.success("Account deleted.");
			onDeleted();
			navigate("/login", { replace: true });
		} catch (err) {
			toast.error(
				err instanceof ApiError ? err.message : "Account deletion failed.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="pt-4 space-y-4">
			<div className="border border-destructive/30 rounded-md p-4 bg-destructive/5">
				<h3 className="font-medium text-destructive">Delete account</h3>
				<p className="text-sm text-muted-foreground mt-1">
					This permanently deletes your account and removes all workspaces you
					own — with their datasets, skills, agents, and bindings. This cannot
					be undone.
				</p>
				<Button
					variant="destructive"
					className="mt-4"
					onClick={() => setOpen(true)}
				>
					Delete account
				</Button>
			</div>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete account</DialogTitle>
						<DialogDescription>
							Type your email and password to confirm. All missions you own,
							with their datasets, skills, agents, and bindings, will be deleted
							permanently.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 pt-2">
						<div className="space-y-1">
							<Label htmlFor="emailConfirm">
								Type <span className="font-mono">{email}</span> to confirm
							</Label>
							<Input
								id="emailConfirm"
								value={emailConfirm}
								onChange={(e) => setEmailConfirm(e.target.value)}
							/>
						</div>
						<div className="space-y-1">
							<Label htmlFor="dpassword">Password</Label>
							<Input
								id="dpassword"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={!canDelete || !password || submitting}
							onClick={onConfirm}
						>
							{submitting ? "Deleting…" : "Delete account"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
