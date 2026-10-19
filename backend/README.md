# Makatipid Backend (Node.js + Express)

Replaces the old Spring Boot backend with the same REST contract, so the Vite frontend works unchanged on `http://localhost:8080/api`.

## Setup

```bash
cd backend
cp .env.example .env   # fill in DB_* + JWT_SECRET + PAYMONGO_SECRET_KEY
npm install
npm run dev            # or npm start
```

Health check: `GET http://localhost:8080/health` -> `OK`.

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
