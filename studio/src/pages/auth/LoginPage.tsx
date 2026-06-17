import { Checkbox, Input, Label } from "@invana/forms";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	TabbedPanel,
} from "@invana/ui";
import {
	Container,
	FlaskConical,
	GitBranch,
	Network,
	ShieldCheck,
	Terminal,
	Waypoints,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ThemeToggle } from "../../components/ThemeToggle";
import { FormError } from "../../components/forms/FormError";
import { useAuth } from "../../hooks/useAuth";
import { authApi } from "../../services/api/auth";
import { ApiError } from "../../services/api/client";

// Capability pillars shown on the brand panel. Phrased as what Invana *is
// about* — no falsifiable benchmarks (the "100K+ nodes" line deliberately
// drops the unverified fps figure that only ever lived in positioning copy).
const PILLARS = [
	{
		icon: Network,
		title: "Curated context from scattered data",
		blurb:
			"Connectors ingest heterogeneous sources, stitched under one shared ontology.",
	},
	{
		icon: ShieldCheck,
		title: "Explainable answers — never hallucinated",
		blurb: "Trace every answer LLM → query → record → dataset, or it says so.",
	},
	{
		icon: GitBranch,
		title: "Graph modelling you can evolve",
		blurb:
			"Version the ontology over time, across Cypher and Gremlin backends.",
	},
	{
		icon: Waypoints,
		title: "Query + visualize at real scale",
		blurb:
			"Async Cypher + Gremlin with WebGPU — built to explore 100K+ node graphs.",
	},
	{
		icon: FlaskConical,
		title: "Simulate decisions on the graph",
		blurb:
			"Game theory, hypothesis testing, sweeps — ask what-if, not just what-is.",
	},
];

export function LoginPage() {
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const { setSession } = useAuth();
	// Username or email (RFC-034) — login accepts either.
	const [identifier, setIdentifier] = useState("");
	const [password, setPassword] = useState("");
	// NOTE: cosmetic until the engine supports it. authApi.login / POST
	// /api/v1/auth/login take no remember flag, so refresh-token lifetime is
	// fixed server-side. Wire this through once the engine accepts a TTL/remember
	// parameter; until then it intentionally does nothing but hold UI state.
	const [remember, setRemember] = useState(true);
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
			const res = await authApi.login(identifier, password);
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
		<div className="relative min-h-screen overflow-hidden bg-background">
			{/* Ambient grid — fades out toward the edges via a radial mask */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{
					backgroundImage:
						"linear-gradient(to right, color-mix(in srgb, var(--color-border) 55%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-border) 55%, transparent) 1px, transparent 1px)",
					backgroundSize: "44px 44px",
					maskImage:
						"radial-gradient(ellipse 70% 70% at 32% 45%, black 20%, transparent 78%)",
					WebkitMaskImage:
						"radial-gradient(ellipse 70% 70% at 32% 45%, black 20%, transparent 78%)",
				}}
			/>
			{/* Accent glow pooling behind the sign-in form */}
			<div
				aria-hidden
				className="pointer-events-none absolute left-[78%] top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
				style={{
					background:
						"radial-gradient(circle, color-mix(in srgb, var(--color-primary) 12%, transparent) 0%, transparent 70%)",
					filter: "blur(70px)",
				}}
			/>

			{/* Theme switcher */}
			<div className="absolute right-6 top-6 z-10">
				<ThemeToggle />
			</div>

			<div className="relative mx-auto flex min-h-screen max-w-[108rem] items-center gap-20 px-14 py-12">
				{/* ── Left: brand + pillars ───────────────────────────────── */}
				<div className="flex-1">
					{/* Hero title + subtitle — brand-forward */}
					<h1 className="text-4xl font-bold tracking-tight">Invana</h1>
					<p className="mt-1 text-xl font-medium text-primary">
						Graph Intelligence Platform
					</p>

					<p className="mt-6 max-w-3xl text-xl text-muted-foreground">
						Messy, multi-source data into a{" "}
						<span className="font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4">
							knowledge graph you can trust
						</span>{" "}
						— reason and simulate on it, with answers you can trace back to the
						source.
					</p>

					<ul className="mt-12 max-w-3xl space-y-6">
						{PILLARS.map((p) => (
							<li key={p.title} className="flex gap-4">
								<span
									aria-hidden
									className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"
								>
									<p.icon className="h-6 w-6" strokeWidth={1.75} />
								</span>
								<div>
									<p className="text-xl font-semibold">{p.title}</p>
									<p className="mt-0.5 text-lg text-muted-foreground">
										{p.blurb}
									</p>
								</div>
							</li>
						))}
					</ul>
				</div>

				{/* ── Right: sign-in card ─────────────────────────────────── */}
				<div className="w-full max-w-lg">
					<div
						className="rounded-lg border border-white/10 bg-card/55 p-8 backdrop-blur-xl"
						style={{
							boxShadow:
								"inset 0 1px 0 color-mix(in srgb, white 6%, transparent), 0 16px 48px -24px rgba(0, 0, 0, 0.6)",
						}}
					>
						<h2 className="text-2xl font-semibold">Sign in</h2>
						<p className="mt-1 text-muted-foreground">
							Welcome back. Enter your credentials to continue.
						</p>

						<form className="mt-7 space-y-5" onSubmit={handleSubmit}>
							<div className="space-y-2">
								<Label htmlFor="identifier">Email or username</Label>
								<Input
									id="identifier"
									type="text"
									autoComplete="username"
									required
									placeholder="you@example.com or your-username"
									// Override the design-kit Input's baked-in `md:text-sm`,
									// which shrinks field text on md+ screens.
									className="md:text-base"
									value={identifier}
									onChange={(e) => setIdentifier(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="password">Password</Label>
								<Input
									id="password"
									type="password"
									autoComplete="current-password"
									required
									placeholder="••••••••"
									className="md:text-base"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
								/>
							</div>

							<label
								htmlFor="remember"
								className="flex items-center gap-2 text-muted-foreground"
							>
								<Checkbox
									id="remember"
									checked={remember}
									onCheckedChange={(c) => setRemember(c === true)}
								/>
								Remember me for 30 days
							</label>

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
								className="transition-colors hover:text-foreground"
								onClick={() => setHelpModal("create-user")}
							>
								Create new user
							</button>
							<span className="opacity-40">·</span>
							<button
								type="button"
								className="transition-colors hover:text-foreground"
								onClick={() => setHelpModal("forgot")}
							>
								Need help?
							</button>
						</div>
					</div>
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
