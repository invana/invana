/**
 * Header theme picker (RFC-044). A compact icon button that opens a popover with
 * the full `<ThemeSelector>` — theme cards, light/dark/system mode, and accent
 * swatches. It drives the app `<ThemeProvider>`, and the app-level
 * `<ThemeSyncBridge>` persists any change to the user's profile.
 *
 * Replaces the old bare light/dark `ThemeToggle` in the app header. The login
 * page keeps `ThemeToggle` (pre-auth, nothing to sync).
 */

import { ThemeSelector } from "@invana/themes";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@invana/ui";
import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { STUDIO_THEMES } from "./studioThemes";

const MODE_ICONS = { light: Sun, dark: Moon, system: Monitor };

export function ThemeMenu() {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7"
					title="Theme & appearance"
				>
					<Palette className="h-4 w-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-72">
				<ThemeSelector
					layout="form"
					themes={STUDIO_THEMES}
					showAccent={false}
					modeIcons={MODE_ICONS}
					className="theme-picker"
				/>
			</PopoverContent>
		</Popover>
	);
}
