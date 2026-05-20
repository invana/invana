import { Button, Input, Label } from "@invana/ui";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../hooks/useAuth";
import { authApi } from "../../services/api/auth";
import { ApiError } from "../../services/api/client";

export function LoginPage() {
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const { setSession } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const next = params.get("next") ?? "/";

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSubmitting(true);
		try {
			const res = await authApi.login(email, password);
			setSession({
				user: res.user,
				accessToken: res.access_token,
				refreshToken: res.refresh_token,
			});
			navigate(decodeURIComponent(next), { replace: true });
		} catch (err) {
			const message = err instanceof ApiError ? err.message : "Sign-in failed.";
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
					<h1 className="text-2xl font-semibold">Sign in to Invana</h1>
					<p className="text-muted-foreground text-sm">
						Use the credentials your workspace admin sent you.
					</p>
				</div>
				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="password">Password</Label>
						<Input
							id="password"
							type="password"
							autoComplete="current-password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</div>
					<Button type="submit" className="w-full" disabled={submitting}>
						{submitting ? "Signing in…" : "Sign in"}
					</Button>
				</form>
			</div>
		</div>
	);
}
