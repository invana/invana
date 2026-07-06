/**
 * A single slider that scales the active theme's primary + accent saturation.
 * Binds straight to the appearance store; `<SaturationBridge>` does the applying.
 * Dropped in below the `<ThemeSelector>` in both the header `ThemeMenu` popover
 * and the settings Appearance tab.
 */

import { Slider } from "@invana/forms";
import { Button } from "@invana/ui";
import {
	SATURATION_DEFAULT,
	SATURATION_MAX,
	SATURATION_MIN,
	useAppearanceStore,
} from "../stores/appearance.store";

export function SaturationControl({ className }: { className?: string }) {
	const saturation = useAppearanceStore((s) => s.saturation);
	const setSaturation = useAppearanceStore((s) => s.setSaturation);
	const isDefault = saturation === SATURATION_DEFAULT;

	return (
		<div className={className}>
			<div className="mb-2 flex items-center justify-between">
				<span className="text-sm font-medium">Saturation</span>
				<div className="flex items-center gap-2">
					<span className="text-xs tabular-nums text-muted-foreground">
						{saturation}%
					</span>
					{!isDefault && (
						<Button
							variant="ghost"
							size="sm"
							className="h-5 px-1.5 text-xs text-muted-foreground"
							onClick={() => setSaturation(SATURATION_DEFAULT)}
						>
							Reset
						</Button>
					)}
				</div>
			</div>
			<Slider
				min={SATURATION_MIN}
				max={SATURATION_MAX}
				step={5}
				value={[saturation]}
				onValueChange={([v]) => setSaturation(v)}
				aria-label="Colour saturation"
			/>
		</div>
	);
}
