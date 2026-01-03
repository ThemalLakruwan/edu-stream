EduStream – Development Setup

0. Prerequisites

Install these tools before starting:

Docker Desktop
 (or Docker Engine) + docker compose v2

Node.js 18
 (only if you need to run local scripts; the app itself runs inside Docker)

Stripe CLI
 (only if you want to test webhooks locally)

1. Clone and check folder layout
git clone <repo-url>
cd <repo-name>


Folder structure:

repo-root/
  ├─ docker-compose.dev.yml
  ├─ docker-compose/          
  ├─ auth-service/
  ├─ course-service/
  ├─ payment-service/
  └─ frontend/                 

2. Create .env files

3. Start the stack

cd docker-compose

docker compose -f docker-compose.dev.yml build

docker compose -f docker-compose.dev.yml up -d

docker-compose -f docker-compose.dev.yml exec course-service npm run seed  (❌Run this Only if database is empty)

test courses are loaded by,
curl -X GET http://localhost:8080/api/categories
curl http://localhost:8080/api/courses

when you want to restart,
docker compose -f docker-compose.dev.yml down
and repeat above steps

Run the frontend via npm start

View logs until services are healthy:

docker compose -f docker-compose.dev.yml logs -f
# or a single service:
docker compose -f docker-compose.dev.yml logs -f payment-service

4. Initialize MinIO (first run only)

Open http://localhost:9001

Login with:

Username: minioadmin

Password: minioadmin123

Create a bucket named edustream (must match S3_BUCKET).

5. Verify services are up

Nginx gateway → http://localhost:8080

Auth health → http://localhost:3001/health

Course health → http://localhost:3002/health

Payment health → http://localhost:3003/health

MongoDB → mongodb+srv://edustream_dev:eduStream101@edustream-dev.xxxxxx.mongodb.net

Redis → localhost:6379 (password: password)

MinIO console → http://localhost:9001

6. Common commands
# Rebuild one service after code changes
docker compose -f docker-compose.dev.yml up -d --build payment-service

# Tail logs for multiple services
docker compose -f docker-compose.dev.yml logs -f auth-service course-service payment-service

# Stop everything
docker compose -f docker-compose.dev.yml down

# Stop and wipe volumes (fresh DB/S3)
docker compose -f docker-compose.dev.yml down -v

7. Known gotchas (and fixes)

Redis connection refused in payment-service
Ensure .env has:
REDIS_URL=redis://:password@redis:6379

Stripe webhook handlers don’t fire
Use correct event names (customer.subscription.created|updated|deleted).
Ensure STRIPE_WEBHOOK_SECRET is set.

MinIO 403 or “bucket not found”
Create the edustream bucket in the console (Step 4).
Ensure S3_* env vars match.

Quick Smoke Test
# Auth
curl http://localhost:3001/health
# Course
curl http://localhost:3002/health
# Payment
curl http://localhost:3003/health


All should return:

{ "status": "healthy" }


✅ If you see "healthy" from all three services, your stack is up and running!

⚠️Use this for as test card number: 4000 0025 0000 3155


8. Set Up Minio Bucket Public --> paste this on bash
01. Invoke-WebRequest https://dl.min.io/client/mc/release/windows-amd64/mc.exe -OutFile mc.exe
02. .\mc.exe --version
03. .\mc alias set localminio http://localhost:9000 minioadmin minioadmin123
04. .\mc policy set download localminio/edustream
05. .\mc.exe anonymous set download localminio/edustream
