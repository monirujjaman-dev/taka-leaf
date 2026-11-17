# Android app notes

- Expo SDK 58 / React Native 0.88, Android only. Read `docs/ARCHITECTURE.md` §11 (stack, sync design)
  and the A1–A4 lists in `docs/DEVELOPMENT-PLAN.md` before changing behaviour.
- Install native libraries with `EXPO_OFFLINE=1 npx expo install <pkg>` (the Expo version service is
  not reachable from Claude sessions; offline mode uses the versions bundled with the SDK).
- The phone never waits for the network: every write goes to SQLite first (and, from A2, to the outbox
  in the same transaction).
- Database: change `src/db/schema.ts`, then `pnpm --filter @takaleaf/mobile db:generate` (drizzle-kit
  writes `drizzle/`). Never edit generated migrations. Queries go in store files that take `AppDb`, so
  they are tested in Node with `openTestDb()` (sql.js, same migrations).
- Money rules are the same as everywhere: integer poisha, `formatBdt` / `parseTaka` from
  `@takaleaf/shared`, balances calculated, dates in Asia/Dhaka.
- Colours from `useColors()` (`packages/shared` `themes`), light and dark from the phone setting.
  Touch targets at least 48 dp; every input has an accessibility label.
- Checks: `pnpm --filter @takaleaf/mobile typecheck && pnpm --filter @takaleaf/mobile test`, and
  `pnpm --filter @takaleaf/mobile bundle` to prove Metro can bundle. The Android workflow builds the APK.

## Release builds

- R8 shrinks release builds. Libraries that create classes by reflection need keep rules in
  `app.json` (`expo-build-properties` → `android.extraProguardRules`); WorkManager's Room
  database is one (without it the app closed on start).
- CI's "Opens on Android 16" job launches the release APK on an emulator; nothing is published
  unless it stays open.
