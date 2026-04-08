# RFC-000: Template

> **Status**: Template
> **Author**:
> **Created**:
> **Updated**:

## Summary

One paragraph — what is this feature/change and why does it matter.

## Motivation

- What problem does this solve?
- Who benefits (end users, developers, operators)?
- What happens if we don't do this?

## Design

### Data Model

Define entities, relationships, constraints, and any schema changes.

### API Surface

Endpoints, request/response shapes, error codes, WebSocket events.

```
POST /api/v1/...
Request: { ... }
Response: { ... }
```

### Studio UI

Describe the user-facing workflow. Include wireframes or mockups if applicable.

### Storage

How does this persist? What migrations are needed?

### Dependencies

- Which other RFCs or modules does this depend on?
- Which external libraries are introduced?

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| Option A | ... | ... | ... |

## Security Considerations

Authentication, authorization, data validation, and potential attack vectors.

## Performance Considerations

Expected load, scaling implications, benchmarks needed.

## Open Questions

- [ ] Unresolved decision 1
- [ ] Unresolved decision 2

## Implementation Plan

Ordered list of PRs/tasks:

1. [ ] Add schema/migrations
2. [ ] Implement core logic
3. [ ] Add API endpoints
4. [ ] Write tests (from documented behavior)
5. [ ] Studio integration
6. [ ] Update user-facing docs

## References

- Related issues, prior art, external resources
