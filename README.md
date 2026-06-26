# Crown EV Management System

Multi-branch electric bike dealership platform for Crown EV / Hadi EV Center. Includes a public storefront, customer portal, branch POS workspace, and admin dashboard backed by a REST API.

## Features

- **Public site** — product catalog, model comparison, online checkout, order tracking, service booking, contact form
- **Customer portal** — orders, invoices, bookings, profile
- **Branch workspace** — POS sales, inventory, online order fulfillment, service bookings, purchases, accounting vouchers, ledgers, reports
- **Admin dashboard** — branches, products, parts, users, orders, bookings, testimonials, reports
- **Invoices** — sale, purchase, and service invoices with PDF export and print
- **Accounting** — chart of accounts, vouchers, customer/supplier ledgers, trial balance

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router |
| Backend | Node.js, Express 5, TypeScript, Prisma |
| Database | PostgreSQL 16 |
| Auth | JWT, email OTP registration, optional Google OAuth |
| Email | SMTP (Resend) |

## Project structure

```
crown ev/
├── backend/          # Express API + Prisma
├── frontend/         # React SPA
├── docker-compose.yml
└── README.md
```

## Prerequisites

- Node.js 18+
- npm
- Docker (for PostgreSQL) or a local PostgreSQL instance

## Local development

### 1. Start PostgreSQL

```bash
docker compose up -d
```

Default connection: `postgresql://postgres:password@localhost:5432/crown_eve`

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

API runs at **http://localhost:3001**  
Health check: `GET /health`

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App runs at **http://localhost:5173**  
Vite proxies `/api` and `/uploads` to the backend.

## Environment variables

### Backend (`backend/.env`)

See `backend/.env.example` for the full list. Required for local dev:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — signing secret for auth tokens
- `PORT` — default `3001`
- `ALLOWED_ORIGINS` — e.g. `http://localhost:5173`
- `SMTP_*` — optional; without SMTP, OTP codes print in the backend terminal

### Frontend (`frontend/.env`)

- `VITE_API_URL` — default `/api` (uses Vite proxy in dev)

## Useful scripts

### Backend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run production build |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Roles

| Role | Access |
|------|--------|
| `CUSTOMER` | Shop, orders, bookings, profile |
| `BRANCH_OWNER` | Branch workspace + POS |
| `ADMIN` | Full system administration |

## Troubleshooting

**502 on login or API calls (local dev)**  
The frontend is running but the backend is not. Start the API with `npm run dev` in `backend/` and ensure PostgreSQL is up.

**Database connection errors**  
Check `DATABASE_URL`, run `docker compose up -d`, then `npm run db:migrate` in `backend/`.

**Prisma generate fails on Windows (EPERM)**  
Stop the dev server and retry, or restart the terminal.

## License

Private — Crown EV / Hadi EV Center.
