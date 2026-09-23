import { SaturationBridge } from "@/components/SaturationBridge";
import { ThemeSyncBridge } from "@/components/ThemeSyncBridge";
import { router } from "@/router";
import { ThemeProvider } from "@invana/themes";
import { Toaster, TooltipProvider } from "@invana/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
// Side-effect import: register OpenTelemetry-Web (docs/for-developers/modules/platform/features/telemetry.md) before the app
// renders, so the query→render pipeline is traced from the first interaction.
import "@/services/telemetry/setup";
// Side-effect import: the auth store registers itself with the axios client
// at module load so request interceptors can read tokens.
import "@/stores/auth.store";
import "./index.css";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			staleTime: 30_000,
		},
	},
});

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

createRoot(container).render(
	<StrictMode>
		<ThemeProvider defaultTheme="default" defaultMode="system">
			{/* Reconciles the theme selection with the signed-in user's profile
			    (docs/for-developers/modules/platform/features/theming.md) — hydrates from /auth/me on login, PATCHes on change. */}
			<ThemeSyncBridge />
			{/* Applies the local saturation preference to the active theme's
			    primary + accent colours. */}
			<SaturationBridge />
			<QueryClientProvider client={queryClient}>
				{/* One tooltip provider for the whole app. Radix needs an
				    ancestor provider for every `Tooltip`, and a screen that
				    mounts its own is a second delay to keep in step — so the
				    shell owns it and no screen declares one. Kit components
				    that provide their own internally are unaffected: nesting a
				    provider is legal, and theirs wins inside them. */}
				<TooltipProvider delayDuration={300}>
					<RouterProvider router={router} />
				</TooltipProvider>
				<Toaster richColors closeButton />
			</QueryClientProvider>
		</ThemeProvider>
	</StrictMode>,
);
