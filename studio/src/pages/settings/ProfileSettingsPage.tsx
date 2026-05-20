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
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../hooks/useAuth";
import { authApi } from "../../services/api/auth";
import { ApiError } from "../../services/api/client";

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const USERNAME_COOLDOWN_DAYS = 30;

type UsernameState =
	| { kind: "idle" }
	| { kind: "checking" }
	| { kind: "available" }
	| { kind: "unavailable"; reason: string };

export function ProfileSettingsPage() {
	const { user, setUser, clear } = useAuth();
	if (!user) return null;

	return (
		<div className="max-w-2xl mx-auto px-6 py-10">
			<header className="mb-8">
				<h1 className="text-2xl font-semibold">Account settings</h1>
				<p className="text-muted-foreground text-base">
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
									username: user.username,
									first_name: user.first_name,
									last_name: user.last_name,
									username_last_changed_at: user.username_last_changed_at,
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

interface BasicInfoInitial {
	email: string;
	username: string;
	first_name: string;
	last_name: string | null;
	username_last_changed_at: string | null;
}

function BasicInfoTab({
	initial,
	onSaved,
}: {
	initial: BasicInfoInitial;
	onSaved: (u: {
		username: string;
		first_name: string;
		last_name: string | null;
		username_last_changed_at: string | null;
	}) => void;
}) {
	const [firstName, setFirstName] = useState(initial.first_name);
	const [lastName, setLastName] = useState(initial.last_name ?? "");
	const [username, setUsername] = useState(initial.username);
	const [submitting, setSubmitting] = useState(false);
	const [usernameState, setUsernameState] = useState<UsernameState>({
		kind: "idle",
	});
	const debounceRef = useRef<number | undefined>(undefined);

	const cooldownUntil = computeCooldownUntil(initial.username_last_changed_at);
	const inCooldown = cooldownUntil !== null && cooldownUntil > new Date();

	const usernameChanged = username.trim().toLowerCase() !== initial.username;
	const usernameOk = !usernameChanged || usernameState.kind === "available";

	useEffect(() => {
		if (debounceRef.current) window.clearTimeout(debounceRef.current);
		const value = username.trim().toLowerCase();
		if (!usernameChanged) {
			setUsernameState({ kind: "idle" });
			return;
		}
		if (value.length < 2) {
			setUsernameState({ kind: "idle" });
			return;
		}
		if (!USERNAME_RE.test(value) || value.includes("--")) {
			setUsernameState({ kind: "unavailable", reason: "invalid_format" });
			return;
		}
		setUsernameState({ kind: "checking" });
		debounceRef.current = window.setTimeout(async () => {
			try {
				const res = await authApi.usernameAvailable(value);
				setUsernameState(
					res.available
						? { kind: "available" }
						: { kind: "unavailable", reason: res.reason ?? "taken" },
				);
			} catch {
				setUsernameState({ kind: "idle" });
			}
		}, 300);
		return () => {
			if (debounceRef.current) window.clearTimeout(debounceRef.current);
		};
	}, [username, usernameChanged]);

	const dirty =
		firstName.trim() !== initial.first_name ||
		(lastName.trim() || null) !== (initial.last_name ?? null) ||
		usernameChanged;

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (usernameChanged && inCooldown && cooldownUntil) {
			toast.error(
				`Username can be changed again on ${cooldownUntil.toLocaleDateString()}.`,
			);
			return;
		}
		if (usernameChanged && usernameState.kind !== "available") {
			toast.error("Pick a valid, available username before saving.");
			return;
		}
		setSubmitting(true);
		try {
			const patch: {
				first_name?: string;
				last_name?: string | null;
				username?: string;
			} = {};
			if (firstName.trim() !== initial.first_name) {
				patch.first_name = firstName.trim();
			}
			if ((lastName.trim() || null) !== (initial.last_name ?? null)) {
				patch.last_name = lastName.trim() || null;
			}
			if (usernameChanged) patch.username = username.trim().toLowerCase();
			const updated = await authApi.patchMe(patch);
			onSaved({
				username: updated.username,
				first_name: updated.first_name,
				last_name: updated.last_name,
				username_last_changed_at: updated.username_last_changed_at,
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
				<p className="text-base text-muted-foreground">
					Email cannot be changed.
				</p>
			</div>
			<div className="space-y-2">
				<Label htmlFor="username">Username</Label>
				<Input
					id="username"
					required
					minLength={2}
					maxLength={64}
					autoCapitalize="off"
					autoCorrect="off"
					disabled={inCooldown}
					value={username}
					onChange={(e) => setUsername(e.target.value.toLowerCase())}
				/>
				<UsernameStatus
					state={usernameState}
					changed={usernameChanged}
					cooldownUntil={cooldownUntil}
				/>
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
			<Button type="submit" disabled={!dirty || submitting || !usernameOk}>
				{submitting ? "Saving…" : "Save changes"}
			</Button>
		</form>
	);
}

function computeCooldownUntil(lastChanged: string | null): Date | null {
	if (!lastChanged) return null;
	const d = new Date(lastChanged);
	d.setDate(d.getDate() + USERNAME_COOLDOWN_DAYS);
	return d;
}

function UsernameStatus({
	state,
	changed,
	cooldownUntil,
}: {
	state: UsernameState;
	changed: boolean;
	cooldownUntil: Date | null;
}) {
	if (cooldownUntil && cooldownUntil > new Date()) {
		return (
			<p className="text-base text-muted-foreground">
				Username can be changed again on {cooldownUntil.toLocaleDateString()}.
			</p>
		);
	}
	if (!changed) {
		return (
			<p className="text-base text-muted-foreground">
				Lowercase letters, digits, and hyphens. Changes are rate-limited.
			</p>
		);
	}
	if (state.kind === "checking") {
		return <p className="text-base text-muted-foreground">Checking…</p>;
	}
	if (state.kind === "available") {
		return (
			<p className="text-base text-emerald-600 dark:text-emerald-400">
				Username available.
			</p>
		);
	}
	if (state.kind === "unavailable") {
		const message =
			state.reason === "taken"
				? "Username is taken."
				: state.reason === "reserved"
					? "Username is reserved."
					: "Invalid format.";
		return <p className="text-base text-destructive">{message}</p>;
	}
	return (
		<p className="text-base text-muted-foreground">
			Lowercase letters, digits, and hyphens. Changes are rate-limited.
		</p>
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
				<p className="text-base text-muted-foreground mt-1">
					This permanently deletes your account and removes all Graphs you own —
					with their datasets, skills, agents, and bindings. This cannot be
					undone.
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
							Type your email and password to confirm. All Graphs you own, with
							their datasets, skills, agents, and bindings, will be deleted
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
