"""starlette-admin views for eval sets, their cases, results and budgets.

Results are read-only: a verdict is what an eval run counted, and editing one
would make the publish gate read something no run produced.
"""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class EvalSetView(ModelView):
    fields = ["id", "graph_id", "subject_kind", "subject_id", "judge_model_pin", "rubric", "created_at"]
    search_fields = ["subject_id"]


class EvalCaseView(ModelView):
    fields = [
        "id",
        "eval_set_id",
        "question",
        "checks",
        "label",
        "status",
        "source_run_id",
        "created_by_id",
        "created_at",
    ]
    search_fields = ["question"]


class EvalResultView(ModelView):
    fields = [
        "id",
        "eval_run_id",
        "eval_case_id",
        "case_run_id",
        "side",
        "hard",
        "judged",
        "tokens",
        "latency_ms",
        "answer_digest",
        "created_at",
    ]
    can_create = False
    can_edit = False
    can_delete = False


class EvalBudgetView(ModelView):
    fields = ["graph_id", "monthly_tokens"]
