# Stockroom Inventory & Order Management

Stockroom is a production-ready full-stack inventory application built for the software engineer technical assessment. It manages products, customers, orders, and inventory tracking through a responsive React interface and a FastAPI backend.

## Features

- Product CRUD with unique SKU validation and non-negative inventory
- Customer management with unique email validation
- Multi-line order creation with automatic total calculation
- Transactional inventory reduction when an order is placed
- Stock restoration when an order is canceled
- Dashboard summaries and low-stock monitoring
- PostgreSQL persistence through a named Docker volume
- Responsive desktop and mobile UI

## Technology Stack

- Backend: Python, FastAPI, SQLAlchemy
- Frontend: React, Vite
- Database: PostgreSQL
- Containers: Docker and Docker Compose
- Deployment configuration: Render for backend/database and Vercel for frontend

## Run With Docker Compose

1. Copy `.env.example` to `.env`.
2. Replace the sample PostgreSQL password in `.env`.
3. Start the complete stack:

```bash
docker compose up --build
```

Open:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:8000`
- Interactive API docs: `http://localhost:8000/docs`

The Compose configuration starts:

- `frontend`: Nginx serving the compiled React application
- `backend`: Uvicorn serving FastAPI
- `db`: PostgreSQL 16 Alpine with a persistent named volume

## Run For Development

Start PostgreSQL locally and provide a valid `DATABASE_URL`, then run:

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

The development frontend uses `http://localhost:8000` unless `VITE_API_URL` is set.

## API Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `POST` | `/products` | Create a product |
| `GET` | `/products` | List products |
| `GET` | `/products/{id}` | Get a product |
| `PUT` | `/products/{id}` | Update a product |
| `DELETE` | `/products/{id}` | Delete an unused product |
| `POST` | `/customers` | Create a customer |
| `GET` | `/customers` | List customers |
| `GET` | `/customers/{id}` | Get a customer |
| `DELETE` | `/customers/{id}` | Delete a customer without orders |
| `POST` | `/orders` | Create an order |
| `GET` | `/orders` | List orders |
| `GET` | `/orders/{id}` | Get an order |
| `DELETE` | `/orders/{id}` | Cancel an order and restore stock |

## Validation And Business Logic

- SKU values are normalized to uppercase before uniqueness checks.
- Customer emails are normalized to lowercase before uniqueness checks.
- Pydantic rejects invalid request data before processing.
- Products are locked during order creation to prevent overselling.
- Order totals are always calculated by the backend.
- Products and customers referenced by orders cannot be deleted.

## Test The Backend

Backend tests use SQLite so the critical business rules can be verified without a running PostgreSQL instance:

```bash
cd backend
pytest
```

## Deploy

### Backend And Database On Render

1. Push this repository to GitHub.
2. In Render, create a Blueprint and select the repository.
3. Render reads `render.yaml` and provisions the backend plus PostgreSQL database.
4. Set `CORS_ORIGINS` to the final frontend URL.
5. Confirm `https://<backend-url>/health` returns `{"status":"ok"}`.

Render's free web service is suitable for an assessment deployment but spins down when idle. Render's free PostgreSQL database is limited to 1 GB and expires 30 days after creation, so upgrade or migrate it for long-term use.

### Frontend On Vercel

1. Import the GitHub repository into Vercel.
2. Set the Root Directory to `frontend`.
3. Set `VITE_API_URL` to the public Render backend URL.
4. Deploy and add the resulting Vercel URL to the backend `CORS_ORIGINS`.

### Backend Image On Docker Hub

```bash
docker build -t <dockerhub-user>/stockroom-api:latest ./backend
docker login
docker push <dockerhub-user>/stockroom-api:latest
```

When Docker is unavailable locally, the included GitHub Actions workflow can build and push the image remotely. Add repository secrets named `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`, then run the `Publish backend image` workflow.

The final submission should include:

- GitHub repository URL: `https://github.com/anushk127/stockroom-inventory-management`
- Docker Hub backend image URL: `https://hub.docker.com/r/anushkshekhar/stockroom-api`
- Live frontend URL: `https://stockroom-inventory-management.vercel.app`
- Live backend API URL: `https://inventory-api-hhkh.onrender.com`
