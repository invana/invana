"""Rules for a Graph's agents, as classes (migration-plan §6)."""

from invana.apps.agents.managers.agent import AgentManager, agent_actor
from invana.apps.agents.managers.soul import SoulManager

__all__ = ["AgentManager", "SoulManager", "agent_actor"]
