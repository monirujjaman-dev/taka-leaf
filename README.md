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
# 1. Database and mail catcher
docker compose -f deploy/docker-compose.dev.yml up -d

# 2. Backend on http://localhost:5080
dotnet run --project backend/TakaLeaf.App

# 3. Web app on http://localhost:5173 (proxies /api to the backend)
pnpm install
pnpm dev
```

Emails sent in development (verification links) arrive in Mailpit at http://localhost:8025.
`backend/TakaLeaf.App/TakaLeaf.App.http` has ready-made requests for trying the API by hand.

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
