# 📡 PingPilot

> A full-stack, personal API health monitoring and keep-alive platform designed for personal services and free-tier infrastructure (such as Render, Fly.io, and Railway).

---

## 🌟 Key Features

- **Keep-Alive Probing**: Automated HTTP health checks running on a 5-minute interval via GitHub Actions & internal fallback worker to prevent free-tier instances from idling.
- **SSRF Hardened**: Multi-tier Server-Side Request Forgery protection blocking loopback (`127.0.0.1`), private RFC1918 subnets, cloud metadata (`169.254.169.254`, `metadata.google.internal`), restricted internal ports, and following redirects securely.
- **Single-Admin Security**: Personal instance architecture with JWT sessions via HttpOnly `SameSite` cookies, Google OAuth 2.0 token verification, rate limiting, and bootstrap admin initialization.
- **Automated 30-Day TTL History**: MongoDB TTL expiration indexes (`expireAfterSeconds: 0`) ensure historical logs older than 30 days are automatically purged without manual database maintenance.
- **Linear/Vercel-Inspired UI**: Responsive interface built with Tailwind CSS, Recharts for latency and uptime visualization, modal dialogs, and instant toast feedback.
- **Strict Theme System**: Light and Dark mode options only (Light default, manual toggle, persisted in `localStorage`, zero flashing on page load).
- **GitHub Actions Scheduler**: Standalone workflow that triggers the monitoring engine every 5 minutes (`2-59/5 * * * *`) with retry handling and concurrency locks.

---

## 🛠️ Architecture & Tech Stack

### Frontend
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4
- **State Management**: Redux Toolkit & React-Redux
- **Routing**: React Router DOM (v7) with protected routes
- **Visualization**: Recharts (Response Time AreaChart, Uptime BarChart)
- **Icons**: Lucide React
- **Notifications**: React Hot Toast
- **Authentication**: Google OAuth (`@react-oauth/google`) & credentials

### Backend
- **Runtime**: Node.js & Express.js
- **Database**: MongoDB Atlas with Mongoose
- **Security**: Helmet, CORS origin whitelist, express-rate-limit, ipaddr.js SSRF filtering
- **Auth**: JWT stored in HttpOnly cookies, bcryptjs password hashing, Google tokeninfo verification
- **Scheduler Worker**: Authenticated internal worker endpoint (`POST /api/internal/monitor/run`)

---

## 📁 Repository Structure

```
PingPilot/
├── .github/
│   └── workflows/
│       └── monitor-scheduler.yml   # 5-minute GitHub Actions scheduler
├── backend/
│   ├── config/
│   │   ├── db.js                   # MongoDB Atlas connection & DNS fallback
│   │   └── validateEnv.js          # Environment variable validation & normalization
│   ├── controllers/
│   │   ├── authController.js       # Admin login, Google OAuth, session check, logout
│   │   ├── dashboardController.js  # Aggregated metrics, charts, and activity feed
│   │   ├── historyController.js    # Paginated logs with date & monitor filters
│   │   ├── monitorController.js    # Monitor CRUD, pause/resume, and manual ping
│   │   ├── settingsController.js   # Configuration and admin profile
│   │   └── workerController.js     # Internal worker endpoint for cron triggers
│   ├── middleware/
│   │   ├── auth.js                 # JWT cookie/bearer protection & worker secret check
│   │   ├── errorHandler.js         # Centralized error handler
│   │   ├── rateLimiter.js          # Rate limiters for public & auth endpoints
│   │   └── validators.js           # Express-validator input schemas
│   ├── models/
│   │   ├── Monitor.js              # Monitor schema with failure threshold counters
│   │   ├── PingResult.js           # Historical ping records with 30-day TTL index
│   │   ├── SystemSetting.js        # Dynamic app settings
│   │   └── User.js                 # Admin user with bcrypt hashing & Google ID
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── healthRoutes.js
│   │   ├── historyRoutes.js
│   │   ├── monitorRoutes.js
│   │   ├── settingsRoutes.js
│   │   └── workerRoutes.js
│   ├── services/
│   │   ├── bootstrapAdmin.js       # Auto-initializes admin account on startup
│   │   ├── monitoringEngine.js     # Single ping & batch cycle execution with SSRF safety
│   │   └── recurringService.js     # In-process recurring fallback timer
│   ├── tests/
│   │   ├── auth.test.js            # Login, password check, and JWT verification tests
│   │   ├── monitoringEngine.test.js# Latency, timeout, and consecutive failure tests
│   │   ├── monitors.test.js        # CRUD, toggle, and cascade deletion tests
│   │   └── ssrf.test.js            # Comprehensive SSRF & IP blocking tests
│   ├── utils/
│   │   ├── generateToken.js        # JWT signing & cookie helpers
│   │   ├── googleAuth.js           # Google ID token verification
│   │   └── ssrfFilter.js           # Private IP & loopback detection using ipaddr.js
│   ├── .env.example
│   ├── app.js
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── charts/             # ResponseTimeChart, UptimeChart
│   │   │   ├── common/             # Card, StatusBadge, Modal, ConfirmDialog, Skeleton
│   │   │   ├── layout/             # Layout, Sidebar, Navbar
│   │   │   └── monitors/           # MonitorTable, MonitorFormModal
│   │   ├── pages/                  # LoginPage, DashboardPage, MonitorsPage, Details, History, Settings
│   │   ├── services/api.js         # Axios client with interceptors
│   │   ├── store/                  # Redux Toolkit store and slices (auth, monitors, theme)
│   │   ├── App.jsx                 # Router with ProtectedRoute
│   │   ├── index.css               # Tailwind CSS v4 styles & dark mode
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── vercel.json                 # SPA routing rewrite for Vercel
│   └── vite.config.js
└── README.md
```

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js 18+ (Node 20 or 22 recommended)
- MongoDB Atlas cluster or local MongoDB instance

### 2. Backend Setup
1. Navigate to `backend`:
   ```bash
   cd backend
   ```
2. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```
   Key environment variables:
   - `PORT=5000`
   - `MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/pingpilot?retryWrites=true&w=majority`
   - `JWT_SECRET=your_super_secret_jwt_key_32_characters_minimum`
   - `ADMIN_EMAIL=admin@example.com`
   - `ADMIN_INITIAL_PASSWORD=PingPilot@2026!`
   - `PINGPILOT_WORKER_SECRET=your_random_worker_secret_key`
   - `FRONTEND_URL=http://localhost:6000`
   - `GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com`
3. Run tests:
   ```bash
   npm test
   ```
4. Start backend:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup
1. Navigate to `frontend`:
   ```bash
   cd frontend
   ```
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Variables:
   - `VITE_API_URL=http://localhost:5000/api`
   - `VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com`
3. Start frontend dev server on port 6000:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:6000` in your browser.

---

## 🌐 Production Deployment Guide

### A. Database (MongoDB Atlas)
1. In MongoDB Atlas, go to **Network Access** and whitelist `0.0.0.0/0` (allow access from anywhere) so Render and GitHub Actions can connect.
2. In **Database Access**, create a user with read/write privileges on the `pingpilot` database.
3. The application will automatically create indexes on startup, including the TTL index:
   ```javascript
   { expiresAt: 1 }, { expireAfterSeconds: 0 }
   ```

### B. Backend (Render)
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New + -> Web Service**.
2. Connect your Git repository.
3. Configure the service settings:
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `MONGODB_URI`: `<Your MongoDB Atlas connection URI>`
   - `JWT_SECRET`: `<Secure 32+ character random string>`
   - `JWT_EXPIRES_IN`: `7d`
   - `FRONTEND_URL`: `https://your-pingpilot.vercel.app`
   - `ADMIN_EMAIL`: `your-email@example.com`
   - `ADMIN_INITIAL_PASSWORD`: `<Strong initial password>`
   - `PINGPILOT_WORKER_SECRET`: `<Secure random secret token>`
   - `GOOGLE_CLIENT_ID`: `<Google OAuth Client ID from Google Cloud Console>`
   - `GOOGLE_CLIENT_SECRET`: `<Google OAuth Client Secret>`
5. Deploy the service and copy your Render URL (e.g. `https://pingpilot-backend.onrender.com`).

### C. Frontend (Vercel)
1. Go to [Vercel Dashboard](https://vercel.com/) and click **Add New... -> Project**.
2. Select your repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
4. Under **Environment Variables**, add:
   - `VITE_API_URL`: `https://pingpilot-backend.onrender.com/api`
   - `VITE_GOOGLE_CLIENT_ID`: `<Your Google Client ID>`
5. Click **Deploy**. Vercel will build and serve the application with SPA fallback via `vercel.json`.

### D. Automated Scheduler (GitHub Actions)
1. In your GitHub repository, navigate to **Settings -> Secrets and variables -> Actions**.
2. Click **New repository secret** and add:
   - `PINGPILOT_WORKER_URL`: `https://pingpilot-backend.onrender.com`
   - `PINGPILOT_WORKER_SECRET`: `<The exact secret value configured in backend PINGPILOT_WORKER_SECRET>`
3. The workflow in `.github/workflows/monitor-scheduler.yml` runs every 5 minutes (`2-59/5 * * * *`).
4. To test manually, go to the **Actions** tab in GitHub, select **PingPilot Monitor Scheduler**, and click **Run workflow**.

---

## 🔒 Security Architecture

- **SSRF Hardening**:
  - Validates protocol strictly (`http:`, `https:`).
  - Blocks loopback (`127.0.0.0/8`, `::1`), private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local metadata (`169.254.169.254`, `metadata.google.internal`), carrier-grade NAT, and internal ports (22, 3306, 6379, 27017, etc.).
  - Follows redirects manually, verifying each redirect target hop against the SSRF filter before executing the request.
- **Worker Authentication**:
  - Scheduled external cron requests authenticate via the `x-worker-secret` header against `PINGPILOT_WORKER_SECRET`.
  - Rejects unauthorized requests with HTTP 401.
  - Implements concurrency locks to prevent overlapping probe runs.
- **Single-Admin Enforcement**:
  - Restricts login strictly to the configured `ADMIN_EMAIL`.
  - Blocks public registration.
  - For Google OAuth, Google identity tokens are verified server-side, and access is permitted only if the verified email matches `ADMIN_EMAIL`.

---

## 🧪 Testing

To execute the backend automated test suite:

```bash
cd backend
npm test
```

Suite covers:
- SSRF filtering (IP ranges, private networks, cloud metadata, protocols, dangerous ports)
- Admin login, password validation, and JWT cookie issuance
- Protected routes and authorization middleware
- Monitor CRUD, input validation, and cascade history cleanup
- Single ping execution, latency timer, and consecutive failure threshold
- Automatic UP status recovery on successful check
- Internal worker authentication and cycle execution

---

## 📄 License
ISC

