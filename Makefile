VENV_DIR?=.venv
PYTHON?=python3

BACKEND_DIR?=backend
FRONTEND_DIR?=frontend
DOCKER_IMAGE?=greasemonkey-backend
DOCKER_TAG?=latest
DOCKER_PORT?=8000
FRONTEND_IMAGE?=greasemonkey-frontend
FRONTEND_TAG?=latest
FRONTEND_PORT?=8080

.PHONY: venv install dev dev-venv clean down backend-shell frontend-shell

# --- Docker Compose targets ---
dev:
	docker compose up --build

down:
	docker compose down

backend-dev:
	docker compose up --build backend

frontend-dev:
	docker compose up --build frontend

backend-shell:
	docker compose exec backend /bin/sh

frontend-shell:
	docker compose exec frontend /bin/sh

# --- Legacy venv targets (for local, non-docker dev) ---
venv:
	$(PYTHON) -m venv $(VENV_DIR)

install: venv
	. $(VENV_DIR)/bin/activate && pip install --upgrade pip && pip install -r $(BACKEND_DIR)/requirements.txt

dev-venv: install
	. $(VENV_DIR)/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000

clean:
	rm -rf $(VENV_DIR) __pycache__ .pytest_cache
