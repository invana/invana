---
"invana": minor
"studio": minor
---

Backend property-type capabilities + DB version compatibility (RFC-022).

The modeller now offers only the property types the bound graph database supports, resolved from a canonical, version-aware `CapabilityProfile` per connector (Cypher vs TinkerPop families, with vendor + version gating). The connected database's version is detected at health-check time and cached on the connection; capabilities resolve against it.

Untested future versions (e.g. a Neo4j release newer than Invana has validated) and undetectable/unknown versions degrade the connection to read-only and prompt the user — acknowledge-at-risk to enable writes, or declare the version when auto-detection isn't available. Versions below the supported floor are blocked. Property-key create/update is enforced server-side (422) against the backend's supported types.
