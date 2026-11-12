import { ThemeProvider } from "@invana/themes";
import { TooltipProvider } from "@invana/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
	<StrictMode>
		<ThemeProvider defaultTheme="default" defaultMode="system">
			<TooltipProvider delayDuration={300}>
				<App />
			</TooltipProvider>
		</ThemeProvider>
	</StrictMode>,
);
