# Swazei POS Backend

A backend API for a multi-tenant point-of-sale system. It supports merchant and store users, product and inventory management, sales, and mock payments.

## Tech Stack

- NestJS and TypeScript
- PostgreSQL with TypeORM
- JWT authentication and role-based access
- Redis for optional caching and queue processing
- Jest and Supertest
- Swagger for API documentation

## Getting Started

### Requirements

- Node.js 18 or newer
- npm

PostgreSQL and Redis are optional for local development. By default, the project can start an embedded PostgreSQL instance and use an in-process fallback when Redis is unavailable.

### Install and run

```bash
npm install
cp .env.example .env
npm run start:dev
```

The API runs at:

- Base URL: `http://localhost:3000/api/v1`
- Swagger docs: `http://localhost:3000/api/v1/docs`

On the default local setup, migrations run during startup and sample data is loaded automatically. The seeded accounts use the password `Passw0rd!`.

### Database configuration

To use your own PostgreSQL instance, set `DATABASE_URL` in `.env` and set `USE_EMBEDDED_DB=false`.

Redis can be configured with `REDIS_URL`. See `.env.example` for the available settings. Use a strong, private `JWT_SECRET` outside local development.

## Main Features

- JWT login and role-based permissions
- Merchant and store-level data access
- Product catalogue and store inventory
- Sales with server-calculated prices and totals
- Inventory updates inside database transactions
- Idempotency keys for sale requests
- Mock payment provider for successful and declined payments
- Asynchronous sale events using an outbox and queue
- Database migrations and sample seed data

## Useful Commands

```bash
npm run start:dev   # Start in watch mode
npm run build       # Build the application
npm run start:prod  # Run the compiled application
npm test            # Run unit and integration tests
npm run test:e2e    # Run end-to-end tests
npm run test:cov    # Run tests with coverage
npm run seed        # Load sample data
npm run db:migrate  # Apply database migrations
npm run db:show     # Show migration status
npm run db:revert   # Revert the last migration
```

## Project Layout

```
src/
  common/       Shared guards, decorators, filters and interceptors
  config/       Environment configuration
  database/     Entities, migrations and seed data
  modules/      Auth, users, merchants, stores, products,
                inventory, sales, payments, cache and queue
test/           End-to-end tests and test setup
postman/        Postman collection
```

## API Notes

Most routes require a bearer token. Sign in through the authentication endpoint and use the returned JWT in the `Authorization: Bearer <token>` header.

Sales requests require an `Idempotency-Key` header so a retry can be recognised. Product prices and sale totals are calculated by the server.

For the available routes, request fields and response examples, use the Swagger page at `/api/v1/docs`.

## Tests

Run the test suite with:

```bash
npm test
```

The end-to-end tests cover sales, inventory behaviour, tenant isolation and related API flows.

---

Built with NestJS and TypeScript for the Swazei backend take-home assignment.
