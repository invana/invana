---
"invana": minor
"studio": minor
---

Stitching is built the way it is drawn: a key on each side, a card that stages, and a count before
the fact (stitch-models.md ST26 · ST27 · ST34–ST37).

`model_links.identity_property` — one property name assumed to hold on both sides — becomes
`source_property` and `target_property`. It is the ordinary case that could not be said before:
`Company.ticker ≡ Stock.nse_symbol`, two models authored apart, neither about to rename a published
version because the other exists. Every existing row backfills to the same name twice, which is
exactly what it meant. The pair reads two ways — *same entity* on an anchor, *where the edge
attaches* on a relationship — so a foreign key already sitting on the records
(`Order.instrument_isin` → `Stock.isin`) is now an edge with no dataset to import. A relationship
takes its endpoints from the keys **or** from a dataset and the engine refuses the pair, because one
edge type with two sources of truth has no rule for which wins.

Studio catches up to the artboards, word for word. One card titled **Declare a stitch** with the
kind as a segmented control inside it, rather than two dialogs titled *Declare an anchor* and
*Declare a relationship link* chosen from a menu beforehand. A key picker on each side, a `Match`
control, an `Endpoints` choice for a relationship, and a primary button that says **Stage this
stitch** — because staging is what it does, and *Declare* promised a change to the union that had
not happened. The resolve count fires as soon as both keys are named instead of hiding behind a
*How many resolve?* button, and names both keys when it comes back; *Show the N* lists the source
keys that matched nothing. A pair that is already stitched is refused with a card naming the rule
the existing stitch carries and a way to open it. Stitch rows, canvas labels and the remove dialog
all read the rule — `Company.ticker = Stock.nse_symbol · exact · active` — and the counts moved off
the canvas onto the Models panel's meta line, so they are stated once.

Two things the count now gets right. A zero against **no rows** is not a verdict on the rule — a
model is authored before its data lands, so the card reads *No records to count* and stages anyway;
only a rule judged against real rows and matching none of them blocks staging. And a type that
carries no properties says so in place of the key picker, rather than offering an empty dropdown.

The global model page says **stitches** rather than links and carries the physical mirror's label
count beside the derived ones, never inside them.
