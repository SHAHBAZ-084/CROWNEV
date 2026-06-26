# Crown EV Management System

Multi-branch electric bike dealership platform for **Crown EV Center** and **Hadi EV Center**. Includes a public storefront, customer portal, branch POS workspace, and admin dashboard backed by a REST API.

## Features

- **Public site** — shop (bikes & parts), model comparison, checkout (self-pickup & bilty delivery), order tracking, service booking, branch map, contact form
- **Customer portal** — orders, payment submission, invoices, bookings, profile
- **Branch workspace** — POS sales, inventory, catalog search, online order fulfillment, service bookings, purchases, accounting vouchers, ledgers, reports
- **Admin dashboard** — branches, products, parts catalog (~1,300 items), users, orders, bookings, testimonials, reports (PDF/CSV)
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
├── backend/              # Express API, Prisma schema & migrations
│   ├── prisma/           # Schema, migrations, seed data
│   └── scripts/          # Parts catalog import, accounting utilities
├── frontend/             # React SPA
│   ├── public/           # Static assets (images, videos, logos)
│   └── scripts/          # Media optimization scripts
├── scripts/              # Git hook helpers
├── docker-compose.yml    # Local PostgreSQL
├── package.json          # Root scripts (dev, setup, migrate)
└── README.md
```

## Prerequisites

- Node.js 18+
- npm
- Docker (for PostgreSQL) or a local PostgreSQL 16 instance

## Quick start

From the repo root:

```bash
npm install
npm run setup
```

This starts PostgreSQL, installs backend/frontend dependencies, runs migrations, and seeds demo data.

Then run both apps:

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| Health check | `GET http://localhost:3001/health` |

Vite proxies `/api` and `/uploads` to the backend in development.

## Manual setup

### 1. PostgreSQL

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

**Production / CI:** use `npx prisma migrate deploy` instead of `db:migrate`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Parts catalog import

The admin parts catalog is imported separately from `backend/prisma/seed-assets/products-catalog.json`:

```bash
cd backend
npm run db:seed-parts
```

Options: `--skip-images`, `--limit N`. Parts are added to the admin catalog only; branches list them on the shop after selecting from catalog.

## Demo accounts (after seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@crown-eve.com` | `Admin@123` |
| Branch owner (Hadi Ev Center) | `owner.hadi@crown-eve.com` | `Owner@123` |

The seed creates **one branch** — **Hadi Ev Center** (Bwn Road, Chishtian). Additional branches should be added via the admin dashboard, not the seed script.

## Environment variables

### Backend (`backend/.env`)

See `backend/.env.example`. Required for local dev:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Auth token signing secret |
| `PORT` | API port (default `3001`) |
| `ALLOWED_ORIGINS` | e.g. `http://localhost:5173` |
| `SMTP_*` | Optional; without SMTP, OTP codes print in the backend terminal |
| `GOOGLE_CLIENT_ID` | Optional; for Google sign-in |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Default `/api` (uses Vite proxy in dev) |
| `VITE_GOOGLE_CLIENT_ID` | Optional; must match backend `GOOGLE_CLIENT_ID` |

For Google OAuth, add `http://localhost:5173` to **Authorized JavaScript origins** in Google Cloud Console.

## Scripts

### Root

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run setup` | Docker up, install, migrate, seed |
| `npm run backend:dev` | Backend only |
| `npm run frontend:dev` | Frontend only |
| `npm run backend:migrate` | Run Prisma migrations |
| `npm run backend:seed` | Seed demo bikes, users, branch |

### Backend

| Command | Description |
|---------|-------------|
| `npm run dev` | API with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run production build |
| `npm run db:migrate` | Apply migrations (dev) |
| `npm run db:seed` | Seed demo data |
| `npm run db:seed-parts` | Import parts catalog + images |
| `npm run db:studio` | Open Prisma Studio |
| `npm run email:test` | Test SMTP configuration |

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |

## Roles

| Role | Access |
|------|--------|
| `CUSTOMER` | Shop, orders, bookings, profile |
| `BRANCH_OWNER` | Branch workspace + POS |
| `ADMIN` | Full system administration |

## Troubleshooting

**502 on login or API calls**  
The frontend is running but the backend is not. Run `npm run backend:dev` or `npm run dev` and ensure PostgreSQL is up.

**Database connection errors**  
Check `DATABASE_URL`, run `docker compose up -d`, then `npm run backend:migrate`.

**Prisma generate fails on Windows (EPERM)**  
Stop the dev server and retry, or restart the terminal.

**Google sign-in 403 in Network tab**  
Configure `VITE_GOOGLE_CLIENT_ID` and add your site origin in Google Cloud Console.

**Shop shows no parts**  
Parts appear on the shop only after a branch lists them from the admin catalog (`Branch → Inventory → Select from catalog`).

## License

Private — Crown EV Center / Hadi EV Center.
