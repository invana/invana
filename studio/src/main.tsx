import { ThemeProvider } from "@invana/themes";
import { Toaster } from "@invana/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
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
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
				<Toaster richColors closeButton />
			</QueryClientProvider>
		</ThemeProvider>
	</StrictMode>,
);
