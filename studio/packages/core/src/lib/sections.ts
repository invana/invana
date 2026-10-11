// One width for every side region Studio opens — the shell's left and right
// sections and a canvas's own side panels (the-shell.md).
export const SIDE_SECTION = {
	defaultSize: "280px",
	minSize: "240px",
	maxSize: "640px",
	collapsible: false,
} as const;

// The docked assistant reads queries, replies and error cards, so it opens
// wider than a list or an inspector.
export const ASSISTANT_SECTION = {
	...SIDE_SECTION,
	defaultSize: "440px",
	minSize: "320px",
} as const;

export const MAIN_SECTION = { minSize: "300px" } as const;

// The bottom region under the canvas (the console) — resizable by its grip.
export const BOTTOM_SECTION = {
	defaultSize: "300px",
	minSize: "140px",
	maxSize: "640px",
	collapsible: false,
} as const;
