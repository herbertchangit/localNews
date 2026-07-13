# ServeRICA production deployment

Production URL: `https://localnews.jingjiqingcheng.com`

## DNS at Hostinger

Create an `A` record in the DNS zone for `jingjiqingcheng.com`:

- Type: `A`
- Name: `localnews`
- Points to: the public IPv4 address of the ServeRICA VPS
- TTL: `300` during deployment; increase later if desired

Remove any conflicting `A` or `CNAME` record for `localnews`. Ports 80 and 443 must reach the VPS so Caddy can issue and renew the TLS certificate.

## First deployment

Install Docker Engine with the Compose plugin on the VPS, then:

```sh
sudo mkdir -p /opt/localnews
sudo chown "$USER":"$USER" /opt/localnews
git clone https://github.com/herbertchangit/localNews.git /opt/localnews
cd /opt/localnews
cp .env.production.example .env.production
```

Replace both placeholder secrets in `.env.production`. Use URL-safe alphanumeric characters for `POSTGRES_PASSWORD` because it is embedded in `DATABASE_URL`.

Start the application:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 app caddy
```

Verify:

```sh
curl -fsS https://localnews.jingjiqingcheng.com/api/health
```

## Updates

```sh
cd /opt/localnews
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d
```

## Backup

```sh
cd /opt/localnews
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db \
  pg_dump -U news -d newsroom > "localnews-$(date +%F-%H%M).sql"
```
