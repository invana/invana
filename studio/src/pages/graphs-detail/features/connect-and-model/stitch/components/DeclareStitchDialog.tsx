/**
 * The declare card, as a dialog — for the Stitches drawer, which has no canvas
 * to dock against.
 *
 * *All models* floats {@link DeclareStitchPanel} over the drawing, because the
 * gesture that opens it is a drag on that drawing and hiding it behind a scrim
 * would hide the two frames the stitch is about (the *Declaring* artboard, T5).
 * Opened from a model's Stitches drawer there is nothing behind it worth
 * keeping in view, so it is a dialog — the same card, the same words, the same
 * counts.
 */

import { DeclareStitchPanel } from "@/pages/graphs-detail/features/connect-and-model/stitch/components/DeclareStitchPanel";
import type { LinkKind } from "@/types/models";
import { Dialog, DialogContent, DialogTitle } from "@invana/ui";

interface Props {
	/** Non-null opens it, and is the kind the card starts on (ST11). */
	kind: LinkKind | null;
	username: string;
	graphSlug: string;
	/** The side already selected, as `${versionId}::${typeName}` (ST19). */
	sourceKey?: string;
	/** The other side, when the gesture named it too. */
	targetKey?: string;
	/** "Open the existing stitch" on the already-stitched refusal. */
	onOpenStitch?: (linkId: string) => void;
	onClose: () => void;
}

export function DeclareStitchDialog({
	kind,
	username,
	graphSlug,
	sourceKey,
	targetKey,
	onOpenStitch,
	onClose,
}: Props) {
	return (
		<Dialog
			open={kind !== null}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<DialogContent className="w-auto max-w-none border-0 bg-transparent p-0 shadow-none">
				{/* The card draws its own header; the dialog still needs a title for
				    the screen reader that announces it. */}
				<DialogTitle className="sr-only">Declare a stitch</DialogTitle>
				{kind ? (
					<DeclareStitchPanel
						key={`${sourceKey}:${targetKey}:${kind}`}
						username={username}
						graphSlug={graphSlug}
						initialKind={kind}
						sourceKey={sourceKey}
						targetKey={targetKey}
						onOpenStitch={onOpenStitch}
						onClose={onClose}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
