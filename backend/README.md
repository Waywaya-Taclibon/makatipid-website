# Makatipid Backend (Node.js + Express)

Replaces the old Spring Boot backend with the same REST contract, so the Vite frontend works unchanged on `http://localhost:8080/api`.

## Setup

```bash
cd backend
cp .env.example .env   # fill in DB_* + JWT_SECRET + PAYMONGO_SECRET_KEY
npm install
npm run dev            # or npm start
```

Health checks: `GET http://localhost:8080/health` -> `OK` (process liveness, no
database access) and `GET http://localhost:8080/health/db` -> `OK` when the
database is reachable, `503 DB unavailable` otherwise. Both are public.

## Admin dashboard

The dashboard lives at `/admin` on the frontend and talks to `/api/admin/*`.
Every admin route requires `role = 'ADMIN'` in the database **and** a JWT with
`scope = "admin"`, so a normal site session can never reach it. Admin sessions
last 6 hours, and unauthenticated/non-admin calls get a plain `404`.

Grant access to an email (creates the account if it does not exist):

```bash
cd backend
npm run promote-admin -- waywaytaclibon.wt@gmail.com
```

The script replaces that account's password with a generated temporary one and
prints it once. Sign in at `/admin`; the dashboard forces a new password before
unlocking. Re-running the script is the account-recovery path.

- Change the admin password later under **Security** in the dashboard.
- Suspending a user bumps `token_version`, so their existing sessions die.
- Every mutating action is recorded in `admin_audit_log`.
- `must_change_password` and `is_active` are added automatically on boot.

## API (same as before)

- `POST /api/auth/register`, `POST /api/auth/login` -> `{token, name, id}`
- `GET /api/users/me`, `PUT /api/users/me`
- `GET /api/properties`, `GET /api/properties/available`, `GET /api/properties/:id`
- `POST /api/properties`, `PUT /api/properties/:id`
- `PUT /api/properties/:id/archive`, `PUT /api/properties/:id/unarchive`, `DELETE /api/properties/:id`
- `POST /api/rentallog`, `GET /api/rentallog/my`, `GET /api/rentallog/property/:propertyId`
- `PUT /api/rentallog/:id/end`, `DELETE /api/rentallog/:id`
- `POST /api/payments/intents`, `GET /api/payments/intents/:intentId`, `POST /api/payments/intents/:intentId/confirm`
- `GET /api/config` -> `{ demoLoginEnabled, demoPhotos }` (public)
- `POST /api/auth/demo` -> `{token, name, id, demo, role}` (one-click demo; no password)
- `POST /api/payments/demo/intents`, `POST /api/payments/demo/intents/:intentId/confirm`
  (demo accounts only; mock QR + instant booking, no PayMongo call)

Auth: Bearer JWT (`sub` = user id, 24h). Public: `/api/auth/**`, `GET /api/properties/**`, `GET /api/config`, `GET /health`. Everything else returns `401` when unauthenticated.

Passwords use `argon2` so existing Spring-hashed users can still log in.

Database: existing MySQL `makatipid_db` is reused (`users`, `properties`, `rentallog`). See `schema.sql` for fresh setups.
