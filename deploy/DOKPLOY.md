# Deploying TakaLeaf with Dokploy

TakaLeaf runs as **one Docker container** (the API and the web app together, on port 8080) next to
a **PostgreSQL** database. Dokploy builds the container from this repository, puts it on your domain
with a free Let's Encrypt certificate, and backs the database up to S3-compatible storage.

```
Browser ──HTTPS──▶ Traefik (Dokploy) ──▶ takaleaf app :8080 ──▶ PostgreSQL (Dokploy database)
                                              │
                                              └─ SMTP provider (verification and reset emails)
```

## Before you start

- A Linux VPS with Dokploy installed, **at least 2 GB RAM** (building the image needs it).
- The domain `takaleaf.monirujjaman.dev` (or your own), with a DNS **A record** pointing to the VPS.
- An SMTP account for email (any provider; you need host, port, username, password and a sender address).
- For backups: an S3-compatible bucket (Cloudflare R2, Backblaze B2, AWS S3, MinIO…).

## 1. Project and database

1. Dokploy → **Projects → Create Project**, name it `TakaLeaf`.
2. In the project: **Create Service → Database → PostgreSQL**.
   - Name: `takaleaf-db` · Database name: `takaleaf` · User: `takaleaf` · Password: a long random one.
   - Image: `postgres:18`.
   - Do **not** set an external port; the app reaches it inside Dokploy.
3. Deploy the database, then copy its **Internal Host** from the database's General tab.
4. Optional, for faster dashboards and reports: **Create Service → Database → Redis**, name
   `takaleaf-cache`, image `redis:8-alpine`, a password, no external port. Deploy it and copy its
   **Internal Host**. Without Redis the app still caches, in its own memory.

## 2. The app

1. In the project: **Create Service → Application**, name it `takaleaf`.
2. **Provider**: GitHub (connect Dokploy's GitHub App the first time and give it access to
   `monirujjaman-dev/taka-leaf`). Repository `taka-leaf`, branch `main`.
3. **Build Type**: `Dockerfile` · Dockerfile path: `Dockerfile` · Docker context path: `.`
4. **Environment**: paste [`production.env.example`](production.env.example) and fill in every `<...>`.
   Make the signing key with `openssl rand -base64 48`.
5. **Advanced → Volumes/Mounts**: add a volume mount, name `takaleaf-logs`, mount path `/app/logs`
   (keeps the daily log files across deploys). Add a second one, name `takaleaf-keys`, mount path
   `/app/keys` (keeps the data protection keys).
6. **Data protection certificate.** The app will not start without it. A `.pfx` is a binary file,
   so it cannot go in Dokploy's File Mount (that one takes pasted text). Copy it to the server and
   bind-mount it instead:
   1. Make the certificate once, on your own computer (the `DataProtection__*` lines in the
      environment example have the `openssl` commands). Keep the `.pfx` and its password in your
      password manager: without them the saved keys cannot be read.
   2. Copy it to the VPS and let the container's app user read it:
      ```bash
      ssh root@<your-vps> "mkdir -p /etc/takaleaf"
      scp dataprotection.pfx root@<your-vps>:/etc/takaleaf/dataprotection.pfx
      ssh root@<your-vps> "chmod 644 /etc/takaleaf/dataprotection.pfx"
      ```
   3. **Advanced → Volumes/Mounts → Bind Mount**: host path `/etc/takaleaf/dataprotection.pfx`,
      mount path `/app/certs/dataprotection.pfx`.
   4. **Environment**: set `DataProtection__CertificatePassword` to the certificate's password.
7. **Domains → Add Domain**: host `takaleaf.monirujjaman.dev`, path `/`, **container port `8080`**,
   HTTPS on, certificate **Let's Encrypt**.
8. **Deploy**. The first build takes a few minutes. On start the app creates or updates the
   database tables by itself (`Database__MigrateOnStartup=true` is set in the image).

## 3. Check it

- `https://takaleaf.monirujjaman.dev/api/health` shows `{"status":"ok","database":"up","cache":"memory"}` (`"up"` with Redis).
- Open the site, create your account, open the link from the verification email, sign in.
- Optional: set `Auth__RegistrationOpen=false` in the app's Environment and redeploy, so nobody else can register.
- In the app's **Logs** tab, request lines show your real IP address. If they show a `10.x.x.x`
  address instead, the proxy network is different on your server: put that network (for example
  `172.16.0.0/12`) in `ReverseProxy__TrustedNetworks__0`.

## 4. Backups

1. Dokploy → **Settings → Destinations → Add Destination** (S3 compatible): bucket, region,
   endpoint, access key, secret key. Use **Test** before saving.
2. Database `takaleaf-db` → **Backups → Add Backup**: the destination, database `takaleaf`,
   schedule `0 21 * * *` (21:00 UTC = 3 AM in Dhaka), keep `14`.
3. Run one backup by hand and **restore it once into a scratch database** to be sure it works.
4. Optional: also turn on Dokploy's own backup (Settings → Web Server → Backups), which saves the
   Dokploy setup itself, including these environment variables.

## Updating

Turn on **Autodeploy** in the app's General tab: every merge to `main` builds and deploys a new
version, and the app applies new database migrations as it starts. Before a release that changes
the database, take a manual backup first (Backups → Run).

## If something goes wrong

| What you see | Check |
| --- | --- |
| Build stops or the server freezes during the build | The VPS needs about 2 GB of free memory while building. Add swap or a bigger plan. |
| The app restarts straight after starting | Its Logs tab. Usually a missing `ConnectionStrings__Database` or a `Auth__SigningKey` shorter than 32 characters. |
| Logs say `DataProtection certificate not found` or `could not be opened` | The bind mount (host `/etc/takaleaf/dataprotection.pfx` → `/app/certs/dataprotection.pfx`), that the file is readable (`chmod 644`), and `DataProtection__CertificatePassword`. |
| `/api/health` says `"cache":"down"` | The host and password in `ConnectionStrings__Redis`, and that the Redis service is running. The app keeps working, reading from PostgreSQL. |
| `/api/health` says `"database":"down"` | The Internal Host and password in `ConnectionStrings__Database`, and that the database service is running. |
| No verification email arrives | The app logs show the SMTP error. Check `Email__*`, and that the sender address is allowed by the provider. |
| Certificate does not issue | The DNS A record must point to the VPS, and ports 80 and 443 must be open. |
| Signed out after every deploy | `Auth__SigningKey` changed between deploys; keep it fixed in Dokploy's environment. |
