import { Button } from "@invana/ui";
import { Maximize, Minimize } from "lucide-react";
import { useEffect, useState } from "react";

export function FullscreenToggle() {
	const [isFullscreen, setIsFullscreen] = useState(
		() => document.fullscreenElement !== null,
	);

	useEffect(() => {
		const onChange = () => setIsFullscreen(document.fullscreenElement !== null);
		document.addEventListener("fullscreenchange", onChange);
		return () => document.removeEventListener("fullscreenchange", onChange);
	}, []);

	const toggle = () => {
		if (document.fullscreenElement) {
			document.exitFullscreen().catch(() => {});
		} else {
			document.documentElement.requestFullscreen().catch(() => {});
		}
	};

	return (
		<Button
			variant="ghost"
			size="icon"
			className="h-7 w-7"
			onClick={toggle}
			title={isFullscreen ? "Exit full screen" : "Enter full screen"}
		>
			{isFullscreen ? (
				<Minimize className="h-4 w-4" />
			) : (
				<Maximize className="h-4 w-4" />
			)}
		</Button>
	);
}
