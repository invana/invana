"""Semantic imports — published vocabularies and ontologies read into Invana's own records.

A SKOS concept scheme becomes a standard
(docs/for-developers/modules/bring-data-in/features/skos-import.md); an RDFS/OWL
ontology becomes a draft model
(docs/for-developers/modules/connect-and-model/features/ontology-import.md).
``reader`` parses the text, ``skos`` and ``ontology`` map it — pure, no session —
and ``managers`` writes a draft model. The standard side's writer lives with
standards, which sits above this package.
"""
