# AGENTS.md

## Cursor Cloud specific instructions

This is **YApi** (community fork `yapi-pro`): a Koa (Node) backend + Vite/React frontend, backed by **MongoDB**. It is run here as a **source deployment** (not Docker). Standard commands live in `package.json` `scripts` and the setup steps in `README.md` ("源码部署"); this section only records the non-obvious cloud caveats.

### Runtime layout gotcha (important)
`server/yapi.js` computes `WEBROOT_RUNTIME` as `../..` from `server/`, which resolves to the **filesystem root `/`** in this source checkout (the path assumes the Docker `/yapi/vendors` layout). As a result:
- The log dir is `/log` and the install marker is `/init.lock` (NOT inside the repo).
- These already exist and are owned by `ubuntu` in the VM snapshot. If they are ever missing/unwritable, recreate with: `sudo mkdir -p /log && sudo chown -R ubuntu:ubuntu /log` (and, only for a first-time `server/install.js` run, temporarily `sudo chmod o+w /` so `/init.lock` can be created, then `sudo chmod o-w /`).

### config.json (required, gitignored)
The server refuses to start without `config.json` at the repo root (also required by `npm test`). It is gitignored, but persists in the VM snapshot. If missing, recreate it from `docker/config.json` but point the DB at the local mongod:
```json
{ "port": "3000", "adminAccount": "admin@admin.com", "timeout": 120000,
  "db": { "servername": "127.0.0.1", "DATABASE": "yapi", "port": 27017 },
  "mail": { "enable": false },
  "passkey": { "rpName": "YApi", "rpID": "localhost", "origin": "http://localhost:3000" } }
```

### MongoDB (must be started manually; not in the update script)
MongoDB 6 is installed in the snapshot at `/usr/local/bin/mongod` with data in `/var/lib/mongodb-yapi`. Start it (e.g. in a tmux session) before running the backend or tests:
```bash
mongod --dbpath /var/lib/mongodb-yapi --bind_ip 127.0.0.1 --port 27017
```

### Database already initialized — do NOT re-run install
`node server/install.js` has already created the admin account and indexes (persisted in `/var/lib/mongodb-yapi`). Re-running it fails on the unique `email` index. Default admin: `admin@admin.com` / `yapi.pro`.

### Running the dev environment
Two processes (dev mode serves `static/dev.html`, which loads assets from the Vite dev server on :4000):
- Backend: `npm run dev-server`  → Koa on `http://127.0.0.1:3000`
- Frontend: `npm run dev-client` → Vite on `http://127.0.0.1:4000`

Open the app at `http://127.0.0.1:3000/` (not :4000).

### Lint / test / build
- Lint: `npm run lint`
- Tests: `npm test` (Vitest; requires `config.json` present, mongod not required for the current suite)
- Frontend production build: `npm run build-client`

### Node version
Effective node in this environment is v22 (satisfies the repo's `engines: node >= 20`). `.nvmrc`/CI pin 20; both work.
