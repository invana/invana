#!/usr/bin/env python3
"""Load the Arabidopsis demo into one Graph, against one graph database, and nothing else.

The airways walkthrough has two Studio visits — New Graph and Publish — because neither
has a CLI. This script does those two through the engine's own managers, and everything
else through today's CLI (``invana models import`` · ``invana records import``), so the
load is the same one a person would run by hand.

**It never touches a database it was not pointed at.** ``--uri`` is required and has no
default. A Graph that already exists must already be connected to exactly that URI, and
no *other* Graph may be connected to the same server and database — two Graphs on one
database would each see the other's records in their global model. Anything else is
refused before a single write.

The URI is stored on the Graph, so give one the engine can reach. ``host.docker.internal``
reaches the host from a container and, with Docker Desktop, from the host too — one URI
then serves a host CLI and a Dockerised engine alike:

    uv run --project engine --extra all python demos/arabidopsis/load.py \\
        --graph admin/arabidopsis --uri bolt://host.docker.internal:37688 \\
        --db-user neo4j --db-password <secret>

Safe to re-run: the Graph, the model and the projects are created only when absent, and
records merge on their identity keys.
"""

from __future__ import annotations

import argparse
import asyncio
import importlib
import json
import pkgutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
DATASET = "accession-phenotypes"
MODEL = "Arabidopsis"
CONNECTOR = "invana_neo4j.connector.Neo4jConnector"
# One machine, three spellings: the host, and the host as a container sees it.
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "host.docker.internal"}


class Refused(Exception):
    """The load would write somewhere it was not pointed at."""


def server_of(uri: str, database: str | None) -> tuple[str, int, str]:
    """Normalise a connection to (host, port, database) so two spellings compare equal."""
    parts = urlsplit(uri)
    host = (parts.hostname or "").lower()
    return (
        "local" if host in LOCAL_HOSTS else host,
        parts.port or 7687,
        (database or "").lower(),
    )


def load_all_models() -> None:
    """Import every ORM model, so mappers resolve in a process that is not the server."""
    import invana.apps  # noqa: PLC0415

    for module in pkgutil.iter_modules(invana.apps.__path__):
        try:
            importlib.import_module(f"invana.apps.{module.name}.models")
        except ModuleNotFoundError as exc:
            if exc.name != f"invana.apps.{module.name}.models":
                raise
    for name in (
        "invana.core.auth.models",
        "invana.core.events.models",
        "invana.runtime.models",
    ):
        importlib.import_module(name)


def invana(*args: str) -> None:
    """Run today's CLI from the same environment as this script."""
    cli = Path(sys.executable).with_name("invana")
    print(f"$ invana {' '.join(args)}", flush=True)
    subprocess.run([str(cli), *args], check=True)


async def prepare_graph(opts: argparse.Namespace) -> None:
    """Create the Graph and its connection, or prove the existing one is the one named."""
    from invana.apps.graphs.managers import GraphManager  # noqa: PLC0415
    from invana.apps.graphs.querysets import GraphConnectionQuerySet, GraphQuerySet  # noqa: PLC0415
    from invana.apps.graphs.schemas import GraphConnectionCreate, GraphCreate  # noqa: PLC0415
    from invana.core.auth.querysets import UserQuerySet  # noqa: PLC0415
    from invana.core.db import create_db_engine, create_session_factory  # noqa: PLC0415
    from invana.core.settings import settings  # noqa: PLC0415

    username, slug = opts.graph.split("/", 1)
    target = server_of(opts.uri, opts.database)
    engine = await create_db_engine()
    try:
        async with create_session_factory(engine)() as session:
            owner = await UserQuerySet().get_by_username_or_email(session, username)
            if owner is None:
                raise Refused(
                    f"No user {username!r}. Create it first: invana users create."
                )
            graph = await GraphQuerySet().get_by_owner_username_and_slug(
                session, owner_username=username, slug=slug
            )
            connections = GraphConnectionQuerySet()

            for other in await connections.list_all(session):
                if (graph is None or other.graph_id != graph.id) and server_of(
                    other.uri, other.database
                ) == target:
                    raise Refused(
                        f"{opts.uri} is already the database of another Graph. Point the Arabidopsis Graph at its own "
                        "database — sharing one mixes both Graphs' records."
                    )

            if graph is not None:
                mine = await connections.for_graph(session, graph.id)
                if mine is None or server_of(mine.uri, mine.database) != target:
                    have = mine.uri if mine else "no connection"
                    raise Refused(
                        f"Graph {opts.graph} is connected to {have}, not {opts.uri}. Nothing was written."
                    )
                print(f"Graph {opts.graph} exists and is connected to {mine.uri}.")
                return

            manager = GraphManager()
            graph = await manager.create_graph(
                session, owner=owner, payload=GraphCreate(name=slug, slug=slug)
            )
            auth = {
                k: v
                for k, v in (("username", opts.db_user), ("password", opts.db_password))
                if v
            }
            await manager.put_graph_connection(
                session,
                graph=graph,
                payload=GraphConnectionCreate(
                    uri=opts.uri,
                    connector_class=opts.connector,
                    database=opts.database,
                    auth=auth,
                ),
                encryption_key=settings.encryption_key,
                actor_id=owner.id,
            )
            await session.commit()
            print(f"Graph {opts.graph} created, connected to {opts.uri}.")
    finally:
        await engine.dispose()


async def model_state(graph_ref: str) -> tuple[bool, str | None]:
    """(model exists, id of its draft when nothing is published yet)."""
    from invana.apps.graphs.querysets import GraphQuerySet  # noqa: PLC0415
    from invana.apps.modeller.store import ModelStore  # noqa: PLC0415
    from invana.core.db import create_db_engine, create_session_factory  # noqa: PLC0415

    username, slug = graph_ref.split("/", 1)
    store = ModelStore()
    engine = await create_db_engine()
    try:
        async with create_session_factory(engine)() as session:
            graph = await GraphQuerySet().get_by_owner_username_and_slug(
                session, owner_username=username, slug=slug
            )
            model = next(
                (
                    m
                    for m in await store.list_graph_models(session, graph.id)
                    if m.name == MODEL
                ),
                None,
            )
            if model is None:
                return False, None
            if await store.get_active_version(session, model.id) is not None:
                return True, None
            drafts = [
                v
                for v in await store.list_versions(session, model.id)
                if v.status == "draft"
            ]
            return True, drafts[0].id if drafts else None
    finally:
        await engine.dispose()


async def publish(graph_ref: str, draft_id: str) -> None:
    """Publish the imported draft — what Studio's Publish button does."""
    from invana.apps.graphs.querysets import GraphQuerySet  # noqa: PLC0415
    from invana.apps.modeller.json_io import SchemaExporter  # noqa: PLC0415
    from invana.apps.modeller.portability import compute_content_hash  # noqa: PLC0415
    from invana.apps.modeller.store import ModelStore  # noqa: PLC0415
    from invana.apps.modeller.versioner import Versioner  # noqa: PLC0415
    from invana.core.auth.querysets import UserQuerySet  # noqa: PLC0415
    from invana.core.db import create_db_engine, create_session_factory  # noqa: PLC0415
    from invana.core.events import actions  # noqa: PLC0415
    from invana.core.events.services import emit_event  # noqa: PLC0415

    username, slug = graph_ref.split("/", 1)
    store = ModelStore()
    engine = await create_db_engine()
    try:
        async with create_session_factory(engine)() as session:
            graph = await GraphQuerySet().get_by_owner_username_and_slug(
                session, owner_username=username, slug=slug
            )
            owner = await UserQuerySet().get_by_username_or_email(session, username)
            published = await Versioner(store).activate(session, version_id=draft_id)
            published = await store.get_version(session, published.id)
            model = next(
                m
                for m in await store.list_graph_models(session, graph.id)
                if m.id == published.model_id
            )
            export = SchemaExporter.export(
                published,
                schema_name=model.name,
                schema_description=model.description,
                validation_mode=model.validation_mode,
            )
            published.content_hash = compute_content_hash(export)
            await emit_event(
                session,
                action=actions.MODEL_COMMIT,
                target_kind=actions.TARGET_MODEL,
                target_id=model.id,
                graph_id=graph.id,
                actor_id=owner.id,
                details={
                    "version": published.version,
                    "content_hash": published.content_hash,
                    "via": "demo load",
                },
            )
            await session.commit()
            print(f"{MODEL} {published.version} published.")
    finally:
        await engine.dispose()


async def seed_work(graph_ref: str) -> None:
    """The projects and todos the Projects boards are drawn on; each created only when absent."""
    from invana.apps.graphs.querysets import GraphQuerySet  # noqa: PLC0415
    from invana.apps.work.managers import ProjectManager, TaskManager  # noqa: PLC0415
    from invana.apps.work.schemas import ProjectCreate, TaskCreate  # noqa: PLC0415
    from invana.core.auth.querysets import UserQuerySet  # noqa: PLC0415
    from invana.core.db import create_db_engine, create_session_factory  # noqa: PLC0415

    seed = json.loads((HERE / "projects.json").read_text(encoding="utf-8"))
    username, slug = graph_ref.split("/", 1)
    projects, tasks = ProjectManager(), TaskManager()
    engine = await create_db_engine()
    try:
        async with create_session_factory(engine)() as session:
            graph = await GraphQuerySet().get_by_owner_username_and_slug(
                session, owner_username=username, slug=slug
            )
            owner = await UserQuerySet().get_by_username_or_email(session, username)
            have = {
                p.key for p in await projects.list_for_graph(session, graph_id=graph.id)
            }
            for item in seed["projects"]:
                if item["key"] not in have:
                    await projects.create(
                        session,
                        graph_id=graph.id,
                        payload=ProjectCreate(**item),
                        actor=owner,
                    )
            titles = {
                t.title for t in await tasks.list_for_graph(session, graph_id=graph.id)
            }
            for item in seed["todos"]:
                if item["title"] not in titles:
                    await tasks.create(
                        session,
                        graph=graph,
                        payload=TaskCreate(
                            **item, assignee_kind="user", assignee_id=owner.id
                        ),
                        actor=owner,
                    )
            await session.commit()
            print(
                f"{len(seed['projects'])} projects and {len(seed['todos'])} todos in place."
            )
    finally:
        await engine.dispose()


async def publish_dataset(graph_ref: str) -> None:
    """The accessions as an install-wide dataset, so Datasets has a record to draw.

    A dataset is tables, so each accession is flattened to one row keyed by
    ``accession``. Minted as the Graph owner's ``accession-phenotypes``, origin
    ``official``; an identical re-run is ``unchanged`` and writes nothing.
    """
    from invana.apps.datasets.managers import DatasetManager  # noqa: PLC0415
    from invana.apps.datasets.schemas import (
        AuthorStep,
        DatasetCreate,
        DatasetVersionCreate,
    )  # noqa: PLC0415
    from invana.core.auth.querysets import UserQuerySet  # noqa: PLC0415
    from invana.core.db import create_db_engine, create_session_factory  # noqa: PLC0415
    from invana.core.errors import ConflictError, NotFoundError  # noqa: PLC0415

    nodes = json.loads(
        (HERE / DATASET / "nodes" / "Accession.json").read_text(encoding="utf-8")
    )
    rows = [{"accession": n["id"], **n["properties"]} for n in nodes]
    username = graph_ref.split("/", 1)[0]
    datasets = DatasetManager()
    engine = await create_db_engine()
    try:
        async with create_session_factory(engine)() as session:
            owner = await UserQuerySet().get_by_username_or_email(session, username)
            try:
                dataset = await datasets.get(
                    session, publisher=owner.username, name=DATASET, reader=owner
                )
            except NotFoundError:
                dataset = await datasets.create(
                    session,
                    payload=DatasetCreate(
                        name=DATASET,
                        title="Accession phenotypes",
                        description="Flowering, rosette and drought traits per Arabidopsis accession",
                        origin="official",
                        key_column="accession",
                        sensitivity="public",
                    ),
                    actor=owner,
                )
            try:
                minted = await datasets.publish_version(
                    session,
                    dataset=dataset,
                    payload=DatasetVersionCreate(
                        licence="CC BY 4.0",
                        author_chain=[
                            AuthorStep(
                                role="original",
                                kind="organisation",
                                name="1001 Genomes",
                            ),
                            AuthorStep(
                                role="original", kind="organisation", name="AraPheno"
                            ),
                        ],
                        records=rows,
                        source="Accession.json",
                    ),
                    actor=owner,
                )
                print(
                    f"{dataset.address}@{minted.version}: {minted.record_count} records."
                )
            except ConflictError as exc:
                print(f"{dataset.address}: {exc}")
            await session.commit()
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--graph", required=True, help="<username>/<slug>, e.g. admin/arabidopsis"
    )
    parser.add_argument(
        "--uri",
        required=True,
        help="The graph database this Graph owns, e.g. bolt://localhost:37688",
    )
    parser.add_argument(
        "--database",
        default=None,
        help="Database on that server (default: the server's own)",
    )
    parser.add_argument(
        "--connector", default=CONNECTOR, help=f"Connector class (default: {CONNECTOR})"
    )
    parser.add_argument("--db-user", default=None)
    parser.add_argument("--db-password", default=None)
    opts = parser.parse_args()
    if "/" not in opts.graph:
        parser.error("--graph must be <username>/<slug>.")

    load_all_models()
    from invana.runtime.catalogue.bundle import check  # noqa: PLC0415

    if not check(HERE).passed:
        sys.exit(f"The bundle does not check clean — run: invana records check {HERE}")
    try:
        asyncio.run(prepare_graph(opts))
    except Refused as exc:
        sys.exit(f"Refused: {exc}")

    exists, draft_id = asyncio.run(model_state(opts.graph))
    if not exists:
        invana(
            "models",
            "import",
            "--graph",
            opts.graph,
            "--file",
            str(HERE / DATASET / "graph-model.json"),
        )
        exists, draft_id = asyncio.run(model_state(opts.graph))
    if draft_id:
        asyncio.run(publish(opts.graph, draft_id))

    path = str(HERE / DATASET)
    invana(
        "records",
        "import",
        "--graph",
        opts.graph,
        "--name",
        DATASET,
        "--model",
        MODEL,
        "--path",
        path,
    )
    asyncio.run(seed_work(opts.graph))
    asyncio.run(publish_dataset(opts.graph))


if __name__ == "__main__":
    main()
