CREATE TABLE agents (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	key VARCHAR(64), 
	name VARCHAR(255) NOT NULL, 
	description TEXT DEFAULT ''::text NOT NULL, 
	kind VARCHAR(16) DEFAULT 'authored'::character varying NOT NULL, 
	status VARCHAR(16) DEFAULT 'active'::character varying NOT NULL, 
	workflow_spec JSON DEFAULT '{}'::json NOT NULL, 
	llm_config_id VARCHAR(36), 
	skill_ids JSON DEFAULT '[]'::json NOT NULL, 
	instructions TEXT DEFAULT ''::text NOT NULL, 
	lifetime VARCHAR(16) DEFAULT 'persistent'::character varying NOT NULL, 
	parent_agent_id VARCHAR(36), 
	spawned_in_run_id VARCHAR(36), 
	budget JSON DEFAULT '{}'::json NOT NULL, 
	policy JSON DEFAULT '{}'::json NOT NULL, 
	version INTEGER DEFAULT 1 NOT NULL, 
	created_by_kind VARCHAR(16) DEFAULT 'user'::character varying NOT NULL, 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT agents_pkey PRIMARY KEY (id), 
	CONSTRAINT agents_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT agents_llm_config_id_fkey FOREIGN KEY(llm_config_id) REFERENCES llm_providers (id) ON DELETE SET NULL, 
	CONSTRAINT agents_parent_agent_id_fkey FOREIGN KEY(parent_agent_id) REFERENCES agents (id) ON DELETE SET NULL, 
	CONSTRAINT uq_agent_graph_name UNIQUE NULLS DISTINCT (graph_id, name)
);

CREATE INDEX ix_agents_graph_id ON agents (graph_id);

CREATE INDEX ix_agents_key ON agents (key);

CREATE INDEX ix_agents_parent_agent_id ON agents (parent_agent_id);

CREATE INDEX ix_agents_status ON agents (status);

CREATE TABLE alembic_version (
	version_num VARCHAR(32) NOT NULL, 
	CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

CREATE TABLE board_versions (
	id VARCHAR(36) NOT NULL, 
	board_id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	created_by_id VARCHAR(36) NOT NULL, 
	message_id VARCHAR(36), 
	cause VARCHAR(16) NOT NULL, 
	label VARCHAR(255) DEFAULT ''::character varying NOT NULL, 
	snapshot_gz BYTEA NOT NULL, 
	source_query TEXT, 
	styling JSON DEFAULT '{}'::json NOT NULL, 
	settings JSON DEFAULT '{}'::json NOT NULL, 
	banner TEXT, 
	node_count INTEGER DEFAULT 0 NOT NULL, 
	edge_count INTEGER DEFAULT 0 NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT board_versions_pkey PRIMARY KEY (id), 
	CONSTRAINT board_versions_board_id_fkey FOREIGN KEY(board_id) REFERENCES boards (id) ON DELETE CASCADE, 
	CONSTRAINT board_versions_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE CASCADE, 
	CONSTRAINT board_versions_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT board_versions_message_id_fkey FOREIGN KEY(message_id) REFERENCES session_messages (id) ON DELETE SET NULL
);

CREATE INDEX ix_board_versions_board_created ON board_versions (board_id, created_at);

CREATE INDEX ix_board_versions_board_id ON board_versions (board_id);

CREATE INDEX ix_board_versions_created_by_id ON board_versions (created_by_id);

CREATE INDEX ix_board_versions_graph_id ON board_versions (graph_id);

CREATE TABLE boards (
	id VARCHAR(36) NOT NULL, 
	session_id VARCHAR(36), 
	graph_id VARCHAR(36) NOT NULL, 
	created_by_id VARCHAR(36) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	instructions TEXT NOT NULL, 
	snapshot JSON NOT NULL, 
	source_query TEXT, 
	view_state JSON NOT NULL, 
	filters JSON NOT NULL, 
	positions JSON NOT NULL, 
	settings JSON NOT NULL, 
	pinned BOOLEAN NOT NULL, 
	archived BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	styling JSON DEFAULT '{}'::json NOT NULL, 
	banner TEXT, 
	kind VARCHAR(32) NOT NULL, 
	subject_id VARCHAR(64), 
	CONSTRAINT boards_pkey PRIMARY KEY (id), 
	CONSTRAINT boards_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE CASCADE, 
	CONSTRAINT boards_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT boards_session_id_fkey FOREIGN KEY(session_id) REFERENCES sessions (id) ON DELETE CASCADE, 
	CONSTRAINT uq_boards_graph_kind_subject UNIQUE NULLS DISTINCT (graph_id, kind, subject_id), 
	CONSTRAINT uq_boards_session_id UNIQUE NULLS DISTINCT (session_id)
);

CREATE INDEX ix_boards_created_by_id ON boards (created_by_id);

CREATE INDEX ix_boards_graph_id ON boards (graph_id);

CREATE INDEX ix_boards_graph_kind ON boards (graph_id, kind);

CREATE TABLE constraint_definitions (
	id VARCHAR(36) NOT NULL, 
	version_id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	target_kind constraint_target_kind_enum NOT NULL, 
	target_label VARCHAR(255) NOT NULL, 
	constraint_type constraint_type_enum NOT NULL, 
	properties JSON NOT NULL, 
	CONSTRAINT constraint_definitions_pkey PRIMARY KEY (id), 
	CONSTRAINT constraint_definitions_version_id_fkey FOREIGN KEY(version_id) REFERENCES graph_versions (id) ON DELETE CASCADE, 
	CONSTRAINT uq_version_constraint UNIQUE NULLS DISTINCT (version_id, name)
);

CREATE TABLE edge_type_definitions (
	id VARCHAR(36) NOT NULL, 
	version_id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	source_node_types JSON, 
	target_node_types JSON, 
	multiplicity multiplicity_enum NOT NULL, 
	CONSTRAINT edge_type_definitions_pkey PRIMARY KEY (id), 
	CONSTRAINT edge_type_definitions_version_id_fkey FOREIGN KEY(version_id) REFERENCES graph_versions (id) ON DELETE CASCADE, 
	CONSTRAINT uq_version_edge_type UNIQUE NULLS DISTINCT (version_id, name)
);

CREATE TABLE emissions (
	id VARCHAR(36) NOT NULL, 
	run_id VARCHAR(36) NOT NULL, 
	message_id VARCHAR(36), 
	step_run_id VARCHAR(36), 
	seq INTEGER NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	payload JSON NOT NULL, 
	template_id VARCHAR(36), 
	citation JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT emissions_pkey PRIMARY KEY (id), 
	CONSTRAINT emissions_run_id_fkey FOREIGN KEY(run_id) REFERENCES task_runs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_emission_seq UNIQUE NULLS DISTINCT (run_id, seq)
);

CREATE INDEX ix_emissions_message_id ON emissions (message_id);

CREATE INDEX ix_emissions_thinking_id ON emissions (run_id);

CREATE TABLE events (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36), 
	actor_id VARCHAR(36), 
	actor_kind event_actor_type NOT NULL, 
	action VARCHAR(64) NOT NULL, 
	target_kind VARCHAR(32), 
	target_id VARCHAR(36), 
	details JSON NOT NULL, 
	trace_id VARCHAR(32), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	on_behalf_of_user_id VARCHAR(36), 
	parent_event_id VARCHAR(36), 
	project_id VARCHAR(36), 
	task_id VARCHAR(36), 
	run_id VARCHAR(36), 
	node_run_id VARCHAR(36), 
	skill_ids JSON DEFAULT '[]'::json NOT NULL, 
	CONSTRAINT events_pkey PRIMARY KEY (id), 
	CONSTRAINT events_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE SET NULL
);

CREATE INDEX ix_events_action_created_at ON events (action, created_at);

CREATE INDEX ix_events_actor_id_created_at ON events (actor_id, created_at);

CREATE INDEX ix_events_created_at ON events (created_at);

CREATE INDEX ix_events_graph_id_created_at ON events (graph_id, created_at);

CREATE INDEX ix_events_on_behalf_of_user_id ON events (on_behalf_of_user_id);

CREATE INDEX ix_events_run_id_created_at ON events (run_id, created_at);

CREATE INDEX ix_events_task_id_created_at ON events (task_id, created_at);

CREATE TABLE graph_connections (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36), 
	uri VARCHAR(2048) NOT NULL, 
	connector_class VARCHAR(512) NOT NULL, 
	auth_encrypted BYTEA, 
	read_only BOOLEAN NOT NULL, 
	status graph_connection_status_enum NOT NULL, 
	last_health_check_at TIMESTAMP WITH TIME ZONE, 
	latency_ms INTEGER, 
	model_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	server_version VARCHAR(32), 
	server_version_source VARCHAR(16), 
	compatibility_status VARCHAR(16), 
	version_acknowledged BOOLEAN DEFAULT false NOT NULL, 
	database VARCHAR(255), 
	CONSTRAINT graph_connections_pkey PRIMARY KEY (id), 
	CONSTRAINT graph_connections_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT graph_connections_model_id_fkey FOREIGN KEY(model_id) REFERENCES graph_models (id) ON DELETE SET NULL, 
	CONSTRAINT uq_graph_connections_graph_id UNIQUE NULLS DISTINCT (graph_id), 
	CONSTRAINT uq_graph_connections_model_id UNIQUE NULLS DISTINCT (model_id)
);

CREATE INDEX ix_graph_connections_graph_id ON graph_connections (graph_id);

CREATE TABLE graph_members (
	graph_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT pk_graph_members PRIMARY KEY (graph_id, user_id), 
	CONSTRAINT graph_members_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT graph_members_user_id_fkey FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE graph_models (
	id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	validation_mode validation_mode_enum NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	graph_id VARCHAR(36), 
	status model_status_enum DEFAULT 'draft'::model_status_enum NOT NULL, 
	yaml_path VARCHAR(1024), 
	origin model_origin_enum DEFAULT 'studio'::model_origin_enum NOT NULL, 
	package_id VARCHAR(64) NOT NULL, 
	import_source VARCHAR(32), 
	CONSTRAINT graph_models_pkey PRIMARY KEY (id), 
	CONSTRAINT fk_graph_models_graph_id FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE INDEX ix_graph_models_graph_id ON graph_models (graph_id);

CREATE INDEX ix_graph_models_package_id ON graph_models (package_id);

CREATE TABLE graph_versions (
	id VARCHAR(36) NOT NULL, 
	model_id VARCHAR(36) NOT NULL, 
	version VARCHAR(32), 
	status version_status_enum NOT NULL, 
	change_summary TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	activated_at TIMESTAMP WITH TIME ZONE, 
	content_hash VARCHAR(64), 
	CONSTRAINT graph_versions_pkey PRIMARY KEY (id), 
	CONSTRAINT graph_versions_model_id_fkey FOREIGN KEY(model_id) REFERENCES graph_models (id) ON DELETE CASCADE, 
	CONSTRAINT uq_graph_version UNIQUE NULLS DISTINCT (model_id, version)
);

CREATE INDEX ix_graph_versions_content_hash ON graph_versions (content_hash);

CREATE TABLE graphs (
	id VARCHAR(36) NOT NULL, 
	slug VARCHAR(255) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT, 
	instructions TEXT, 
	setup_state JSON DEFAULT '{}'::json NOT NULL, 
	status graph_status DEFAULT 'active'::graph_status NOT NULL, 
	created_by_id VARCHAR(36) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	default_agent_id VARCHAR(36), 
	max_concurrent_runs INTEGER DEFAULT 4 NOT NULL, 
	concurrency_policy VARCHAR(8) DEFAULT 'queue'::character varying NOT NULL, 
	CONSTRAINT graphs_pkey PRIMARY KEY (id), 
	CONSTRAINT graphs_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE RESTRICT, 
	CONSTRAINT uq_graphs_owner_slug UNIQUE NULLS DISTINCT (created_by_id, slug)
);

CREATE INDEX ix_graphs_created_by_id ON graphs (created_by_id);

CREATE TABLE index_definitions (
	id VARCHAR(36) NOT NULL, 
	version_id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	target_kind index_target_kind_enum NOT NULL, 
	target_label VARCHAR(255) NOT NULL, 
	properties JSON NOT NULL, 
	index_type index_type_enum NOT NULL, 
	index_options JSON, 
	CONSTRAINT index_definitions_pkey PRIMARY KEY (id), 
	CONSTRAINT index_definitions_version_id_fkey FOREIGN KEY(version_id) REFERENCES graph_versions (id) ON DELETE CASCADE, 
	CONSTRAINT uq_version_index UNIQUE NULLS DISTINCT (version_id, name)
);

CREATE TABLE llm_providers (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	provider llm_provider_kind NOT NULL, 
	model_id VARCHAR(255) NOT NULL, 
	api_key_encrypted BYTEA, 
	base_url VARCHAR(2048), 
	guardrails JSON NOT NULL, 
	is_default BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	credential_kind llm_credential_kind, 
	last_ping_at TIMESTAMP WITH TIME ZONE, 
	last_ping_ok BOOLEAN, 
	last_ping_error TEXT, 
	CONSTRAINT llm_providers_pkey PRIMARY KEY (id), 
	CONSTRAINT llm_providers_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE INDEX ix_llm_providers_graph_id ON llm_providers (graph_id);

CREATE UNIQUE INDEX uq_llm_providers_default_per_graph ON llm_providers (graph_id) WHERE (is_default = true);

CREATE TABLE model_links (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	kind model_link_kind_enum NOT NULL, 
	source_version_id VARCHAR(36) NOT NULL, 
	source_type VARCHAR(255) NOT NULL, 
	target_version_id VARCHAR(36) NOT NULL, 
	target_type VARCHAR(255) NOT NULL, 
	source_property VARCHAR(255), 
	identity_match model_link_match_enum DEFAULT 'exact'::model_link_match_enum NOT NULL, 
	edge_type VARCHAR(255), 
	source_model_id VARCHAR(36), 
	description TEXT DEFAULT ''::text NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	status model_link_status_enum DEFAULT 'active'::model_link_status_enum NOT NULL, 
	target_property VARCHAR(255), 
	CONSTRAINT model_links_pkey PRIMARY KEY (id), 
	CONSTRAINT model_links_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT model_links_source_version_id_fkey FOREIGN KEY(source_version_id) REFERENCES graph_versions (id) ON DELETE CASCADE, 
	CONSTRAINT model_links_target_version_id_fkey FOREIGN KEY(target_version_id) REFERENCES graph_versions (id) ON DELETE CASCADE, 
	CONSTRAINT uq_model_link UNIQUE NULLS DISTINCT (graph_id, kind, source_version_id, source_type, target_version_id, target_type, edge_type)
);

CREATE INDEX ix_model_links_graph_id ON model_links (graph_id);

CREATE TABLE node_type_definitions (
	id VARCHAR(36) NOT NULL, 
	version_id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	parent_type VARCHAR(255), 
	is_abstract BOOLEAN NOT NULL, 
	validation_mode VARCHAR(16), 
	CONSTRAINT node_type_definitions_pkey PRIMARY KEY (id), 
	CONSTRAINT node_type_definitions_version_id_fkey FOREIGN KEY(version_id) REFERENCES graph_versions (id) ON DELETE CASCADE, 
	CONSTRAINT uq_version_node_type UNIQUE NULLS DISTINCT (version_id, name)
);

CREATE TABLE personal_access_tokens (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	name VARCHAR(64) NOT NULL, 
	token_hash VARCHAR(64) NOT NULL, 
	last_four VARCHAR(4) NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE, 
	last_used_at TIMESTAMP WITH TIME ZONE, 
	revoked_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT personal_access_tokens_pkey PRIMARY KEY (id), 
	CONSTRAINT personal_access_tokens_user_id_fkey FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	CONSTRAINT uq_pat_user_name UNIQUE NULLS DISTINCT (user_id, name)
);

CREATE UNIQUE INDEX ix_personal_access_tokens_token_hash ON personal_access_tokens (token_hash);

CREATE INDEX ix_personal_access_tokens_user_id ON personal_access_tokens (user_id);

CREATE TABLE project_assignments (
	id VARCHAR(36) NOT NULL, 
	project_id VARCHAR(36) NOT NULL, 
	principal_kind VARCHAR(16) NOT NULL, 
	principal_id VARCHAR(36) NOT NULL, 
	assigned_by_kind VARCHAR(16) DEFAULT 'user'::character varying NOT NULL, 
	assigned_by_id VARCHAR(36), 
	assigned_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT project_assignments_pkey PRIMARY KEY (id), 
	CONSTRAINT project_assignments_project_id_fkey FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	CONSTRAINT uq_project_assignment UNIQUE NULLS DISTINCT (project_id, principal_kind, principal_id)
);

CREATE INDEX ix_project_assignments_project_id ON project_assignments (project_id);

CREATE TABLE projection_templates (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36), 
	name VARCHAR(128) NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	surface VARCHAR(24) NOT NULL, 
	accepts JSON NOT NULL, 
	spec JSON NOT NULL, 
	intent VARCHAR(255) DEFAULT ''::character varying NOT NULL, 
	version INTEGER DEFAULT 1 NOT NULL, 
	status VARCHAR(16) DEFAULT 'published'::character varying NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT projection_templates_pkey PRIMARY KEY (id), 
	CONSTRAINT projection_templates_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_projection_template_version UNIQUE NULLS DISTINCT (graph_id, name, version)
);

CREATE INDEX ix_projection_templates_graph_id ON projection_templates (graph_id);

CREATE TABLE projects (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	key VARCHAR(64) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT DEFAULT ''::text NOT NULL, 
	status VARCHAR(16) DEFAULT 'active'::character varying NOT NULL, 
	created_by_kind VARCHAR(16) DEFAULT 'user'::character varying NOT NULL, 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT projects_pkey PRIMARY KEY (id), 
	CONSTRAINT projects_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_project_graph_key UNIQUE NULLS DISTINCT (graph_id, key)
);

CREATE INDEX ix_projects_graph_id ON projects (graph_id);

CREATE TABLE property_key_definitions (
	id VARCHAR(36) NOT NULL, 
	version_id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	type VARCHAR(64) NOT NULL, 
	value_cardinality value_cardinality_enum NOT NULL, 
	description TEXT NOT NULL, 
	CONSTRAINT property_key_definitions_pkey PRIMARY KEY (id), 
	CONSTRAINT property_key_definitions_version_id_fkey FOREIGN KEY(version_id) REFERENCES graph_versions (id) ON DELETE CASCADE, 
	CONSTRAINT uq_version_property_key UNIQUE NULLS DISTINCT (version_id, name)
);

CREATE TABLE refresh_tokens (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	token_hash VARCHAR(64) NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	revoked_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id), 
	CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	CONSTRAINT uq_refresh_tokens_token_hash UNIQUE NULLS DISTINCT (token_hash)
);

CREATE UNIQUE INDEX ix_refresh_tokens_token_hash ON refresh_tokens (token_hash);

CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens (user_id);

CREATE TABLE schema_projections (
	id VARCHAR(36) NOT NULL, 
	version_id VARCHAR(36) NOT NULL, 
	connector_id VARCHAR(255) NOT NULL, 
	status projection_status_enum NOT NULL, 
	operations JSON NOT NULL, 
	errors JSON NOT NULL, 
	projected_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT schema_projections_pkey PRIMARY KEY (id), 
	CONSTRAINT schema_projections_version_id_fkey FOREIGN KEY(version_id) REFERENCES graph_versions (id) ON DELETE CASCADE
);

CREATE TABLE session_messages (
	id VARCHAR(36) NOT NULL, 
	session_id VARCHAR(36) NOT NULL, 
	seq INTEGER NOT NULL, 
	role session_message_role NOT NULL, 
	content TEXT NOT NULL, 
	status session_message_status, 
	via VARCHAR(255), 
	query_language VARCHAR(32), 
	source_query TEXT, 
	row_count INTEGER, 
	execution_time_ms INTEGER, 
	node_count INTEGER, 
	edge_count INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	llm_time_ms INTEGER, 
	timeout_s DOUBLE PRECISION, 
	mode VARCHAR(2), 
	rationale TEXT, 
	clarification_options JSON, 
	feedback VARCHAR(4), 
	operation VARCHAR(16), 
	run_id VARCHAR(36), 
	CONSTRAINT session_messages_pkey PRIMARY KEY (id), 
	CONSTRAINT session_messages_session_id_fkey FOREIGN KEY(session_id) REFERENCES sessions (id) ON DELETE CASCADE, 
	CONSTRAINT uq_session_message_seq UNIQUE NULLS DISTINCT (session_id, seq)
);

CREATE INDEX ix_session_messages_session_id ON session_messages (session_id);

CREATE INDEX ix_session_messages_thinking_id ON session_messages (run_id);

CREATE TABLE sessions (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	created_by_id VARCHAR(36) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	message_count INTEGER NOT NULL, 
	node_count INTEGER NOT NULL, 
	edge_count INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	pinned BOOLEAN DEFAULT false NOT NULL, 
	archived BOOLEAN DEFAULT false NOT NULL, 
	last_status session_message_status, 
	surface session_surface NOT NULL, 
	model_id VARCHAR(36), 
	agent_id VARCHAR(36), 
	CONSTRAINT sessions_pkey PRIMARY KEY (id), 
	CONSTRAINT fk_sessions_model_id FOREIGN KEY(model_id) REFERENCES graph_models (id) ON DELETE SET NULL, 
	CONSTRAINT sessions_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE CASCADE, 
	CONSTRAINT sessions_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE INDEX ix_sessions_created_by_id ON sessions (created_by_id);

CREATE INDEX ix_sessions_graph_id ON sessions (graph_id);

CREATE INDEX ix_sessions_graph_user_surface ON sessions (graph_id, created_by_id, surface);

CREATE INDEX ix_sessions_model_id ON sessions (model_id);

CREATE TABLE skills (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	content TEXT NOT NULL, 
	when_to_use TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT skills_pkey PRIMARY KEY (id), 
	CONSTRAINT skills_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_skill_graph_name UNIQUE NULLS DISTINCT (graph_id, name)
);

CREATE INDEX ix_skills_graph_id ON skills (graph_id);

CREATE TABLE task_plans (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	key VARCHAR(64), 
	version INTEGER DEFAULT 1 NOT NULL, 
	name VARCHAR(255) DEFAULT ''::character varying NOT NULL, 
	description TEXT DEFAULT ''::text NOT NULL, 
	kind VARCHAR(16) DEFAULT 'ask'::character varying NOT NULL, 
	origin VARCHAR(16) DEFAULT 'builtin'::character varying NOT NULL, 
	intent JSON NOT NULL, 
	todo_id VARCHAR(36), 
	args_schema JSON NOT NULL, 
	source_skill_version_ids JSON NOT NULL, 
	reusable BOOLEAN DEFAULT true NOT NULL, 
	promoted_from_run_id VARCHAR(36), 
	created_by_kind VARCHAR(16) DEFAULT 'user'::character varying NOT NULL, 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT task_plans_pkey PRIMARY KEY (id), 
	CONSTRAINT task_plans_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT task_plans_todo_id_fkey FOREIGN KEY(todo_id) REFERENCES todos (id) ON DELETE CASCADE, 
	CONSTRAINT uq_task_plan_graph_key_version UNIQUE NULLS DISTINCT (graph_id, key, version)
);

CREATE INDEX ix_task_plans_graph_id ON task_plans (graph_id);

CREATE INDEX ix_task_plans_kind ON task_plans (kind);

CREATE INDEX ix_task_plans_origin ON task_plans (origin);

CREATE INDEX ix_task_plans_reusable ON task_plans (reusable);

CREATE INDEX ix_task_plans_todo_id ON task_plans (todo_id);

CREATE TABLE task_prompts (
	id VARCHAR(36) NOT NULL, 
	run_id VARCHAR(36) NOT NULL, 
	step_seq INTEGER NOT NULL, 
	template_id VARCHAR(36), 
	answered_by_kind VARCHAR(16) DEFAULT 'user'::character varying NOT NULL, 
	answered_by_id VARCHAR(36), 
	value JSON NOT NULL, 
	answered_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	kind VARCHAR(16) DEFAULT 'clarification'::character varying NOT NULL, 
	options JSON DEFAULT '[]'::json NOT NULL, 
	deadline_s INTEGER, 
	CONSTRAINT prompt_answers_pkey PRIMARY KEY (id), 
	CONSTRAINT task_prompts_run_id_fkey FOREIGN KEY(run_id) REFERENCES task_runs (id) ON DELETE CASCADE
);

CREATE INDEX ix_prompt_answers_thinking_id ON task_prompts (run_id);

CREATE TABLE task_runs (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	parent_run_id VARCHAR(36), 
	todo_id VARCHAR(36), 
	task_plan_id VARCHAR(36), 
	task_id VARCHAR(36), 
	role VARCHAR(16) DEFAULT 'execute'::character varying NOT NULL, 
	task_key VARCHAR(64) DEFAULT ''::character varying NOT NULL, 
	step_key VARCHAR(64), 
	label VARCHAR(64) DEFAULT ''::character varying NOT NULL, 
	seq INTEGER DEFAULT 0 NOT NULL, 
	lane VARCHAR(64), 
	iteration INTEGER DEFAULT 0 NOT NULL, 
	attempt INTEGER DEFAULT 1 NOT NULL, 
	workflow_key VARCHAR(64) DEFAULT ''::character varying NOT NULL, 
	plan_snapshot JSON, 
	plan_origin VARCHAR(64), 
	plan_revision INTEGER DEFAULT 0 NOT NULL, 
	lens_id VARCHAR(36), 
	lens_snapshot JSON, 
	ask_kind VARCHAR(16), 
	body TEXT, 
	params JSON DEFAULT '{}'::json NOT NULL, 
	session_id VARCHAR(36), 
	message_id VARCHAR(36), 
	author_id VARCHAR(36), 
	author_kind VARCHAR(16) DEFAULT 'user'::character varying NOT NULL, 
	agent_id VARCHAR(36), 
	agent_version INTEGER, 
	triggered_by VARCHAR(16) DEFAULT 'user'::character varying NOT NULL, 
	on_behalf_of_user_id VARCHAR(36), 
	status VARCHAR(16) DEFAULT 'queued'::character varying NOT NULL, 
	outcome VARCHAR(16), 
	assistant_message_id VARCHAR(36), 
	queued_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE, 
	finished_at TIMESTAMP WITH TIME ZONE, 
	cursor JSON, 
	stream_seq INTEGER DEFAULT 0 NOT NULL, 
	clarifications INTEGER DEFAULT 0 NOT NULL, 
	replans INTEGER DEFAULT 0 NOT NULL, 
	detail VARCHAR(255) DEFAULT ''::character varying NOT NULL, 
	args JSON, 
	input JSON, 
	output JSON, 
	result JSON, 
	error JSON, 
	tokens_in INTEGER, 
	tokens_out INTEGER, 
	skills_offered JSON DEFAULT '[]'::json NOT NULL, 
	skills_applied JSON DEFAULT '[]'::json NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	cost_usd DOUBLE PRECISION, 
	CONSTRAINT task_runs_pkey PRIMARY KEY (id), 
	CONSTRAINT task_runs_assistant_message_id_fkey FOREIGN KEY(assistant_message_id) REFERENCES session_messages (id) ON DELETE SET NULL, 
	CONSTRAINT task_runs_author_id_fkey FOREIGN KEY(author_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT task_runs_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT task_runs_message_id_fkey FOREIGN KEY(message_id) REFERENCES session_messages (id) ON DELETE SET NULL, 
	CONSTRAINT task_runs_parent_run_id_fkey FOREIGN KEY(parent_run_id) REFERENCES task_runs (id) ON DELETE CASCADE, 
	CONSTRAINT task_runs_session_id_fkey FOREIGN KEY(session_id) REFERENCES sessions (id) ON DELETE CASCADE, 
	CONSTRAINT task_runs_task_id_fkey FOREIGN KEY(task_id) REFERENCES tasks (id) ON DELETE SET NULL, 
	CONSTRAINT task_runs_task_plan_id_fkey FOREIGN KEY(task_plan_id) REFERENCES task_plans (id) ON DELETE SET NULL, 
	CONSTRAINT uq_task_run_attempt UNIQUE NULLS DISTINCT (parent_run_id, task_id, lane, iteration, attempt)
);

CREATE INDEX ix_task_runs_agent_id ON task_runs (agent_id);

CREATE INDEX ix_task_runs_assistant_message_id ON task_runs (assistant_message_id);

CREATE INDEX ix_task_runs_graph_id ON task_runs (graph_id);

CREATE INDEX ix_task_runs_lens_id ON task_runs (lens_id);

CREATE INDEX ix_task_runs_parent_run_id ON task_runs (parent_run_id);

CREATE INDEX ix_task_runs_role ON task_runs (role);

CREATE INDEX ix_task_runs_session_id ON task_runs (session_id);

CREATE INDEX ix_task_runs_status ON task_runs (status);

CREATE INDEX ix_task_runs_task_id ON task_runs (task_id);

CREATE INDEX ix_task_runs_task_plan_id ON task_runs (task_plan_id);

CREATE INDEX ix_task_runs_todo_id ON task_runs (todo_id);

CREATE TABLE task_stream (
	id VARCHAR(36) NOT NULL, 
	run_id VARCHAR(36) NOT NULL, 
	seq INTEGER NOT NULL, 
	kind VARCHAR(48) NOT NULL, 
	payload JSON DEFAULT '{}'::json NOT NULL, 
	idem_key VARCHAR(128), 
	created_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT thought_stream_pkey PRIMARY KEY (id), 
	CONSTRAINT task_stream_run_id_fkey FOREIGN KEY(run_id) REFERENCES task_runs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_task_stream_seq UNIQUE NULLS DISTINCT (run_id, seq)
);

CREATE INDEX ix_thought_stream_thinking_id ON task_stream (run_id);

CREATE TABLE tasks (
	id VARCHAR(36) NOT NULL, 
	task_plan_id VARCHAR(36) NOT NULL, 
	parent_id VARCHAR(36), 
	ordinal INTEGER DEFAULT 0 NOT NULL, 
	key VARCHAR(64) NOT NULL, 
	form VARCHAR(16) DEFAULT 'callable'::character varying NOT NULL, 
	step_key VARCHAR(64), 
	title VARCHAR(255) DEFAULT ''::character varying NOT NULL, 
	body TEXT DEFAULT ''::text NOT NULL, 
	args JSON NOT NULL, 
	assignee_kind VARCHAR(16), 
	assignee_id VARCHAR(36), 
	depends_on JSON NOT NULL, 
	"when" TEXT, 
	map_over TEXT, 
	loop JSON, 
	approval JSON, 
	timeout_s INTEGER, 
	retry JSON, 
	pool VARCHAR(64), 
	max_parallel INTEGER, 
	on_lane_failure VARCHAR(24), 
	source_span TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT tasks_pkey1 PRIMARY KEY (id), 
	CONSTRAINT tasks_parent_id_fkey1 FOREIGN KEY(parent_id) REFERENCES tasks (id) ON DELETE CASCADE, 
	CONSTRAINT tasks_task_plan_id_fkey FOREIGN KEY(task_plan_id) REFERENCES task_plans (id) ON DELETE CASCADE, 
	CONSTRAINT uq_task_plan_sibling_key UNIQUE NULLS DISTINCT (task_plan_id, parent_id, key)
);

CREATE INDEX ix_tasks_parent_id ON tasks (parent_id);

CREATE INDEX ix_tasks_step_key ON tasks (step_key);

CREATE INDEX ix_tasks_task_plan_id ON tasks (task_plan_id);

CREATE TABLE todo_dependencies (
	id VARCHAR(36) NOT NULL, 
	task_id VARCHAR(36) NOT NULL, 
	depends_on_id VARCHAR(36) NOT NULL, 
	kind VARCHAR(24) DEFAULT 'finish_to_start'::character varying NOT NULL, 
	binds JSON, 
	created_by_kind VARCHAR(16) DEFAULT 'user'::character varying NOT NULL, 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT task_dependencies_pkey PRIMARY KEY (id), 
	CONSTRAINT task_dependencies_depends_on_id_fkey FOREIGN KEY(depends_on_id) REFERENCES todos (id) ON DELETE CASCADE, 
	CONSTRAINT task_dependencies_task_id_fkey FOREIGN KEY(task_id) REFERENCES todos (id) ON DELETE CASCADE, 
	CONSTRAINT uq_todo_dependency UNIQUE NULLS DISTINCT (task_id, depends_on_id)
);

CREATE INDEX ix_todo_dependencies_depends_on_id ON todo_dependencies (depends_on_id);

CREATE INDEX ix_todo_dependencies_task_id ON todo_dependencies (task_id);

CREATE TABLE todos (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	project_id VARCHAR(36), 
	parent_id VARCHAR(36), 
	title VARCHAR(255) NOT NULL, 
	body TEXT DEFAULT ''::text NOT NULL, 
	acceptance TEXT DEFAULT ''::text NOT NULL, 
	status VARCHAR(16) DEFAULT 'open'::character varying NOT NULL, 
	assignee_kind VARCHAR(16), 
	assignee_id VARCHAR(36), 
	created_by_kind VARCHAR(16) DEFAULT 'user'::character varying NOT NULL, 
	created_by_id VARCHAR(36), 
	result JSON, 
	blocked_reason VARCHAR(255), 
	due_at TIMESTAMP WITH TIME ZONE, 
	closed_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT tasks_pkey PRIMARY KEY (id), 
	CONSTRAINT tasks_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT tasks_parent_id_fkey FOREIGN KEY(parent_id) REFERENCES todos (id) ON DELETE CASCADE, 
	CONSTRAINT tasks_project_id_fkey FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL
);

CREATE INDEX ix_todos_assignee_id ON todos (assignee_id);

CREATE INDEX ix_todos_graph_id ON todos (graph_id);

CREATE INDEX ix_todos_parent_id ON todos (parent_id);

CREATE INDEX ix_todos_project_id ON todos (project_id);

CREATE INDEX ix_todos_status ON todos (status);

CREATE TABLE type_property_mappings (
	id VARCHAR(36) NOT NULL, 
	property_key_id VARCHAR(36) NOT NULL, 
	node_type_id VARCHAR(36), 
	edge_type_id VARCHAR(36), 
	default_value TEXT, 
	sort_order INTEGER NOT NULL, 
	CONSTRAINT type_property_mappings_pkey PRIMARY KEY (id), 
	CONSTRAINT type_property_mappings_edge_type_id_fkey FOREIGN KEY(edge_type_id) REFERENCES edge_type_definitions (id) ON DELETE CASCADE, 
	CONSTRAINT type_property_mappings_node_type_id_fkey FOREIGN KEY(node_type_id) REFERENCES node_type_definitions (id) ON DELETE CASCADE, 
	CONSTRAINT type_property_mappings_property_key_id_fkey FOREIGN KEY(property_key_id) REFERENCES property_key_definitions (id) ON DELETE CASCADE
);

CREATE TABLE users (
	id VARCHAR(36) NOT NULL, 
	email VARCHAR(320), 
	username VARCHAR(64) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	first_name VARCHAR(120) NOT NULL, 
	last_name VARCHAR(120), 
	is_superuser BOOLEAN DEFAULT false NOT NULL, 
	is_active BOOLEAN DEFAULT true NOT NULL, 
	username_last_changed_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	preferences JSON NOT NULL, 
	CONSTRAINT users_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_users_email UNIQUE NULLS DISTINCT (email), 
	CONSTRAINT uq_users_username UNIQUE NULLS DISTINCT (username)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE UNIQUE INDEX ix_users_username ON users (username);

CREATE TABLE validation_rules (
	id VARCHAR(36) NOT NULL, 
	property_key_id VARCHAR(36), 
	type_property_mapping_id VARCHAR(36), 
	rule_type rule_type_enum NOT NULL, 
	params JSON NOT NULL, 
	CONSTRAINT validation_rules_pkey PRIMARY KEY (id), 
	CONSTRAINT validation_rules_property_key_id_fkey FOREIGN KEY(property_key_id) REFERENCES property_key_definitions (id) ON DELETE CASCADE, 
	CONSTRAINT validation_rules_type_property_mapping_id_fkey FOREIGN KEY(type_property_mapping_id) REFERENCES type_property_mappings (id) ON DELETE CASCADE
);
