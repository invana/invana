// ─────────────────────────────────────────────────────────────────────────────
// Instruction types — mirrors engine/src/invana/instructions/schemas.py
//
// Per-Graph operational directives the agents follow (MVP § 2.5). Configured
// under /u/:username/:graphSlug/settings (Settings panel → Instructions).
// ─────────────────────────────────────────────────────────────────────────────

export interface Instruction {
	id: string;
	graph_id: string;
	name: string;
	content: string;
	priority: number;
	created_at: string;
	updated_at: string;
}

export interface InstructionCreate {
	name: string;
	content?: string;
	priority?: number;
}

export interface InstructionUpdate {
	name?: string;
	content?: string;
	priority?: number;
}

export interface InstructionListResponse {
	items: Instruction[];
	total: number;
}
