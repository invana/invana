---
"invana": patch
---

An element names the run that wrote it.

Everything a load writes carries provenance stamped on the element itself, and the id in it was an
`import_jobs` row. That table is going: the record of a load is the TaskRun, which is what the
journal lists, what the trace opens, and what outlives the load. So the stamp is `_inv_run_id`.

**The value changes with the name.** A job id is not a run id, so this is not a rename that can be
done in place — an element left carrying its old value under the new key would say *this was written
by run X* about a run that never existed. The remap goes through each job's own `run_id`.

That remapping happens in the graph database, where migrations do not reach. It ships as a command:

    invana datasets restamp --graph <username>/<slug>          # reports, writes nothing
    invana datasets restamp --graph <username>/<slug> --apply

It is idempotent, and it must run **before** the `import_jobs` table is dropped — the table is the
only mapping from the old stamp to the new one, and dropping it first strands every element written
before the upgrade. The command reports how many elements carry a stamp no load claims, rather than
passing over them.

Until a Graph is restamped, nothing fails loudly and two things quietly stop working: a stitch
solve scoped to one load matches none of that Graph's older records, and the record inspector
reports no run for a record it can otherwise resolve.

`RecordProvenance.job_id` is now `RecordProvenance.run_id`, which is a change to the inspect
response.
