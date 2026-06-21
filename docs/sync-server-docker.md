# noteDock Sync Server Docker Deployment

noteDock sync is designed as a local-first mirror service. The desktop app keeps editing local files, while this server stores a remote copy of workspace files, app state, metadata, and attachments.

## 1. Prepare the server

Install Docker and Docker Compose on the server, then copy or clone this repository:

```bash
git clone <your-repo-url> /opt/notedock
cd /opt/notedock/deploy/sync-server
cp .env.example .env
```

Edit `.env`:

```bash
NOTEDOCK_ADMIN_USERNAME=admin
NOTEDOCK_ADMIN_PASSWORD=<a-long-random-password>
NOTEDOCK_SYNC_BIND=127.0.0.1
NOTEDOCK_SYNC_DATA_DIR=/srv/notedock-sync/data
NOTEDOCK_SYNC_TOKEN=
```

Generate a strong password or optional legacy token:

```bash
openssl rand -hex 32
```

Create the data directory:

```bash
sudo mkdir -p /srv/notedock-sync/data
sudo chown -R "$USER":"$USER" /srv/notedock-sync
```

Start the server:

```bash
docker compose up -d --build
docker compose ps
```

The service listens inside the container on port `47831`. The default compose file binds it to `127.0.0.1:47831` on the host, which is the recommended setup behind Nginx or Caddy.

## 2. Expose it with HTTPS

Use HTTPS before putting the service on the public internet. Login sessions and sync tokens are sent as Bearer tokens, so TLS is required to keep them private.

Nginx example:

```nginx
server {
  listen 443 ssl http2;
  server_name sync.example.com;

  client_max_body_size 250m;

  location / {
    proxy_pass http://127.0.0.1:47831;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

Caddy example:

```caddyfile
sync.example.com {
  reverse_proxy 127.0.0.1:47831
}
```

Health check:

```bash
curl https://sync.example.com/api/v1/sync/health
```

Login check:

```bash
curl -X POST https://sync.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

## 3. Configure the desktop app

Open noteDock settings and fill the sync section:

- Server URL: `https://sync.example.com`
- Username and password
- Click login and enable sync

The desktop app logs in once, creates a sync access token, stores that token locally, and clears the password field. The desktop app still edits local files. After sync is enabled, local changes are pushed to the server and remote changes are pulled back into the local workspace.

For a new device, use the same server URL and account. The server assigns that user an internal default workspace automatically. Choose an empty local folder if you want that device to rebuild the workspace from the cloud mirror.

Create another independent user from the administrator session:

```bash
ADMIN_TOKEN="<accessToken from /api/v1/auth/login>"

curl -X POST https://sync.example.com/api/v1/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"alice-password"}'
```

The new user can log in from the desktop app and receives a separate internal workspace. Users cannot read or write each other's mirrored files.

## 4. Data durability

The important data is not inside the container. It lives in:

```text
NOTEDOCK_SYNC_DATA_DIR=/srv/notedock-sync/data
```

That directory contains:

```text
sync.sqlite      # manifest, revisions, app-state
sync.sqlite-wal  # SQLite WAL file when active
sync.sqlite-shm  # SQLite shared-memory file when active
files/           # mirrored workspace files
```

Container lifecycle is safe:

```bash
docker compose down
docker compose up -d --build
```

This recreates the container but keeps `/srv/notedock-sync/data`.

## 5. Backup and restore

Simple consistent backup:

```bash
cd /opt/notedock/deploy/sync-server
docker compose stop
sudo tar -czf "/srv/notedock-sync/backup-$(date +%Y%m%d-%H%M%S).tar.gz" \
  -C /srv/notedock-sync data
docker compose up -d
```

Restore:

```bash
cd /opt/notedock/deploy/sync-server
docker compose stop
sudo rm -rf /srv/notedock-sync/data
sudo tar -xzf /srv/notedock-sync/backup-YYYYMMDD-HHMMSS.tar.gz \
  -C /srv/notedock-sync
docker compose up -d
```

For production, add a scheduled backup job that archives `/srv/notedock-sync/data` to another disk or object storage.

## 6. Auth model

The server supports users and sync access tokens. Each user gets one internal default workspace automatically:

```text
User
  -> Internal default workspace
      -> Sync access token
```

The administrator is bootstrapped from `.env` on first startup and stored in SQLite. Users log in with username and password, then the desktop app creates a sync access token. Sync requests use that token:

```http
Authorization: Bearer ndsync_<random>
```

The server stores token hashes, not plaintext tokens. A sync token can only access the internal workspace owned by its user, so two users on the same server remain isolated.

`NOTEDOCK_SYNC_TOKEN` is still supported as an optional legacy token for older single-user deployments. New deployments should leave it blank and use login-generated sync tokens.

Recommended safety rules:

- Use a strong administrator password.
- Use HTTPS.
- Keep `NOTEDOCK_SYNC_BIND=127.0.0.1` and expose the service through a reverse proxy.
- Revoke and recreate sync tokens if a device is lost.
- Use different users for independent people or independent note vaults.

The first multi-user version does not implement shared note vaults. If later you need sharing, add a membership table with roles such as owner/editor/viewer.
