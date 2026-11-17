# TakaLeaf for Android

## Try it on your phone (no Android Studio needed)

1. On the phone, open TakaLeaf on the web (https://takaleaf.monirujjaman.dev) and sign in, and tap
   **More → Get the Android app**. (The same file is the latest
   release on GitHub: every green Android build on `main` is published there.)
2. Copy the APK to the phone and open it. Allow "Install unknown apps" for your file manager or browser
   when Android asks. (Until A4 the APK is signed with a development key; you will reinstall the
   properly signed one then.)
3. Open **TakaLeaf**. The A1 screen is called **Setup checks**.

### The two A1 experiments

| Check | What to do | It works when |
| --- | --- | --- |
| 1. Saved on this phone | Save a note or two. Swipe the app away from recent apps (or restart the phone) and open it again. | The notes are still listed. |
| 2. Works with the app closed | Enter your server address and tap **Check now** (an "app" row appears). Then close the app and leave the phone for an hour or two, unplugged and plugged in at least once. | Rows marked **background** appear under Server checks. |

If no background rows appear after a few hours, open Android **Settings → Apps → TakaLeaf → Battery**
and choose **Unrestricted**, then try again. Tell Claude the phone model and Android version either way;
the sync design falls back to syncing on open, on save and on the Sync button if background runs are rare.

## Develop with Android Studio

```bash
pnpm install
pnpm --filter @takaleaf/mobile android   # builds a development app onto a connected phone or emulator
pnpm --filter @takaleaf/mobile start     # Metro for the development app afterwards
```

The development app shows **Run the background task now** to test the task without waiting.

## What the app does

Everything in TakaLeaf works offline on the phone: wallets, income, expenses and transfers (with
fees), people and loans, budgets, recurring entries, reports and categories. Changes are saved in
SQLite first and synced with your server when there is a connection. More → Sync shows what is
waiting and anything the server did not accept. More → App lock adds a PIN or fingerprint, and
More → Daily reminder a notification each evening.
