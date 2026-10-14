import {
	Alert,
	AlertDescription,
	Button,
	type ButtonProps,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@invana/ui";
import type { AccessAreaName } from "@invana-studio/core";
import { whoToAsk } from "@invana-studio/core";
import { Lock } from "lucide-react";
import { forwardRef } from "react";
import { useAccess } from "./useAccess";

/**
 * A button that changes something in one **area** of the Graph. With the
 * area's role it is the kit's `Button`, untouched; without it, it shows
 * disabled and its tooltip says which role it needs and who holds it
 * (shell.md › *Without the role*).
 *
 *     <ActButton area="build" onClick={openNewAgent}>New agent</ActButton>
 *
 * A disabled button takes no pointer events, so the tooltip hangs off a
 * focusable wrapper; the reason is also the button's accessible description.
 */
export const ActButton = forwardRef<
	HTMLButtonElement,
	ButtonProps & { area: AccessAreaName }
>(function ActButton({ area, ...props }, ref) {
	const gate = useAccess().gate(area);
	if (gate.allowed) return <Button ref={ref} {...props} />;
	return (
		<TooltipProvider>
			<Tooltip delayDuration={0}>
				<TooltipTrigger asChild>
					{/* biome-ignore lint/a11y/noNoninteractiveTabindex: a disabled button cannot take focus, so its wrapper carries the reason to keyboard users */}
					<span tabIndex={0} className="inline-flex">
						<Button
							ref={ref}
							{...props}
							onClick={undefined}
							disabled
							aria-description={gate.reason ?? undefined}
						/>
					</span>
				</TooltipTrigger>
				<TooltipContent>{gate.reason}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
});

/**
 * The line a read-only surface opens with, when the member lacks the area's
 * role — *You can read this skill. Editing needs the builder role — ask ravi.*
 * Renders nothing when the member may change it, or before access loads.
 */
export function ReadOnlyNotice({
	area,
	noun,
}: {
	area: AccessAreaName;
	/** What the surface shows: `skill`, `model`, `project`. */
	noun: string;
}) {
	const gate = useAccess().gate(area);
	if (gate.allowed) return null;
	return (
		<Alert tone="info">
			<Lock className="size-4" />
			<AlertDescription>
				You can read this {noun}. Editing needs the {gate.role} role — ask{" "}
				{whoToAsk(gate.holders)}.
			</AlertDescription>
		</Alert>
	);
}
