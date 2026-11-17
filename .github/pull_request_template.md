## What

<!-- One or two sentences. Tables help for endpoints or screens. -->

## Why

<!-- The requirement (docs/REQUIREMENTS.md id), bug or plan item this answers. -->

## How it was tested

- [ ] `pnpm typecheck && pnpm test && pnpm build`
- [ ] `dotnet test backend/TakaLeaf.App.Tests`
- [ ] UI: 390 px and desktop, light and dark (if screens changed)

## Checklist

- [ ] Branch follows [docs/GIT-WORKFLOW.md](../blob/develop/docs/GIT-WORKFLOW.md) (`feature/…`, `fix/…` → `develop`; `hotfix/…` → `main`)
- [ ] Money in poisha, queries scoped by `UserId`, soft delete, Asia/Dhaka dates
- [ ] No hand-edited `Data/Migrations` (use `backend/.migration-request`)
- [ ] Docs updated (`docs/ARCHITECTURE.md`, `DESIGN.md`, requirement and plan status)

<!-- Auto merge squash-merges this when CI, Branch policy and Claude review are green.
     Label no-auto-merge to hold it, no-auto-fix to stop Claude fixing it. -->
