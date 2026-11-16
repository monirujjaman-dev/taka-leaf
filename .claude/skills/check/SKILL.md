---
name: check
description: Run every TakaLeaf check that CI runs (web typecheck, tests and build; backend tests) and report failures with their cause.
allowed-tools: Bash(pnpm typecheck) Bash(pnpm test) Bash(pnpm build) Bash(dotnet test *) Bash(dotnet build *)
---

Run the same checks as CI and report only what failed and why.

1. `pnpm typecheck && pnpm test && pnpm build`
2. If PostgreSQL is running (`docker compose -f deploy/docker-compose.dev.yml ps`), run
   `dotnet test backend/TakaLeaf.App.Tests`. If .NET or the database is not available here, say so;
   CI on the pull request is then the backend check.
3. For each failure, give the test or file, the error, and the likely cause. Fix it if it is in
   code changed in this session; otherwise report it.
