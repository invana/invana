"""Policies, groups holding managed policies, and the last iam-admin
(docs/for-developers/modules/identity-and-access/features/policies.md ·
people-and-groups.md · roles.md), over HTTP against a real Postgres.
"""

from __future__ import annotations

import uuid

import pytest

READ_FARES = {"actions": ["graph.read.*"], "resources": ["graph/Fare/*"]}


@pytest.mark.asyncio
async def test_a_draft_saves_as_versions_and_a_bad_statement_is_refused(client, graph_url) -> None:
    iam = f"{graph_url}/iam"
    made = await client.post(f"{iam}/policies", json={"name": "fare-read", "statements": [READ_FARES]})
    assert made.status_code == 201, made.text
    assert (made.json()["status"], made.json()["version"], made.json()["held_by"]["line"]) == ("draft", 0, "nobody")

    saved = (await client.post(f"{iam}/policies/fare-read/save", json={"why": "first cut"})).json()
    assert (saved["status"], saved["version"], saved["editable"]) == ("saved", 1, True)

    wider = {"actions": ["llm.call"], "resources": ["llm/*"]}
    edited = await client.patch(f"{iam}/policies/fare-read", json={"statements": [READ_FARES, wider], "why": "think"})
    assert edited.json()["version"] == 2
    assert [layer["layer"] for layer in edited.json()["layers"]] == ["graph", "llm"]
    history = (await client.get(f"{iam}/policies/fare-read/versions")).json()
    assert [(v["version"], v["why"], v["statement_count"]) for v in history] == [(2, "think", 2), (1, "first cut", 1)]

    listed = (await client.get(f"{iam}/policies")).json()
    assert listed["kinds"]["managed"] == 6 and listed["kinds"]["custom"] == 1

    bad = await client.post(
        f"{iam}/policies", json={"name": "bad", "statements": [{"actions": ["x"], "resources": ["fares/*"]}]}
    )
    assert bad.status_code == 422
    assert "names no layer" in bad.text
    assert (await client.delete(f"{iam}/policies/viewer")).status_code == 409


@pytest.mark.asyncio
async def test_a_group_holding_builder_lets_a_viewer_build(client, people, graph_url) -> None:
    ada, bo = people["ada"], people["bo"]
    assert (await client.post(f"{graph_url}/members", json={"user": bo.email})).status_code == 201
    missing_agent = f"{graph_url}/agents/{uuid.uuid4()}"

    client.as_(bo)
    refused = await client.delete(missing_agent)
    assert refused.status_code == 403
    assert refused.json()["detail"]["role"] == "builder" and refused.json()["detail"]["holders"] == [ada.username]
    not_admin = await client.post(f"{graph_url}/iam/groups", json={"name": "fare-team"})
    assert not_admin.status_code == 403 and not_admin.json()["detail"]["holders"] == [ada.username]

    client.as_(ada)
    group = (await client.post(f"{graph_url}/iam/groups", json={"name": "fare-team"})).json()
    added = await client.post(
        f"{graph_url}/iam/groups/fare-team/members", json={"member_kind": "person", "member_id": bo.id}
    )
    assert added.json()["people"] == [bo.username]
    held = await client.post(
        f"{graph_url}/iam/policies/builder/holders", json={"holder_kind": "group", "holder_id": group["id"]}
    )
    assert held.status_code == 201 and held.json()["line"] == bo.username
    holders = (await client.get(f"{graph_url}/iam/policies/builder/holders")).json()
    assert {(h["kind"], h["name"], h["how"]) for h in holders["items"]} == {
        ("group", "fare-team", "direct"),
        ("person", ada.username, "role"),
    }
    robot = await client.post(f"{graph_url}/iam/service-accounts", json={"username": f"robot-{uuid.uuid4().hex[:6]}"})
    assert robot.json()["signs_in_with"] == "no sign-in · token only"
    people_page = (await client.get(f"{graph_url}/iam/people")).json()
    assert people_page["kinds"] == {"all": 3, "person": 2, "service": 1}

    client.as_(bo)
    assert (await client.delete(missing_agent)).status_code == 404
    access = (await client.get(f"{graph_url}/access")).json()
    assert {a["area"]: a["allowed"] for a in access["areas"]}["build"] is True


@pytest.mark.asyncio
async def test_the_last_iam_admin_cannot_be_demoted(client, people, graph_url) -> None:
    ada = people["ada"]
    demoted = await client.patch(f"{graph_url}/members/{ada.username}", json={"roles": ["owner"]})
    assert demoted.status_code == 409
    assert "always has an iam-admin" in demoted.text
