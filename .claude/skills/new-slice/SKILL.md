---
name: new-slice
description: Add a backend endpoint or feature to TakaLeaf as a vertical slice, with tests and the matching web types. Use when adding or extending an API endpoint.
argument-hint: "[Feature/Action, e.g. Tags/AddTag]"
---

Add the slice **$ARGUMENTS** following the project's conventions (see CLAUDE.md and docs/ARCHITECTURE.md).

1. Read the closest existing feature first (for example `Features/Budgets/Budgets.cs` for a small
   one, `Features/Transactions/` for a larger one) and copy its shape.
2. Backend, in `backend/TakaLeaf.App/Features/<Feature>/`:
   - DTO and request records (amounts `long` poisha, enums as enums, nullable request fields).
   - Rules in `<Feature>Models.cs` → `internal static class <Feature>Rules` if more than one action needs them.
   - The action file: map the route, `principal.UserId()`, validate with `ValidationErrors.For`,
     scope every query by `UserId`, `NotFound.Problem` for missing or foreign rows,
     soft delete with `DeletedAt`, `await db.SaveChangesAsync(ct)`.
   - Register in `<Feature>Endpoints.cs` and `Program.cs` if the group is new.
   - Entity change? Stop here and run the `/migration` steps before going further.
3. Tests in `backend/TakaLeaf.App.Tests/Features/<Feature>/`: the happy path, each validation
   rule, and "another account cannot see or change it". Use the existing helpers.
4. Web: add the type to `apps/web/src/api/types.ts` and a hook to `api/queries.ts`
   (money changes → `useInvalidateMoney`).
5. Add a request to `backend/TakaLeaf.App/TakaLeaf.App.http` and update docs/ARCHITECTURE.md §5 (API) and §4 if
   the data model changed.
6. Run `/check`.
