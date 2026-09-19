"""Setup — the six derived steps of a new Graph (13.7).

Its own app because the derivation is a **cross-app read**: datasets, modeller,
llm_providers and skills all answer part of "is this Graph ready". Living in
`apps/graphs` made four packages import `graphs` back for the `Graph` model, and
that was four of the measured cycles (migration-plan §14.1).

Nothing imports `setup`, so no new cycle forms.
"""
