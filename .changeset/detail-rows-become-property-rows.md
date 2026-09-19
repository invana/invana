---
"studio": patch
---

The work panels' `DetailRow` becomes the kit's `PropertyRow`, and `DetailBlock`
renders through `PropertyList` (DS17). 36 call sites across Agents, Projects,
Tasks and Workflows.

The gain is not the deletion, it is the alignment: `PropertyList` owns one label
column for the whole block, so every value in a detail starts on the same x.
`DetailRow` set its own `110px` grid per row, which agreed only by coincidence.

`DetailProse`, `DetailStatus`, `AgentChipRow` and `DetailPlaceholder` stay —
they carry domain grammar rather than shadowing a kit component (DS2).
`DetailStatus` is the one to revisit: it is deliberately square, and says so, to
keep "bordered means editable" true everywhere else. That is a `Badge` question
for the kit, not a Studio one.
