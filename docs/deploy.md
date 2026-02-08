# Ubuntu Deployment Notes

## Backend (NestJS)

1. Install Node.js 20+ and MariaDB.
2. Create database: `CREATE DATABASE jazabox;`
3. Configure environment variables (see `docs/setup.md`).
4. Install deps: `cd backend && npm install`
5. Run migrations: `npm run migration:run`
6. Run: `npm run build && npm start`
7. Use PM2 or systemd for process management.

## Dashboard (Next.js)

1. Install deps: `cd dashboard && npm install`
2. Set `NEXT_PUBLIC_API_URL` to the backend URL.
3. Build and start: `npm run build && npm start`

## Webhooks

- Expose `/payments/mpesa/callback` over HTTPS and set the URL in M-PESA config.
