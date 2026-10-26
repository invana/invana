---
"invana": minor
---

Modeller › Rules by scope: one page of every rule in force in a Graph, and a dialog that shows what a rule would have stopped.

- **Rules** is a page: the install's rules, the Graph's own and each project's, in the order a step is
  given them, filtered by *Scope* and *Checked on* on the engine. Each row says where the rule holds,
  what it is checked on, what happens when it is broken and how often it broke in the last 30 days.
- **The rule dialog** writes a rule at its scope — install (an install Admin's), Graph or project —
  with its check, *When broken* (Block · Warn · Report) and *Because*, the line shown to whoever the
  rule stops. Before it saves, the engine replays the last 30 days through the check and the dialog
  names what it would have stopped.
- `demos/airways/rules.json` seeds two install rules: `invana rules apply --file … --user admin`.
