import { useTheme } from "@invana/themes";
import { Button } from "@invana/ui";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
	const { isDark, toggleMode } = useTheme();
	return (
		<Button
			variant="ghost"
			size="icon"
			className="h-7 w-7"
			onClick={toggleMode}
			title={isDark ? "Switch to light mode" : "Switch to dark mode"}
		>
			{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
		</Button>
	);
}
