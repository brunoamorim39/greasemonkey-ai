BACKEND_IMAGE=greasemonkey-backend
BACKEND_CONTAINER=greasemonkey-backend

.PHONY: build up down dev

build:
	docker build -t $(BACKEND_IMAGE) ./backend

up:
	docker run -d --rm -p 8000:8000 --name $(BACKEND_CONTAINER) $(BACKEND_IMAGE)

down:
	docker stop $(BACKEND_CONTAINER) || true

dev:
	cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000
