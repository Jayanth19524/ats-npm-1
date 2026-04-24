# Pulse ATS

Applicant Tracking System — Express backend + React frontend.

---

## Prerequisites

- **Node.js** 20+
- **Docker** (for Postgres, S3, email in local dev)
- **npm** 10+

---

## Local Development (Full Stack)

### 1 — Start infrastructure

```bash
docker compose up
```

This starts:
| Service | URL |
|---|---|
| Postgres | `localhost:5432` |
| LocalStack (S3) | `localhost:4566` |
| MailHog (email) | `localhost:1025` SMTP / `localhost:8025` web UI |

### 2 — Set up the backend

```bash
cd backend

# Copy local env (Postgres + LocalStack + MailHog pre-configured)
cp .env.localstack .env

# Install dependencies (includes AWS SDK)
npm install

# Push DB schema
npm run db:push

# Seed with sample data
npm run seed

# Start dev server (hot-reload)
npm run dev
```

Backend runs at **http://localhost:8080**

### 3 — Set up the frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:5173**

---

## Testing S3 (LocalStack)

Upload a resume via the UI, then verify it landed in LocalStack:

```bash
# List uploaded files
aws --endpoint-url=http://localhost:4566 s3 ls s3://pulse-resumes-local/resumes/

# Resume download URLs returned by the API are authenticated app URLs.
# Open them while signed in to the app.
```

Requires `aws` CLI. Install via `brew install awscli` or `pip install awscli`.

---

## Testing Email (MailHog)

Trigger an email by:
- Moving a candidate to a stage that has **Send email** enabled with a template, OR
- Using **POST /api/candidates/:id/email** directly

Then open **http://localhost:8025** to see the full rendered email in MailHog's inbox.

---

## Production Deploy

This repo now includes a simple Docker-based production deployment:

```bash
cp backend/.env.production.example backend/.env.production

# edit backend/.env.production with real values first

docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Then run the database schema push once:

```bash
docker compose -f docker-compose.prod.yml exec backend npm run db:push
```

The app will be available on port `80` through the frontend container, which:
- serves the React SPA
- proxies `/api/*` to the backend container

Recommended production setup:
- use a real managed Postgres instead of the bundled `postgres` service when possible
- use a private S3 bucket for resumes
- for direct browser-to-S3 resume uploads, add an S3 CORS rule that allows `PUT` from your frontend origin and the `x-amz-tagging` header
- new S3 resumes are tagged `scan-status=pending`; serve them only after your scanner flips the tag to `clean`
- keep `SERVE_PUBLIC_UPLOADS=false`
- set `TRUST_PROXY=true` when behind a load balancer or reverse proxy

---

## Environment Variables

| File | Purpose |
|---|---|
| `backend/.env.localstack` | Local dev (Postgres + LocalStack + MailHog) |
| `backend/.env.example` | Production template |
| `backend/.env.production.example` | Docker/VPS production template |

### Key variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | Cookie signing secret (change in prod!) |
| `APP_BASE_URL` | Public backend/API URL used in password reset emails |
| `FRONTEND_BASE_URL` | Public frontend URL that receives reset-password redirects |
| `S3_BUCKET` | S3 bucket name |
| `S3_ENDPOINT` | Set to `http://localhost:4566` for LocalStack, omit for real AWS |
| `AWS_ACCESS_KEY_ID` | AWS key (use `test` for LocalStack) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret (use `test` for LocalStack) |
| `LOGIN_RATE_LIMIT` | Login attempts per email/IP window |
| `PASSWORD_RESET_RATE_LIMIT` | Forgot/reset password attempts per window |
| `UPLOAD_RATE_LIMIT` | Resume uploads per IP window |
| `UPLOAD_CONCURRENCY_LIMIT` | Maximum simultaneous resume uploads per backend process |
| `RESUME_SCAN_COMMAND` | Optional scanner executable, e.g. `clamscan` |
| `SMTP_HOST` | SMTP server host |
| `SMTP_PORT` | 465 (SSL) or 587 (STARTTLS) or 1025 (MailHog) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Sender address shown in emails |

### S3 Malware Scanning

With S3 configured, resume uploads use a presigned browser-to-S3 flow and every new object is tagged:

```text
scan-status=pending
```

The backend will only stream resumes whose tag is `clean`. A tag of `pending` returns `409`, and `infected` returns `403`.

Recommended AWS setup:
- S3 `ObjectCreated:*` event on the resume bucket
- Lambda function that downloads the file, scans it, and updates the object tag
- keep the bucket private and continue serving resumes through the backend

A starter Lambda handler is included at:

```text
scripts/aws/resume-scan-lambda.mjs
```

---

## Project Structure

```
ats/
├── docker-compose.yml          ← Postgres + LocalStack + MailHog
├── scripts/
│   └── localstack-init/        ← Auto-creates S3 bucket on startup
├── backend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── email.ts        ← Nodemailer (MailHog-compatible)
│   │   │   ├── s3.ts           ← S3 upload (LocalStack-compatible)
│   │   │   ├── session.ts      ← Cookie session
│   │   │   └── viewer.ts       ← Auth helpers
│   │   ├── routes/             ← Express routes
│   │   └── db/schema/          ← Drizzle ORM schemas
│   ├── .env.localstack         ← Local dev env template
│   └── .env.example            ← Production env template
└── frontend/
    └── src/
        ├── pages/              ← React pages
        └── components/         ← UI components
```
