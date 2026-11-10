# 📡 PingPilot – Full-Stack API Monitoring & Keep-Alive SaaS Platform

> A production-grade API health monitoring and keep-alive SaaS platform designed for personal services, microservices, and free-tier hosting infrastructure (Render, Fly.io, Railway, Vercel). Features automated multi-user tenant isolation, single-portal super-admin management, SSRF hardening, 30-day automated TTL history retention, and GitHub Actions cron scheduling.

---

## 🌟 Key Features

- **Multi-Tenant SaaS Architecture**: External users can register via Google OAuth or email/password and manage their own isolated monitors.
- **Dedicated Super-Admin Portal**: Configured portal administrator (`ADMIN_EMAIL`) has platform-wide visibility (`/admin/users`), user activation/deactivation controls, and aggregate telemetry while maintaining their own personal monitors.
- **Keep-Alive Automated Probing**: 5-minute HTTP health checks executed via GitHub Actions cron scheduler (`2-59/5 * * * *`) with internal worker fallback to keep free-tier instances awake.
- **Email Alert Notifications**: Automated email notifications dispatched via Nodemailer when a monitored service transitions to `DOWN` or recovers back to `UP`.
- **SSRF Hardened**: Multi-tier Server-Side Request Forgery protection blocking loopback (`127.0.0.1`), private RFC1918 subnets, cloud metadata (`169.254.169.254`, `metadata.google.internal`), restricted internal ports, and verifying manual redirects.
- **Automated 30-Day TTL History**: MongoDB TTL expiration indexes (`{ expiresAt: 1 }, { expireAfterSeconds: 0 }`) purge logs older than 30 days automatically.
- **Linear/Vercel-Inspired UI**: Built with Tailwind CSS, Recharts for latency and uptime visualization, modal dialogs, and instant toast feedback. Brand theme centered around `#0E7A88` (Rich Ocean Teal).
- **Strict Theme System**: Two clean themes (Light & Dark). Manual toggle persisted in `localStorage` with zero flash on initial page load.
- **Direct & Simple API Communication**: Self-contained component `fetch()` calls inside respective page files for maximum clarity and maintainability.
- **Password Reset & Change Workflows**: Forgot password with secure crypto tokens and email delivery for local accounts (safely rejecting Google OAuth-only accounts), plus in-app password change for both admins and regular users.

---

## 🛠️ Architecture & Tech Stack

### Frontend
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4 (Theme color `#0E7A88`)
- **State Management**: Redux Toolkit (Auth session state)
- **Routing**: React Router DOM (v7) with role-based Protected Routes
- **Data Fetching**: Direct, self-contained `fetch()` calls in respective components
- **Visualization**: Recharts (Latency AreaChart & Uptime Availability BarChart)
- **Icons**: Lucide React
- **Notifications**: React Hot Toast
- **Authentication**: Google OAuth (`@react-oauth/google`) & local JWT credentials

### Backend
- **Runtime**: Node.js & Express.js
- **Database**: MongoDB Atlas with Mongoose
- **Security**: Helmet, CORS origin whitelist, express-rate-limit, ipaddr.js SSRF filtering
- **Auth**: JWT stored in HttpOnly cookies and Bearer tokens, bcryptjs password hashing, Google tokeninfo verification
- **Scheduler Worker**: Authenticated internal worker endpoint (`POST /api/internal/monitor/run`)
- **Email Alerts**: Nodemailer with HTML alert templates (`serviceDown`, `serviceRecovered`, `resetPassword`)

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
│   │   ├── adminController.js      # Platform stats & user management
│   │   ├── authController.js       # Login, register, Google OAuth, forgot/reset password
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
│   │   └── User.js                 # Multi-user model with bcrypt, roles & reset tokens
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── healthRoutes.js
│   │   ├── historyRoutes.js
│   │   ├── monitorRoutes.js
│   │   ├── settingsRoutes.js
│   │   └── workerRoutes.js
│   ├── services/
│   │   ├── bootstrapAdmin.js       # Auto-initializes primary admin on startup
│   │   ├── monitoringEngine.js     # Single ping & batch cycle execution with SSRF safety & alert triggers
│   │   └── recurringService.js     # In-process recurring fallback timer
│   ├── tests/
│   │   ├── admin.test.js           # Multi-user, registration & admin access control
│   │   ├── auth.test.js            # Login, password reset, change password & JWT verification tests
│   │   ├── monitoringEngine.test.js# Latency, timeout, and consecutive failure tests
│   │   ├── monitors.test.js        # CRUD, toggle, and cascade deletion tests
│   │   └── ssrf.test.js            # Comprehensive SSRF & IP blocking tests
│   ├── utils/
│   │   ├── generateToken.js        # JWT signing & cookie helpers
│   │   ├── googleAuth.js           # Google ID token verification
│   │   ├── renderTemplate.js       # HTML email alert templates
│   │   ├── sendMail.js             # Nodemailer wrapper
│   │   └── ssrfFilter.js           # Private IP & loopback detection using ipaddr.js
│   ├── .env.example
│   ├── app.js
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/               # AuthModal (frosted glass login/register/forgot password)
│   │   │   ├── charts/             # ResponseTimeChart, UptimeChart
│   │   │   ├── common/             # Card, StatusBadge, Modal, ConfirmDialog, Skeleton
│   │   │   ├── layout/             # Layout (Admin sidebar + User centered navbar), Navbar
│   │   │   └── monitors/           # MonitorTable, MonitorFormModal
│   │   ├── pages/                  # LandingPage, LoginPage, DashboardPage, MonitorsPage, Details, History, Settings, AdminUsersPage
│   │   ├── store/                  # Redux Toolkit store (auth session & theme)
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
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Key environment variables:
   - `PORT=4001`
   - `MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/pingpilot?retryWrites=true&w=majority`
   - `JWT_SECRET=your_super_secret_jwt_key_32_characters_minimum`
   - `ADMIN_EMAIL=abishekkrishnat@gmail.com`
   - `ADMIN_INITIAL_PASSWORD=PingPilot@2026!`
   - `ALLOW_PUBLIC_REGISTRATION=true`
   - `EMAIL_USER=your-email@gmail.com`
   - `EMAIL_PASS=your-google-app-password`
   - `PINGPILOT_WORKER_SECRET=your_random_worker_secret_key`
   - `FRONTEND_URL=http://localhost:3000`
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
   - `VITE_API_URL=http://localhost:4001/api`
   - `VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com`
3. Start frontend dev server on port 3000:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000` in your browser.

---

## 🌐 Production Deployment Guide

### A. Database (MongoDB Atlas)
1. Whitelist `0.0.0.0/0` in Atlas **Network Access** so Render and GitHub Actions can connect.
2. In **Database Access**, create a user with read/write privileges on the `pingpilot` database.
3. The application automatically creates indexes on startup, including the TTL index:
   ```javascript
   { expiresAt: 1 }, { expireAfterSeconds: 0 }
   ```

### B. Backend (Render)
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New + -> Web Service**.
2. Connect your Git repository.
3. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `MONGODB_URI`: `<Your MongoDB Atlas connection URI>`
   - `JWT_SECRET`: `<Secure 32+ character random string>`
   - `JWT_EXPIRES_IN`: `7d`
   - `FRONTEND_URL`: `https://your-pingpilot.vercel.app`
   - `ADMIN_EMAIL`: `abishekkrishnat@gmail.com`
   - `ADMIN_INITIAL_PASSWORD`: `<Strong initial password>`
   - `ALLOW_PUBLIC_REGISTRATION`: `true`
   - `EMAIL_USER`: `<Your email for alert dispatch>`
   - `EMAIL_PASS`: `<App password>`
   - `PINGPILOT_WORKER_SECRET`: `<Secure random secret token>`
   - `GOOGLE_CLIENT_ID`: `<Google OAuth Client ID>`
5. Deploy the service and copy your Render URL (e.g. `https://pingpilot-backend.onrender.com`).

### C. Frontend (Vercel)
1. Go to [Vercel Dashboard](https://vercel.com/) and click **Add New... -> Project**.
2. Select your repository.
3. Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
4. Environment Variables:
   - `VITE_API_URL`: `https://pingpilot-backend.onrender.com/api`
   - `VITE_GOOGLE_CLIENT_ID`: `<Your Google Client ID>`
5. Click **Deploy**. Vercel will build and serve the application with SPA fallback via `vercel.json`.

### D. Automated Scheduler (GitHub Actions)
1. In your GitHub repository, navigate to **Settings -> Secrets and variables -> Actions**.
2. Click **New repository secret** and add:
   - `PINGPILOT_WORKER_URL`: `https://pingpilot-backend.onrender.com`
   - `PINGPILOT_WORKER_SECRET`: `<The exact secret value configured in backend PINGPILOT_WORKER_SECRET>`
3. The workflow in `.github/workflows/monitor-scheduler.yml` executes every 5 minutes (`2-59/5 * * * *`).
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
- **Multi-Tenant Isolation**:
  - Monitors and history records are partitioned strictly by `userId`. Standard users can never query or mutate monitors belonging to other users.
- **Admin Access Control**:
  - Only the verified `ADMIN_EMAIL` receives the `admin` role upon bootstrap or Google sign-in.
  - Admin endpoints (`/api/admin/*`) are protected by `protect` and `adminOnly` middlewares.
  - The super-admin is filtered out from the tenant user management table.

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
- Multi-user registration and tenant isolation
- Forgot password (local accounts vs Google-only rejection) and change password flows
- Monitor CRUD, input validation, and cascade history cleanup
- Single ping execution, latency timer, and consecutive failure threshold
- Automatic UP status recovery on successful check
- Internal worker authentication and cycle execution

---

## 📄 License
ISC
