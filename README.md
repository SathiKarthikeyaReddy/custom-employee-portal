# Custom Employee Portal with Zoho One Integration

## 1. Project Overview

A web-based custom employee portal with its own authentication and Role-Based Access Control (RBAC). The backend integrates with Zoho One APIs so employees can view and open only the Zoho applications their assigned role permits. Employees never enter individual Zoho credentials — all Zoho access is proxied through one backend service account.

---

## 2. Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                   USER BROWSER                                    |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                 React 18 + Vite Frontend (Office Access UI)                 |  |
|  |  - AuthContext (Session Inactivity Tracker, Permissions & Role Matrix)      |  |
|  |  - Directory UI (Authorized / Pending Setup / Locked App Tiles)             |  |
|  |  - Admin Management (Users, Roles, Permissions, System Audit Trail)         |  |
|  +-----------------------------------------------------------------------------+  |
+----------------------------------------+------------------------------------------+
                                         |
                                         | HTTPS / REST API (/api/*)
                                         | Bearer JWT
                                         v
+-----------------------------------------------------------------------------------+
|                         NODE.JS / EXPRESS BACKEND SERVER                          |
|                                                                                   |
|  Middlewares:                                                                     |
|    - Helmet (Security headers) & CORS                                             |
|    - Rate Limiting (express-rate-limit on /api/auth/login)                        |
|    - Authenticate (JWT Bearer verification)                                       |
|    - Authorize (Server-side requirePermission + ACCESS_DENIED audit logging)       |
|    - ErrorHandler (Standardized { message, details } API responses)               |
|                                                                                   |
|  Controllers & Routes:                                                            |
|    - Auth (/api/auth)       -> Login, Me                                          |
|    - Users (/api/users)     -> Full CRUD, Password Reset                          |
|    - Roles (/api/roles)     -> CRUD with Core Role Protection                     |
|    - Permissions (/api/permissions) -> Catalog & Role Matrix Assignment          |
|    - Audit (/api/audit)     -> Paginated, Filterable Security Trail               |
|    - Zoho (/api/zoho)       -> Catalog Discovery, Launch Proxy, API Proxy         |
|                                                                                   |
|  Zoho Integration Layer (zohoService.js):                                         |
|    - In-Memory OAuth2 Token Cache (60-second safety margin)                       |
|    - Service Account Refresh-Token Grant Handler                                  |
|    - Secure Outbound Zoho Dispatcher (Zoho-oauthtoken header)                     |
+--------------------+-------------------------------------+------------------------+
                     |                                     |
      Raw Parameterized SQL                                | OAuth 2.0 Refresh Flow
      via pg.Pool                                          | & Authorized API Proxy
                     v                                     v
+--------------------------------+   +----------------------------------------------+
|     POSTGRESQL DATABASE        |   |             ZOHO ONE CLOUD APIS              |
|                                |   |                                              |
|  - roles                       |   |  - Zoho Accounts (OAuth Token Refresh)       |
|  - permissions                 |   |  - Zoho People (HR Portal)                   |
|  - users                       |   |  - Zoho CRM (Sales Management)               |
|  - user_roles                  |   |  - Zoho Desk (Support - Pending Setup)       |
|  - role_permissions            |   |  - Zoho Books (Financial Operations)         |
|  - audit_logs                  |   |                                              |
|  - zoho_apps                   |   +----------------------------------------------+
+--------------------------------+
```

---

## 3. Prerequisites

- **Node.js**: `v18.x` or higher (tested on `v22.x`)
- **npm**: `v9.x` or higher
- **PostgreSQL**: `v14+` running locally or via Docker
  - Example Docker setup:
    ```bash
    docker run --name employee-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=employee_portal -p 5432:5432 -d postgres:16-alpine
    ```

---

## 4. Backend Setup

1. **Navigate to the backend directory and install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Configure your database connection in `.env`:
   ```env
   PORT=4000
   NODE_ENV=development
   FRONTEND_ORIGIN=http://localhost:5173
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/employee_portal
   JWT_SECRET=your-secure-random-secret
   JWT_EXPIRES_IN=8h
   SESSION_IDLE_TIMEOUT_MINUTES=30
   ```

3. **Initialize database schema and seed default data:**
   ```bash
   npm run seed
   ```
   This script runs idempotent DDL (`schema.sql`) and populates default permissions, roles, the 4 Zoho One applications, and the initial System Administrator user.

4. **Start backend in development mode:**
   ```bash
   npm run dev
   ```
   The backend API will listen on `http://localhost:4000`.

---

## 5. Frontend Setup

1. **Navigate to the frontend directory and install dependencies:**
   ```bash
   cd ../frontend
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Verify `VITE_API_BASE_URL`:
   ```env
   VITE_API_BASE_URL=http://localhost:4000/api
   VITE_SESSION_IDLE_TIMEOUT_MINUTES=30
   ```

3. **Start the frontend development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 6. Default Admin Login

The seed script creates the following default System Administrator:

| Parameter | Value |
|---|---|
| **Email** | `admin@brainwave.io` |
| **Password** | `ChangeMe123!` |
| **Assigned Role** | `Admin` (all 8 permissions granted) |

---

## 7. Role → Zoho App Mapping Table

| Role | Permitted Zoho Applications | Core Permission Grants |
|---|---|---|
| **Admin** | Zoho People, Zoho CRM, Zoho Desk, Zoho Books | All 8 permissions (`zoho.*` + `admin.*`) |
| **HR** | Zoho People | `zoho.people.access` |
| **Sales** | Zoho CRM | `zoho.crm.access` |
| **Support** | Zoho Desk | `zoho.desk.access` |
| **Finance** | Zoho Books | `zoho.books.access` |
| **Manager** | Read-only oversight (no default Zoho apps) | `admin.audit.view` |

*Note:* Roles can be assigned additional permissions via the Admin Panel (**Role Permissions** page) dynamically without code changes.

---

## 8. Zoho Desk Pending Provisioning State

Currently, Zoho Desk is seeded in a **"Pending setup"** state (`is_provisioned = false`) because Zoho Desk scopes (`ZohoDesk.tickets.ALL`) were not yet provisioned in the trial organization during initial OAuth refresh token generation.

### How to Activate Zoho Desk once provisioned:
1. Generate an updated Zoho OAuth grant code containing `ZohoDesk.tickets.ALL` in addition to People, CRM, and Books scopes.
2. Exchange the grant code for a refresh token and update `ZOHO_REFRESH_TOKEN` in `backend/.env`.
3. Update `ZOHO_DESK_URL` in `backend/.env` with your organization's Desk portal URL (e.g. `https://desk.zoho.in/support/<org>`).
4. Flip `is_provisioned` in the `zoho_apps` table to `true`:
   ```sql
   UPDATE zoho_apps
   SET is_provisioned = true, base_url = 'https://desk.zoho.in'
   WHERE key = 'desk';
   ```
   Or re-run `npm run seed` after changing the default in `backend/src/config/seed.js`.

---

## 9. Security Notes

- **Credential Isolation:** Zoho OAuth `client_secret` and `refresh_token` reside **strictly on the backend**. They are never transmitted to the browser, never printed in console logs, and never stored in the database.
- **In-Memory Token Cache:** Fresh Zoho access tokens are cached in-memory with a 60-second expiry safety buffer, minimizing token requests while avoiding persistent disk or DB storage.
- **Audit Trail:** All authentication events (`LOGIN_SUCCESS`, `LOGIN_FAILED`), access denials (`ACCESS_DENIED`), Zoho application launches (`ZOHO_APP_OPENED`), and admin mutations (`USER_CREATED`, `USER_UPDATED`, `USER_DELETED`, `PASSWORD_RESET`, `ROLE_PERMISSIONS_UPDATED`) are written to the PostgreSQL `audit_logs` table with timestamp and IP address.
- **Session Security:** Frontend monitors activity and triggers an idle logout after 30 minutes of inactivity (`VITE_SESSION_IDLE_TIMEOUT_MINUTES`). The JWT token has an independent backend expiration (`JWT_EXPIRES_IN=8h`).
- **HTTPS Enforcement:** Production deployments redirect unencrypted HTTP traffic to HTTPS via reverse-proxy header inspection (`x-forwarded-proto`).
- **Environment Isolation:** Local `.env` files containing real API secrets and database passwords are explicitly ignored in `.gitignore` and must never be committed to version control. Only `.env.example` templates are tracked.

---

## 10. API Endpoint Contract

All responses conform to `{ message: string, details?: object }` on error.

| Method | Path | Auth | Required Permission | Request Body | Success Response |
|---|---|---|---|---|---|
| `POST` | `/api/auth/login` | None | — (Rate limited: 10 req/15min) | `{ email, password }` | `200 { token, user }` |
| `GET` | `/api/auth/me` | JWT | — | — | `200 { user }` |
| `GET` | `/api/users` | JWT | `admin.users.manage` | — | `200 { users: [] }` |
| `POST` | `/api/users` | JWT | `admin.users.manage` | `{ name, email, password, roleIds }` | `201 { user }` |
| `PATCH` | `/api/users/:id` | JWT | `admin.users.manage` | `{ name?, email?, isActive?, roleIds? }` | `200 { user }` |
| `POST` | `/api/users/:id/reset-password` | JWT | `admin.users.manage` | `{ password }` | `200 { message }` |
| `DELETE` | `/api/users/:id` | JWT | `admin.users.manage` | — | `204 No Content` |
| `GET` | `/api/roles` | JWT | `admin.roles.manage` | — | `200 { roles: [] }` |
| `POST` | `/api/roles` | JWT | `admin.roles.manage` | `{ name, description }` | `201 { role }` |
| `PATCH` | `/api/roles/:id` | JWT | `admin.roles.manage` | `{ name?, description? }` | `200 { role }` |
| `DELETE` | `/api/roles/:id` | JWT | `admin.roles.manage` | — | `204 No Content` (or `409` if core role) |
| `GET` | `/api/permissions` | JWT | `admin.permissions.manage` | — | `200 { permissions: [] }` |
| `POST` | `/api/permissions/assign` | JWT | `admin.permissions.manage` | `{ roleId, permissionIds }` | `200 { role }` |
| `GET` | `/api/audit` | JWT | `admin.audit.view` | Query params: `?limit=50&offset=0&action=&userEmail=` | `200 { logs: [], total }` |
| `GET` | `/api/zoho/apps` | JWT | — | — | `200 { authorized: [], locked: [] }` |
| `POST` | `/api/zoho/:appKey/open` | JWT | Verified per-app key | — | `200 { redirectUrl }` (or `403`/`409`) |
| `ANY` | `/api/zoho/:appKey/proxy*` | JWT | Verified per-app key | Passthrough payload | Passthrough Zoho API response |
