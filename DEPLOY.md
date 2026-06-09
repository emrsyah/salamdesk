# Deploying SalamDesk

SalamDesk is two deployable units sharing one Postgres + one Redis:

| Unit            | What it is                                  | Where it goes        |
| --------------- | ------------------------------------------- | -------------------- |
| **Web app**     | Next.js dashboard + API (queue producer)    | **Vercel**           |
| **Worker**      | Baileys WhatsApp socket + BullMQ workers    | **VPS** (Docker)     |
| Postgres        | shared by both                              | Neon / Supabase      |
| Redis           | shared by both (BullMQ + pub/sub)           | Upstash (TCP)        |

The web app **enqueues** jobs and the VPS worker **consumes** them — so both
must point at the *same* Redis and the *same* Postgres.

---

## 1. Web app → Vercel

Import the repo in Vercel (it auto-detects Next.js). Set these env vars in the
Vercel project (Settings → Environment Variables):

```
DATABASE_URL              # same managed Postgres as the worker
REDIS_URL                 # same Upstash TCP Redis as the worker (rediss://...)
OPENROUTER_API_KEY
OPENROUTER_MODEL
BETTER_AUTH_URL           # your https://your-app.vercel.app URL
VOYAGE_API_KEY
VOYAGE_EMBEDDING_MODEL
UPLOADTHING_TOKEN
```

That's it — `next build` / `next start` is fully serverless-friendly. Push to
`main` and Vercel redeploys automatically.

---

## 2. Worker → VPS (Docker)

One-time setup on a fresh VPS (Ubuntu/Debian):

```bash
# Install Docker + compose plugin
curl -fsSL https://get.docker.com | sh

# Clone the repo (this becomes VPS_APP_DIR for the auto-deploy workflow)
git clone https://github.com/emrsyah/salamdesk.git
cd salamdesk

# Configure secrets
cp .env.worker.example .env.worker
nano .env.worker          # fill in DATABASE_URL, OPENROUTER_*, VOYAGE_*, etc.

# Build & start the worker
docker compose -f docker-compose.worker.yml up -d --build

# Scan the WhatsApp QR (printed on first boot)
docker compose -f docker-compose.worker.yml logs -f worker
```

The WhatsApp session is stored in the `wa-auth` Docker volume, so restarts and
rebuilds keep you logged in — no re-scanning the QR.

Useful commands:

```bash
docker compose -f docker-compose.worker.yml logs -f worker   # tail logs
docker compose -f docker-compose.worker.yml restart worker   # restart
docker compose -f docker-compose.worker.yml down             # stop everything
```

---

## 3. Shared Redis (Upstash)

Both the Vercel app and the VPS worker use the **same Upstash Redis** — that's
how enqueued jobs reach the worker.

1. Create a Redis database in the [Upstash console](https://console.upstash.com).
2. Copy the **TCP** connection string (starts with `rediss://`) — **not** the
   REST URL. BullMQ needs a real TCP connection with blocking commands, so the
   REST/serverless endpoint will not work.
3. Set the same `REDIS_URL=rediss://default:<password>@<host>:6379` on **both**
   Vercel (env vars) and the VPS (`.env.worker`).

No Redis container runs on the VPS — `docker-compose.worker.yml` only runs the
worker.

---

## 4. Auto-deploy on push (optional)

`.github/workflows/deploy-worker.yml` SSHes into the VPS and rebuilds the
worker whenever worker code changes on `main`. Add these repo secrets
(Settings → Secrets and variables → Actions):

| Secret         | Value                                            |
| -------------- | ------------------------------------------------ |
| `VPS_HOST`     | VPS IP or hostname                               |
| `VPS_USER`     | SSH user (e.g. `root` or `deploy`)               |
| `VPS_SSH_KEY`  | private SSH key with access to the VPS           |
| `VPS_PORT`     | SSH port (optional, defaults to 22)              |
| `VPS_APP_DIR`  | absolute path to the cloned repo on the VPS      |

After that, `git push` → Vercel redeploys the web app and the Action redeploys
the worker, in parallel.
