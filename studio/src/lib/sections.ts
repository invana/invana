// One width for every side region Studio opens — the shell's left and right
// sections and a canvas's own side panels (the-shell.md).
export const SIDE_SECTION = {
	defaultSize: "280px",
	minSize: "240px",
	maxSize: "640px",
	collapsible: false,
} as const;

export const MAIN_SECTION = { minSize: "300px" } as const;
