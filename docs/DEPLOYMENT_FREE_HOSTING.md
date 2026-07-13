# Deploying CaseLens for Free

This guide explains how to publish CaseLens so anyone can access it, entirely on
free tiers.

## This app is now fully free-hostable

By default (`DOCUMENT_PROCESSING_MODE=inline`), the whole document pipeline —
PDF extraction, chunking, embedding, and AI analysis — runs **inside the API
process** as a background task. There is **no Temporal server and no separate
worker to host**. That collapses the deployment to four pieces, all of which
have real free tiers:

| Component | What it is | Free host |
|---|---|---|
| **Web** | Next.js frontend | Vercel (serverless/CDN) |
| **API** | FastAPI backend (runs the pipeline inline) | Render / Fly.io / Koyeb |
| **Postgres + pgvector** | Database + vector search | Supabase / Neon |
| **Object storage** | Uploaded PDFs (S3-compatible) | Cloudflare R2 |
| _Redis_ | Currently unused (reserved for Phase 2) | Skip |
| _Temporal + Worker_ | Optional (only if `DOCUMENT_PROCESSING_MODE=temporal`) | Not needed |

The only always-on process is the **API**. On a free tier it may cold-start
after idle (first request is slow), but there are no paid components.

> **Trade-off of inline mode:** if the API process restarts while a document is
> mid-processing, that document is left in `PROCESSING`/`ERROR` and can be
> re-processed by calling **Analyze** again. For heavy/parallel processing at
> scale you can switch back to `DOCUMENT_PROCESSING_MODE=temporal` and run the
> worker — but for free hosting and normal usage, inline is the right choice.

---

## Recommended free-tier stack

| Layer | Service | Free tier | Notes |
|---|---|---|---|
| Web | **Vercel** | Yes, generous | Ideal for Next.js. Zero config. |
| Database | **Supabase** or **Neon** | Yes | Both include `pgvector`. |
| Object storage | **Cloudflare R2** | 10 GB free | S3-compatible → works with existing boto3 code. |
| API + Worker + Temporal | **Render** or **Fly.io** | Limited | See the two options below. |

---

## Step 1 — Database (Supabase, free)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, enable extensions:
   ```sql
   create extension if not exists vector;
   create extension if not exists "uuid-ossp";
   ```
3. Copy the connection string and convert it to async form for CaseLens:
   `postgresql+asyncpg://USER:PASSWORD@HOST:5432/postgres`
4. Run migrations against it once:
   ```bash
   cd apps/api && DATABASE_URL="postgresql+asyncpg://..." uv run alembic upgrade head
   ```

## Step 2 — Object storage (Cloudflare R2, free)

1. Create an R2 bucket at [dash.cloudflare.com](https://dash.cloudflare.com) → R2.
2. Create an R2 API token (Access Key + Secret).
3. Set on the API and Worker:
   ```
   STORAGE_BACKEND=minio            # the code's S3-compatible client works with R2
   STORAGE_ENDPOINT=<accountid>.r2.cloudflarestorage.com
   STORAGE_ACCESS_KEY=<r2 access key>
   STORAGE_SECRET_KEY=<r2 secret key>
   STORAGE_BUCKET_NAME=caselens-documents
   STORAGE_USE_SSL=true
   ```

## Step 3 — API (the only always-on service)

Deploy **just the API** — it runs the document pipeline inline, so there's
nothing else to stand up.

### Option A — Render (simplest)

- Create a **Web Service** from `apps/api`.
- Build: `uv sync` · Start: `uvicorn caselens.main:app --host 0.0.0.0 --port $PORT`
- Or point Render at `infrastructure/docker/Dockerfile.api`.
- Caveat: free web services **spin down after ~15 min idle**, so the first
  request after idle is slow (cold start). Fine for a free public demo.

### Option B — Fly.io (no cold starts within allowance)

- `fly launch` from `infrastructure/docker/Dockerfile.api`. A card is required,
  but light traffic stays within the free allowance.

Either way, keep `DOCUMENT_PROCESSING_MODE=inline` (the default) — do **not**
set `TEMPORAL_HOST`; it isn't used.

## Step 4 — Web (Vercel, free)

1. Import the repo at [vercel.com](https://vercel.com); set **Root Directory** to
   `apps/web`.
2. Environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-api.onrender.com   # your deployed API URL
   NEXT_PUBLIC_APP_NAME=CaseLens
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your google web client id>   # optional
   ```
3. Deploy. Vercel gives you `https://your-app.vercel.app`.

## Step 5 — Wire the pieces together

On the **API** service, set:
```
APP_ENV=production
APP_DEBUG=false
APP_SECRET_KEY=<random 64 chars>
JWT_SECRET_KEY=<different random 64 chars>
DATABASE_URL=<supabase async url>
CORS_ORIGINS=https://your-app.vercel.app
# AI provider keys (free tier)
GEMINI_API_KEY=...
CEREBRAS_API_KEY=...
GROQ_API_KEY=...
NVIDIA_API_KEY=...
OPENROUTER_API_KEY=...
AI_CHAT_PROVIDER_CHAIN=cerebras,groq,gemini,nvidia,openrouter
AI_ANALYSIS_PROVIDER_CHAIN=cerebras,groq,nvidia,openrouter
AI_EMBEDDING_PROVIDER_CHAIN=gemini
GOOGLE_CLIENT_ID=<same google web client id>   # optional
```
(No worker to configure — the API runs the pipeline itself.)

## Step 6 — Google Sign-In (optional)

1. [console.cloud.google.com](https://console.cloud.google.com) → APIs &
   Services → Credentials → Create **OAuth client ID** → **Web application**.
2. **Authorized JavaScript origins**: add `https://your-app.vercel.app` (and
   `http://localhost:3000` for local dev).
3. Copy the client ID into both `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Vercel) and
   `GOOGLE_CLIENT_ID` (API). The "Continue with Google" button activates
   automatically once both are set.

## Cost reality check

- **Free**: Web (Vercel), API (Render/Fly), Database (Supabase/Neon), Storage
  (R2), all five AI providers (free tiers). No paid component is required.
- **Only caveat**: on a free API host the service may cold-start after idle
  (first request slow). Upgrading the API to a small always-on instance (a few
  $/mo) removes the cold start but is entirely optional.

## Security before you go live

- Rotate every secret; never ship the dev defaults in `.env`.
- Remove the committed dev `OPENAI_API_KEY` from any real deployment.
- Set `APP_DEBUG=false` and a strict `CORS_ORIGINS`.
- Serve everything over HTTPS (all the hosts above do by default).
