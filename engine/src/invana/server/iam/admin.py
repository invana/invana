"""starlette-admin views for IAM's tables.

Policies, their versions and attachments, groups and their members are edited
through the product; these exist so somebody debugging a Graph can see the
rows. Nothing here is sensitive — a policy is meant to be readable by every
member of its Graph.
"""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class PolicyView(ModelView):
    label = "Policies"
    icon = "fa fa-scroll"
    fields = [
        "id",
        "graph_id",
        "name",
        "kind",
        "status",
        "description",
        "statements",
        "limits",
        "version",
        "owner_id",
        "drafted_by",
        "created_by_id",
        "updated_by_id",
        "created_at",
        "updated_at",
    ]
    search_fields = ["name", "kind", "status"]


class PolicyVersionView(ModelView):
    label = "Policy versions"
    icon = "fa fa-clock-rotate-left"
    # History is written by saving a policy; it is never hand-edited.
    can_create = False
    can_edit = False
    fields = ["id", "policy_id", "version", "statements", "limits", "description", "saved_by_id", "saved_at", "why"]


class PolicyAttachmentView(ModelView):
    label = "Policy attachments"
    icon = "fa fa-paperclip"
    fields = [
        "id",
        "policy_id",
        "graph_id",
        "holder_kind",
        "holder_id",
        "attached_by_id",
        "attached_at",
        "ends_at",
        "run_id",
        "via",
        "approval_id",
    ]
    search_fields = ["holder_kind", "holder_id"]


class GroupView(ModelView):
    label = "Groups"
    icon = "fa fa-people-group"
    fields = ["id", "graph_id", "name", "description", "created_by_id", "created_at"]
    search_fields = ["name"]


class GroupMemberView(ModelView):
    label = "Group members"
    icon = "fa fa-user-plus"
    fields = ["id", "group_id", "member_kind", "member_id", "added_by_id", "added_at"]
