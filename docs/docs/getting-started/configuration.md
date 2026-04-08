# Configuration

Invana is configured via environment variables. All variables are prefixed with `INVANA_`.

## Environment Variables

### Core

| Variable | Default | Description |
|---|---|---|
| `INVANA_ENV` | `development` | Environment: `development`, `staging`, `production` |
| `INVANA_HOST` | `127.0.0.1` | Host to bind the server to |
| `INVANA_PORT` | `8000` | Port to bind the server to |
| `INVANA_LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warning`, `error` |

### Database (App State)

Invana uses a relational database to store its own state (projects, saved queries, simulation configs) — not your graph data.

| Variable | Default | Description |
|---|---|---|
| `INVANA_DATABASE_URL` | `sqlite+aiosqlite:///./invana.db` | SQLAlchemy async connection string |

For production, use PostgreSQL:

```bash
export INVANA_DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/invana"
```

### Authentication

| Variable | Default | Description |
|---|---|---|
| `INVANA_SECRET_KEY` | (auto-generated) | Secret key for JWT signing. **Set this in production.** |
| `INVANA_TOKEN_EXPIRY_MINUTES` | `1440` | JWT token expiry (default: 24 hours) |
| `INVANA_OAUTH_ENABLED` | `false` | Enable OAuth2/SSO providers |
| `INVANA_OAUTH_PROVIDER` | — | OAuth provider: `google`, `github`, `okta`, `azure-ad` |
| `INVANA_OAUTH_CLIENT_ID` | — | OAuth client ID |
| `INVANA_OAUTH_CLIENT_SECRET` | — | OAuth client secret |

### Studio

| Variable | Default | Description |
|---|---|---|
| `INVANA_STUDIO_ENABLED` | `true` | Serve the Studio web UI. Set `false` for API-only mode. |

## Configuration File

You can also use a `.env` file in the working directory:

```bash
# .env
INVANA_ENV=production
INVANA_DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/invana
INVANA_SECRET_KEY=your-secret-key-here
INVANA_LOG_LEVEL=info
```

## CLI Configuration

All environment variables can also be passed as CLI flags:

```bash
invana start --host 0.0.0.0 --port 9000 --log-level debug
```

CLI flags take precedence over environment variables, which take precedence over defaults.
