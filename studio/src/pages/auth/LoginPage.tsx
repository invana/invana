import { Input, Label } from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	TabbedPanel,
} from "@invana/ui";
import { Container, Terminal } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FormError } from "../../components/forms/FormError";
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
	const [error, setError] = useState<string | null>(null);
	const [helpModal, setHelpModal] = useState<"create-user" | "forgot" | null>(
		null,
	);

	const next = params.get("next") ?? "/";

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSubmitting(true);
		setError(null);
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
			setError(message);
			toast.error(message);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background px-4">
			{/* Ambient grid — fades out toward the edges via a radial mask */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{
					backgroundImage:
						"linear-gradient(to right, color-mix(in srgb, var(--color-border) 55%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-border) 55%, transparent) 1px, transparent 1px)",
					backgroundSize: "44px 44px",
					maskImage:
						"radial-gradient(ellipse 75% 60% at 50% 38%, black 25%, transparent 75%)",
					WebkitMaskImage:
						"radial-gradient(ellipse 75% 60% at 50% 38%, black 25%, transparent 75%)",
				}}
			/>
			{/* Subtle accent glow pooling behind the card */}
			<div
				aria-hidden
				className="pointer-events-none absolute left-1/2 top-[38%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
				style={{
					background:
						"radial-gradient(circle, color-mix(in srgb, var(--color-primary) 10%, transparent) 0%, transparent 70%)",
					filter: "blur(60px)",
				}}
			/>

			{/* Frosted glass card */}
			<div
				className="relative w-full max-w-sm rounded-lg border border-white/10 bg-card/55 p-8 backdrop-blur-xl"
				style={{
					boxShadow:
						"inset 0 1px 0 color-mix(in srgb, white 6%, transparent), 0 16px 48px -24px rgba(0, 0, 0, 0.6)",
				}}
			>
				<div className="space-y-2 text-center">
					<div
						className="w-12 h-12 rounded-md bg-primary text-primary-foreground font-bold mx-auto flex items-center justify-center"
						style={{
							boxShadow:
								"0 0 18px color-mix(in srgb, var(--color-primary) 30%, transparent)",
						}}
					>
						I
					</div>
					<h1 className="text-2xl font-semibold pt-2">Sign in to Invana</h1>
				</div>
				<form className="space-y-4 mt-8" onSubmit={handleSubmit}>
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
					<FormError error={error} />
					<Button
						type="submit"
						className="w-full shadow-[0_6px_20px_-10px_var(--color-primary)] transition-shadow hover:shadow-[0_8px_28px_-8px_var(--color-primary)]"
						disabled={submitting}
					>
						{submitting ? "Signing in…" : "Sign in"}
					</Button>
				</form>

				<div className="mt-6 flex items-center justify-center gap-3 text-muted-foreground">
					<button
						type="button"
						className="hover:text-foreground transition-colors"
						onClick={() => setHelpModal("create-user")}
					>
						Create new user
					</button>
					<span className="opacity-40">·</span>
					<button
						type="button"
						className="hover:text-foreground transition-colors"
						onClick={() => setHelpModal("forgot")}
					>
						Forgot password?
					</button>
				</div>
			</div>

			{/* Create-user help */}
			<Dialog
				open={helpModal === "create-user"}
				onOpenChange={(open) => setHelpModal(open ? "create-user" : null)}
			>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Create a new user</DialogTitle>
						<DialogDescription>
							Invana has no public sign-up. Create users from the command line
							on the engine — or from Studio once you're signed in as a
							superuser.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 pt-1">
						<TabbedPanel
							className="border border-border rounded-md overflow-hidden w-full min-w-0"
							defaultTab="cli"
							tabs={[
								{
									value: "cli",
									label: "Python CLI",
									icon: Terminal,
									content: (
										<div className="p-4 space-y-3">
											<p className="text-muted-foreground">
												On the machine running the engine:
											</p>
											<div className="space-y-1">
												<p className="font-medium">Regular user</p>
												<pre className="rounded-md border border-border bg-muted p-3 font-mono whitespace-pre-wrap break-all">
													invana users create
												</pre>
											</div>
											<div className="space-y-1">
												<p className="font-medium">
													Superuser (platform admin)
												</p>
												<pre className="rounded-md border border-border bg-muted p-3 font-mono whitespace-pre-wrap break-all">
													invana users create --superuser
												</pre>
											</div>
											<p className="text-muted-foreground">
												Either way you'll be prompted for a username, name,
												email, and password. For scripted setups, pass{" "}
												<code className="font-mono">--non-interactive</code>{" "}
												with <code className="font-mono">--username</code>,{" "}
												<code className="font-mono">--email</code>,{" "}
												<code className="font-mono">--password</code>, and{" "}
												<code className="font-mono">--first-name</code>.
											</p>
											<p className="text-muted-foreground">
												Setting up a fresh install?{" "}
												<code className="font-mono">invana init</code> creates
												the first superuser (idempotent — it refuses once one
												exists).
											</p>
										</div>
									),
								},
								{
									value: "docker",
									label: "Docker",
									icon: Container,
									content: (
										<div className="p-4 space-y-3">
											<p className="text-muted-foreground">
												If the engine runs in a container, exec the command
												inside it:
											</p>
											<div className="space-y-1">
												<p className="font-medium">Regular user</p>
												<pre className="rounded-md border border-border bg-muted p-3 font-mono whitespace-pre-wrap break-all">
													docker exec -it invana-engine invana users create
												</pre>
											</div>
											<div className="space-y-1">
												<p className="font-medium">
													Superuser (platform admin)
												</p>
												<pre className="rounded-md border border-border bg-muted p-3 font-mono whitespace-pre-wrap break-all">
													docker exec -it invana-engine invana users create
													--superuser
												</pre>
											</div>
											<p className="text-muted-foreground">
												Replace <code className="font-mono">invana-engine</code>{" "}
												with your container or Compose service name. The same{" "}
												<code className="font-mono">--non-interactive</code>{" "}
												flags apply.
											</p>
										</div>
									),
								},
							]}
						/>
						<p className="text-muted-foreground">
							Already signed in as a superuser? You can also create users from
							Studio.
						</p>
					</div>
				</DialogContent>
			</Dialog>

			{/* Forgot-password help */}
			<Dialog
				open={helpModal === "forgot"}
				onOpenChange={(open) => setHelpModal(open ? "forgot" : null)}
			>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Forgot your password?</DialogTitle>
						<DialogDescription>
							There's no email-based reset. An operator with shell access to the
							engine resets it from the command line.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 pt-1">
						<TabbedPanel
							className="border border-border rounded-md overflow-hidden w-full min-w-0"
							defaultTab="cli"
							tabs={[
								{
									value: "cli",
									label: "Python CLI",
									icon: Terminal,
									content: (
										<div className="p-4 space-y-2">
											<p className="text-muted-foreground">
												On the machine running the engine, reset the password by
												email or username:
											</p>
											<pre className="rounded-md border border-border bg-muted p-3 font-mono whitespace-pre-wrap break-all">
												invana users update-password --user you@example.com
											</pre>
											<p className="text-muted-foreground">
												You'll be prompted for the new password — no current
												password needed. All existing sessions are signed out
												afterward.
											</p>
										</div>
									),
								},
								{
									value: "docker",
									label: "Docker",
									icon: Container,
									content: (
										<div className="p-4 space-y-2">
											<p className="text-muted-foreground">
												If the engine runs in a container, exec the same command
												inside it:
											</p>
											<pre className="rounded-md border border-border bg-muted p-3 font-mono whitespace-pre-wrap break-all">
												docker exec -it invana-engine invana users
												update-password --user you@example.com
											</pre>
											<p className="text-muted-foreground">
												Replace <code className="font-mono">invana-engine</code>{" "}
												with your container or Compose service name.
											</p>
										</div>
									),
								},
							]}
						/>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
