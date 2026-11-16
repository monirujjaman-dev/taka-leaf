# Web notes

- Visual rules: `DESIGN.md` (tokens, components, do's and don'ts) and `PRODUCT.md` (principles).
  Screen and interaction rules: `docs/UI-UX.md`. Change those docs when the UI changes.

- Pages: `src/pages/<area>/<Area>Page.tsx`; forms are modals (`ui/Modal.tsx`) with local state,
  client-side checks first, then the server's field errors via `ApiError.field(name)`.
- Data: add hooks in `src/api/queries.ts`, types in `src/api/types.ts`. Anything that changes money
  invalidates with `useInvalidateMoney()`.
- Amount inputs: `AmountField` + `parseTaka` → poisha; show with `formatBdt`. Dates: helpers in
  `ui/format.ts` (Asia/Dhaka), never `toLocaleDateString` without the time zone.
- Navigation items live in `layout/AppShell.tsx` (`NAV`); phones show at most five tabs.
- Check visually at 390 px and 1440 px, light and dark. Run `pnpm typecheck && pnpm test`.
