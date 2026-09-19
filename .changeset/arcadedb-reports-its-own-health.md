---
"invana": patch
---

The graph databases report their own health.

`docker compose --profile arcadedb up -d` brought up a container that worked perfectly and reported
`unhealthy` forever. The healthcheck ran `curl`, and the ArcadeDB image ships no `curl` — only `wget`
and `nc`:

```
/bin/sh: curl: not found
```

So the check failed every ten seconds from the moment the server was ready, and anything downstream
that waits on health — `depends_on: condition: service_healthy`, a CI gate, a contributor reading
`docker ps` — was told the database was broken while it was answering queries.

It now uses `wget`, and it checks **both** ports rather than one. The HTTP API on 2480 being ready
does not mean the Gremlin plugin on 8182 is listening, and 8182 is the one the connector suite
connects to — a green check that does not cover the port under test is the same problem in a quieter
form.

Healthy in about ten seconds from a cold start, on a fresh volume.

JanusGraph had the same bug wearing the opposite disguise. Its check ended in `|| exit 0`, so it
could not fail — and the script in front of that `||` exits 1 every time, meaning the container has
been reporting `healthy` unconditionally, including while it was still starting. It now opens a TCP
connection to the Gremlin port, which is what a client needs before it can handshake. That image
has no `nc` and serves no HTTP on 8182, so the probe is a bash TCP open — verified to pass on 8182
and to fail on a closed port, which is more than the check it replaces could do.

Two images, two different sets of tools, and neither matched what its check assumed. Every probe
here was run inside its own container before it was written down.
