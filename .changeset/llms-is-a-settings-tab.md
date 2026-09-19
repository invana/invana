---
"invana": patch
---

**LLM providers are a Settings tab, not a rail icon** (providers-and-models.md PM6, G23 · G29).

A provider is the Graph's own configuration in exactly the way the connection is — one is the
database it reads, the other the model it thinks with — and `leftNav` is for things a person *goes
to*. It cost an icon to say what a tab says.

Settings is four tabs now: **Basic** · **Graph** · **LLMs** · **Agents** — what the graph is, what
it reads, what it thinks with, how hard it may run.

Inside the tab the panel keeps its list → detail shape: `LLM Providers`, `› Add`, `› <provider>`,
with the root crumb the way back. What moves is where that trail lives — one panel has one tab
strip and never a second header row under it, so the trail and **Add** sit on the tab's own rule
line. Search goes with the chrome: a Graph has two or three providers, and the status bar already
counts them.

`?panel=llms` still resolves — onto `settings` with the `llms` tab open — so every bookmark, and
the setup board's *Add an LLM provider* step, lands where it always did.
