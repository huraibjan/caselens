# ===================================================================
# CaseIntelix — Development Makefile
# ===================================================================

.PHONY: setup dev test lint typecheck migrate seed verify clean help

# ── Colors ─────────────────────────────────────────────────────────
GREEN  := \033[0;32m
YELLOW := \033[0;33m
RED    := \033[0;31m
CYAN   := \033[0;36m
RESET  := \033[0m

# ── Setup ──────────────────────────────────────────────────────────
setup: ## Install all dependencies and prepare the dev environment
	@echo "$(CYAN)▸ Installing Node.js dependencies...$(RESET)"
	pnpm install
	@echo "$(CYAN)▸ Installing Python dependencies...$(RESET)"
	cd apps/api && uv sync
	cd apps/worker && uv sync
	@echo "$(CYAN)▸ Copying environment file...$(RESET)"
	@test -f .env || cp .env.example .env
	@echo "$(CYAN)▸ Starting infrastructure services...$(RESET)"
	docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis minio temporal
	@echo "$(CYAN)▸ Waiting for services...$(RESET)"
	bash infrastructure/scripts/wait-for-services.sh
	@echo "$(CYAN)▸ Running database migrations...$(RESET)"
	cd apps/api && uv run alembic upgrade head
	@echo "$(GREEN)✓ Setup complete!$(RESET)"

# ── Development ────────────────────────────────────────────────────
dev: ## Start all services for local development
	@echo "$(CYAN)▸ Starting all services...$(RESET)"
	docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis minio temporal
	@bash infrastructure/scripts/wait-for-services.sh
	@echo "$(CYAN)▸ Starting API server...$(RESET)"
	cd apps/api && uv run uvicorn caselens.main:app --reload --host 0.0.0.0 --port 8000 &
	@echo "$(CYAN)▸ Starting worker...$(RESET)"
	cd apps/worker && PYTHONPATH=../api/src uv run python -m caselens_worker.main &
	@echo "$(CYAN)▸ Starting web dev server...$(RESET)"
	cd apps/web && pnpm dev

dev-api: ## Start only the API server
	cd apps/api && uv run uvicorn caselens.main:app --reload --host 0.0.0.0 --port 8000

dev-worker: ## Start only the Temporal worker
	cd apps/worker && PYTHONPATH=../api/src uv run python -m caselens_worker.main

dev-web: ## Start only the Next.js dev server
	cd apps/web && pnpm dev

dev-infra: ## Start only infrastructure services
	docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis minio temporal

# ── Testing ────────────────────────────────────────────────────────
test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests
	cd apps/api && uv run pytest -v

test-frontend: ## Run frontend tests
	cd apps/web && pnpm test

test-e2e: ## Run end-to-end tests
	cd apps/web && pnpm test:e2e

test-unit: ## Run unit tests only
	cd apps/api && uv run pytest -v -m "not integration"

test-integration: ## Run integration tests only
	cd apps/api && uv run pytest -v -m "integration"

# ── Quality ────────────────────────────────────────────────────────
lint: ## Run all linters
	@echo "$(CYAN)▸ Linting Python...$(RESET)"
	cd apps/api && uv run ruff check .
	cd apps/worker && uv run ruff check .
	@echo "$(CYAN)▸ Linting TypeScript...$(RESET)"
	cd apps/web && pnpm lint
	@echo "$(GREEN)✓ All lint checks passed$(RESET)"

typecheck: ## Run type checking
	@echo "$(CYAN)▸ Type checking Python...$(RESET)"
	cd apps/api && uv run mypy src/caselens
	@echo "$(CYAN)▸ Type checking TypeScript...$(RESET)"
	cd apps/web && pnpm typecheck
	@echo "$(GREEN)✓ All type checks passed$(RESET)"

format: ## Format all code
	cd apps/api && uv run ruff format .
	cd apps/worker && uv run ruff format .
	pnpm format

# ── Database ───────────────────────────────────────────────────────
migrate: ## Run database migrations
	cd apps/api && uv run alembic upgrade head

migrate-create: ## Create a new migration (usage: make migrate-create MSG="description")
	cd apps/api && uv run alembic revision --autogenerate -m "$(MSG)"

migrate-rollback: ## Rollback last migration
	cd apps/api && uv run alembic downgrade -1

seed: ## Seed database with sample data
	cd apps/api && uv run python -m caselens.db.seed

# ── Docker ─────────────────────────────────────────────────────────
docker-build: ## Build all Docker images
	docker compose -f infrastructure/docker/docker-compose.yml build

docker-up: ## Start all Docker services
	docker compose -f infrastructure/docker/docker-compose.yml up -d

docker-down: ## Stop all Docker services
	docker compose -f infrastructure/docker/docker-compose.yml down

docker-logs: ## View Docker logs
	docker compose -f infrastructure/docker/docker-compose.yml logs -f

# ── Verification ───────────────────────────────────────────────────
verify: lint typecheck test ## Run full verification suite
	@echo "$(GREEN)✓ All checks passed!$(RESET)"

# ── Cleanup ────────────────────────────────────────────────────────
clean: ## Remove all generated files and Docker volumes
	@echo "$(RED)▸ Cleaning up...$(RESET)"
	docker compose -f infrastructure/docker/docker-compose.yml down -v --remove-orphans 2>/dev/null || true
	rm -rf node_modules .turbo
	rm -rf apps/web/node_modules apps/web/.next apps/web/.turbo
	rm -rf apps/api/.venv apps/api/__pycache__
	rm -rf apps/worker/.venv apps/worker/__pycache__
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	@echo "$(GREEN)✓ Clean complete$(RESET)"

# ── Help ───────────────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
