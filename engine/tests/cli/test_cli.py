"""Unit tests for CLI commands and import_class_from_dotted_path utility."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from click.testing import CliRunner

from invana.cli.main import app
from invana.utils import import_class_from_dotted_path

# ---------------------------------------------------------------------------
# import_class_from_dotted_path
# ---------------------------------------------------------------------------


class TestImportClassFromDottedPath:
    def test_imports_known_engine_class(self):
        cls = import_class_from_dotted_path("invana.graph.connectors.OpenCypherConnector")
        assert cls.__name__ == "OpenCypherConnector"

    def test_imports_gremlin_connector(self):
        cls = import_class_from_dotted_path("invana.graph.connectors.GremlinConnector")
        assert cls.__name__ == "GremlinConnector"

    def test_no_dot_raises_value_error(self):
        with pytest.raises(ValueError, match="dotted path"):
            import_class_from_dotted_path("NoDot")

    def test_bad_module_raises_import_error(self):
        with (
            patch("importlib.import_module", side_effect=ImportError("no module")),
            pytest.raises(ImportError, match="Cannot import module"),
        ):
            import_class_from_dotted_path("nonexistent.module.MyClass")

    def test_missing_class_raises_attribute_error(self):
        fake_module = MagicMock(spec=[])
        with (
            patch("importlib.import_module", return_value=fake_module),
            pytest.raises(AttributeError, match="has no attribute"),
        ):
            import_class_from_dotted_path("mypkg.module.MissingClass")

    def test_custom_class_via_dotted_path(self):
        FakeCls = type("FakeConnector", (), {})
        fake_module = MagicMock()
        fake_module.FakeConnector = FakeCls
        with patch("importlib.import_module", return_value=fake_module):
            cls = import_class_from_dotted_path("fake_pkg.module.FakeConnector")
        assert cls is FakeCls


# ---------------------------------------------------------------------------
# invana version
# ---------------------------------------------------------------------------


class TestVersionCommand:
    def test_exit_code(self):
        assert CliRunner().invoke(app, ["version"]).exit_code == 0

    def test_output_contains_invana(self):
        assert "Invana" in CliRunner().invoke(app, ["version"]).output


# ---------------------------------------------------------------------------
# invana --help
# ---------------------------------------------------------------------------


class TestHelpCommand:
    def test_lists_subcommands(self):
        result = CliRunner().invoke(app, ["--help"])
        assert result.exit_code == 0
        for cmd in ("version", "start", "migrate", "loader"):
            assert cmd in result.output

    def test_loader_help_shows_options(self):
        result = CliRunner().invoke(app, ["loader", "--help"])
        assert result.exit_code == 0
        for flag in ("--uri", "--connector", "--batch-size", "--dry-run", "--skip-on-error"):
            assert flag in result.output


# ---------------------------------------------------------------------------
# invana loader — error paths
# ---------------------------------------------------------------------------


class TestLoaderCommandErrors:
    def test_missing_uri_exits_with_usage_error(self, monkeypatch):
        monkeypatch.setenv("INVANA_GRAPH_URI", "")
        monkeypatch.setenv("INVANA_GRAPH_CONNECTOR", "")
        result = CliRunner().invoke(app, ["loader", "/some/path"])
        assert result.exit_code == 2
        assert "uri" in result.output.lower()

    def test_missing_connector_exits_with_usage_error(self, monkeypatch):
        monkeypatch.setenv("INVANA_GRAPH_URI", "")
        monkeypatch.setenv("INVANA_GRAPH_CONNECTOR", "")
        result = CliRunner().invoke(app, ["loader", "/some/path", "--uri", "bolt://localhost:7687"])
        assert result.exit_code == 2
        assert "connector" in result.output.lower()

    def test_bad_connector_path_produces_click_exception(self, monkeypatch):
        monkeypatch.setenv("INVANA_GRAPH_URI", "")
        monkeypatch.setenv("INVANA_GRAPH_CONNECTOR", "")
        result = CliRunner().invoke(
            app,
            [
                "loader",
                "/some/path",
                "--uri",
                "bolt://localhost:7687",
                "--connector",
                "nonexistent.module.Connector",
            ],
        )
        assert result.exit_code != 0

    def test_dry_run_with_mocked_loader(self, tmp_path, monkeypatch):
        monkeypatch.setenv("INVANA_GRAPH_URI", "")
        monkeypatch.setenv("INVANA_GRAPH_CONNECTOR", "")
        (tmp_path / "nodes").mkdir()
        (tmp_path / "relationships").mkdir()

        from invana.graph.loaders import LoaderStats

        with (
            patch("invana.cli.commands.loader._run_loader", return_value=LoaderStats()),
            patch(
                "invana.utils.import_class_from_dotted_path",
                return_value=MagicMock(return_value=MagicMock()),
            ),
        ):
            result = CliRunner().invoke(
                app,
                [
                    "loader",
                    str(tmp_path),
                    "--uri",
                    "bolt://localhost:7687",
                    "--connector",
                    "invana.graph.connectors.OpenCypherConnector",
                    "--dry-run",
                ],
            )
        assert result.exit_code == 0
        assert "DRY RUN" in result.output
