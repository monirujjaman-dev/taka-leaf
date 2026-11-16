# TakaLeaf

**Your Money. Your Control.** A personal income and expense tracker in BDT (৳): many wallets,
loans per person, budgets and reports.

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
