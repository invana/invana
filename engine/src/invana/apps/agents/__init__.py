"""Agents — the graph's named actors (docs/for-developers/modules/work/spec.md).

An agent is not only a configuration you pick: it is a **principal**. It can be
bound to a session, assigned a task, spawn other agents, and it appears by name
in every row of the activity trace. What it carries is its way of run — an
envelope (the static workflow spec), an LLM provider, a set of skills, a budget
and a policy.
"""
