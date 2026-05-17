# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kartrack is a Brazilian Portuguese vehicle tracking web app for logging fuel fill-ups, expenses, and vehicle history. Stack: React + Vite (frontend), FastAPI + SQLAlchemy (backend), MySQL 8, served via Docker Compose.

## Development Commands

### Full stack (Docker)
```bash
docker compose up --build        # Build and start all services
docker compose up                # Start without rebuild
docker compose down
```

Services: frontend at `http://localhost:5173`, backend API at `http://localhost:8000`, docs at `http://localhost:8000/docs`.

### Frontend (local)
```bash
cd frontend
npm install
npm run dev      # Vite dev server on 0.0.0.0:5173
npm run build
```

### Backend (local)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload    # Requires a running MySQL instance
```

## Configuration

All config files must be copied from their `.example` counterparts before first run:
```bash
cp backend/.env.example backend/.env
cp docker-compose.yml.example docker-compose.yml
cp frontend/vite.config.js.example frontend/vite.config.js
```

Backend env vars (`backend/.env`): `SECRET_KEY`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`. Loaded via pydantic-settings (`backend/app/config.py`).

Frontend API URL: set `VITE_API_URL` in `frontend/.env` (falls back to `/api` if unset — correct for reverse-proxy setups).

## Architecture

### Backend (`backend/app/`)

Single-file API in `main.py` — all FastAPI route handlers live there (no routers). Key modules:

- `models.py` — SQLAlchemy ORM: `User → Vehicle → FuelRecord / ExpenseRecord / VehicleFipeHistory`. `LookupItem` stores per-user configurable dropdown values.
- `schemas.py` — Pydantic request/response models.
- `auth.py` — JWT creation (`create_access_token`) and `get_current_user` dependency (Bearer token from `Authorization` header, stored in `localStorage` on the frontend).
- `database.py` — SQLAlchemy engine + `get_db` dependency + `init_db()` (called on startup to create all tables via `Base.metadata.create_all`).
- `config.py` — `Settings` singleton with DB connection string builder.

The `uploads/` directory at the repo root is mounted into the backend container at `/app/uploads` and served as static files at `/uploads`. Vehicle photos are stored under `uploads/vehicles/vehicle_{id}.{ext}`. Branding assets (`logo_light.png`, `logo_dark.png`, `favicon.ico`) live directly in `uploads/`.

**FIPE integration**: `_refresh_vehicle_fipe_if_needed()` calls the public API `https://fipe.parallelum.com.br/api/v2` to update vehicle market value. Auto-refreshes on the 2nd business day of each month; can be forced via `POST /api/vehicles/{id}/fipe-sync`.

**Fuel consumption**: `_compute_full_tank_consumption()` calculates km/L only between consecutive full-tank fill-ups (`tanque_cheio=True`).

**LookupItems**: User-specific dropdown options (fuel brands, expense categories, service providers, etc.). Seeded with defaults on first use per category via `_ensure_lookup_defaults()`.

### Frontend (`frontend/src/`)

React SPA with React Router v6. Global state (authenticated user, vehicle list, active vehicle, theme) is held in `App.jsx` and passed as props — no global state manager.

- `api.js` — Axios instance with JWT interceptor. `API_BASE_URL` is either `VITE_API_URL` env var or `/api`.
- `pages/` — One component per route. Routes: `/` (DashboardPage/timeline), `/abastecimento`, `/despesa`, `/relatorios`, `/veiculo`, `/registros`, `/backup-restore`, `/configuracoes`.
- `components/Layout.jsx` — Shell with sidebar nav, theme toggle, vehicle selector.

Theme (light/dark) is persisted to `localStorage` as `theme`. Last visited path is saved to `localStorage` as `cartrack_last_path` and restored on login.

The dashboard polls every 10 seconds for updated metrics.

## API Prefix

All API routes are under `/api` (configurable via `settings.api_prefix`). The Nginx reverse proxy forwards `/api` → backend port 8000 and `/uploads` → backend static files. See `nginx.conf.example`.

## First-run Flow

1. Register via "Primeiro acesso? Criar conta" — first registered user becomes admin (`is_admin=True`).
2. Add a vehicle under "Meu veículo".
3. Optionally import records via CSV from "Registros".
