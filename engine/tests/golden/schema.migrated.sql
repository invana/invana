CREATE TABLE agents (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	key VARCHAR(64), 
	name VARCHAR(255) NOT NULL, 
	description TEXT DEFAULT ''::text NOT NULL, 
	kind VARCHAR(16) DEFAULT 'authored'::character varying NOT NULL, 
	status VARCHAR(16) DEFAULT 'active'::character varying NOT NULL, 
	workflow_spec JSON DEFAULT '{}'::json NOT NULL, 
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
	soul TEXT DEFAULT ''::text NOT NULL, 
	soul_traits JSON DEFAULT '{}'::json NOT NULL, 
	effort JSON DEFAULT '{}'::json NOT NULL, 
	model_pin VARCHAR(255), 
	instructions_draft TEXT, 
	CONSTRAINT agents_pkey PRIMARY KEY (id), 
	CONSTRAINT agents_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
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

CREATE TABLE alert_rules (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	name VARCHAR(128) NOT NULL, 
	enabled BOOLEAN NOT NULL, 
	match JSON NOT NULL, 
	notify_user_ids JSON NOT NULL, 
	last_fired_at TIMESTAMP WITH TIME ZONE, 
	last_seq INTEGER NOT NULL, 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT alert_rules_pkey PRIMARY KEY (id), 
	CONSTRAINT alert_rules_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_alert_rule_name UNIQUE NULLS DISTINCT (graph_id, name)
);

CREATE INDEX ix_alert_rules_graph_id ON alert_rules (graph_id);

CREATE TABLE annotation_anchors (
	id VARCHAR(36) NOT NULL, 
	annotation_id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	record_id VARCHAR(255) NOT NULL, 
	CONSTRAINT annotation_anchors_pkey PRIMARY KEY (id), 
	CONSTRAINT annotation_anchors_annotation_id_fkey FOREIGN KEY(annotation_id) REFERENCES annotations (id) ON DELETE CASCADE
);

CREATE INDEX ix_annotation_anchors_annotation_id ON annotation_anchors (annotation_id);

CREATE INDEX ix_annotation_anchors_graph_record ON annotation_anchors (graph_id, record_id);

CREATE TABLE annotations (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	records JSON NOT NULL, 
	prop VARCHAR(255), 
	value_then JSON, 
	text TEXT NOT NULL, 
	label VARCHAR(255) NOT NULL, 
	color VARCHAR(16) NOT NULL, 
	author_kind VARCHAR(16) NOT NULL, 
	created_by_id VARCHAR(36), 
	session_id VARCHAR(36), 
	message_id VARCHAR(36), 
	reach VARCHAR(16) NOT NULL, 
	promoted_by_id VARCHAR(36), 
	evidence JSON, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT annotations_pkey PRIMARY KEY (id), 
	CONSTRAINT annotations_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT annotations_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT annotations_message_id_fkey FOREIGN KEY(message_id) REFERENCES session_messages (id) ON DELETE SET NULL, 
	CONSTRAINT annotations_promoted_by_id_fkey FOREIGN KEY(promoted_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT annotations_session_id_fkey FOREIGN KEY(session_id) REFERENCES sessions (id) ON DELETE SET NULL
);

CREATE INDEX ix_annotations_created_by_id ON annotations (created_by_id);

CREATE INDEX ix_annotations_graph_created ON annotations (graph_id, created_at);

CREATE INDEX ix_annotations_session_id ON annotations (session_id);

CREATE TABLE approvals (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	subject_kind VARCHAR(16) NOT NULL, 
	subject_id VARCHAR(36) NOT NULL, 
	run_id VARCHAR(36), 
	schedule_id VARCHAR(36), 
	title VARCHAR(255) NOT NULL, 
	payload JSON NOT NULL, 
	approver_ids JSON NOT NULL, 
	requested_by_id VARCHAR(36), 
	deadline_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	reminded_at TIMESTAMP WITH TIME ZONE, 
	status VARCHAR(16) NOT NULL, 
	decided_by_id VARCHAR(36), 
	decided_at TIMESTAMP WITH TIME ZONE, 
	note TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE, 
	kind VARCHAR(16) DEFAULT 'send'::character varying NOT NULL, 
	asked_by JSON DEFAULT '[]'::json NOT NULL, 
	wants VARCHAR(512) DEFAULT ''::character varying NOT NULL, 
	routed_reason VARCHAR(64) DEFAULT ''::character varying NOT NULL, 
	step_run_id VARCHAR(36), 
	scope VARCHAR(8), 
	CONSTRAINT approvals_pkey PRIMARY KEY (id), 
	CONSTRAINT approvals_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE INDEX ix_approvals_graph_id ON approvals (graph_id);

CREATE INDEX ix_approvals_kind ON approvals (kind);

CREATE INDEX ix_approvals_pending ON approvals (status, deadline_at);

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

CREATE TABLE branch_findings (
	id VARCHAR(36) NOT NULL, 
	branch_id VARCHAR(36) NOT NULL, 
	finding_id VARCHAR(36) NOT NULL, 
	via VARCHAR(8) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT branch_findings_pkey PRIMARY KEY (id), 
	CONSTRAINT branch_findings_branch_id_fkey FOREIGN KEY(branch_id) REFERENCES project_branches (id) ON DELETE CASCADE, 
	CONSTRAINT branch_findings_finding_id_fkey FOREIGN KEY(finding_id) REFERENCES project_findings (id) ON DELETE CASCADE, 
	CONSTRAINT uq_branch_finding UNIQUE NULLS DISTINCT (branch_id, finding_id)
);

CREATE INDEX ix_branch_findings_branch_id ON branch_findings (branch_id);

CREATE INDEX ix_branch_findings_finding_id ON branch_findings (finding_id);

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

CREATE TABLE dataset_bindings (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	model_id VARCHAR(36) NOT NULL, 
	dataset_id VARCHAR(36) NOT NULL, 
	dataset_version_id VARCHAR(36) NOT NULL, 
	type_name VARCHAR(255) NOT NULL, 
	run_id VARCHAR(36), 
	bound_by_id VARCHAR(36), 
	bound_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT dataset_bindings_pkey PRIMARY KEY (id), 
	CONSTRAINT dataset_bindings_bound_by_id_fkey FOREIGN KEY(bound_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT dataset_bindings_dataset_id_fkey FOREIGN KEY(dataset_id) REFERENCES datasets (id) ON DELETE CASCADE, 
	CONSTRAINT dataset_bindings_dataset_version_id_fkey FOREIGN KEY(dataset_version_id) REFERENCES dataset_versions (id) ON DELETE CASCADE, 
	CONSTRAINT dataset_bindings_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT dataset_bindings_model_id_fkey FOREIGN KEY(model_id) REFERENCES graph_models (id) ON DELETE CASCADE, 
	CONSTRAINT dataset_bindings_run_id_fkey FOREIGN KEY(run_id) REFERENCES task_runs (id) ON DELETE SET NULL, 
	CONSTRAINT uq_dataset_binding_target UNIQUE NULLS DISTINCT (graph_id, model_id, dataset_id, type_name)
);

CREATE INDEX ix_dataset_bindings_dataset_id ON dataset_bindings (dataset_id);

CREATE INDEX ix_dataset_bindings_dataset_version_id ON dataset_bindings (dataset_version_id);

CREATE INDEX ix_dataset_bindings_graph_id ON dataset_bindings (graph_id);

CREATE INDEX ix_dataset_bindings_model_id ON dataset_bindings (model_id);

CREATE TABLE dataset_conformance (
	id VARCHAR(36) NOT NULL, 
	dataset_version_id VARCHAR(36) NOT NULL, 
	standard_version_id VARCHAR(36) NOT NULL, 
	mapping JSON NOT NULL, 
	record_count INTEGER NOT NULL, 
	conforming INTEGER NOT NULL, 
	score DOUBLE PRECISION NOT NULL, 
	violation_count INTEGER NOT NULL, 
	violations JSON NOT NULL, 
	checked_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT dataset_conformance_pkey PRIMARY KEY (id), 
	CONSTRAINT dataset_conformance_dataset_version_id_fkey FOREIGN KEY(dataset_version_id) REFERENCES dataset_versions (id) ON DELETE CASCADE, 
	CONSTRAINT dataset_conformance_standard_version_id_fkey FOREIGN KEY(standard_version_id) REFERENCES standard_versions (id) ON DELETE CASCADE, 
	CONSTRAINT uq_dataset_conformance_pair UNIQUE NULLS DISTINCT (dataset_version_id, standard_version_id)
);

CREATE INDEX ix_dataset_conformance_dataset_version_id ON dataset_conformance (dataset_version_id);

CREATE INDEX ix_dataset_conformance_standard_version_id ON dataset_conformance (standard_version_id);

CREATE TABLE dataset_records (
	id VARCHAR(36) NOT NULL, 
	version_id VARCHAR(36) NOT NULL, 
	key VARCHAR(255) NOT NULL, 
	values JSON NOT NULL, 
	provenance JSON, 
	CONSTRAINT dataset_records_pkey PRIMARY KEY (id), 
	CONSTRAINT dataset_records_version_id_fkey FOREIGN KEY(version_id) REFERENCES dataset_versions (id) ON DELETE CASCADE, 
	CONSTRAINT uq_dataset_record_key UNIQUE NULLS DISTINCT (version_id, key)
);

CREATE INDEX ix_dataset_records_version_id ON dataset_records (version_id);

CREATE TABLE dataset_standards (
	id VARCHAR(36) NOT NULL, 
	dataset_id VARCHAR(36) NOT NULL, 
	standard_id VARCHAR(36) NOT NULL, 
	standard_version_id VARCHAR(36) NOT NULL, 
	mode VARCHAR(8) NOT NULL, 
	mapping JSON NOT NULL, 
	attached_by_id VARCHAR(36), 
	attached_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT dataset_standards_pkey PRIMARY KEY (id), 
	CONSTRAINT dataset_standards_attached_by_id_fkey FOREIGN KEY(attached_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT dataset_standards_dataset_id_fkey FOREIGN KEY(dataset_id) REFERENCES datasets (id) ON DELETE CASCADE, 
	CONSTRAINT dataset_standards_standard_id_fkey FOREIGN KEY(standard_id) REFERENCES standards (id) ON DELETE CASCADE, 
	CONSTRAINT dataset_standards_standard_version_id_fkey FOREIGN KEY(standard_version_id) REFERENCES standard_versions (id) ON DELETE CASCADE, 
	CONSTRAINT uq_dataset_standard UNIQUE NULLS DISTINCT (dataset_id, standard_id)
);

CREATE INDEX ix_dataset_standards_dataset_id ON dataset_standards (dataset_id);

CREATE INDEX ix_dataset_standards_standard_id ON dataset_standards (standard_id);

CREATE TABLE dataset_versions (
	id VARCHAR(36) NOT NULL, 
	dataset_id VARCHAR(36) NOT NULL, 
	version INTEGER NOT NULL, 
	content_hash VARCHAR(80) NOT NULL, 
	licence VARCHAR(255) NOT NULL, 
	author_chain JSON NOT NULL, 
	columns JSON NOT NULL, 
	record_count INTEGER NOT NULL, 
	source TEXT, 
	derived_from JSON NOT NULL, 
	why VARCHAR(500), 
	published_by_id VARCHAR(36), 
	published_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	retracted_at TIMESTAMP WITH TIME ZONE, 
	retracted_by_id VARCHAR(36), 
	retraction_reason VARCHAR(500), 
	state VARCHAR(16) DEFAULT 'published'::character varying NOT NULL, 
	CONSTRAINT dataset_versions_pkey PRIMARY KEY (id), 
	CONSTRAINT dataset_versions_dataset_id_fkey FOREIGN KEY(dataset_id) REFERENCES datasets (id) ON DELETE CASCADE, 
	CONSTRAINT dataset_versions_published_by_id_fkey FOREIGN KEY(published_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT dataset_versions_retracted_by_id_fkey FOREIGN KEY(retracted_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT uq_dataset_version_number UNIQUE NULLS DISTINCT (dataset_id, version)
);

CREATE INDEX ix_dataset_versions_content_hash ON dataset_versions (content_hash);

CREATE INDEX ix_dataset_versions_dataset_id ON dataset_versions (dataset_id);

CREATE TABLE datasets (
	id VARCHAR(36) NOT NULL, 
	publisher VARCHAR(63) NOT NULL, 
	name VARCHAR(63) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	origin VARCHAR(16) NOT NULL, 
	key_column VARCHAR(255) NOT NULL, 
	visibility VARCHAR(16) NOT NULL, 
	sensitivity VARCHAR(16) NOT NULL, 
	column_sensitivity JSON NOT NULL, 
	refresh_schedule VARCHAR(128), 
	refresh_source TEXT, 
	current_version_id VARCHAR(36), 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT datasets_pkey PRIMARY KEY (id), 
	CONSTRAINT datasets_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT fk_datasets_current_version FOREIGN KEY(current_version_id) REFERENCES dataset_versions (id) ON DELETE SET NULL, 
	CONSTRAINT uq_dataset_address UNIQUE NULLS DISTINCT (publisher, name)
);

CREATE INDEX ix_datasets_created_by_id ON datasets (created_by_id);

CREATE INDEX ix_datasets_origin ON datasets (origin);

CREATE INDEX ix_datasets_publisher ON datasets (publisher);

CREATE TABLE edge_type_definitions (
	id VARCHAR(36) NOT NULL, 
	version_id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	source_node_types JSON, 
	target_node_types JSON, 
	multiplicity multiplicity_enum NOT NULL, 
	source_iri VARCHAR(2048), 
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

CREATE TABLE envelope_outcomes (
	idempotency_key VARCHAR(160) NOT NULL, 
	run_id VARCHAR(36) NOT NULL, 
	outcome JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT envelope_outcomes_pkey PRIMARY KEY (idempotency_key)
);

CREATE INDEX ix_envelope_outcomes_run_id ON envelope_outcomes (run_id);

CREATE TABLE eval_budgets (
	graph_id VARCHAR(36) NOT NULL, 
	monthly_tokens INTEGER, 
	CONSTRAINT eval_budgets_pkey PRIMARY KEY (graph_id), 
	CONSTRAINT eval_budgets_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE TABLE eval_cases (
	id VARCHAR(36) NOT NULL, 
	eval_set_id VARCHAR(36) NOT NULL, 
	question TEXT NOT NULL, 
	checks JSON NOT NULL, 
	label VARCHAR(16) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	source_run_id VARCHAR(36), 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT eval_cases_pkey PRIMARY KEY (id), 
	CONSTRAINT eval_cases_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT eval_cases_eval_set_id_fkey FOREIGN KEY(eval_set_id) REFERENCES eval_sets (id) ON DELETE CASCADE
);

CREATE INDEX ix_eval_cases_eval_set_id ON eval_cases (eval_set_id);

CREATE TABLE eval_results (
	id VARCHAR(36) NOT NULL, 
	eval_run_id VARCHAR(36) NOT NULL, 
	eval_case_id VARCHAR(36) NOT NULL, 
	case_run_id VARCHAR(36), 
	side VARCHAR(8) NOT NULL, 
	hard JSON NOT NULL, 
	judged DOUBLE PRECISION, 
	tokens INTEGER NOT NULL, 
	latency_ms INTEGER NOT NULL, 
	answer_digest VARCHAR(64) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT eval_results_pkey PRIMARY KEY (id), 
	CONSTRAINT eval_results_case_run_id_fkey FOREIGN KEY(case_run_id) REFERENCES task_runs (id) ON DELETE SET NULL, 
	CONSTRAINT eval_results_eval_case_id_fkey FOREIGN KEY(eval_case_id) REFERENCES eval_cases (id) ON DELETE CASCADE, 
	CONSTRAINT eval_results_eval_run_id_fkey FOREIGN KEY(eval_run_id) REFERENCES task_runs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_eval_result_side UNIQUE NULLS DISTINCT (eval_run_id, eval_case_id, side)
);

CREATE INDEX ix_eval_results_eval_case_id ON eval_results (eval_case_id);

CREATE INDEX ix_eval_results_eval_run_id ON eval_results (eval_run_id);

CREATE TABLE eval_sets (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	subject_kind VARCHAR(16) NOT NULL, 
	subject_id VARCHAR(36) NOT NULL, 
	judge_model_pin VARCHAR(255), 
	rubric TEXT, 
	created_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT eval_sets_pkey PRIMARY KEY (id), 
	CONSTRAINT eval_sets_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_eval_set_subject UNIQUE NULLS DISTINCT (subject_kind, subject_id)
);

CREATE INDEX ix_eval_sets_graph_id ON eval_sets (graph_id);

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
	span_id VARCHAR(16), 
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

CREATE TABLE flows (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	key VARCHAR(64), 
	version INTEGER DEFAULT 1 NOT NULL, 
	name VARCHAR(255) DEFAULT ''::character varying NOT NULL, 
	description TEXT DEFAULT ''::text NOT NULL, 
	kind VARCHAR(16) DEFAULT 'ask'::character varying NOT NULL, 
	origin VARCHAR(16) DEFAULT 'packaged'::character varying NOT NULL, 
	intent JSON NOT NULL, 
	todo_id VARCHAR(36), 
	args_schema JSON NOT NULL, 
	source_skill_version_ids JSON NOT NULL, 
	reusable BOOLEAN DEFAULT true NOT NULL, 
	promoted_from_run_id VARCHAR(36), 
	created_by_kind VARCHAR(16) DEFAULT 'user'::character varying NOT NULL, 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	uses JSON DEFAULT '[]'::json NOT NULL, 
	CONSTRAINT flows_pkey PRIMARY KEY (id), 
	CONSTRAINT flows_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT flows_todo_id_fkey FOREIGN KEY(todo_id) REFERENCES todos (id) ON DELETE CASCADE, 
	CONSTRAINT uq_flow_graph_key_version UNIQUE NULLS DISTINCT (graph_id, key, version)
);

CREATE INDEX ix_flows_graph_id ON flows (graph_id);

CREATE INDEX ix_flows_kind ON flows (kind);

CREATE INDEX ix_flows_origin ON flows (origin);

CREATE INDEX ix_flows_reusable ON flows (reusable);

CREATE INDEX ix_flows_todo_id ON flows (todo_id);

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
	roles JSON DEFAULT '["viewer"]'::json NOT NULL, 
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

CREATE TABLE graph_query_log (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	at TIMESTAMP WITH TIME ZONE NOT NULL, 
	shape_hash VARCHAR(16) NOT NULL, 
	shape_text TEXT NOT NULL, 
	language VARCHAR(16) NOT NULL, 
	caller_kind query_caller_kind_enum NOT NULL, 
	caller_id VARCHAR(64), 
	task_run_id VARCHAR(36), 
	duration_ms DOUBLE PRECISION NOT NULL, 
	rows INTEGER NOT NULL, 
	ok BOOLEAN NOT NULL, 
	types_touched JSON NOT NULL, 
	properties_touched JSON, 
	touched_from query_touched_from_enum NOT NULL, 
	CONSTRAINT graph_query_log_pkey PRIMARY KEY (id), 
	CONSTRAINT graph_query_log_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE INDEX ix_graph_query_log_graph_at ON graph_query_log (graph_id, at);

CREATE INDEX ix_graph_query_log_graph_shape ON graph_query_log (graph_id, shape_hash);

CREATE TABLE graph_versions (
	id VARCHAR(36) NOT NULL, 
	model_id VARCHAR(36) NOT NULL, 
	version VARCHAR(32), 
	status version_status_enum NOT NULL, 
	change_summary TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	activated_at TIMESTAMP WITH TIME ZONE, 
	content_hash VARCHAR(64), 
	axes JSON DEFAULT '{}'::json NOT NULL, 
	affected_datasets JSON DEFAULT '[]'::json NOT NULL, 
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
	pools JSON DEFAULT '{"llm": 20, "graphdb": 50, "heavy": 4}'::json NOT NULL, 
	CONSTRAINT graphs_pkey PRIMARY KEY (id), 
	CONSTRAINT graphs_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE RESTRICT, 
	CONSTRAINT uq_graphs_owner_slug UNIQUE NULLS DISTINCT (created_by_id, slug)
);

CREATE INDEX ix_graphs_created_by_id ON graphs (created_by_id);

CREATE TABLE group_members (
	id VARCHAR(36) NOT NULL, 
	group_id VARCHAR(36) NOT NULL, 
	member_kind VARCHAR(16) NOT NULL, 
	member_id VARCHAR(36) NOT NULL, 
	added_by_id VARCHAR(36), 
	added_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT group_members_pkey PRIMARY KEY (id), 
	CONSTRAINT group_members_added_by_id_fkey FOREIGN KEY(added_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT group_members_group_id_fkey FOREIGN KEY(group_id) REFERENCES groups (id) ON DELETE CASCADE, 
	CONSTRAINT uq_group_members_member UNIQUE NULLS DISTINCT (group_id, member_kind, member_id)
);

CREATE INDEX ix_group_members_group_id ON group_members (group_id);

CREATE INDEX ix_group_members_member_id ON group_members (member_id);

CREATE TABLE groups (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	name VARCHAR(64) NOT NULL, 
	description TEXT DEFAULT ''::text NOT NULL, 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT groups_pkey PRIMARY KEY (id), 
	CONSTRAINT groups_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT groups_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_groups_graph_name UNIQUE NULLS DISTINCT (graph_id, name)
);

CREATE INDEX ix_groups_graph_id ON groups (graph_id);

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

CREATE TABLE ledger_checks (
	graph_id VARCHAR(36) NOT NULL, 
	verified_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	ok BOOLEAN NOT NULL, 
	last_seq BIGINT NOT NULL, 
	broken_seq BIGINT, 
	CONSTRAINT ledger_checks_pkey PRIMARY KEY (graph_id), 
	CONSTRAINT ledger_checks_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE TABLE ledger_exports (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	requested_by_id VARCHAR(36), 
	filters JSON NOT NULL, 
	format VARCHAR(8) NOT NULL, 
	rows INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT ledger_exports_pkey PRIMARY KEY (id), 
	CONSTRAINT ledger_exports_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE INDEX ix_ledger_exports_graph_id ON ledger_exports (graph_id);

CREATE TABLE ledger_rows (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	seq BIGINT NOT NULL, 
	at TIMESTAMP WITH TIME ZONE NOT NULL, 
	actor_kind VARCHAR(16) NOT NULL, 
	actor_user_id VARCHAR(36), 
	actor_agent_id VARCHAR(36), 
	actor_chain JSON NOT NULL, 
	act VARCHAR(128) NOT NULL, 
	layer VARCHAR(16) NOT NULL, 
	touched VARCHAR(512) NOT NULL, 
	touched_line VARCHAR(255) NOT NULL, 
	verdict VARCHAR(16) NOT NULL, 
	refused_by VARCHAR(16), 
	rule VARCHAR(512) NOT NULL, 
	run_id VARCHAR(36), 
	step_run_id VARCHAR(36), 
	run_number INTEGER, 
	"where" VARCHAR(128) NOT NULL, 
	args JSON NOT NULL, 
	hash VARCHAR(64) NOT NULL, 
	prev_hash VARCHAR(64) NOT NULL, 
	CONSTRAINT ledger_rows_pkey PRIMARY KEY (id), 
	CONSTRAINT ledger_rows_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_ledger_rows_graph_seq UNIQUE NULLS DISTINCT (graph_id, seq)
);

CREATE INDEX ix_ledger_rows_actor_agent_id ON ledger_rows (actor_agent_id);

CREATE INDEX ix_ledger_rows_actor_user_id ON ledger_rows (actor_user_id);

CREATE INDEX ix_ledger_rows_graph_at ON ledger_rows (graph_id, at);

CREATE INDEX ix_ledger_rows_run ON ledger_rows (run_id);

CREATE INDEX ix_ledger_rows_touched ON ledger_rows (graph_id, touched);

CREATE TABLE lenses (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	kind VARCHAR(16) DEFAULT 'world'::character varying NOT NULL, 
	key VARCHAR(128), 
	name VARCHAR(255), 
	scope VARCHAR(64), 
	rules JSON DEFAULT '[]'::json NOT NULL, 
	"cast" JSON DEFAULT '{}'::json NOT NULL, 
	closed_layers JSON DEFAULT '[]'::json NOT NULL, 
	as_of TIMESTAMP WITH TIME ZONE, 
	created_in_run_id VARCHAR(36), 
	created_by_id VARCHAR(36), 
	version INTEGER DEFAULT 1 NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	target VARCHAR(255), 
	access VARCHAR(8), 
	leaves BOOLEAN, 
	allowed_in JSON DEFAULT '[]'::json NOT NULL, 
	CONSTRAINT lenses_pkey PRIMARY KEY (id), 
	CONSTRAINT lenses_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT lenses_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_lens_graph_key UNIQUE NULLS DISTINCT (graph_id, key), 
	CONSTRAINT ck_lens_graph_guardrail_rule CHECK (kind::text <> 'guardrail'::text OR scope::text <> 'graph'::text OR target IS NOT NULL AND access IS NOT NULL AND leaves IS NOT NULL), 
	CONSTRAINT ck_lens_kind_shape CHECK (kind::text = 'guardrail'::text AND scope IS NOT NULL AND key IS NOT NULL OR kind::text = 'world'::text AND scope IS NULL)
);

CREATE INDEX ix_lens_graph_kind ON lenses (graph_id, kind);

CREATE INDEX ix_lenses_created_in_run_id ON lenses (created_in_run_id);

CREATE INDEX ix_lenses_graph_id ON lenses (graph_id);

CREATE TABLE llm_models (
	id VARCHAR(36) NOT NULL, 
	provider_id VARCHAR(36) NOT NULL, 
	model_id VARCHAR(255) NOT NULL, 
	display_name VARCHAR(255), 
	capabilities JSON DEFAULT '{}'::json NOT NULL, 
	pricing JSON DEFAULT '{}'::json NOT NULL, 
	status VARCHAR(16) DEFAULT 'active'::character varying NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT llm_models_pkey PRIMARY KEY (id), 
	CONSTRAINT llm_models_provider_id_fkey FOREIGN KEY(provider_id) REFERENCES llm_providers (id) ON DELETE CASCADE, 
	CONSTRAINT uq_llm_model_provider_model UNIQUE NULLS DISTINCT (provider_id, model_id)
);

CREATE INDEX ix_llm_models_provider_id ON llm_models (provider_id);

CREATE TABLE llm_providers (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	provider llm_provider_kind NOT NULL, 
	api_key_encrypted BYTEA, 
	base_url VARCHAR(2048), 
	guardrails JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	credential_kind llm_credential_kind, 
	last_ping_at TIMESTAMP WITH TIME ZONE, 
	last_ping_ok BOOLEAN, 
	last_ping_error TEXT, 
	name VARCHAR(64) NOT NULL, 
	CONSTRAINT llm_providers_pkey PRIMARY KEY (id), 
	CONSTRAINT llm_providers_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_llm_provider_graph_name UNIQUE NULLS DISTINCT (graph_id, name)
);

CREATE INDEX ix_llm_providers_graph_id ON llm_providers (graph_id);

CREATE TABLE mcp_served (
	graph_id VARCHAR(36) NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	ref VARCHAR(64) NOT NULL, 
	served BOOLEAN DEFAULT false NOT NULL, 
	changed_by_id VARCHAR(36), 
	changed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT mcp_served_pkey PRIMARY KEY (graph_id, kind, ref), 
	CONSTRAINT mcp_served_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE TABLE mcp_servers (
	name VARCHAR(32) NOT NULL, 
	url VARCHAR(2048) NOT NULL, 
	revision INTEGER NOT NULL, 
	tools JSON NOT NULL, 
	skipped JSON NOT NULL, 
	server JSON NOT NULL, 
	frozen_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	added_by_id VARCHAR(36), 
	CONSTRAINT mcp_servers_pkey PRIMARY KEY (name)
);

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
	edges INTEGER, 
	CONSTRAINT model_links_pkey PRIMARY KEY (id), 
	CONSTRAINT model_links_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT model_links_source_version_id_fkey FOREIGN KEY(source_version_id) REFERENCES graph_versions (id) ON DELETE CASCADE, 
	CONSTRAINT model_links_target_version_id_fkey FOREIGN KEY(target_version_id) REFERENCES graph_versions (id) ON DELETE CASCADE, 
	CONSTRAINT uq_model_link UNIQUE NULLS DISTINCT (graph_id, kind, source_version_id, source_type, target_version_id, target_type, edge_type)
);

CREATE INDEX ix_model_links_graph_id ON model_links (graph_id);

CREATE TABLE model_publish_reviews (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	model_id VARCHAR(36) NOT NULL, 
	version_id VARCHAR(36) NOT NULL, 
	base_version_id VARCHAR(36), 
	draft_hash VARCHAR(64) NOT NULL, 
	classification VARCHAR(16) NOT NULL, 
	changes JSON NOT NULL, 
	preview JSON, 
	result JSON, 
	why TEXT NOT NULL, 
	approver_ids JSON NOT NULL, 
	deadline_s INTEGER NOT NULL, 
	requested_by_id VARCHAR(36), 
	approval_id VARCHAR(36), 
	preview_run_id VARCHAR(36), 
	run_id VARCHAR(36), 
	published_version VARCHAR(32), 
	status VARCHAR(16) NOT NULL, 
	reason TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT model_publish_reviews_pkey PRIMARY KEY (id), 
	CONSTRAINT model_publish_reviews_base_version_id_fkey FOREIGN KEY(base_version_id) REFERENCES graph_versions (id) ON DELETE SET NULL, 
	CONSTRAINT model_publish_reviews_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT model_publish_reviews_model_id_fkey FOREIGN KEY(model_id) REFERENCES graph_models (id) ON DELETE CASCADE, 
	CONSTRAINT model_publish_reviews_preview_run_id_fkey FOREIGN KEY(preview_run_id) REFERENCES task_runs (id) ON DELETE SET NULL, 
	CONSTRAINT model_publish_reviews_requested_by_id_fkey FOREIGN KEY(requested_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT model_publish_reviews_run_id_fkey FOREIGN KEY(run_id) REFERENCES task_runs (id) ON DELETE SET NULL, 
	CONSTRAINT model_publish_reviews_version_id_fkey FOREIGN KEY(version_id) REFERENCES graph_versions (id) ON DELETE CASCADE
);

CREATE INDEX ix_model_publish_reviews_approval_id ON model_publish_reviews (approval_id);

CREATE INDEX ix_model_publish_reviews_graph_id ON model_publish_reviews (graph_id);

CREATE INDEX ix_model_publish_reviews_model_id ON model_publish_reviews (model_id);

CREATE INDEX ix_model_publish_reviews_status ON model_publish_reviews (status);

CREATE TABLE node_type_definitions (
	id VARCHAR(36) NOT NULL, 
	version_id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	parent_type VARCHAR(255), 
	is_abstract BOOLEAN NOT NULL, 
	validation_mode VARCHAR(16), 
	source_iri VARCHAR(2048), 
	CONSTRAINT node_type_definitions_pkey PRIMARY KEY (id), 
	CONSTRAINT node_type_definitions_version_id_fkey FOREIGN KEY(version_id) REFERENCES graph_versions (id) ON DELETE CASCADE, 
	CONSTRAINT uq_version_node_type UNIQUE NULLS DISTINCT (version_id, name)
);

CREATE TABLE notification_channels (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	name VARCHAR(128) NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	target VARCHAR(512) NOT NULL, 
	secret_encrypted BYTEA, 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT notification_channels_pkey PRIMARY KEY (id), 
	CONSTRAINT notification_channels_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_notification_channel_name UNIQUE NULLS DISTINCT (graph_id, name)
);

CREATE INDEX ix_notification_channels_graph_id ON notification_channels (graph_id);

CREATE TABLE notification_cursors (
	name VARCHAR(32) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	event_id VARCHAR(36) NOT NULL, 
	CONSTRAINT notification_cursors_pkey PRIMARY KEY (name)
);

CREATE TABLE notification_deliveries (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	channel_id VARCHAR(36), 
	rule_id VARCHAR(36), 
	event_id VARCHAR(36), 
	firing_id VARCHAR(36), 
	approval_id VARCHAR(36), 
	status VARCHAR(16) NOT NULL, 
	payload JSON NOT NULL, 
	attempts INTEGER NOT NULL, 
	error TEXT NOT NULL, 
	sent_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT notification_deliveries_pkey PRIMARY KEY (id), 
	CONSTRAINT notification_deliveries_channel_id_fkey FOREIGN KEY(channel_id) REFERENCES notification_channels (id) ON DELETE SET NULL, 
	CONSTRAINT notification_deliveries_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_delivery_event_rule UNIQUE NULLS DISTINCT (channel_id, event_id, rule_id)
);

CREATE INDEX ix_notification_deliveries_approval_id ON notification_deliveries (approval_id);

CREATE INDEX ix_notification_deliveries_channel_id ON notification_deliveries (channel_id);

CREATE INDEX ix_notification_deliveries_firing_id ON notification_deliveries (firing_id);

CREATE INDEX ix_notification_deliveries_status ON notification_deliveries (status, created_at);

CREATE TABLE notification_rules (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	name VARCHAR(128) NOT NULL, 
	events JSON NOT NULL, 
	match JSON NOT NULL, 
	member_ids JSON NOT NULL, 
	roles JSON NOT NULL, 
	requester BOOLEAN NOT NULL, 
	in_app BOOLEAN NOT NULL, 
	channel_ids JSON NOT NULL, 
	enabled BOOLEAN NOT NULL, 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT notification_rules_pkey PRIMARY KEY (id), 
	CONSTRAINT notification_rules_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_notification_rule_name UNIQUE NULLS DISTINCT (graph_id, name)
);

CREATE INDEX ix_notification_rules_graph_id ON notification_rules (graph_id);

CREATE TABLE notifications (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	body TEXT NOT NULL, 
	event_id VARCHAR(36), 
	rule_id VARCHAR(36), 
	approval_id VARCHAR(36), 
	schedule_id VARCHAR(36), 
	run_id VARCHAR(36), 
	target_kind VARCHAR(32), 
	target_id VARCHAR(36), 
	read_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT notifications_pkey PRIMARY KEY (id), 
	CONSTRAINT notifications_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT notifications_user_id_fkey FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	CONSTRAINT uq_notification_event_rule UNIQUE NULLS DISTINCT (user_id, event_id, rule_id)
);

CREATE INDEX ix_notifications_inbox ON notifications (graph_id, user_id, created_at);

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
	graph_id VARCHAR(36), 
	policy_id VARCHAR(36), 
	created_by_id VARCHAR(36), 
	worker_pool_id VARCHAR(36), 
	join_cap INTEGER, 
	joins INTEGER DEFAULT 0 NOT NULL, 
	CONSTRAINT personal_access_tokens_pkey PRIMARY KEY (id), 
	CONSTRAINT fk_pat_created_by FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT fk_pat_graph FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT personal_access_tokens_user_id_fkey FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	CONSTRAINT uq_pat_user_name UNIQUE NULLS DISTINCT (user_id, name)
);

CREATE INDEX ix_personal_access_tokens_graph_id ON personal_access_tokens (graph_id);

CREATE UNIQUE INDEX ix_personal_access_tokens_token_hash ON personal_access_tokens (token_hash);

CREATE INDEX ix_personal_access_tokens_user_id ON personal_access_tokens (user_id);

CREATE INDEX ix_personal_access_tokens_worker_pool_id ON personal_access_tokens (worker_pool_id);

CREATE TABLE plugin_states (
	name VARCHAR(128) NOT NULL, 
	enabled BOOLEAN NOT NULL, 
	changed_by_id VARCHAR(36), 
	changed_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT plugin_states_pkey PRIMARY KEY (name)
);

CREATE TABLE policies (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	name VARCHAR(64) NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	description TEXT DEFAULT ''::text NOT NULL, 
	statements JSON NOT NULL, 
	limits JSON NOT NULL, 
	version INTEGER DEFAULT 0 NOT NULL, 
	owner_id VARCHAR(36), 
	drafted_by VARCHAR(16) DEFAULT 'person'::character varying NOT NULL, 
	created_by_id VARCHAR(36), 
	updated_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT policies_pkey PRIMARY KEY (id), 
	CONSTRAINT policies_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT policies_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT policies_owner_id_fkey FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT policies_updated_by_id_fkey FOREIGN KEY(updated_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT uq_policies_graph_name UNIQUE NULLS DISTINCT (graph_id, name)
);

CREATE INDEX ix_policies_graph_id ON policies (graph_id);

CREATE INDEX ix_policies_kind ON policies (kind);

CREATE TABLE policy_attachments (
	id VARCHAR(36) NOT NULL, 
	policy_id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	holder_kind VARCHAR(16) NOT NULL, 
	holder_id VARCHAR(36) NOT NULL, 
	attached_by_id VARCHAR(36), 
	attached_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	ends_at TIMESTAMP WITH TIME ZONE, 
	run_id VARCHAR(36), 
	via VARCHAR(16) DEFAULT 'direct'::character varying NOT NULL, 
	approval_id VARCHAR(36), 
	CONSTRAINT policy_attachments_pkey PRIMARY KEY (id), 
	CONSTRAINT policy_attachments_attached_by_id_fkey FOREIGN KEY(attached_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT policy_attachments_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT policy_attachments_policy_id_fkey FOREIGN KEY(policy_id) REFERENCES policies (id) ON DELETE CASCADE, 
	CONSTRAINT uq_policy_attachments_holder UNIQUE NULLS DISTINCT (policy_id, holder_kind, holder_id)
);

CREATE INDEX ix_policy_attachments_graph_id ON policy_attachments (graph_id);

CREATE INDEX ix_policy_attachments_holder_id ON policy_attachments (holder_id);

CREATE INDEX ix_policy_attachments_policy_id ON policy_attachments (policy_id);

CREATE TABLE policy_versions (
	id VARCHAR(36) NOT NULL, 
	policy_id VARCHAR(36) NOT NULL, 
	version INTEGER NOT NULL, 
	statements JSON NOT NULL, 
	limits JSON NOT NULL, 
	description TEXT DEFAULT ''::text NOT NULL, 
	saved_by_id VARCHAR(36), 
	saved_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	why VARCHAR(500), 
	CONSTRAINT policy_versions_pkey PRIMARY KEY (id), 
	CONSTRAINT policy_versions_policy_id_fkey FOREIGN KEY(policy_id) REFERENCES policies (id) ON DELETE CASCADE, 
	CONSTRAINT policy_versions_saved_by_id_fkey FOREIGN KEY(saved_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT uq_policy_versions_number UNIQUE NULLS DISTINCT (policy_id, version)
);

CREATE INDEX ix_policy_versions_policy_id ON policy_versions (policy_id);

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

CREATE TABLE project_branches (
	id VARCHAR(36) NOT NULL, 
	project_id VARCHAR(36) NOT NULL, 
	number INTEGER NOT NULL, 
	parent_id VARCHAR(36), 
	title VARCHAR(500) NOT NULL, 
	body TEXT NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	merged_into_id VARCHAR(36), 
	created_by_kind VARCHAR(16) NOT NULL, 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT project_branches_pkey PRIMARY KEY (id), 
	CONSTRAINT project_branches_merged_into_id_fkey FOREIGN KEY(merged_into_id) REFERENCES project_branches (id) ON DELETE SET NULL, 
	CONSTRAINT project_branches_parent_id_fkey FOREIGN KEY(parent_id) REFERENCES project_branches (id) ON DELETE CASCADE, 
	CONSTRAINT project_branches_project_id_fkey FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	CONSTRAINT uq_project_branch_number UNIQUE NULLS DISTINCT (project_id, number)
);

CREATE INDEX ix_project_branches_parent_id ON project_branches (parent_id);

CREATE INDEX ix_project_branches_project_id ON project_branches (project_id);

CREATE TABLE project_decisions (
	id VARCHAR(36) NOT NULL, 
	project_id VARCHAR(36) NOT NULL, 
	branch_id VARCHAR(36) NOT NULL, 
	number INTEGER NOT NULL, 
	verdict VARCHAR(16) NOT NULL, 
	choice VARCHAR(16) NOT NULL, 
	rationale TEXT NOT NULL, 
	cites JSON NOT NULL, 
	addresses JSON NOT NULL, 
	into_branch_id VARCHAR(36), 
	supersedes_id VARCHAR(36), 
	checks JSON NOT NULL, 
	warnings JSON NOT NULL, 
	decided_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT project_decisions_pkey PRIMARY KEY (id), 
	CONSTRAINT project_decisions_branch_id_fkey FOREIGN KEY(branch_id) REFERENCES project_branches (id) ON DELETE CASCADE, 
	CONSTRAINT project_decisions_decided_by_id_fkey FOREIGN KEY(decided_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT project_decisions_into_branch_id_fkey FOREIGN KEY(into_branch_id) REFERENCES project_branches (id) ON DELETE SET NULL, 
	CONSTRAINT project_decisions_project_id_fkey FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	CONSTRAINT project_decisions_supersedes_id_fkey FOREIGN KEY(supersedes_id) REFERENCES project_decisions (id) ON DELETE SET NULL, 
	CONSTRAINT project_decisions_supersedes_id_key UNIQUE NULLS DISTINCT (supersedes_id), 
	CONSTRAINT uq_project_decision_number UNIQUE NULLS DISTINCT (project_id, number)
);

CREATE INDEX ix_project_decisions_branch_id ON project_decisions (branch_id);

CREATE INDEX ix_project_decisions_project_id ON project_decisions (project_id);

CREATE TABLE project_findings (
	id VARCHAR(36) NOT NULL, 
	project_id VARCHAR(36) NOT NULL, 
	branch_id VARCHAR(36) NOT NULL, 
	number INTEGER NOT NULL, 
	statement TEXT NOT NULL, 
	stance VARCHAR(16) NOT NULL, 
	cites JSON NOT NULL, 
	added_by_kind VARCHAR(16) NOT NULL, 
	added_by_id VARCHAR(36), 
	reviewed_by_id VARCHAR(36), 
	reviewed_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT project_findings_pkey PRIMARY KEY (id), 
	CONSTRAINT project_findings_branch_id_fkey FOREIGN KEY(branch_id) REFERENCES project_branches (id) ON DELETE CASCADE, 
	CONSTRAINT project_findings_project_id_fkey FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	CONSTRAINT project_findings_reviewed_by_id_fkey FOREIGN KEY(reviewed_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT uq_project_finding_number UNIQUE NULLS DISTINCT (project_id, number)
);

CREATE INDEX ix_project_findings_branch_id ON project_findings (branch_id);

CREATE INDEX ix_project_findings_project_id ON project_findings (project_id);

CREATE TABLE project_proposals (
	id VARCHAR(36) NOT NULL, 
	project_id VARCHAR(36) NOT NULL, 
	branch_id VARCHAR(36) NOT NULL, 
	number INTEGER NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	payload JSON NOT NULL, 
	rationale TEXT NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	agent_id VARCHAR(36), 
	submitted_by_id VARCHAR(36), 
	resolved_by_id VARCHAR(36), 
	resolved_at TIMESTAMP WITH TIME ZONE, 
	note TEXT NOT NULL, 
	result JSON, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT project_proposals_pkey PRIMARY KEY (id), 
	CONSTRAINT project_proposals_agent_id_fkey FOREIGN KEY(agent_id) REFERENCES agents (id) ON DELETE SET NULL, 
	CONSTRAINT project_proposals_branch_id_fkey FOREIGN KEY(branch_id) REFERENCES project_branches (id) ON DELETE CASCADE, 
	CONSTRAINT project_proposals_project_id_fkey FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	CONSTRAINT project_proposals_resolved_by_id_fkey FOREIGN KEY(resolved_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT uq_project_proposal_number UNIQUE NULLS DISTINCT (project_id, number)
);

CREATE INDEX ix_project_proposals_branch_id ON project_proposals (branch_id);

CREATE INDEX ix_project_proposals_project_id ON project_proposals (project_id);

CREATE INDEX ix_project_proposals_status ON project_proposals (status);

CREATE TABLE project_report_versions (
	id VARCHAR(36) NOT NULL, 
	report_id VARCHAR(36) NOT NULL, 
	version INTEGER NOT NULL, 
	body TEXT NOT NULL, 
	cites JSON NOT NULL, 
	published_by_id VARCHAR(36), 
	published_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT project_report_versions_pkey PRIMARY KEY (id), 
	CONSTRAINT project_report_versions_published_by_id_fkey FOREIGN KEY(published_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT project_report_versions_report_id_fkey FOREIGN KEY(report_id) REFERENCES project_reports (id) ON DELETE CASCADE, 
	CONSTRAINT uq_project_report_version UNIQUE NULLS DISTINCT (report_id, version)
);

CREATE INDEX ix_project_report_versions_report_id ON project_report_versions (report_id);

CREATE TABLE project_reports (
	id VARCHAR(36) NOT NULL, 
	project_id VARCHAR(36) NOT NULL, 
	draft TEXT NOT NULL, 
	draft_updated_by_id VARCHAR(36), 
	draft_updated_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT project_reports_pkey PRIMARY KEY (id), 
	CONSTRAINT project_reports_draft_updated_by_id_fkey FOREIGN KEY(draft_updated_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT project_reports_project_id_fkey FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	CONSTRAINT project_reports_project_id_key UNIQUE NULLS DISTINCT (project_id)
);

CREATE TABLE project_simulations (
	id VARCHAR(36) NOT NULL, 
	project_id VARCHAR(36) NOT NULL, 
	branch_id VARCHAR(36) NOT NULL, 
	number INTEGER NOT NULL, 
	simulator VARCHAR(64) NOT NULL, 
	simulator_version VARCHAR(32) NOT NULL, 
	plugin VARCHAR(128) NOT NULL, 
	plugin_version VARCHAR(32) NOT NULL, 
	spec JSON NOT NULL, 
	seed BIGINT NOT NULL, 
	inputs JSON NOT NULL, 
	run_id VARCHAR(36), 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT project_simulations_pkey PRIMARY KEY (id), 
	CONSTRAINT project_simulations_branch_id_fkey FOREIGN KEY(branch_id) REFERENCES project_branches (id) ON DELETE CASCADE, 
	CONSTRAINT project_simulations_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT project_simulations_project_id_fkey FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	CONSTRAINT project_simulations_run_id_fkey FOREIGN KEY(run_id) REFERENCES task_runs (id) ON DELETE SET NULL, 
	CONSTRAINT uq_project_simulation_number UNIQUE NULLS DISTINCT (project_id, number)
);

CREATE INDEX ix_project_simulations_branch_id ON project_simulations (branch_id);

CREATE INDEX ix_project_simulations_project_id ON project_simulations (project_id);

CREATE INDEX ix_project_simulations_run_id ON project_simulations (run_id);

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
	type VARCHAR(16) DEFAULT 'general'::character varying NOT NULL, 
	question TEXT DEFAULT ''::text NOT NULL, 
	visibility VARCHAR(16) DEFAULT 'graph'::character varying NOT NULL, 
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
	source_iri VARCHAR(2048), 
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

CREATE TABLE requests (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	title VARCHAR(512) NOT NULL, 
	detail TEXT, 
	source VARCHAR(16) NOT NULL, 
	asked_by_id VARCHAR(36), 
	agent_id VARCHAR(36), 
	run_id VARCHAR(36), 
	session_id VARCHAR(36), 
	guardrail_id VARCHAR(36), 
	blocked_by VARCHAR(255), 
	asks INTEGER NOT NULL, 
	last_asked_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	status VARCHAR(8) NOT NULL, 
	resolution VARCHAR(16), 
	resolution_note VARCHAR(512), 
	world_id VARCHAR(36), 
	model_id VARCHAR(36), 
	resolved_by_id VARCHAR(36), 
	resolved_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT requests_pkey PRIMARY KEY (id), 
	CONSTRAINT requests_asked_by_id_fkey FOREIGN KEY(asked_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT requests_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT requests_guardrail_id_fkey FOREIGN KEY(guardrail_id) REFERENCES lenses (id) ON DELETE SET NULL, 
	CONSTRAINT requests_model_id_fkey FOREIGN KEY(model_id) REFERENCES graph_models (id) ON DELETE SET NULL, 
	CONSTRAINT requests_resolved_by_id_fkey FOREIGN KEY(resolved_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT requests_world_id_fkey FOREIGN KEY(world_id) REFERENCES lenses (id) ON DELETE SET NULL
);

CREATE INDEX ix_requests_graph_id ON requests (graph_id);

CREATE INDEX ix_requests_graph_status ON requests (graph_id, status);

CREATE INDEX ix_requests_guardrail ON requests (guardrail_id);

CREATE TABLE rule_versions (
	id VARCHAR(36) NOT NULL, 
	rule_id VARCHAR(36) NOT NULL, 
	version INTEGER NOT NULL, 
	statement TEXT DEFAULT ''::text NOT NULL, 
	published_by_id VARCHAR(36), 
	published_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	"check" JSON, 
	mode VARCHAR(8), 
	CONSTRAINT rule_versions_pkey PRIMARY KEY (id), 
	CONSTRAINT rule_versions_published_by_id_fkey FOREIGN KEY(published_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT rule_versions_rule_id_fkey FOREIGN KEY(rule_id) REFERENCES rules (id) ON DELETE CASCADE, 
	CONSTRAINT uq_rule_version_number UNIQUE NULLS DISTINCT (rule_id, version)
);

CREATE INDEX ix_rule_versions_rule_id ON rule_versions (rule_id);

CREATE TABLE rules (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36), 
	project_id VARCHAR(36), 
	active BOOLEAN DEFAULT true NOT NULL, 
	"order" INTEGER DEFAULT 0 NOT NULL, 
	current_version_id VARCHAR(36), 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT rules_pkey PRIMARY KEY (id), 
	CONSTRAINT fk_rules_current_version FOREIGN KEY(current_version_id) REFERENCES rule_versions (id) ON DELETE SET NULL, 
	CONSTRAINT rules_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT rules_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT rules_project_id_fkey FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
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
	volume JSON DEFAULT '{}'::json NOT NULL, 
	applied JSON DEFAULT '{}'::json NOT NULL, 
	sent JSON DEFAULT '{}'::json NOT NULL, 
	query JSON DEFAULT '{}'::json NOT NULL, 
	cost_usd DOUBLE PRECISION, 
	duration_ms INTEGER, 
	at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT run_touches_pkey PRIMARY KEY (id), 
	CONSTRAINT run_touches_run_id_fkey FOREIGN KEY(run_id) REFERENCES task_runs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_run_touch_seq UNIQUE NULLS DISTINCT (run_id, seq)
);

CREATE INDEX ix_run_touch_graph_address ON run_touches (graph_id, address);

CREATE INDEX ix_run_touch_run_direction ON run_touches (run_id, direction);

CREATE INDEX ix_run_touches_address ON run_touches (address);

CREATE INDEX ix_run_touches_graph_id ON run_touches (graph_id);

CREATE INDEX ix_run_touches_run_id ON run_touches (run_id);

CREATE TABLE schedule_firings (
	id VARCHAR(36) NOT NULL, 
	schedule_id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	due_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	fired_at TIMESTAMP WITH TIME ZONE, 
	outcome VARCHAR(16) NOT NULL, 
	catch_up BOOLEAN NOT NULL, 
	manual BOOLEAN NOT NULL, 
	run_id VARCHAR(36), 
	reason VARCHAR(255) NOT NULL, 
	delivered_at TIMESTAMP WITH TIME ZONE, 
	actor_id VARCHAR(36), 
	CONSTRAINT schedule_firings_pkey PRIMARY KEY (id), 
	CONSTRAINT schedule_firings_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT schedule_firings_run_id_fkey FOREIGN KEY(run_id) REFERENCES task_runs (id) ON DELETE SET NULL, 
	CONSTRAINT schedule_firings_schedule_id_fkey FOREIGN KEY(schedule_id) REFERENCES schedules (id) ON DELETE CASCADE, 
	CONSTRAINT uq_schedule_firing_due UNIQUE NULLS DISTINCT (schedule_id, due_at)
);

CREATE INDEX ix_schedule_firings_graph_id ON schedule_firings (graph_id);

CREATE INDEX ix_schedule_firings_schedule_id ON schedule_firings (schedule_id);

CREATE TABLE schedules (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	name VARCHAR(128) NOT NULL, 
	agent_id VARCHAR(36), 
	instructions TEXT NOT NULL, 
	cron VARCHAR(128) NOT NULL, 
	timezone VARCHAR(64) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	missed VARCHAR(16) NOT NULL, 
	overlap VARCHAR(16) NOT NULL, 
	deliver_in_app BOOLEAN NOT NULL, 
	recipient_ids JSON NOT NULL, 
	channel_ids JSON NOT NULL, 
	approve_outward BOOLEAN NOT NULL, 
	approver_ids JSON NOT NULL, 
	approval_deadline_s INTEGER NOT NULL, 
	next_fire_at TIMESTAMP WITH TIME ZONE, 
	owner_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT schedules_pkey PRIMARY KEY (id), 
	CONSTRAINT schedules_agent_id_fkey FOREIGN KEY(agent_id) REFERENCES agents (id) ON DELETE SET NULL, 
	CONSTRAINT schedules_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT schedules_owner_id_fkey FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT uq_schedule_name UNIQUE NULLS DISTINCT (graph_id, name)
);

CREATE INDEX ix_schedules_due ON schedules (status, next_fire_at);

CREATE INDEX ix_schedules_graph_id ON schedules (graph_id);

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
	canvas_query TEXT, 
	clarification_descriptions JSON, 
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
	lens_id VARCHAR(36), 
	max_cost_usd_run DOUBLE PRECISION, 
	max_tokens_run INTEGER, 
	CONSTRAINT sessions_pkey PRIMARY KEY (id), 
	CONSTRAINT fk_sessions_model_id FOREIGN KEY(model_id) REFERENCES graph_models (id) ON DELETE SET NULL, 
	CONSTRAINT sessions_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE CASCADE, 
	CONSTRAINT sessions_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE INDEX ix_sessions_created_by_id ON sessions (created_by_id);

CREATE INDEX ix_sessions_graph_id ON sessions (graph_id);

CREATE INDEX ix_sessions_graph_user_surface ON sessions (graph_id, created_by_id, surface);

CREATE INDEX ix_sessions_model_id ON sessions (model_id);

CREATE TABLE skill_bindings (
	id VARCHAR(36) NOT NULL, 
	skill_id VARCHAR(36) NOT NULL, 
	agent_id VARCHAR(36) NOT NULL, 
	bound_by_id VARCHAR(36), 
	bound_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT skill_bindings_pkey PRIMARY KEY (id), 
	CONSTRAINT skill_bindings_agent_id_fkey FOREIGN KEY(agent_id) REFERENCES agents (id) ON DELETE CASCADE, 
	CONSTRAINT skill_bindings_bound_by_id_fkey FOREIGN KEY(bound_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT skill_bindings_skill_id_fkey FOREIGN KEY(skill_id) REFERENCES skills (id) ON DELETE CASCADE, 
	CONSTRAINT uq_skill_binding UNIQUE NULLS DISTINCT (skill_id, agent_id)
);

CREATE INDEX ix_skill_bindings_agent_id ON skill_bindings (agent_id);

CREATE INDEX ix_skill_bindings_skill_id ON skill_bindings (skill_id);

CREATE TABLE skill_version_clarifications (
	id VARCHAR(36) NOT NULL, 
	skill_version_id VARCHAR(36) NOT NULL, 
	span TEXT NOT NULL, 
	question TEXT DEFAULT ''::text NOT NULL, 
	options JSON NOT NULL, 
	answer TEXT, 
	answered_by_id VARCHAR(36), 
	answered_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT skill_version_clarifications_pkey PRIMARY KEY (id), 
	CONSTRAINT skill_version_clarifications_answered_by_id_fkey FOREIGN KEY(answered_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT skill_version_clarifications_skill_version_id_fkey FOREIGN KEY(skill_version_id) REFERENCES skill_versions (id) ON DELETE CASCADE
);

CREATE INDEX ix_skill_version_clarifications_version ON skill_version_clarifications (skill_version_id);

CREATE TABLE skill_versions (
	id VARCHAR(36) NOT NULL, 
	skill_id VARCHAR(36) NOT NULL, 
	version INTEGER NOT NULL, 
	description TEXT DEFAULT ''::text NOT NULL, 
	content TEXT DEFAULT ''::text NOT NULL, 
	when_to_use TEXT DEFAULT ''::text NOT NULL, 
	published_by_id VARCHAR(36), 
	published_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	plan_id VARCHAR(36) NOT NULL, 
	restored_from_version INTEGER, 
	model_pin VARCHAR(255), 
	drawn_digest VARCHAR(64), 
	CONSTRAINT skill_versions_pkey PRIMARY KEY (id), 
	CONSTRAINT fk_skill_versions_plan FOREIGN KEY(plan_id) REFERENCES flows (id) ON DELETE RESTRICT, 
	CONSTRAINT skill_versions_published_by_id_fkey FOREIGN KEY(published_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT skill_versions_skill_id_fkey FOREIGN KEY(skill_id) REFERENCES skills (id) ON DELETE CASCADE, 
	CONSTRAINT uq_skill_version_number UNIQUE NULLS DISTINCT (skill_id, version), 
	CONSTRAINT uq_skill_version_plan UNIQUE NULLS DISTINCT (plan_id)
);

CREATE INDEX ix_skill_versions_skill_id ON skill_versions (skill_id);

CREATE TABLE skills (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	current_version_id VARCHAR(36), 
	origin VARCHAR(16) DEFAULT 'authored'::character varying NOT NULL, 
	CONSTRAINT skills_pkey PRIMARY KEY (id), 
	CONSTRAINT fk_skills_current_version FOREIGN KEY(current_version_id) REFERENCES skill_versions (id) ON DELETE SET NULL, 
	CONSTRAINT skills_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT uq_skill_graph_name UNIQUE NULLS DISTINCT (graph_id, name)
);

CREATE INDEX ix_skills_graph_id ON skills (graph_id);

CREATE TABLE standard_versions (
	id VARCHAR(36) NOT NULL, 
	standard_id VARCHAR(36) NOT NULL, 
	version INTEGER NOT NULL, 
	terms JSON NOT NULL, 
	content_hash VARCHAR(80) NOT NULL, 
	why VARCHAR(500), 
	published_by_id VARCHAR(36), 
	published_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT standard_versions_pkey PRIMARY KEY (id), 
	CONSTRAINT standard_versions_published_by_id_fkey FOREIGN KEY(published_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT standard_versions_standard_id_fkey FOREIGN KEY(standard_id) REFERENCES standards (id) ON DELETE CASCADE, 
	CONSTRAINT uq_standard_version_number UNIQUE NULLS DISTINCT (standard_id, version)
);

CREATE INDEX ix_standard_versions_content_hash ON standard_versions (content_hash);

CREATE INDEX ix_standard_versions_standard_id ON standard_versions (standard_id);

CREATE TABLE standards (
	id VARCHAR(36) NOT NULL, 
	publisher VARCHAR(63) NOT NULL, 
	name VARCHAR(63) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	origin VARCHAR(16) NOT NULL, 
	current_version_id VARCHAR(36), 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT standards_pkey PRIMARY KEY (id), 
	CONSTRAINT fk_standards_current_version FOREIGN KEY(current_version_id) REFERENCES standard_versions (id) ON DELETE SET NULL, 
	CONSTRAINT standards_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT uq_standard_address UNIQUE NULLS DISTINCT (publisher, name)
);

CREATE INDEX ix_standards_created_by_id ON standards (created_by_id);

CREATE INDEX ix_standards_origin ON standards (origin);

CREATE INDEX ix_standards_publisher ON standards (publisher);

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
	flow_id VARCHAR(36), 
	task_id VARCHAR(36), 
	role VARCHAR(16) DEFAULT 'execute'::character varying NOT NULL, 
	task_key VARCHAR(64) DEFAULT ''::character varying NOT NULL, 
	step_key VARCHAR(64), 
	label VARCHAR(64) DEFAULT ''::character varying NOT NULL, 
	seq INTEGER DEFAULT 0 NOT NULL, 
	lane VARCHAR(64), 
	iteration INTEGER DEFAULT 0 NOT NULL, 
	attempt INTEGER DEFAULT 1 NOT NULL, 
	flow_key VARCHAR(64) DEFAULT ''::character varying NOT NULL, 
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
	rules_offered JSON DEFAULT '[]'::json NOT NULL, 
	rules_cited JSON DEFAULT '[]'::json NOT NULL, 
	trace_id VARCHAR(32), 
	root_span_id VARCHAR(16), 
	model_version VARCHAR(255), 
	rerun_of_run_id VARCHAR(36), 
	duration_ms BIGINT, 
	queue_ms BIGINT, 
	work_ms BIGINT, 
	ask_ms BIGINT, 
	wait_ms BIGINT, 
	tokens INTEGER, 
	run_tokens_in INTEGER, 
	run_tokens_out INTEGER, 
	run_tokens INTEGER, 
	number INTEGER, 
	exit_reason VARCHAR(24), 
	escrow_tokens INTEGER, 
	escrow_returned INTEGER, 
	CONSTRAINT task_runs_pkey PRIMARY KEY (id), 
	CONSTRAINT fk_task_runs_rerun_of_run_id FOREIGN KEY(rerun_of_run_id) REFERENCES task_runs (id) ON DELETE SET NULL, 
	CONSTRAINT task_runs_assistant_message_id_fkey FOREIGN KEY(assistant_message_id) REFERENCES session_messages (id) ON DELETE SET NULL, 
	CONSTRAINT task_runs_author_id_fkey FOREIGN KEY(author_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT task_runs_flow_id_fkey FOREIGN KEY(flow_id) REFERENCES flows (id) ON DELETE SET NULL, 
	CONSTRAINT task_runs_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT task_runs_message_id_fkey FOREIGN KEY(message_id) REFERENCES session_messages (id) ON DELETE SET NULL, 
	CONSTRAINT task_runs_parent_run_id_fkey FOREIGN KEY(parent_run_id) REFERENCES task_runs (id) ON DELETE CASCADE, 
	CONSTRAINT task_runs_session_id_fkey FOREIGN KEY(session_id) REFERENCES sessions (id) ON DELETE CASCADE, 
	CONSTRAINT task_runs_task_id_fkey FOREIGN KEY(task_id) REFERENCES tasks (id) ON DELETE SET NULL, 
	CONSTRAINT uq_task_run_attempt UNIQUE NULLS DISTINCT (parent_run_id, task_id, lane, iteration, attempt), 
	CONSTRAINT uq_task_runs_graph_number UNIQUE NULLS DISTINCT (graph_id, number)
);

CREATE INDEX ix_task_runs_agent_id ON task_runs (agent_id);

CREATE INDEX ix_task_runs_agent_started ON task_runs (agent_id, started_at);

CREATE INDEX ix_task_runs_assistant_message_id ON task_runs (assistant_message_id);

CREATE INDEX ix_task_runs_exit_reason ON task_runs (exit_reason);

CREATE INDEX ix_task_runs_flow_id ON task_runs (flow_id);

CREATE INDEX ix_task_runs_graph_id ON task_runs (graph_id);

CREATE INDEX ix_task_runs_lens_id ON task_runs (lens_id);

CREATE INDEX ix_task_runs_parent_run_id ON task_runs (parent_run_id);

CREATE INDEX ix_task_runs_role ON task_runs (role);

CREATE INDEX ix_task_runs_session_id ON task_runs (session_id);

CREATE INDEX ix_task_runs_status ON task_runs (status);

CREATE INDEX ix_task_runs_task_id ON task_runs (task_id);

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
	flow_id VARCHAR(36) NOT NULL, 
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
	source_plan_key VARCHAR(80), 
	source_step_key VARCHAR(64), 
	task_version VARCHAR(32), 
	CONSTRAINT tasks_pkey1 PRIMARY KEY (id), 
	CONSTRAINT tasks_flow_id_fkey FOREIGN KEY(flow_id) REFERENCES flows (id) ON DELETE CASCADE, 
	CONSTRAINT tasks_parent_id_fkey1 FOREIGN KEY(parent_id) REFERENCES tasks (id) ON DELETE CASCADE, 
	CONSTRAINT uq_flow_sibling_key UNIQUE NULLS DISTINCT (flow_id, parent_id, key)
);

CREATE INDEX ix_tasks_flow_id ON tasks (flow_id);

CREATE INDEX ix_tasks_parent_id ON tasks (parent_id);

CREATE INDEX ix_tasks_step_key ON tasks (step_key);

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
	branch_id VARCHAR(36), 
	CONSTRAINT tasks_pkey PRIMARY KEY (id), 
	CONSTRAINT fk_todos_branch_id FOREIGN KEY(branch_id) REFERENCES project_branches (id) ON DELETE SET NULL, 
	CONSTRAINT tasks_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE, 
	CONSTRAINT tasks_parent_id_fkey FOREIGN KEY(parent_id) REFERENCES todos (id) ON DELETE CASCADE, 
	CONSTRAINT tasks_project_id_fkey FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL
);

CREATE INDEX ix_todos_assignee_id ON todos (assignee_id);

CREATE INDEX ix_todos_branch_id ON todos (branch_id);

CREATE INDEX ix_todos_graph_id ON todos (graph_id);

CREATE INDEX ix_todos_parent_id ON todos (parent_id);

CREATE INDEX ix_todos_project_id ON todos (project_id);

CREATE INDEX ix_todos_status ON todos (status);

CREATE TABLE type_count_snapshots (
	id VARCHAR(36) NOT NULL, 
	graph_id VARCHAR(36) NOT NULL, 
	at TIMESTAMP WITH TIME ZONE NOT NULL, 
	source count_snapshot_source_enum NOT NULL, 
	source_id VARCHAR(36), 
	kind count_snapshot_kind_enum NOT NULL, 
	type_name VARCHAR(255) NOT NULL, 
	count INTEGER NOT NULL, 
	max_degree INTEGER, 
	median_degree INTEGER, 
	CONSTRAINT type_count_snapshots_pkey PRIMARY KEY (id), 
	CONSTRAINT type_count_snapshots_graph_id_fkey FOREIGN KEY(graph_id) REFERENCES graphs (id) ON DELETE CASCADE
);

CREATE INDEX ix_type_count_snapshots_graph_at ON type_count_snapshots (graph_id, at);

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
	is_service_account BOOLEAN DEFAULT false NOT NULL, 
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
	unit VARCHAR(32), 
	standard_version_id VARCHAR(36), 
	standard_ref VARCHAR(160), 
	term VARCHAR(255), 
	on_break VARCHAR(8) DEFAULT 'reject'::character varying NOT NULL, 
	CONSTRAINT validation_rules_pkey PRIMARY KEY (id), 
	CONSTRAINT fk_validation_rules_standard_version FOREIGN KEY(standard_version_id) REFERENCES standard_versions (id) ON DELETE SET NULL, 
	CONSTRAINT validation_rules_property_key_id_fkey FOREIGN KEY(property_key_id) REFERENCES property_key_definitions (id) ON DELETE CASCADE, 
	CONSTRAINT validation_rules_type_property_mapping_id_fkey FOREIGN KEY(type_property_mapping_id) REFERENCES type_property_mappings (id) ON DELETE CASCADE
);

CREATE TABLE worker_events (
	id VARCHAR(36) NOT NULL, 
	pool_id VARCHAR(36) NOT NULL, 
	worker_id VARCHAR(36), 
	change VARCHAR(16) NOT NULL, 
	detail JSON NOT NULL, 
	why TEXT DEFAULT ''::text NOT NULL, 
	actor_id VARCHAR(36), 
	at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT worker_events_pkey PRIMARY KEY (id), 
	CONSTRAINT worker_events_actor_id_fkey FOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT worker_events_pool_id_fkey FOREIGN KEY(pool_id) REFERENCES worker_pools (id) ON DELETE CASCADE, 
	CONSTRAINT worker_events_worker_id_fkey FOREIGN KEY(worker_id) REFERENCES workers (id) ON DELETE SET NULL
);

CREATE INDEX ix_worker_events_at ON worker_events (at);

CREATE INDEX ix_worker_events_pool_id ON worker_events (pool_id);

CREATE TABLE worker_pools (
	id VARCHAR(36) NOT NULL, 
	name VARCHAR(64) NOT NULL, 
	runs_on VARCHAR(16) DEFAULT 'python'::character varying NOT NULL, 
	labels JSON NOT NULL, 
	slots_per_worker INTEGER DEFAULT 4 NOT NULL, 
	plugins JSON NOT NULL, 
	secrets JSON NOT NULL, 
	egress JSON NOT NULL, 
	set_by VARCHAR(16) DEFAULT 'hand'::character varying NOT NULL, 
	replicas INTEGER, 
	created_by_id VARCHAR(36), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT worker_pools_pkey PRIMARY KEY (id), 
	CONSTRAINT worker_pools_created_by_id_fkey FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT worker_pools_name_key UNIQUE NULLS DISTINCT (name)
);

CREATE TABLE worker_stats (
	pool_id VARCHAR(36) NOT NULL, 
	at TIMESTAMP WITH TIME ZONE NOT NULL, 
	workers INTEGER DEFAULT 0 NOT NULL, 
	starting INTEGER DEFAULT 0 NOT NULL, 
	lost INTEGER DEFAULT 0 NOT NULL, 
	slots INTEGER DEFAULT 0 NOT NULL, 
	slots_busy INTEGER DEFAULT 0 NOT NULL, 
	ready INTEGER DEFAULT 0 NOT NULL, 
	oldest_s INTEGER, 
	envelopes INTEGER DEFAULT 0 NOT NULL, 
	suggested INTEGER DEFAULT 0 NOT NULL, 
	CONSTRAINT worker_stats_pkey PRIMARY KEY (pool_id, at), 
	CONSTRAINT worker_stats_pool_id_fkey FOREIGN KEY(pool_id) REFERENCES worker_pools (id) ON DELETE CASCADE
);

CREATE TABLE workers (
	id VARCHAR(36) NOT NULL, 
	pool_id VARCHAR(36) NOT NULL, 
	name VARCHAR(64) NOT NULL, 
	node VARCHAR(255) DEFAULT ''::character varying NOT NULL, 
	version VARCHAR(32) DEFAULT ''::character varying NOT NULL, 
	labels JSON NOT NULL, 
	plugins JSON NOT NULL, 
	slots INTEGER DEFAULT 4 NOT NULL, 
	state VARCHAR(16) DEFAULT 'starting'::character varying NOT NULL, 
	slots_busy INTEGER DEFAULT 0 NOT NULL, 
	cpu DOUBLE PRECISION, 
	credential_hash VARCHAR(64) NOT NULL, 
	previous_credential_hash VARCHAR(64), 
	credential_rotated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	queue_worker_id BIGINT, 
	joined_via VARCHAR(36), 
	joined_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	last_heartbeat_at TIMESTAMP WITH TIME ZONE, 
	from_ip VARCHAR(64), 
	redelivered INTEGER DEFAULT 0 NOT NULL, 
	CONSTRAINT workers_pkey PRIMARY KEY (id), 
	CONSTRAINT workers_joined_via_fkey FOREIGN KEY(joined_via) REFERENCES personal_access_tokens (id) ON DELETE SET NULL, 
	CONSTRAINT workers_pool_id_fkey FOREIGN KEY(pool_id) REFERENCES worker_pools (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ix_workers_credential_hash ON workers (credential_hash);

CREATE INDEX ix_workers_pool_id ON workers (pool_id);

CREATE INDEX ix_workers_previous_credential_hash ON workers (previous_credential_hash);

CREATE INDEX ix_workers_state ON workers (state);
