---
"invana": patch
---

A world and a guardrail are authored by picking, and a save is refused before it is taken (W3 · G2 · W4).

**One editor, because they are one record.** A guardrail and a world are separated by `kind`
([GV1](docs/for-developers/modules/govern/spec.md)), so `LensEditor` authors both and `kind` changes
four things and nothing else: the header's word, whether the name field publishes, whether the save
asks for its impact first, and whether the cast section is drawn ([WO10](docs/for-developers/modules/govern/features/worlds.md)).
Two forms would be two places for the grammar to drift.

**Nothing is free text** ([WO7](docs/for-developers/modules/govern/features/worlds.md)). Layer,
sublayer and participant are three pickers over the live catalogue, and the wildcards are options
inside them — `Deals@*` sits beside `Deals@1.0.1`, which is what makes the version-proof rule as easy
to write as the brittle one. A typo cannot become a rule that silently matches nothing, because
there is no key to mistype.

**The preview greys near-misses rather than filtering them**
([GR9](docs/for-developers/modules/govern/features/guardrails.md)): a list of hits alone cannot
distinguish *precise* from *wrong*, since `Deals@1.0.0` and `Deals@*` both show one hit and only the
greyed second version says which survives the next publish.

**A refusal lands on the rule that caused it**, in the server's own words, with its recourse as the
way out — the form asks the same question the save will, on every edit, so *this world widens a
guardrail* and *this model declares no time axis* arrive while somebody is still looking at the
controls rather than after they press Save.

**A guardrail save says what it would cost first**
([GR2](docs/for-developers/modules/govern/features/guardrails.md)). Every world is revalidated and
what each one loses is named before the write; worlds are narrowed, not deleted, and a world that
does not change is still listed saying so.

**The ladder is four one-field edits** — name it (which publishes), rename, duplicate into a private
copy, promote to a guardrail — and every refusal names what holds it, including the agents carrying
a world somebody tried to delete.

**Editing a guardrail is a permission, and without it every control is absent rather than greyed**
([GR12](docs/for-developers/modules/govern/features/guardrails.md)). The rules still render for
everyone, because a bound nobody may read is a bound nobody can work within. `may_edit_guardrails`
rides on the lens list rather than on a route of its own, so the bound and the right to edit it can
never land at different moments.
