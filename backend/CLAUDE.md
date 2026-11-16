# Backend notes

- New feature: `Features/<Feature>/` with `<Feature>Models.cs` (DTOs, `internal static <Feature>Rules`),
  one file per action, `<Feature>Endpoints.cs` with `MapGroup("/<feature>").WithTags(...).RequireAuthorization()`,
  then `api.Map<Feature>()` in `Program.cs`. Use `/new-slice` for the checklist.
- Handler signature pattern: `(…request, ClaimsPrincipal principal, AppDbContext db, TimeProvider clock, CancellationToken ct)`;
  `var userId = principal.UserId();` first.
- Validation order: required fields → ranges (amount 1..`TransactionRules.MaxAmount`) → ownership
  lookups → cross-field rules. Return on the first problem.
- Time: `TimeProvider` for "now", `LocalCalendar` for local dates. No `DateTime.Now`.
- Entity changes need a migration through CI (`/migration`). Never touch `Data/Migrations/`.
- Tests live in `TakaLeaf.App.Tests/Features/<Feature>/<Feature>Tests.cs`; reuse helpers from
  `Auth/AuthClient.cs`, `Wallets/WalletTests.cs`, `Transactions/TransactionTests.cs`.
