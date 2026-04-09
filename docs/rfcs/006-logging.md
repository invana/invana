# RFC-006: Logging

> **Status**: Implemented
> **Author**: Ravi Merugu
> **Created**: 2026-04-10
> **Updated**: 2026-04-10
> **Depends on**: RFC-005 (CLI)

## Summary

A minimal `logging` module inside the engine. Call `configure_logging()` once at startup and the standard `logging.getLogger(__name__)` calls across all modules start producing useful output. No settings object, no env vars — just a `DEFAULT_LOGGING_CONFIG` constant applied via `dictConfig`.

## Motivation

- **Nothing is configured today.** Every module calls `logging.getLogger(__name__)` but no handler or formatter is ever attached, so log output is silent.
- **One call should be enough.** No configuration needed for the common case; power users can pass their own `dictConfig` dict.

## Design

### Module Location

```
engine/src/invana/logging/
├── __init__.py     # exports: configure_logging, DEFAULT_LOGGING_CONFIG
├── config.py       # DEFAULT_LOGGING_CONFIG dict + configure_logging()
└── formatters.py   # JSONFormatter
```

### `DEFAULT_LOGGING_CONFIG`

A standard Python `dictConfig` dict defined as a module-level constant in `config.py`.

```python
DEFAULT_LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {
            "format": "{levelname} - {asctime} : {message}",
            "style": "{",
        },
        "json": {
            "()": "invana.logging.formatters.JSONFormatter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": "INFO",
            "formatter": "simple",
        },
        "rotating_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "DEBUG",
            "filename": "logs/invana.log",
            "maxBytes": 50 * 1024 * 1024,  # 50 MB
            "backupCount": 5,
            "formatter": "simple",
            "encoding": "utf-8",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "invana": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
```

### `configure_logging()`

Called once at startup. Accepts an optional `dictConfig` dict for full override; uses `DEFAULT_LOGGING_CONFIG` otherwise.

```python
# Common case — just turn on logging
configure_logging()

# Full override (integration packages, custom deployments)
configure_logging({"version": 1, "root": {"level": "WARNING"}, ...})
```

### Formatters

Two built-in formatters defined in `config.py` and used by `DEFAULT_LOGGING_CONFIG`:

- **`simple`** — `{levelname} - {asctime} : {message}`
- **`json`** — one JSON object per line: `timestamp`, `level`, `logger`, `module`, `function`, `line`, `message`, plus `exception` when present. Defined in `formatters.py`.

### Integration Points

**FastAPI lifespan** (`server/app.py`):

```python
from invana.logging import configure_logging

@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    yield
```

**CLI root group** (`cli/main.py`) — runs once before any subcommand (`loader`, `start`, `migrate`, etc.):

```python
from invana.logging import configure_logging

@click.group()
def app() -> None:
    """Invana — Graph Intelligence Platform."""
    configure_logging()
```

No other module imports from `invana.logging`; they all continue using `logging.getLogger(__name__)`.

### File Layout

```
engine/src/invana/
└── logging/
    ├── __init__.py   # exports: configure_logging, DEFAULT_LOGGING_CONFIG
    ├── config.py     # DEFAULT_LOGGING_CONFIG + configure_logging()
    └── formatters.py # JSONFormatter
```

### Dependencies

No new external dependencies. Uses Python stdlib only: `logging`, `logging.config`, `logging.handlers`, `json`, `datetime`.

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| `structlog` | Feature-rich | Extra dependency | Keep stdlib only |
| `loguru` | Nice API | Replaces stdlib logger, breaks `getLogger(__name__)` | Incompatible with existing code |
| `LoggingSettings` Pydantic model | Env-var driven | Unnecessary complexity for logging | Overkill — a constant is sufficient |
| Per-module handler setup | Fine-grained | Verbose, duplicated | Central config is the stdlib pattern |

## Security Considerations

- Log files must not contain secrets. Connectors must redact credentials before logging connection strings.
- Rotating file handler caps disk usage at 50 MB × 5 backups.

## Performance Considerations

- `dictConfig` is called once at startup; no runtime overhead.
- JSON formatter only active if caller passes a config that uses it.
