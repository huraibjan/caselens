---
name: deployment
description: Docker containerization, Docker Compose orchestration, CI/CD, and local development environment for CaseLens.
---

# Deployment Skill

## Local Development
- `make setup` → Install dependencies, create Docker volumes, run migrations
- `make dev` → Start all services via Docker Compose
- `make test` → Run all test suites
- `make clean` → Tear down Docker volumes and containers

## Docker Services
| Service | Image | Port |
|---------|-------|------|
| postgres | postgres:17 + pgvector | 5432 |
| redis | redis:7 | 6379 |
| minio | minio/minio | 9000/9001 |
| temporal | temporalio/auto-setup | 7233/8233 |
| api | Python FastAPI (hot-reload) | 8000 |
| worker | Python Temporal worker | — |
| web | Next.js dev server | 3000 |

## Container Best Practices
- Multi-stage builds for production images
- Non-root users in all containers
- Health checks on all services
- Named volumes for persistent data
- Environment variable configuration (no secrets in images)
