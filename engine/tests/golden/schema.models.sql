CREATE TABLE agents (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	key VARCHAR(64), 
	name VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	workflow_spec JSON NOT NULL, 
	instructions TEXT NOT NULL, 
	lifetime VARCHAR(16) NOT NULL, 
	parent_agent_id VARCHAR(36), 
	spawned_in_run_id VARCHAR(36), 
	budget JSON NOT NULL, 
	policy JSON NOT NULL, 
	lens_id VARCHAR(36), 
	version INTEGER NOT NULL, 
	created_by_kind VARCHAR(16) NOT NULL, 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_agent_graph_name UNIQUE (graph_id, name), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	FOREIGN KEY(parent_agent_id) REFERENCES agents (id) ON DELETE SET NULL, 
	FOREIGN KEY(lens_id) REFERENCES lenses (id) ON DELETE RESTRICT
);

CREATE INDEX ix_agents_graph_id ON agents (graph_id);

CREATE INDEX ix_agents_key ON agents (key);

CREATE INDEX ix_agents_lens_id ON agents (lens_id);

CREATE INDEX ix_agents_parent_agent_id ON agents (parent_agent_id);

CREATE INDEX ix_agents_status ON agents (status);

CREATE TABLE board_versions (
	id VARCHAR(36) NOT NULL, 
	board_id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	created_by_id VARCHAR(36) NOT NULL, 
	message_id VARCHAR(36), 
	cause VARCHAR(16) NOT NULL, 
	label VARCHAR(255) NOT NULL, 
	snapshot_gz BYTEA NOT NULL, 
	source_query TEXT, 
	styling JSON NOT NULL, 
	settings JSON NOT NULL, 
	banner TEXT, 
	node_count INTEGER NOT NULL, 
	edge_count INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(board_id) REFERENCES boards (id) ON DELETE CASCADE, 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(message_id) REFERENCES session_messages (id) ON DELETE SET NULL
);

CREATE INDEX ix_board_versions_board_created ON board_versions (board_id, created_at);

CREATE INDEX ix_board_versions_board_id ON board_versions (board_id);

CREATE INDEX ix_board_versions_created_by_id ON board_versions (created_by_id);

CREATE INDEX ix_board_versions_graph_id ON board_versions (graph_id);

CREATE TABLE boards (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	kind VARCHAR(32) NOT NULL, 
	subject_id VARCHAR(64), 
	session_id VARCHAR(36), 
	created_by_id VARCHAR(36) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	instructions TEXT NOT NULL, 
	settings JSON NOT NULL, 
	styling JSON NOT NULL, 
	view_state JSON NOT NULL, 
	filters JSON NOT NULL, 
	snapshot JSON NOT NULL, 
	positions JSON NOT NULL, 
	source_query TEXT, 
	banner TEXT, 
	pinned BOOLEAN NOT NULL, 
	archived BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_boards_session_id UNIQUE (session_id), 
	CONSTRAINT uq_boards_graph_kind_subject UNIQUE (graph_id, kind, subject_id), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	FOREIGN KEY(session_id) REFERENCES sessions (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE CASCADE
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
	PRIMARY KEY (id), 
	CONSTRAINT uq_version_constraint UNIQUE (version_id, name), 
	FOREIGN KEY(version_id) REFERENCES graph_versions (id) ON DELETE CASCADE
);

CREATE TABLE edge_type_definitions (
	id VARCHAR(36) NOT NULL, 
	version_id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	source_node_types JSON, 
	target_node_types JSON, 
	multiplicity multiplicity_enum NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_version_edge_type UNIQUE (version_id, name), 
	FOREIGN KEY(version_id) REFERENCES graph_versions (id) ON DELETE CASCADE
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
	PRIMARY KEY (id), 
	CONSTRAINT uq_emission_seq UNIQUE (run_id, seq), 
	FOREIGN KEY(run_id) REFERENCES task_runs (id) ON DELETE CASCADE
);

CREATE INDEX ix_emissions_message_id ON emissions (message_id);

CREATE INDEX ix_emissions_run_id ON emissions (run_id);

CREATE TABLE events (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36), 
	actor_id VARCHAR(36), 
	actor_kind event_actor_type NOT NULL, 
	on_behalf_of_user_id VARCHAR(36), 
	parent_event_id VARCHAR(36), 
	project_id VARCHAR(36), 
	task_id VARCHAR(36), 
	run_id VARCHAR(36), 
	node_run_id VARCHAR(36), 
	skill_ids JSON NOT NULL, 
	action VARCHAR(64) NOT NULL, 
	target_kind VARCHAR(32), 
	target_id VARCHAR(36), 
	details JSON NOT NULL, 
	trace_id VARCHAR(32), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE SET NULL
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
	database VARCHAR(255), 
	auth_encrypted BYTEA, 
	read_only BOOLEAN NOT NULL, 
	status graph_connection_status_enum NOT NULL, 
	last_health_check_at TIMESTAMP WITH TIME ZONE, 
	latency_ms INTEGER, 
	server_version VARCHAR(32), 
	server_version_source VARCHAR(16), 
	compatibility_status VARCHAR(16), 
	version_acknowledged BOOLEAN NOT NULL, 
	model_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	UNIQUE (model_id), 
	FOREIGN KEY(model_id) REFERENCES graph_models (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX ix_graph_connections_graph_id ON graph_connections (graph_id);

CREATE TABLE graph_members (
	graph_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	can_edit_guardrails BOOLEAN DEFAULT 'false' NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (graph_id, user_id), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE graph_models (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36), 
	name VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	package_id VARCHAR(64) NOT NULL, 
	import_source VARCHAR(32), 
	validation_mode validation_mode_enum NOT NULL, 
	status model_status_enum NOT NULL, 
	origin model_origin_enum NOT NULL, 
	yaml_path VARCHAR(1024), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE INDEX ix_graph_models_graph_id ON graph_models (graph_id);

CREATE INDEX ix_graph_models_package_id ON graph_models (package_id);

CREATE TABLE graph_versions (
	id VARCHAR(36) NOT NULL, 
	model_id VARCHAR(36) NOT NULL, 
	version VARCHAR(32), 
	status version_status_enum NOT NULL, 
	change_summary TEXT NOT NULL, 
	content_hash VARCHAR(64), 
	axes JSON DEFAULT '{}' NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	activated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_graph_version UNIQUE (model_id, version), 
	FOREIGN KEY(model_id) REFERENCES graph_models (id) ON DELETE CASCADE
);

CREATE INDEX ix_graph_versions_content_hash ON graph_versions (content_hash);

CREATE TABLE graphs (
	id VARCHAR(36) NOT NULL, 
	slug VARCHAR(255) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT, 
	instructions TEXT, 
	setup_state JSON NOT NULL, 
	status graph_status NOT NULL, 
	default_agent_id VARCHAR(36), 
	max_concurrent_runs INTEGER DEFAULT '4' NOT NULL, 
	concurrency_policy VARCHAR(8) DEFAULT 'queue' NOT NULL, 
	pools JSON DEFAULT '{"llm": 20, "graphdb": 50, "heavy": 4}' NOT NULL, 
	created_by_id VARCHAR(36) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_graphs_owner_slug UNIQUE (created_by_id, slug), 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE RESTRICT
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
	PRIMARY KEY (id), 
	CONSTRAINT uq_version_index UNIQUE (version_id, name), 
	FOREIGN KEY(version_id) REFERENCES graph_versions (id) ON DELETE CASCADE
);

CREATE TABLE lenses (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	key VARCHAR(128), 
	name VARCHAR(255), 
	scope VARCHAR(64), 
	rules JSON NOT NULL, 
	"cast" JSON NOT NULL, 
	closed_layers JSON NOT NULL, 
	as_of TIMESTAMP WITH TIME ZONE, 
	created_in_run_id VARCHAR(36), 
	created_by_id VARCHAR(36), 
	version INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_lens_graph_key UNIQUE (graph_id, key), 
	CONSTRAINT ck_lens_kind_shape CHECK ((kind = 'guardrail' AND scope IS NOT NULL AND key IS NOT NULL) OR (kind = 'world' AND scope IS NULL)), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_lens_graph_kind ON lenses (graph_id, kind);

CREATE INDEX ix_lenses_created_in_run_id ON lenses (created_in_run_id);

CREATE INDEX ix_lenses_graph_id ON lenses (graph_id);

CREATE TABLE llm_models (
	id VARCHAR(36) NOT NULL, 
	provider_id VARCHAR(36) NOT NULL, 
	model_id VARCHAR(255) NOT NULL, 
	display_name VARCHAR(255), 
	capabilities JSON NOT NULL, 
	pricing JSON NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_llm_model_provider_model UNIQUE (provider_id, model_id), 
	FOREIGN KEY(provider_id) REFERENCES llm_providers (id) ON DELETE CASCADE
);

CREATE INDEX ix_llm_models_provider_id ON llm_models (provider_id);

CREATE TABLE llm_providers (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	name VARCHAR(64) NOT NULL, 
	provider llm_provider_kind NOT NULL, 
	api_key_encrypted BYTEA, 
	credential_kind llm_credential_kind, 
	base_url VARCHAR(2048), 
	guardrails JSON NOT NULL, 
	last_ping_at TIMESTAMP WITH TIME ZONE, 
	last_ping_ok BOOLEAN, 
	last_ping_error TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_llm_provider_graph_name UNIQUE (graph_id, name), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE INDEX ix_llm_providers_graph_id ON llm_providers (graph_id);

CREATE TABLE model_links (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	kind model_link_kind_enum NOT NULL, 
	status model_link_status_enum NOT NULL, 
	source_version_id VARCHAR(36) NOT NULL, 
	source_type VARCHAR(255) NOT NULL, 
	target_version_id VARCHAR(36) NOT NULL, 
	target_type VARCHAR(255) NOT NULL, 
	source_property VARCHAR(255), 
	target_property VARCHAR(255), 
	identity_match model_link_match_enum NOT NULL, 
	edge_type VARCHAR(255), 
	source_model_id VARCHAR(36), 
	description TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_model_link UNIQUE (graph_id, kind, source_version_id, source_type, target_version_id, target_type, edge_type), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	FOREIGN KEY(source_version_id) REFERENCES graph_versions (id) ON DELETE CASCADE, 
	FOREIGN KEY(target_version_id) REFERENCES graph_versions (id) ON DELETE CASCADE
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
	PRIMARY KEY (id), 
	CONSTRAINT uq_version_node_type UNIQUE (version_id, name), 
	FOREIGN KEY(version_id) REFERENCES graph_versions (id) ON DELETE CASCADE
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
	PRIMARY KEY (id), 
	CONSTRAINT uq_pat_user_name UNIQUE (user_id, name), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ix_personal_access_tokens_token_hash ON personal_access_tokens (token_hash);

CREATE INDEX ix_personal_access_tokens_user_id ON personal_access_tokens (user_id);

CREATE TABLE project_assignments (
	id VARCHAR(36) NOT NULL, 
	project_id VARCHAR(36) NOT NULL, 
	principal_kind VARCHAR(16) NOT NULL, 
	principal_id VARCHAR(36) NOT NULL, 
	assigned_by_kind VARCHAR(16) NOT NULL, 
	assigned_by_id VARCHAR(36), 
	assigned_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_project_assignment UNIQUE (project_id, principal_kind, principal_id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
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
	intent VARCHAR(255) NOT NULL, 
	version INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_projection_template_version UNIQUE (graph_id, name, version), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE INDEX ix_projection_templates_graph_id ON projection_templates (graph_id);

CREATE TABLE projects (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	key VARCHAR(64) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	created_by_kind VARCHAR(16) NOT NULL, 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_project_graph_key UNIQUE (graph_id, key), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE INDEX ix_projects_graph_id ON projects (graph_id);

CREATE TABLE property_key_definitions (
	id VARCHAR(36) NOT NULL, 
	version_id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	type VARCHAR(64) NOT NULL, 
	value_cardinality value_cardinality_enum NOT NULL, 
	description TEXT NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_version_property_key UNIQUE (version_id, name), 
	FOREIGN KEY(version_id) REFERENCES graph_versions (id) ON DELETE CASCADE
);

CREATE TABLE refresh_tokens (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	token_hash VARCHAR(64) NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	revoked_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ix_refresh_tokens_token_hash ON refresh_tokens (token_hash);

CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens (user_id);

CREATE TABLE rule_versions (
	id VARCHAR(36) NOT NULL, 
	rule_id VARCHAR(36) NOT NULL, 
	version INTEGER NOT NULL, 
	statement TEXT NOT NULL, 
	published_by_id VARCHAR(36), 
	published_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_rule_version_number UNIQUE (rule_id, version), 
	FOREIGN KEY(rule_id) REFERENCES rules (id) ON DELETE CASCADE, 
	FOREIGN KEY(published_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_rule_versions_rule_id ON rule_versions (rule_id);

CREATE TABLE rules (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	project_id VARCHAR(36), 
	active BOOLEAN NOT NULL, 
	"order" INTEGER NOT NULL, 
	current_version_id VARCHAR(36), 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_rules_graph_id ON rules (graph_id);

CREATE INDEX ix_rules_project_id ON rules (project_id);

CREATE TABLE run_touches (
	id VARCHAR(36) NOT NULL, 
	run_id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	seq INTEGER NOT NULL, 
	step_key VARCHAR(64), 
	address VARCHAR(512) NOT NULL, 
	layer VARCHAR(16) NOT NULL, 
	sublayer VARCHAR(64) NOT NULL, 
	participant VARCHAR(255) NOT NULL, 
	direction VARCHAR(16) NOT NULL, 
	rule_matched VARCHAR(512), 
	why VARCHAR(255), 
	volume JSON NOT NULL, 
	applied JSON NOT NULL, 
	sent JSON NOT NULL, 
	query JSON NOT NULL, 
	cost_usd FLOAT, 
	duration_ms INTEGER, 
	at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_run_touch_seq UNIQUE (run_id, seq), 
	FOREIGN KEY(run_id) REFERENCES task_runs (id) ON DELETE CASCADE
);

CREATE INDEX ix_run_touch_graph_address ON run_touches (graph_id, address);

CREATE INDEX ix_run_touch_run_direction ON run_touches (run_id, direction);

CREATE INDEX ix_run_touches_address ON run_touches (address);

CREATE INDEX ix_run_touches_graph_id ON run_touches (graph_id);

CREATE INDEX ix_run_touches_run_id ON run_touches (run_id);

CREATE TABLE schema_projections (
	id VARCHAR(36) NOT NULL, 
	version_id VARCHAR(36) NOT NULL, 
	connector_id VARCHAR(255) NOT NULL, 
	status projection_status_enum NOT NULL, 
	operations JSON NOT NULL, 
	errors JSON NOT NULL, 
	projected_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(version_id) REFERENCES graph_versions (id) ON DELETE CASCADE
);

CREATE TABLE session_messages (
	id VARCHAR(36) NOT NULL, 
	session_id VARCHAR(36) NOT NULL, 
	seq INTEGER NOT NULL, 
	role session_message_role NOT NULL, 
	content TEXT NOT NULL, 
	status session_message_status, 
	operation VARCHAR(16), 
	mode VARCHAR(2), 
	via VARCHAR(255), 
	query_language VARCHAR(32), 
	source_query TEXT, 
	rationale TEXT, 
	clarification_options JSON, 
	feedback VARCHAR(4), 
	row_count INTEGER, 
	execution_time_ms INTEGER, 
	llm_time_ms INTEGER, 
	timeout_s FLOAT, 
	node_count INTEGER, 
	edge_count INTEGER, 
	run_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_session_message_seq UNIQUE (session_id, seq), 
	FOREIGN KEY(session_id) REFERENCES sessions (id) ON DELETE CASCADE
);

CREATE INDEX ix_session_messages_run_id ON session_messages (run_id);

CREATE INDEX ix_session_messages_session_id ON session_messages (session_id);

CREATE TABLE sessions (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	created_by_id VARCHAR(36) NOT NULL, 
	surface session_surface NOT NULL, 
	model_id VARCHAR(36), 
	agent_id VARCHAR(36), 
	title VARCHAR(255) NOT NULL, 
	pinned BOOLEAN NOT NULL, 
	archived BOOLEAN NOT NULL, 
	message_count INTEGER NOT NULL, 
	node_count INTEGER NOT NULL, 
	edge_count INTEGER NOT NULL, 
	last_status session_message_status, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(model_id) REFERENCES graph_models (id) ON DELETE SET NULL
);

CREATE INDEX ix_sessions_agent_id ON sessions (agent_id);

CREATE INDEX ix_sessions_created_by_id ON sessions (created_by_id);

CREATE INDEX ix_sessions_graph_id ON sessions (graph_id);

CREATE INDEX ix_sessions_model_id ON sessions (model_id);

CREATE TABLE skill_bindings (
	id VARCHAR(36) NOT NULL, 
	skill_id VARCHAR(36) NOT NULL, 
	agent_id VARCHAR(36) NOT NULL, 
	bound_by_id VARCHAR(36), 
	bound_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_skill_binding UNIQUE (skill_id, agent_id), 
	FOREIGN KEY(skill_id) REFERENCES skills (id) ON DELETE CASCADE, 
	FOREIGN KEY(agent_id) REFERENCES agents (id) ON DELETE CASCADE, 
	FOREIGN KEY(bound_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_skill_bindings_agent_id ON skill_bindings (agent_id);

CREATE INDEX ix_skill_bindings_skill_id ON skill_bindings (skill_id);

CREATE TABLE skill_version_clarifications (
	id VARCHAR(36) NOT NULL, 
	skill_version_id VARCHAR(36) NOT NULL, 
	span TEXT NOT NULL, 
	question TEXT NOT NULL, 
	options JSON NOT NULL, 
	answer TEXT, 
	answered_by_id VARCHAR(36), 
	answered_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(skill_version_id) REFERENCES skill_versions (id) ON DELETE CASCADE, 
	FOREIGN KEY(answered_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_skill_version_clarifications_skill_version_id ON skill_version_clarifications (skill_version_id);

CREATE TABLE skill_versions (
	id VARCHAR(36) NOT NULL, 
	skill_id VARCHAR(36) NOT NULL, 
	version INTEGER NOT NULL, 
	description TEXT NOT NULL, 
	content TEXT NOT NULL, 
	when_to_use TEXT NOT NULL, 
	plan_id VARCHAR(36) NOT NULL, 
	published_by_id VARCHAR(36), 
	published_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_skill_version_number UNIQUE (skill_id, version), 
	FOREIGN KEY(skill_id) REFERENCES skills (id) ON DELETE CASCADE, 
	UNIQUE (plan_id), 
	FOREIGN KEY(plan_id) REFERENCES task_plans (id) ON DELETE RESTRICT, 
	FOREIGN KEY(published_by_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_skill_versions_skill_id ON skill_versions (skill_id);

CREATE TABLE skills (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	origin VARCHAR(16) NOT NULL, 
	current_version_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_skill_graph_name UNIQUE (graph_id, name), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE INDEX ix_skills_graph_id ON skills (graph_id);

CREATE TABLE task_plans (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	key VARCHAR(64), 
	version INTEGER NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	origin VARCHAR(16) NOT NULL, 
	intent JSON NOT NULL, 
	todo_id VARCHAR(36), 
	args_schema JSON NOT NULL, 
	uses JSON NOT NULL, 
	source_skill_version_ids JSON NOT NULL, 
	reusable BOOLEAN NOT NULL, 
	promoted_from_run_id VARCHAR(36), 
	created_by_kind VARCHAR(16) NOT NULL, 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_task_plan_graph_key_version UNIQUE (graph_id, key, version), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	FOREIGN KEY(todo_id) REFERENCES todos (id) ON DELETE CASCADE
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
	kind VARCHAR(16) NOT NULL, 
	options JSON NOT NULL, 
	deadline_s INTEGER, 
	template_id VARCHAR(36), 
	answered_by_kind VARCHAR(16) NOT NULL, 
	answered_by_id VARCHAR(36), 
	value JSON NOT NULL, 
	answered_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(run_id) REFERENCES task_runs (id) ON DELETE CASCADE
);

CREATE INDEX ix_task_prompts_run_id ON task_prompts (run_id);

CREATE TABLE task_runs (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	parent_run_id VARCHAR(36), 
	todo_id VARCHAR(36), 
	task_plan_id VARCHAR(36), 
	task_id VARCHAR(36), 
	role VARCHAR(16) NOT NULL, 
	task_key VARCHAR(64) NOT NULL, 
	step_key VARCHAR(64), 
	label VARCHAR(64) NOT NULL, 
	seq INTEGER NOT NULL, 
	lane VARCHAR(64), 
	iteration INTEGER NOT NULL, 
	attempt INTEGER NOT NULL, 
	workflow_key VARCHAR(64) NOT NULL, 
	plan_snapshot JSON, 
	plan_origin VARCHAR(64), 
	plan_revision INTEGER NOT NULL, 
	lens_id VARCHAR(36), 
	lens_snapshot JSON, 
	ask_kind VARCHAR(16), 
	body TEXT, 
	params JSON NOT NULL, 
	session_id VARCHAR(36), 
	message_id VARCHAR(36), 
	author_id VARCHAR(36), 
	author_kind VARCHAR(16) NOT NULL, 
	agent_id VARCHAR(36), 
	agent_version INTEGER, 
	triggered_by VARCHAR(16) NOT NULL, 
	on_behalf_of_user_id VARCHAR(36), 
	status VARCHAR(16) NOT NULL, 
	outcome VARCHAR(16), 
	assistant_message_id VARCHAR(36), 
	queued_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE, 
	finished_at TIMESTAMP WITH TIME ZONE, 
	cursor JSON, 
	stream_seq INTEGER NOT NULL, 
	clarifications INTEGER NOT NULL, 
	replans INTEGER NOT NULL, 
	detail VARCHAR(255) NOT NULL, 
	args JSON, 
	input JSON, 
	output JSON, 
	result JSON, 
	error JSON, 
	tokens_in INTEGER, 
	tokens_out INTEGER, 
	cost_usd FLOAT, 
	skills_offered JSON NOT NULL, 
	skills_applied JSON NOT NULL, 
	rules_offered JSON NOT NULL, 
	rules_cited JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_task_run_attempt UNIQUE (parent_run_id, task_id, lane, iteration, attempt), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	FOREIGN KEY(parent_run_id) REFERENCES task_runs (id) ON DELETE CASCADE, 
	FOREIGN KEY(task_plan_id) REFERENCES task_plans (id) ON DELETE SET NULL, 
	FOREIGN KEY(task_id) REFERENCES tasks (id) ON DELETE SET NULL, 
	FOREIGN KEY(session_id) REFERENCES sessions (id) ON DELETE CASCADE, 
	FOREIGN KEY(message_id) REFERENCES session_messages (id) ON DELETE SET NULL, 
	FOREIGN KEY(author_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(assistant_message_id) REFERENCES session_messages (id) ON DELETE SET NULL
);

CREATE INDEX ix_task_runs_agent_id ON task_runs (agent_id);

CREATE INDEX ix_task_runs_agent_started ON task_runs (agent_id, started_at);

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
	payload JSON NOT NULL, 
	idem_key VARCHAR(128), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_task_stream_seq UNIQUE (run_id, seq), 
	FOREIGN KEY(run_id) REFERENCES task_runs (id) ON DELETE CASCADE
);

CREATE INDEX ix_task_stream_run_id ON task_stream (run_id);

CREATE TABLE tasks (
	id VARCHAR(36) NOT NULL, 
	task_plan_id VARCHAR(36) NOT NULL, 
	parent_id VARCHAR(36), 
	ordinal INTEGER NOT NULL, 
	key VARCHAR(64) NOT NULL, 
	form VARCHAR(16) NOT NULL, 
	step_key VARCHAR(64), 
	title VARCHAR(255) NOT NULL, 
	body TEXT NOT NULL, 
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
	source_plan_key VARCHAR(80), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_task_plan_sibling_key UNIQUE (task_plan_id, parent_id, key), 
	FOREIGN KEY(task_plan_id) REFERENCES task_plans (id) ON DELETE CASCADE, 
	FOREIGN KEY(parent_id) REFERENCES tasks (id) ON DELETE CASCADE
);

CREATE INDEX ix_tasks_parent_id ON tasks (parent_id);

CREATE INDEX ix_tasks_step_key ON tasks (step_key);

CREATE INDEX ix_tasks_task_plan_id ON tasks (task_plan_id);

CREATE TABLE todo_dependencies (
	id VARCHAR(36) NOT NULL, 
	task_id VARCHAR(36) NOT NULL, 
	depends_on_id VARCHAR(36) NOT NULL, 
	kind VARCHAR(24) NOT NULL, 
	binds JSON, 
	created_by_kind VARCHAR(16) NOT NULL, 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_todo_dependency UNIQUE (task_id, depends_on_id), 
	FOREIGN KEY(task_id) REFERENCES todos (id) ON DELETE CASCADE, 
	FOREIGN KEY(depends_on_id) REFERENCES todos (id) ON DELETE CASCADE
);

CREATE INDEX ix_todo_dependencies_depends_on_id ON todo_dependencies (depends_on_id);

CREATE INDEX ix_todo_dependencies_task_id ON todo_dependencies (task_id);

CREATE TABLE todos (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	project_id VARCHAR(36), 
	parent_id VARCHAR(36), 
	title VARCHAR(255) NOT NULL, 
	body TEXT NOT NULL, 
	acceptance TEXT NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	assignee_kind VARCHAR(16), 
	assignee_id VARCHAR(36), 
	created_by_kind VARCHAR(16) NOT NULL, 
	created_by_id VARCHAR(36), 
	result JSON, 
	blocked_reason VARCHAR(255), 
	due_at TIMESTAMP WITH TIME ZONE, 
	closed_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL, 
	FOREIGN KEY(parent_id) REFERENCES todos (id) ON DELETE CASCADE
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
	PRIMARY KEY (id), 
	FOREIGN KEY(property_key_id) REFERENCES property_key_definitions (id) ON DELETE CASCADE, 
	FOREIGN KEY(node_type_id) REFERENCES node_type_definitions (id) ON DELETE CASCADE, 
	FOREIGN KEY(edge_type_id) REFERENCES edge_type_definitions (id) ON DELETE CASCADE
);

CREATE TABLE users (
	id VARCHAR(36) NOT NULL, 
	email VARCHAR(320), 
	username VARCHAR(64) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	first_name VARCHAR(120) NOT NULL, 
	last_name VARCHAR(120), 
	preferences JSON NOT NULL, 
	is_superuser BOOLEAN NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	username_last_changed_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE UNIQUE INDEX ix_users_username ON users (username);

CREATE TABLE validation_rules (
	id VARCHAR(36) NOT NULL, 
	property_key_id VARCHAR(36), 
	type_property_mapping_id VARCHAR(36), 
	rule_type rule_type_enum NOT NULL, 
	params JSON NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(property_key_id) REFERENCES property_key_definitions (id) ON DELETE CASCADE, 
	FOREIGN KEY(type_property_mapping_id) REFERENCES type_property_mappings (id) ON DELETE CASCADE
);
