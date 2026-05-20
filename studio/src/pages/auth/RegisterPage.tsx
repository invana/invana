import { Button, Input, Label } from "@invana/ui";
import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../hooks/useAuth";
import { authApi } from "../../services/api/auth";
import { ApiError } from "../../services/api/client";

export function RegisterPage() {
	const [params] = useSearchParams();
	const navigate = useNavigate();
	const { setSession } = useAuth();
	const invite = params.get("invite") ?? "";

	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [submitting, setSubmitting] = useState(false);

	if (!invite) {
		return <Navigate to="/login" replace />;
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (password !== confirm) {
			toast.error("Passwords don't match.");
			return;
		}
		setSubmitting(true);
		try {
			const res = await authApi.register(invite, {
				first_name: firstName,
				last_name: lastName.trim() || null,
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
					<p className="text-muted-foreground text-sm">
						Set your name and password to finish creating your account.
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
					<Button type="submit" className="w-full" disabled={submitting}>
						{submitting ? "Creating account…" : "Create account"}
					</Button>
				</form>
			</div>
		</div>
	);
}
