# THREADS — Fashion Store MVP

A complete demonstration fashion store: a public React storefront, a
server-validated simulated checkout, and a separate, session-protected
admin dashboard — all in one small repository with a SQLite database.

---

## 1. Project Overview and Features

**THREADS** sells clothing and fashion accessories. Customers browse the
catalog, search and filter products, manage a cart, and place demo orders
through a simulated checkout. Administrators manage the whole store
through a separate admin area at `/admin` that is never linked from the
public storefront.

### Storefront features

- Home page with hero, brand introduction, categories and featured products.
- Product catalog with search, category / size / price filters, and
  sorting (newest, price asc, price desc) — all synced to the URL.
- Product detail pages with size and color variant selection, per-variant
  stock status and a quantity stepper limited by real stock.
- Cart (persisted in `localStorage`) with quantity editing, removal,
  subtotal, and discount-code entry with live server validation.
- Simulated checkout: server recomputes every total from the database,
  validates stock and discounts inside a transaction, and creates an
  order with a `TH-000000` order number. Duplicate submissions (same
  idempotency token) cannot create a second order.
- Order confirmation page with the order number and item summary.
- Optional customer accounts: register / sign in (`/register`, `/login`),
  an account area (`/account`) with editable contact details and order
  history, and checkout pre-filled from the account. Guest checkout
  stays fully available — an account is never required.
- Clear "simulated payment — no real charge" labeling in cart, checkout
  and confirmation.
- Loading, empty, error and success states on every data screen;
  responsive from desktop down to mobile.
- Inline SVG monogram logo (header, footer, admin) — no image assets
  required for the branding.
- Dark and light mode: a sun/moon toggle in the header (and admin bar),
  remembered in `localStorage` and defaulting to the system preference.
  The theme is applied before first paint, so there is no flash.

### Admin features (`/admin`, login at `/admin/login`)

- **Dashboard** — total/active products, orders (with pending count),
  customers, 30-day and all-time revenue, low-stock alerts, recent
  orders, orders-by-status — all from live SQL queries.
- **Products** — searchable paginated table, create/edit with a
  size/color/stock variant editor, optional image path (a styled
  placeholder is used when empty), activate/deactivate, safe deletion
  (products referenced by order history return `409` and are kept).
- **Categories** — CRUD with unique-name enforcement; deletion is
  refused while products reference the category.
- **Orders** — search and status filters, order details with customer,
  shipping, snapshot items and totals; status changes restricted to
  valid transitions; cancelling restores stock exactly once.
- **Customers** — guest customer records, search, order history,
  contact editing.
- **Discounts** — percentage/fixed codes with minimum order, date window,
  usage limit, activation toggle; used codes cannot be deleted (409).
- **Inventory** — variant-level stock with filters (all/low/out/in) and
  inline, non-negative stock updates.
- **Settings** — store name, contact details, currency, low-stock
  threshold, description (validated server-side; secrets never shown).
- **Account** — change password (session is rotated on success).
- Confirmation dialogs before every destructive action; toasts for
  success and failure.

---

## 2. Technology Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, Vite 6, plain CSS, react-router-dom 6 |
| Backend | Node.js (>= 20), Express 4 |
| Database | SQLite via `better-sqlite3` (synchronous, transactional) |
| Authentication | Server-side sessions in SQLite + HTTP-only cookie; `scrypt` password hashing (Node built-in `crypto`) with `SESSION_SECRET` as pepper |
| Validation | Hand-rolled server-side validation for every write operation |
| Testing | `node:test` (built-in runner) — API + authorization tests |
| Assets | Local SVG illustrations only, no external image services |

No CORS library, no cookie parser, no dotenv: development uses a Vite
proxy so the browser only ever talks to one origin, and small helpers
are implemented in-repo to keep dependencies minimal.

---

## 3. Prerequisites

- **Node.js 20 or newer** (developed and verified on Node 24; the
  `engines` field requires `>= 20`).
- npm 9+ (ships with Node).
- Windows, macOS or Linux — no OS-specific commands are required.

---

## 4. Installation Steps

Open a terminal in the repository root, then:

```bash
# 1) Backend dependencies
cd server
npm install

# 2) Frontend dependencies
cd ../client
npm install

# 3) Configure the server (see section 5)
cd ../server
copy .env.example .env      # Windows: copy — macOS/Linux: cp .env.example .env
```

Then edit `server/.env` (next section), initialize and seed the
database (section 6), and start the servers (section 8).

---

## 5. Environment-Variable Setup

Copy `server/.env.example` to `server/.env` and adjust the values:

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | no (default `4000`) | Port for the Express API (and, in production, the built frontend). |
| `NODE_ENV` | no (default `development`) | Set to `production` when deploying. |
| `SESSION_SECRET` | **yes in production** | Long random string used as a pepper when hashing passwords and session tokens. The server refuses to start in production with a placeholder/short value. |
| `SESSION_TTL_HOURS` | no (default `8`) | Admin session lifetime. |
| `DATABASE_PATH` | no | Override the SQLite file location (default `server/data/threads.sqlite`). |
| `ADMIN_EMAIL` | for seeding | Email of the admin account created by `db:seed` / `db:reset`. |
| `ADMIN_PASSWORD` | for seeding | Password for that account. **The seed command refuses to run without it.** Set it only locally; never commit it. |
| `LOGIN_WINDOW_MS`, `LOGIN_MAX_ATTEMPTS` | no | Login rate-limit window (default 15 min) and allowed failures (default 10). |

`server/.env` is listed in `.gitignore` and is **never** part of the
submission ZIP. Only `.env.example` is committed.

---

## 6. Database Initialization and Seed

All database commands run from `server/`:

```bash
npm run db:init    # create tables (safe to run any time; idempotent)
npm run db:seed    # insert demo data — safe to rerun, never overwrites existing rows
npm run db:reset   # DROP the database file, recreate the schema and reseed from scratch
```

What the seed creates (all fictional):

- 4 categories — Tops, Bottoms, Outerwear, Accessories.
- 12 products with variant-level size/color/stock data and local SVG images.
- 5 discount codes, including one expired (`SUMMER24`) and one
  inactive (`STAFF25`) example, plus `THREADS10`, `WELCOME15`, `SAVE5`.
- Store settings (name `THREADS`, contact details, currency, low-stock threshold).
- The initial administrator from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

The server also creates the schema automatically on first start, so
`db:init` is optional. To rebuild the demo database at any point, run
`npm run db:reset`.

---

## 7. Creating the First Admin Account

The admin account is created **locally through the seed command**, never
shipped as a default:

1. Create `server/.env` from `.env.example`.
2. Set a strong `ADMIN_PASSWORD` (and `ADMIN_EMAIL` if you like) in that
   local file.
3. Run `npm run db:seed` (or `npm run db:reset`) in `server/`.
   The command errors out if `ADMIN_PASSWORD` is empty.
4. Sign in at `http://localhost:5173/admin/login` (dev) or
   `http://localhost:4000/admin/login` (production build).

For a classroom demo: set the password locally, show the login, and
change it afterwards via **Admin → Account → Change password**. Because
`server/.env` is gitignored and excluded from the ZIP, no real
credential is ever submitted or published.

---

## 8. Running the Application

### Development (two terminals)

```bash
# Terminal 1 — API on http://localhost:4000
cd server
npm run dev          # or: npm start

# Terminal 2 — Vite dev server on http://localhost:5173
cd client
npm run dev
```

Open **http://localhost:5173**. Vite proxies every `/api` request to
`http://localhost:4000`, so the session cookie stays same-origin.

### Production-style single origin (what the grader sees)

```bash
cd client && npm run build     # outputs client/dist (served by Express)
cd ../server && npm start      # serves the API + built frontend on :4000
```

Open **http://localhost:4000** — storefront and `/admin` both work from
this single origin.

---

## 9. Test Commands

```bash
cd server
npm test           # node --test: 31 automated tests
```

The suite covers authorization (all admin endpoints return `401`
without a session, generic login errors, logout, password change,
login rate limiting), customer accounts (register, claiming a guest
email, login, profile updates, order history, logout, rate limiting),
checkout integrity (server-side totals, stock
deduction, over-stock/out-of-stock rejection, discount validation,
duplicate-token protection), and admin behavior (product/category CRUD
rules, 409 protections, order transition rules, stock restored exactly
once on cancel, settings validation, dashboard stats).

Each test file boots the real Express app against its own temporary
SQLite database on an ephemeral port — no fixtures, no shared state.

---

## 10. Route Summary

### Storefront (public)

| Route | Purpose |
| --- | --- |
| `/` | Home — hero, brand intro, categories, featured products |
| `/catalog` | Product catalog with filters (`?search=&category=&size=&minPrice=&maxPrice=&sort=&page=`) |
| `/product/:slug` | Product details with variant selection |
| `/cart` | Shopping cart and discount entry |
| `/checkout` | Simulated checkout form |
| `/order-confirmation` | Order confirmation with order number |
| `/login`, `/register` | Customer sign-in and registration |
| `/account` | Signed-in area: contact details + order history |
| `*` | 404 page |

### Admin (no link anywhere in the storefront)

| Route | Purpose |
| --- | --- |
| `/admin/login` | Direct admin login (redirects to `/admin` when already signed in) |
| `/admin` | Dashboard (redirects to `/admin/login` when unauthenticated) |
| `/admin/products` | Product management |
| `/admin/categories` | Category management |
| `/admin/orders`, `/admin/orders/:id` | Order list and details |
| `/admin/customers`, `/admin/customers/:id` | Customer list and details |
| `/admin/discounts` | Discount codes |
| `/admin/inventory` | Variant stock |
| `/admin/settings` | Store settings |
| `/admin/account` | Change password |

### API

Public: `GET /api/products`, `GET /api/products/:slug`,
`GET /api/categories`, `POST /api/checkout`,
`POST /api/discounts/validate`, `GET /api/store-settings/public`.

Customer auth: `POST /api/auth/register`, `POST /api/auth/login`,
`POST /api/auth/logout`, `GET /api/auth/me`, `PATCH /api/auth/me`,
`GET /api/auth/orders`.

Admin auth: `POST /api/admin/auth/login`, `POST /api/admin/auth/logout`,
`GET /api/admin/auth/me`, `POST /api/admin/auth/change-password`.

Admin management (all require a valid session, verified on the server):
CRUD under `/api/admin/products`, `/api/admin/categories`,
`/api/admin/discounts`; read/update under `/api/admin/orders`
(including `PATCH /:id/status`), `/api/admin/customers`,
`/api/admin/settings`; plus `GET /api/admin/dashboard/stats` and
`GET|PATCH /api/admin/inventory[/:variantId]`.

---

## 11. Security Notes

- **Simulated payment only.** `POST /api/checkout` never touches a
  payment gateway and never accepts or stores card data. Orders are
  created with `payment_method = 'simulated'` and
  `payment_status = 'pending'`. The UI labels the demo clearly in the
  cart, checkout and confirmation.
- **Demo credentials** exist only in your local `server/.env` and are
  used by the local seed command. Nothing sensitive ships in the ZIP:
  `.env`, `server/data/*.sqlite` and logs are all excluded.
- **Password hashing:** `scrypt` (N=16384) with per-row random salt and
  `SESSION_SECRET` as pepper; hashes are never returned by any API.
- **Sessions:** opaque random token in an `HTTP-only`, `SameSite=Lax`
  cookie (`Secure` in production); only the HMAC of the token is stored
  server-side, sessions are destroyed on logout and rotated on password
  change. `SESSION_SECRET` is required (and checked for strength) in
  production. Admin and customer sessions use separate cookies, tables
  and rate-limit counters, so they never interfere with each other.
- **Authorization:** every `/api/admin/*` endpoint independently runs
  `requireAdmin` — hiding links in the UI is never the security
  mechanism. Frontend route guards are UX only.
- **CSRF:** same-origin deployment + `SameSite=Lax` cookies plus an
  Origin/Referer host check on state-changing admin and customer-auth
  requests.
- **Rate limiting:** repeated login failures per email+IP are limited
  (429 after the configured number of attempts within the window) —
  separately for admin and customer sign-ins.
- **Validation:** every write body and route parameter is validated
  server-side; errors return `{ error, details }` field messages, never
  stack traces.
- **SQL:** only parameterized queries (`better-sqlite3` prepared
  statements) with foreign keys enabled.
- **Money integrity:** all amounts are integer cents; totals are always
  recomputed from the database, never trusted from the browser;
  checkout and cancellation run in transactions; stock cannot go
  negative and is restored exactly once (guarded by `stock_restored`).
- **Generic auth errors:** unknown email and wrong password return the
  identical `401 Invalid email or password.`
- **Request limits:** JSON bodies are size-limited; static files are
  served read-only; no directory traversal (Express static + fallback).

---

## 12. Creating the Submission ZIP (< 10 MB)

The ZIP must contain the source but **exclude dependencies, build
output, secrets and database files**. From the repository root on
Windows (PowerShell):

```powershell
# Stage the source without excluded directories…
Remove-Item threads-fashion-store.zip -ErrorAction SilentlyContinue   # never nest an old archive
robocopy . "$env:TEMP\threads-src" /E /XD node_modules dist data .git .vscode .idea coverage /XF .env *.sqlite *.sqlite3 *.sqlite-shm *.sqlite-wal *.db *.log *.zip /NFL /NDL /NJH /NJS | Out-Null

# …then compress the staged copy
Compress-Archive -Path "$env:TEMP\threads-src\*" -DestinationPath threads-fashion-store.zip -Force
Remove-Item -Recurse -Force "$env:TEMP\threads-src"

# Measure it — must be below 10 MB
(Get-Item threads-fashion-store.zip).Length / 1MB

# Verify no secrets or databases slipped in
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::OpenRead((Resolve-Path threads-fashion-store.zip)).Entries.FullName |
  Select-String -Pattern 'node_modules|\.env$|\.sqlite|\.db$'
```

macOS / Linux equivalent (requires `zip`):

```bash
git ls-files -co --exclude-standard | zip threads-fashion-store.zip -@
# or, without git: rsync -a --exclude node_modules --exclude dist --exclude .env ./ staging/ && cd staging && zip -r ../threads-fashion-store.zip .
```

### Explicit list of excluded paths

| Path | Why |
| --- | --- |
| `node_modules/` (both packages) | Installed dependencies — recreated by `npm install` |
| `client/dist/` | Generated build output — recreated by `npm run build` |
| `server/.env`, any `.env*` | Real credentials, never submitted |
| `server/data/` (`*.sqlite`, `*.db`, WAL files) | Local database with demo/admin data |
| `*.zip` (stale archives) | Old submission archives must never nest inside the new one |
| `coverage/`, `*.log`, `*.tmp` | Test/scratch artifacts |
| `.vscode/`, `.idea/`, `.DS_Store`, `Thumbs.db` | Editor and OS metadata |

**Included:** all source (`client/src`, `server/src`, `server/test`),
`package.json` + `package-lock.json` for both packages,
`.env.example`, `.gitignore`, `MVP.md`, `README.md` and the small local
SVG assets in `client/public` (15 files, < 15 KB total).

**Measured submission size: ~0.17 MB — re-measure with the command
above before every submission.**

| Archive | Size | Limit |
| --- | --- | --- |
| `threads-fashion-store.zip` | **≈ 0.17 MB (≈ 174 KB)** | 10 MB ✅ |

---

## Project Structure

```text
threads-fashion-store/
├── client/
│   ├── src/
│   │   ├── components/       # shared UI (Header, ProductCard, Modal, …)
│   │   ├── pages/            # storefront pages (Home, Catalog, …)
│   │   ├── admin/            # admin layout, auth, and 13 admin pages
│   │   ├── context/          # Settings, Cart, CustomerAuth, Toast
│   │   ├── services/api.js   # fetch wrapper for /api
│   │   ├── styles/           # global.css, storefront.css, admin.css
│   │   └── utils/format.js   # money/date/status helpers
│   ├── public/               # favicon + local SVG images
│   └── package.json
├── server/
│   ├── src/
│   │   ├── routes/           # public routes + routes/admin/*
│   │   ├── middleware/       # auth, rate limit, security, errors
│   │   ├── services/         # orders, sessions, discounts, stats, …
│   │   ├── database/         # schema, init, seed, reset
│   │   ├── validation/       # server-side validators
│   │   ├── app.js  server.js  config.js
│   ├── test/                 # node:test automated tests
│   ├── .env.example
│   └── package.json
├── .gitignore
├── MVP.md
└── README.md
```
