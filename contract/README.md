# contract

Files shared by the backend and the TypeScript apps.

- `fixtures/` - inputs and the one correct result for money rules and for cleaning a person's name
  (`person-name.json`). The C# tests and the
  TypeScript tests both read these files; if either side disagrees, the build fails.
- The API's request and response shapes are written by hand in `apps/web/src/api/types.ts` and must
  match the C# DTOs (see docs/ARCHITECTURE.md §5).
