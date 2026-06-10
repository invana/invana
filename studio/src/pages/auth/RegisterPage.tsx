import { Input, Label } from "@invana/forms";
import { Button } from "@invana/ui";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FormError } from "../../components/forms/FormError";
import { useAuth } from "../../hooks/useAuth";
import { authApi } from "../../services/api/auth";
import { ApiError } from "../../services/api/client";

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

type UsernameState =
	| { kind: "idle" }
	| { kind: "checking" }
	| { kind: "available" }
	| { kind: "unavailable"; reason: string };

export function RegisterPage() {
	const [params] = useSearchParams();
	const navigate = useNavigate();
	const { setSession } = useAuth();
	const invite = params.get("invite") ?? "";

	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [usernameState, setUsernameState] = useState<UsernameState>({
		kind: "idle",
	});
	const debounceRef = useRef<number | undefined>(undefined);

	useEffect(() => {
		if (debounceRef.current) window.clearTimeout(debounceRef.current);
		const value = username.trim().toLowerCase();
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
				// Don't block the form on network errors; final check is server-side.
				setUsernameState({ kind: "idle" });
			}
		}, 300);
		return () => {
			if (debounceRef.current) window.clearTimeout(debounceRef.current);
		};
	}, [username]);

	if (!invite) {
		return <Navigate to="/login" replace />;
	}

	const usernameOk = usernameState.kind === "available";

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (password !== confirm) {
			setError("Passwords don't match.");
			toast.error("Passwords don't match.");
			return;
		}
		if (!usernameOk) {
			const msg = "Pick a valid, available username before continuing.";
			setError(msg);
			toast.error(msg);
			return;
		}
		setSubmitting(true);
		setError(null);
		try {
			const res = await authApi.register(invite, {
				first_name: firstName,
				last_name: lastName.trim() || null,
				username: username.trim().toLowerCase(),
				password,
			});
			setSession({
				user: res.user,
				accessToken: res.access_token,
				refreshToken: res.refresh_token,
			});
			navigate("/", { replace: true });
		} catch (err) {
			const message =
				err instanceof ApiError ? err.message : "Registration failed.";
			setError(message);
			toast.error(message);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm space-y-8">
				<div className="space-y-2 text-center">
					<div className="w-10 h-10 rounded-md bg-primary text-primary-foreground font-bold mx-auto flex items-center justify-center">
						I
					</div>
					<h1 className="text-2xl font-semibold">Accept your invitation</h1>
					<p className="text-muted-foreground text-base">
						Pick a username and set your password to finish creating your
						account.
					</p>
				</div>
				<form className="space-y-4" onSubmit={handleSubmit}>
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
					<div className="space-y-2">
						<Label htmlFor="username">Username</Label>
						<Input
							id="username"
							required
							minLength={2}
							maxLength={64}
							autoCapitalize="off"
							autoCorrect="off"
							value={username}
							onChange={(e) => setUsername(e.target.value.toLowerCase())}
							placeholder="e.g. ravi"
						/>
						<UsernameHint state={usernameState} />
					</div>
					<div className="space-y-2">
						<Label htmlFor="password">Password (min 12 chars)</Label>
						<Input
							id="password"
							type="password"
							autoComplete="new-password"
							required
							minLength={12}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="confirm">Confirm password</Label>
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
					<FormError error={error} />
					<Button
						type="submit"
						className="w-full"
						disabled={submitting || !usernameOk}
					>
						{submitting ? "Creating account…" : "Create account"}
					</Button>
				</form>
			</div>
		</div>
	);
}

function UsernameHint({ state }: { state: UsernameState }) {
	if (state.kind === "idle") {
		return (
			<p className="text-base text-muted-foreground">
				Lowercase letters, digits, and hyphens. 2–64 chars.
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
	const message =
		state.reason === "taken"
			? "Username is taken."
			: state.reason === "reserved"
				? "Username is reserved."
				: "Invalid format.";
	return <p className="text-base text-destructive">{message}</p>;
}
