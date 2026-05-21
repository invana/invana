// ─────────────────────────────────────────────────────────────────────────────
// Skill types — mirrors engine/src/invana/skills/schemas.py
//
// Per-Graph capability descriptions agents can apply (MVP § 2.4). Configured
// under /u/:username/:graphSlug/settings (Settings panel → Skills section).
// ─────────────────────────────────────────────────────────────────────────────

export interface Skill {
	id: string;
	graph_id: string;
	name: string;
	description: string;
	content: string;
	when_to_use: string;
	created_at: string;
	updated_at: string;
}

export interface SkillCreate {
	name: string;
	description?: string;
	content?: string;
	when_to_use?: string;
}

export interface SkillUpdate {
	name?: string;
	description?: string;
	content?: string;
	when_to_use?: string;
}

export interface SkillListResponse {
	items: Skill[];
	total: number;
}
