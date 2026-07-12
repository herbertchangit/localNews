# Local News Channel

A responsive public news site and newsroom management dashboard backed by Express, PostgreSQL, Prisma, JWT/RBAC, and Swagger.

## Run with Docker

```bash
docker compose up --build
```

Open `http://localhost:18080`. The database and demo content are prepared automatically. The newsroom dashboard is at `/newsroom`, API health at `/api/health`, and interactive API documentation at `/api/docs`.

Demo accounts all use `Demo123!`: `admin@local.news`, `editor@local.news`, `reporter@local.news`, and `reader@local.news`.

## Production notes

Set a long random `JWT_SECRET`, use managed PostgreSQL credentials, put the service behind HTTPS, and replace `prisma db push` with versioned migrations before deployment.
