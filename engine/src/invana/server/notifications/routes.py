"""Paths for the inbox, notification rules and channels.

``/api/v1/u/{username}/{graphSlug}/notifications``            — my inbox on this Graph
``/api/v1/u/{username}/{graphSlug}/notifications/rules``      — who hears what
``/api/v1/u/{username}/{graphSlug}/notifications/channels``   — where it goes

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.activity.schemas import (
    ChannelListResponse,
    ChannelRead,
    InboxResponse,
    MarkReadResponse,
    NotificationRuleListResponse,
    NotificationRuleRead,
)
from invana.server.notifications import views

notifications_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/notifications", tags=["notifications"])

notifications_router.get("", response_model=InboxResponse)(views.get_inbox)
notifications_router.post("/read", response_model=MarkReadResponse)(views.mark_read)
notifications_router.get("/rules", response_model=NotificationRuleListResponse)(views.list_rules)
notifications_router.post("/rules", response_model=NotificationRuleRead, status_code=status.HTTP_201_CREATED)(
    views.create_rule
)
notifications_router.get("/rules/{rule_id}", response_model=NotificationRuleRead)(views.get_rule)
notifications_router.patch("/rules/{rule_id}", response_model=NotificationRuleRead)(views.update_rule)
notifications_router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_rule)
notifications_router.get("/channels", response_model=ChannelListResponse)(views.list_channels)
notifications_router.post("/channels", response_model=ChannelRead, status_code=status.HTTP_201_CREATED)(
    views.create_channel
)
notifications_router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_channel)

__all__ = ["notifications_router"]
