# Sanlian Connect

**A bookstore community platform for cultural events, reading, and meaningful encounters.**

[简体中文](README.zh-CN.md)

Sanlian Connect brings event discovery, registration, participant feedback, and store administration into one web application for the Sanlian Bookstore Tianjing Lake community. Built as a student team project, it uses a vanilla JavaScript frontend, an Express backend, and PostgreSQL.

**[Open the shared test website](https://sanlian-connect.onrender.com)**

The shared test site runs on Render and stores its data in Neon. Initial event and book examples are fictional. Local development uses a separate database.

## Features

- **Discover events:** browse published events in the next 60 days, search and filter the event list, or expand the window to 180 days.
- **Register and manage attendance:** view availability, register with contact consent, view personal tickets, and cancel eligible registrations to release places.
- **Share feedback:** checked-in participants can submit feedback immediately, including while the event is still running. Other valid registrations become eligible after the event ends. Entry points appear in My registrations, event details, and Activity feedback; administrators can view and reply, and participants can read their own replies.
- **Manage an account:** register, sign in, update a display name, and use database-backed sessions.
- **Administer the community:** manage users, events, registrations, feedback, and operation logs from the administrator dashboard.
- **Explore a sample bookshelf:** browse a basic demonstration of book recommendations.
- **AI reading assistant (local implementation):** a floating DeepSeek chat panel searches live published events and sample books, opens book details, and prepares the event confirmation form. Sign-in is required for chat; the user supplies missing contact details, checks consent, and personally submits. Package checkout and payments are not implemented. This change has not yet been deployed to the shared site.

The two application roles are `user` and `stuff`. The spelling `stuff` is intentional: it is the project's administrator role. Public registration always creates a `user` account.

## Architecture

**Browser → Node.js / Express on Render → PostgreSQL on Neon**

| Layer | Technology and responsibility |
| --- | --- |
| Frontend | HTML, CSS, and vanilla JavaScript; event pages, forms, and dashboard |
| Backend | Node.js and Express; validation, authorization, and business rules |
| Database | PostgreSQL with `pg`; accounts, sessions, events, registrations, feedback, books, and logs |
| Collaboration | GitHub; source code, schema, migration tools, and review |

The browser submits data to the backend, which checks it before reading or writing the database. Private queries are scoped to the signed-in user. Registration transactions lock the event row and enforce capacity and duplicate-registration constraints. Administrative changes and their logs are committed together.

GitHub stores the code and database definitions. Live business records and database credentials are kept outside the repository.

## Run locally

Use Node.js **22.20.0**, the version pinned in [`.node-version`](.node-version) and used for the latest local verification.

```powershell
git clone https://github.com/hxs898570462/sanlian-connect.git
cd sanlian-connect
npm ci
```

For a private repository, your GitHub account must have access before cloning.

In the first terminal, start PostgreSQL:

```powershell
npm run db:local
```

This starts a real local PostgreSQL server at `127.0.0.1:55432` without installing a system service. Data is stored in `data/postgres`. If `.env` does not exist, the command creates it with a randomly generated database password; an existing `.env` is preserved. Keep this terminal running.

In a second terminal, from the project directory:

```powershell
npm run dev
```

Open **[localhost:3000](http://localhost:3000)**. Use `npm start` to run without file watching. Stop the web server before stopping PostgreSQL.

Each developer's local database is independent of the shared website. Cloning the repository does not download cloud accounts, registrations, or credentials. Set `SEED_DEMO=true` in your local `.env` before starting the app if you want fictional sample events and books in a fresh database.

## Configuration

See [`.env.example`](.env.example) for a safe configuration template. The application loads `.env`; existing process environment variables take precedence.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL connection URI; preserve the provider's TLS settings for cloud connections |
| `SEED_DEMO` | Defaults to `false`; `true` creates fictional events and books when the activities table is empty |
| `PORT` | HTTP port; defaults to `3000`, or the value supplied by the hosting platform |
| `NODE_ENV` | Set to `production` for HTTPS hosting and secure cookies |
| `APP_ORIGIN` | Exact website origin; on Render, defaults to the platform-provided `RENDER_EXTERNAL_URL` |
| `HOST` | Defaults to `127.0.0.1` locally and `0.0.0.0` in production |
| `TRUST_PROXY_HOPS` | Trusted proxy hop count; defaults to `0` locally and initially `1` on Render; verify the actual forwarding path before changing it |
| `DEEPSEEK_API_KEY` | Optional private API key; enables the AI assistant when configured on the backend |
| `DEEPSEEK_BASE_URL` | Defaults to `https://api.deepseek.com`; only the official HTTPS endpoint is accepted |
| `DEEPSEEK_MODEL` | Defaults to `deepseek-flash` |
| `DEEPSEEK_PROXY_URL` | Optional existing loopback HTTP proxy for local development; do not set on Render; rejected in production |

AI setup, privacy, limits, and the confirmation flow are documented in [the assistant guide](docs/assistant.md). AI calls incur provider usage charges. Render needs its own private key environment variable; your local `.env` is not uploaded.

`DB_PATH` is no longer used. The runtime database is PostgreSQL; SQLite is retained only for legacy imports and migration tests.

Dates use PostgreSQL `TIMESTAMPTZ`. APIs return UTC ISO strings and the interface displays China Standard Time. Monetary values are stored as integer cents; compatibility flags use `0`/`1`.

## Accounts and administration

Regular users can access public content and their own profile, registrations, and feedback. Administrators can manage business data through the dashboard. Role and account-status changes revoke the affected account's existing sessions.

Create an administrator in the database selected by your local `.env` / `DATABASE_URL`:

```powershell
npm run create-admin
```

Promote an existing account while retaining its password and revoking old sessions:

```powershell
npm run create-admin -- --promote
```

Check the target environment before either command. Use individual accounts instead of a shared administrator password. For cloud administrator setup using a separate private `.env.cloud`, see the [deployment guide](docs/deployment.md).

## Testing

```powershell
npm test
```

Tests start a temporary real PostgreSQL instance and create isolated test databases. Multi-instance scenarios use two HTTP servers with independent connection pools. The temporary databases and server are cleaned up afterward; the development database is not cleared.

The latest local run on **October 30, 2026** passed **62 tests**, including parent tests. Coverage includes competing for the last event place, duplicate registrations, administrator/user races, account isolation, session revocation, feedback during ongoing events after check-in, duplicate-feedback races and administrator replies, restart persistence, administrator commands, deployment checks with a simulated proxy, both migration paths with rollback checks, and the AI assistant's queries, confirmation boundary, conversation isolation, rate limits, and error handling. The updated feedback flow and AI assistant are local changes awaiting deployment to the shared site.

An existing test server can be supplied with `TEST_DATABASE_URL`; its account needs permission to create and drop isolated test databases. Do not use the shared or production database as the test target.

## Deployment and data migration

The shared test website is deployed to **Render**, with **Neon PostgreSQL** storing persistent business data. Local records were migrated to Neon and verified field by field after reconnecting. The project owner also confirmed that the original account, administrator dashboard, and personal registrations work online. The full multi-member development workflow and the actual proxy forwarding path still need their own verification.

| Render setting | Value |
| --- | --- |
| Runtime / branch | Node / `main` |
| Root directory | Leave empty; `package.json` is at the repository root |
| Build command | `npm ci --omit=dev` |
| Start command | `npm start` |
| Health check | `/api/health` |
| Environment | `NODE_ENV=production`, a private Neon `DATABASE_URL`, and `SEED_DEMO=false` after initial setup |

Database records live in Neon rather than Render's local filesystem. Keep credentials in private environment settings, and back up data before structural changes or bulk operations. Use `pg_dump` or provider exports for regular PostgreSQL backups; copying a running database's data directory is not a reliable backup procedure.

Two one-time migration tools are available:

- **Legacy SQLite → PostgreSQL:** `npm run migrate:sqlite` creates a consistent source backup and only imports into a target with empty business tables. It preserves IDs, password hashes, and relationships, maps legacy roles to `user` / `stuff`, and rolls back failed imports. Invalid dates, relationships, duplicates, or over-capacity records are rejected. See the [PostgreSQL notes](docs/postgresql.md).
- **Local PostgreSQL → Neon:** `node scripts/migrate-postgres.js` audits and backs up the two databases. Only an explicit `--apply` performs the import, and the target must be empty or contain only unmodified default demo data. See the [cloud migration record](docs/postgres-to-neon.md).

The existing project has already been migrated. Do not repeat an import against the shared database. These tools perform one-time copies; local and cloud databases do not synchronize afterward. Changes to existing tables require explicit migration scripts: editing `CREATE TABLE IF NOT EXISTS` in `schema.sql` does not update existing columns.

## Team workflow

1. Accept the repository invitation, clone the project, and run your own local database.
2. Create a feature branch from an up-to-date `main`.
3. Make changes, run the relevant tests, and review affected pages.
4. Open a pull request explaining the behavior, validation, and any database changes.
5. Have another member review it before merging. If automatic deployment is enabled, Render deploys updates to its linked branch.

GitHub collaborator access and website roles are separate permissions. All members testing the shared website use the same cloud database, subject to their application permissions; local development does not need the shared database password.

**Documentation rule:** whenever a README is updated, update both `README.md` and `README.zh-CN.md` in the same change. Keep their features, commands, configuration, status, and links aligned. This rule is also recorded in [AGENTS.md](AGENTS.md).

## Project structure

```text
public/       Pages, styles, and frontend interactions
server/       Express APIs, authorization, queries, and schema.sql
scripts/      Local database, tests, administrator setup, and migration tools
test/         Real PostgreSQL integration tests and legacy schema fixtures
docs/         Deployment, access control, collaboration, and migration records
data/         Private local databases and backups; excluded from Git
```

Further documentation is currently in Chinese: [deployment](docs/deployment.md), [access control](docs/access-control.md), [team collaboration](docs/team-collaboration.md), [PostgreSQL conversion](docs/postgresql.md), [cloud migration](docs/postgres-to-neon.md), and [historical Softr migration](docs/migration.md).
