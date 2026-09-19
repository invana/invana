"""Band 4 — what follows *from* a write.

Reads every domain band and is read only by the edge. The tree, the task
read-model, and (when it lands) the notification inbox live here because they
join `core/events`, `apps/*` and `runtime` — which no single one of those may
do (migration-plan §2, §13.4).
"""
