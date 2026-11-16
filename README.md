# TakaLeaf

**Your Money. Your Control.** A personal income and expense tracker in BDT (৳): many wallets,
loans per person, budgets and reports.

## Documents

| Document | What it covers |
| --- | --- |
| [PRODUCT.md](PRODUCT.md) | Who it is for, purpose, brand personality, design principles |
| [DESIGN.md](DESIGN.md) | Visual design system: colours, type, elevation, components (Google Stitch format; sidecar in `.impeccable/`) |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Functional and non-functional requirements, with status |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture, rules, data model, API, security, Android sync plan |
| [docs/UI-UX.md](docs/UI-UX.md) | Navigation, screens, flows, interaction and copy rules |
| [docs/DEVELOPMENT-PLAN.md](docs/DEVELOPMENT-PLAN.md) | Milestones, status, risks |
| [docs/TESTING-PLAN.md](docs/TESTING-PLAN.md) | Test levels, fixtures, case ids, release checklist |
| [CLAUDE.md](CLAUDE.md) | Notes for Claude Code |

Version 1 is the backend and the web app. The Android app (offline, with sync) is version 2.

## Layout

| Folder | What |
| --- | --- |
| `backend/TakaLeaf.App` | .NET 10 API, one project, vertical slices under `Features/` |
| `backend/TakaLeaf.App.Tests` | Backend tests |
| `apps/web` | React + TypeScript + Vite + Tailwind web app |
| `packages/shared` | TypeScript shared by the web app now and the Android app later (money formatting, brand) |
| `contract/` | Fixtures both sides are tested against; the OpenAPI document from M1 |
| `brand/` | Logo and design tokens |
| `deploy/` | Docker Compose files |

## Run it locally

Needs: .NET 10 SDK, Node.js 22+, pnpm, Docker.

```bash
# 1. Database, mail catcher and Seq
docker compose -f deploy/docker-compose.dev.yml up -d

# 2. Backend on http://localhost:5080
dotnet run --project backend/TakaLeaf.App

# 3. Web app on http://localhost:5173 (proxies /api to the backend)
pnpm install
pnpm dev
```

Open http://localhost:5173, create an account, then open the verification link from Mailpit at
http://localhost:8025 (every email sent in development lands there) and sign in.
`backend/TakaLeaf.App/TakaLeaf.App.http` has ready-made requests for trying the API by hand.

### Data protection certificate (local dev)

Data protection keys can be encrypted with a certificate. To make a local development one, run
this in the project root (it writes `dataprotection.pfx`, which Git ignores):

```bash
dotnet dev-certs https -v -ep dataprotection.pfx -p 5e86a1e1-ce12-476c-b3f7-d685f7928265
```

`appsettings.Development.json` already points at it (`../../dataprotection.pfx` from
`backend/TakaLeaf.App`) with that password, and keeps the keys in `backend/TakaLeaf.App/keys`.
Without the file the backend still starts in development (and in CI), logs a warning and keeps the
keys unencrypted. Production uses its own certificate and will not start without it; see
[deploy/production.env.example](deploy/production.env.example).

## Deploying

Production runs on a Linux VPS with Dokploy: one Docker image (API and web app together) and a
PostgreSQL database. Step by step: [deploy/DOKPLOY.md](deploy/DOKPLOY.md).

## Logs

The backend writes structured logs with Serilog to three places:

| Where | What |
| --- | --- |
| Console | One readable line per event |
| `logs/takaleaf-<date>.json` | Compact JSON, one file a day, kept 14 days |
| Seq, http://localhost:5341 | Search and filter every property, for example `UserName = 'you@example.com'` |

Every request writes one line such as
`HTTP POST /api/auth/login responded 200 in 84.2 ms for anonymous from 172.18.0.1`,
and every log line written during a request carries `ClientIp`, `UserName` (the signed-in
user's email, or `anonymous`) and `UserId`. Passwords, tokens, amounts and notes are never logged.

## Configuration

Development settings live in `appsettings.Development.json`. In production, set these as
environment variables (never in Git):

| Setting | Environment variable | What |
| --- | --- | --- |
| Database connection | `ConnectionStrings__Database` | PostgreSQL connection string |
| Token signing key | `Auth__SigningKey` | Random secret, at least 32 characters |
| Web address | `App__WebBaseUrl` | Used in links inside emails |
| Email server | `Email__Host`, `Email__Port`, `Email__Security`, `Email__Username`, `Email__Password`, `Email__From` | SMTP provider |
| Migrations on start | `Database__MigrateOnStartup` | `true` to apply migrations when the API starts |
| Seq address | `Serilog__WriteTo__2__Args__serverUrl` | Where structured logs go; add `Serilog__WriteTo__2__Args__apiKey` if Seq needs a key |
| Reverse proxy | `ReverseProxy__TrustedProxies__0` | IP address of the proxy in front of the API, so the real client IP is logged and rate-limited |

## Tests

```bash
pnpm test                                   # shared package and web app
dotnet test backend/TakaLeaf.App.Tests      # backend (needs PostgreSQL from step 1)
```

## Rules worth knowing

- Money is a whole number of poisha everywhere. `contract/fixtures/` holds the cases that the
  C# and TypeScript code must both pass.
- A backend feature is a folder under `Features/`; each action is one file holding its endpoint,
  request and response types, validation and handler.

## Database migrations

Tables are created by EF Core migrations in `backend/TakaLeaf.App/Data/Migrations`.

- Apply them locally: `dotnet ef database update --project backend/TakaLeaf.App`
- Add one after changing an entity: `dotnet ef migrations add <Name> --project backend/TakaLeaf.App --output-dir Data/Migrations`
- Or let CI add it: on a feature branch, commit a file `backend/.migration-request` containing the name and push.
