# Installation

MoneyTrack runs on Windows, macOS, and Linux, including Raspberry Pi and small
VMs. Requirements: **Node.js 20+** and npm. No Docker is required.

---

## 1. Any OS — from source

```bash
git clone git@github.com:magollap/moneytrack.git
cd moneytrack
npm install
```

Create the database and load demo data:

```bash
npm run db:push     # creates prisma/dev.db
npm run db:seed     # demo / demo123 (admin) + 90 days of transactions
```

Production mode (Express serves the built UI and the API on one port):

```bash
npm run build
npm run server      # http://localhost:4000
```

Development mode (hot reload, UI on :5173, API on :4000):

```bash
npm run server      # terminal 1
npm run dev         # terminal 2 → http://localhost:5173
```

Demo credentials: **demo / demo123**. Any new username self-registers; the
first user in an empty database becomes admin.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server on :5173 (proxies `/api`) |
| `npm run server` | Express API + built UI on :4000 |
| `npm run build` | Production bundle into `dist/` |
| `npm run db:push` | Sync schema to the SQLite file |
| `npm run db:seed` | Insert demo user + transactions |
| `npm run db:studio` | Browse the database |

---

## 2. Start / stop / status

### Linux (systemd)

`/etc/systemd/system/moneytrack.service`:

```ini
[Unit]
Description=MoneyTrack
After=network.target

[Service]
WorkingDirectory=/opt/moneytrack
ExecStart=/usr/bin/node server.js
Environment=PORT=4000
Restart=on-failure
User=moneytrack

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now moneytrack
sudo systemctl status moneytrack     # status
sudo systemctl stop moneytrack       # stop
sudo systemctl start moneytrack      # start
journalctl -u moneytrack -f          # logs
```

### macOS (launchd)

`~/Library/LaunchAgents/com.moneytrack.app.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.moneytrack.app</string>
  <key>ProgramArguments</key>
  <array><string>/usr/local/bin/node</string><string>/Users/me/moneytrack/server.js</string></array>
  <key>WorkingDirectory</key><string>/Users/me/moneytrack</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.moneytrack.app.plist
launchctl list | grep moneytrack      # status
launchctl stop com.moneytrack.app     # stop
launchctl start com.moneytrack.app    # start
```

### Windows

Run in PowerShell:

```powershell
cd C:\moneytrack
npm run build
$env:PORT=4000; npm run server
```

To keep it running as a service, install [NSSM](https://nssm.cc/) and register:

```powershell
nssm install MoneyTrack "C:\Program Files\nodejs\node.exe" "C:\moneytrack\server.js"
nssm set MoneyTrack AppDirectory C:\moneytrack
nssm start MoneyTrack
nssm status MoneyTrack
nssm stop MoneyTrack
```

Alternatively use **Task Scheduler** → *Create Task* → trigger *At startup* →
action *Start a program* → `node.exe`, arguments `server.js`, start in
`C:\moneytrack`.

---

## 3. PostgreSQL (large datasets)

1. In `prisma/schema.prisma` set `provider = "postgresql"`.
2. Set the URL in `prisma.config.ts`:
   ```ts
   datasource: { url: process.env.DATABASE_URL }
   ```
3. Export the connection string and migrate:
   ```bash
   export DATABASE_URL="postgresql://user:pass@localhost:5432/moneytrack"
   npm run db:push
   npm run db:seed
   ```
4. In `src/lib/db.js` replace the libSQL adapter:
   ```js
   import { PrismaPg } from '@prisma/adapter-pg'
   export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
   ```
   ```bash
   npm install @prisma/adapter-pg pg
   ```

---

## 4. Raspberry Pi notes

- 64-bit Raspberry Pi OS, Node 20+ (`curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs`).
- SQLite is the right choice; use a USB SSD for the database if you write often.
- `npm run build` on the Pi takes a few minutes; you can also build on a laptop
  and copy `dist/` plus the project files over.
- Memory footprint at idle: roughly 60–100 MB.

---

## 5. Backups

The SQLite database is a single file:

```bash
cp prisma/dev.db backups/dev-$(date +%F).db
```

Stop the service first (or use `sqlite3 prisma/dev.db ".backup ..."`) for a
consistent copy.
