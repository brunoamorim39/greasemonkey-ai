VENV_DIR?=.venv
PYTHON?=python3

BACKEND_DIR?=backend
FRONTEND_DIR?=frontend

.PHONY: venv install dev clean

venv:
	$(PYTHON) -m venv $(VENV_DIR)

install: venv
	. $(VENV_DIR)/bin/activate && pip install --upgrade pip && pip install -r $(BACKEND_DIR)/requirements.txt

dev: install
	. $(VENV_DIR)/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000

clean:
	rm -rf $(VENV_DIR) __pycache__ .pytest_cache
