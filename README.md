# RentEase — Rental Property Management System

RentEase is a web application for managing rental properties. **Landlords** list their
properties, move tenants in and out, bill monthly rent, record payments and handle
maintenance complaints. **Tenants** see their home, their rent and payment history, and
report issues. **Administrators** manage user accounts and oversee everything.

Final-year project · React + ASP.NET Core (.NET 8) + SQL Server.

---

## Contents

1. [Features](#features)
2. [Technology](#technology)
3. [Prerequisites](#prerequisites)
4. [Repository structure](#repository-structure)
5. [Set up the database (SSMS)](#1-set-up-the-database-ssms)
6. [Configure the API](#2-configure-the-api)
7. [Run the API](#3-run-the-api)
8. [Run the frontend](#4-run-the-frontend)
9. [Demo accounts](#demo-accounts)
10. [API endpoints](#api-endpoints)
11. [Security notes](#security-notes)
12. [Testing](#testing)
13. [Troubleshooting](#troubleshooting)
14. [Known limitations](#known-limitations)

---

## Features

| Area | What works |
|---|---|
| **Sign-in** | Email + password against our own SQL Server `Users` table, passwords hashed with PBKDF2, self-issued JWT (8 h), logout, “session expired” handling, login rate limiting, deactivated accounts blocked immediately |
| **Dashboards** | Separate Admin / Landlord / Tenant dashboards, all figures calculated from the database: properties, occupancy, tenants, rent collected / pending / overdue, open complaints, 6-month rent chart, recent activity |
| **Users** (Admin) | List, search, filter by role and status, sort, create, edit, reset password, activate / deactivate (cannot deactivate yourself or the last admin) |
| **Properties** | List with search, type/status filters, sorting and pagination; add, edit, details; delete only when the property has no history |
| **Tenants** | Tenant list, tenant details with rental history and rent totals, create a tenant account and move them in in one step |
| **Rentals** | Assign a tenant to a vacant property, end a rental (history and rent kept), one active tenant per property; property status updates automatically |
| **Rent** | Monthly rent records per rental (one per month), automatic Overdue status, record payments (cash / UPI / bank transfer / other), totals, filters by status / property / tenant / month, payment history |
| **Complaints** | Tenants report issues for the home they rent; landlords and admins move them Open → In Progress → Resolved (and reopen); progress timeline |
| **Notifications** | Bell with unread count, dropdown, notifications page, mark one / all as read. Created for new rent, payments, rental start/end, new complaints and status changes |
| **Reports** | Rent collection by month (6/12/24 months), outstanding rent, occupancy, complaints by status/priority/category, average resolution time, CSV export |
| **Profile** | Every user can update their name and phone and change their password (current password required) |
| **UI** | Responsive (desktop, laptop, tablet, phone), sidebar + mobile drawer, breadcrumbs, toasts, confirmation dialogs, loading skeletons, empty and error states, keyboard accessible |

RentEase **records** payments that were made outside the app. It does not process or move money.

## Technology

| Layer | Used |
|---|---|
| Frontend | React 19, Vite, React Router 7, axios, Recharts (charts), lucide-react (icons), plain CSS design system |
| Backend | ASP.NET Core Web API on .NET 8, Entity Framework Core 8, JWT bearer authentication, Swagger |
| Database | Microsoft SQL Server, managed with SQL scripts in SSMS |

## Prerequisites

- **SQL Server** (Express or Developer edition) and **SQL Server Management Studio (SSMS)**
- **.NET 8 SDK** — check with `dotnet --list-sdks`
- **Node.js 20+** — check with `node -v`
- Optional, for the automated API tests: **Python 3** and `sqlcmd`

## Repository structure

```
Rent Management/
├── backend/RentEase.Api/          ASP.NET Core Web API
│   ├── Controllers/               HTTP endpoints only — each calls one service method
│   ├── Services/                  Business rules (properties, rentals, rent, complaints, …)
│   ├── Common/                    CurrentUser, DataScope (who may see what), constants, errors, paging
│   ├── DTOs/                      Request/response shapes (never the database entities)
│   ├── Models/ + Data/            EF Core entities and AppDbContext
│   ├── Middleware/                Turns exceptions into JSON errors
│   └── Program.cs                 Startup: database, JWT, CORS, rate limiting, Swagger
├── database/
│   ├── 01_RentEaseDb_Setup.sql    Creates the database, tables, constraints and demo data
│   ├── 02_RentEaseDb_Upgrade.sql  Upgrades a database created before Oct 2026 (safe to re-run)
│   └── ER-DIAGRAM.md              Entity relationship diagram and integrity rules
├── frontend/                      React app (Vite)
│   └── src/
│       ├── pages/                 One folder per module (dashboard, properties, tenants, rent, …)
│       ├── components/            layout/ (shell), common/ (tables, cards, modals…), forms/, charts/
│       ├── context/               Auth, toast and confirm-dialog state
│       ├── hooks/                 useAsync (data loading), useListParams (filters in the URL)
│       ├── services/              api.js (axios), api.service.js (one function per endpoint)
│       └── utils/                 Formatting, constants, error messages
├── tests/                         End-to-end API tests (see tests/README.md)
├── PROJECT_AUDIT.md               Audit findings, fixes and verification results
└── README.md
```

---

## 1. Set up the database (SSMS)

1. Open **SSMS** and connect to your SQL Server (for example `localhost` or `.\SQLEXPRESS`)
   with **Windows Authentication**.
2. **New database:** *File → Open → File…* → `database/01_RentEaseDb_Setup.sql` → press **F5**.
   This creates `RentEaseDb`, all eight tables, constraints, indexes and the demo data.
   > ⚠️ Re-running script 01 **drops and recreates all RentEase tables** — any data you added is lost.
3. **Existing database** (created with an older copy of script 01): open
   `database/02_RentEaseDb_Upgrade.sql` and press **F5**. It adds the `BillingMonth` column
   and the new constraints without deleting data, and prints what it did in the *Messages* tab.
   It is safe to run more than once.
4. Check: in *Object Explorer* expand **Databases → RentEaseDb → Tables**; you should see
   `Roles, Users, Properties, TenantProperties, RentPayments, ComplaintCategories, Complaints, Notifications`.

The schema and its rules are documented in [`database/ER-DIAGRAM.md`](database/ER-DIAGRAM.md).

## 2. Configure the API

Settings live in `backend/RentEase.Api/appsettings.json`. **Secrets are not stored there.**

### Connection string

The default connects to `localhost` with Windows Authentication, which contains no password:

```json
"ConnectionStrings": {
  "DefaultConnection": "Server=localhost;Database=RentEaseDb;Trusted_Connection=True;TrustServerCertificate=True;"
}
```

If your server has a different name (e.g. SQL Express), change `Server=` to `.\\SQLEXPRESS`
(note the doubled backslash in JSON). If you use a **SQL login with a password**, do not put it in
`appsettings.json` — store it as a user-secret instead:

```powershell
cd backend/RentEase.Api
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost;Database=RentEaseDb;User Id=rentease;Password=<your password>;TrustServerCertificate=True;"
```

### JWT signing key (required)

The API refuses to start without a signing key of at least 32 characters. Generate one and
store it as a user-secret (stored in your Windows profile, outside the repository):

```powershell
cd backend/RentEase.Api
dotnet user-secrets set "Jwt:Key" "$([Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(64)))"
```

On a server, set the environment variable `Jwt__Key` instead. Other JWT settings
(`Issuer`, `Audience`, `ExpiryHours`) are in `appsettings.json`.

### Other settings

| Setting | Default | Purpose |
|---|---|---|
| `Cors:AllowedOrigins` | `http://localhost:5173` | Frontend address(es) allowed to call the API |
| `RateLimiting:LoginsPerMinute` | `10` | Login attempts allowed per minute per IP address |

## 3. Run the API

```powershell
cd backend/RentEase.Api
dotnet dev-certs https --trust     # first time only: trust the local HTTPS certificate
dotnet run --launch-profile https
```

- API: **https://localhost:7190** (also http://localhost:5030)
- Swagger UI: **https://localhost:7190/swagger** — sign in with `POST /api/auth/login`,
  click **Authorize** and paste the returned `token`.

## 4. Run the frontend

```powershell
cd frontend
npm install        # first time only
npm run dev
```

Open **http://localhost:5173**. The frontend calls the API address in `frontend/.env`:

```
VITE_API_BASE_URL=https://localhost:7190/api
```

Production build: `npm run build` (output in `frontend/dist`). Lint: `npm run lint`.

## Demo accounts

Created by `01_RentEaseDb_Setup.sql`. **Development only — never use these on a real deployment.**
The passwords are stored hashed; they are listed here only so you can sign in to the demo.

| Role | Email | Password | Demo data |
|---|---|---|---|
| Admin | `admin@rentease.com` | `Admin@123` | Sees everything |
| Landlord | `landlord@rentease.com` | `Landlord@123` | John — owns Greenwood Apartments 2B and Maple Street Duplex |
| Landlord | `sarah.landlord@rentease.com` | `Landlord@123` | Sarah — owns Riverside Villa and Downtown Loft 5A (vacant) |
| Tenant | `tenant@rentease.com` | `Tenant@123` | Michael — rents Greenwood Apartments 2B |
| Tenant | `emma.tenant@rentease.com` | `Tenant@123` | Emma — rents Maple Street Duplex |
| Tenant | `david.tenant@rentease.com` | `Tenant@123` | David — rents Riverside Villa |

**Suggested demo:** sign in as John → add a rent record for Greenwood → sign in as Michael in a
private window → see the notification, report an issue → back as John, resolve it and record the
payment → Michael's dashboard and notifications update.

To change a demo password, sign in and use **Profile → Change password** (or reset it as Admin
under **Users → Edit**). New passwords need 8+ characters with a letter and a number.

---

## API endpoints

All endpoints except login require `Authorization: Bearer <token>`. Errors always look like
`{ "message": "…" }` (validation errors add `"errors": { "field": ["…"] }`).
List endpoints accept `page`, `pageSize` (max 100), `search`, `sortBy`, `sortDir` (`asc`/`desc`)
and return `{ items, page, pageSize, totalCount, totalPages }`.

“Scoped” means: **Admin** sees everything, a **Landlord** only data for their own properties,
a **Tenant** only their own records. Records outside your scope return **404**.

### Authentication & profile

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | anyone | `{ email, password }` → `{ token, user }`. Rate limited |
| GET | `/api/auth/me` | signed in | Current user |
| POST | `/api/auth/change-password` | signed in | Same as `/api/profile/change-password` |
| GET | `/api/profile` | signed in | Own profile |
| PUT | `/api/profile` | signed in | `{ firstName, lastName, phoneNumber }` — email, role and status can't be changed here |
| POST | `/api/profile/change-password` | signed in | `{ currentPassword, newPassword }` |

### Users (Admin only)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/users` | Filters `role`, `isActive`; sort `name, email, role, createdAt, lastLogin` |
| GET | `/api/users/{id}` | |
| POST | `/api/users` | `{ firstName, lastName, email, phoneNumber, role, password }` |
| PUT | `/api/users/{id}` | `{ firstName, lastName, email, phoneNumber, newPassword? }` — role is fixed |
| PATCH | `/api/users/{id}/status` | `{ isActive }` — not yourself, not the last active admin |

### Properties

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/properties` | scoped | Filters `type`, `status`, `landlordId`; sort `name, rent, city, status, createdAt` |
| GET | `/api/properties/{id}` | scoped | Includes current tenant, rental history, recent rent, totals |
| POST | `/api/properties` | Admin, Landlord | Admins must give `landlordId`; status `Available` or `Maintenance` |
| PUT | `/api/properties/{id}` | owner, Admin | `Occupied` is controlled by rentals, not editable |
| DELETE | `/api/properties/{id}` | owner, Admin | Only if the property has no rental or complaint history (409 otherwise) |

### Tenants & rentals

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/tenants` | Admin, Landlord | `status=Housed|Unassigned`; sort `name, email, property` |
| GET | `/api/tenants/available` | Admin, Landlord | Active tenants without a rental (name + email only) |
| GET | `/api/tenants/{id}` | Admin, Landlord | Landlords see only rentals on their own properties |
| POST | `/api/tenants` | Admin, Landlord | Creates the account and (required for landlords) the rental in one transaction |
| GET | `/api/tenantproperties` | scoped | Filters `status, propertyId, tenantId`; sort `startDate, tenant, property, status` |
| GET | `/api/tenantproperties/{id}` | scoped | Includes rent records and totals |
| POST | `/api/tenantproperties` | Admin, Landlord | `{ tenantId, propertyId, startDate, endDate? }` → property becomes Occupied |
| POST | `/api/tenantproperties/{id}/complete` | Admin, Landlord | `{ endDate }` (today or earlier) → Completed, property Available |

### Rent

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/rentpayments` | scoped | Filters `status, propertyId, tenantId, billingMonth (yyyy-MM)`; sort `dueDate, month, amount, status, tenant, property` |
| GET | `/api/rentpayments/summary` | scoped | Collected / pending / overdue totals for the same filters |
| GET | `/api/rentpayments/{id}` | scoped | |
| POST | `/api/rentpayments` | Admin, Landlord | `{ tenantPropertyId, billingMonth, amount, dueDate, notes? }` — one per rental per month |
| POST | `/api/rentpayments/{id}/mark-paid` | Admin, Landlord | `{ paymentDate, paymentMethod, notes? }` — tenants cannot; a record can be paid once |

### Complaints

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/complaints` | scoped | Filters `status, priority, categoryId, propertyId`; sort `createdAt, updatedAt, priority, status, title, property` |
| GET | `/api/complaints/{id}` | scoped | |
| POST | `/api/complaints` | Tenant | `{ propertyId, categoryId, title, description, priority }` — must be the property they rent now |
| PATCH | `/api/complaints/{id}/status` | Admin, Landlord | `{ status }` — Resolved sets `ResolvedAt`, reopening clears it |
| GET | `/api/complaintcategories` | signed in | Active categories |

### Notifications (own only)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/notifications` | `unreadOnly=true` optional; response includes `unreadCount` |
| GET | `/api/notifications/unread-count` | `{ count }` |
| PATCH | `/api/notifications/{id}/read` | 404 for anyone else's notification |
| PATCH | `/api/notifications/read-all` | |

### Dashboards & reports

| Method | Path | Who |
|---|---|---|
| GET | `/api/dashboard/admin` | Admin |
| GET | `/api/dashboard/landlord` | Landlord |
| GET | `/api/dashboard/tenant` | Tenant |
| GET | `/api/reports/rent-collection?months=12` | scoped (1–24 months) |
| GET | `/api/reports/occupancy` | Admin, Landlord |
| GET | `/api/reports/complaints` | scoped |

---

## Security notes

- **Passwords** are hashed with ASP.NET Core Identity's `PasswordHasher` (PBKDF2, salted). Hashes are never returned by the API.
- **Authentication** is our own: the API checks the password against SQL Server and issues a signed JWT (HMAC-SHA256, 8-hour expiry). No external identity provider is used.
- **Every request** re-checks that the account still exists and is active, so deactivating a user takes effect immediately.
- **Authorization is enforced by the API** (`[Authorize(Roles = …)]` plus ownership filters in `Common/DataScope.cs`). The user id always comes from the validated token, never from the request body. Hiding buttons in the UI is only a convenience.
- **Login rate limiting**: 10 attempts per minute per IP (configurable).
- **CORS** allows only the configured frontend origin. **HTTPS** is used in development (`https` launch profile).
- **Errors** never include stack traces or SQL; they are logged on the server instead.
- **Token storage**: the frontend keeps the JWT in `localStorage` so a refresh keeps you signed in. The trade-off is that a script injected into the page could read it. React escapes all rendered text and the app never renders raw HTML, which limits that risk; tokens also expire after 8 hours and are rejected as soon as the account is deactivated. A stricter alternative would be an HttpOnly cookie with CSRF protection.
- **Secrets**: the JWT key (and any SQL password) live in user-secrets or environment variables, not in the repository.

## Testing

| What | Command | Result (Oct 31, 2026) |
|---|---|---|
| Backend build | `dotnet build backend/RentEase.Api` | 0 warnings, 0 errors |
| Frontend build | `cd frontend && npm run build` | succeeds |
| Frontend lint | `cd frontend && npm run lint` | 0 warnings |
| API end-to-end tests | `pwsh tests/run-api-tests.ps1` | 147 / 147 checks passed |

The API tests run against a throw-away `RentEaseDb_Test` database. See [`tests/README.md`](tests/README.md).
A browser walkthrough (Microsoft Edge, all pages × 3 roles × 4 screen widths, plus the main
workflows) was also run during the audit; results are in [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md).

## Troubleshooting

| Problem | Fix |
|---|---|
| API exits with *“Jwt:Key is missing…”* | Set the user-secret — see [Configure the API](#jwt-signing-key-required) |
| Login page says *“Cannot reach the RentEase server”* | The API isn't running, or `frontend/.env` points to the wrong address. Restart `npm run dev` after editing `.env` |
| Browser blocks `https://localhost:7190` | Run `dotnet dev-certs https --trust`, then restart the browser |
| *“The database is currently unavailable”* | SQL Server isn't running (check *Services → SQL Server (MSSQLSERVER)*), or the connection string's `Server=` is wrong |
| `Cannot open database "RentEaseDb"` / login failed | Run `01_RentEaseDb_Setup.sql` in SSMS; make sure your Windows user can access SQL Server |
| *“Invalid column name 'BillingMonth'”* | Your database predates the upgrade — run `02_RentEaseDb_Upgrade.sql` |
| CORS error in the browser console | The frontend address must be listed in `Cors:AllowedOrigins` |
| *“Too many sign-in attempts”* | Wait one minute (rate limiting) |
| Demo password doesn't work | Someone changed it — reset it as Admin, or re-run script 01 (this resets **all** data) |

## Known limitations

- **No real payments.** Recording a payment marks rent as paid; no money moves and there is no payment gateway.
- **Whole-month payments only.** A rent record is either paid in full or not; partial payments would need a separate payments table.
- **One active rental per tenant** and per property.
- **Notifications are not real-time.** The bell refreshes on navigation and every minute; there is no email or SMS.
- **Overdue** is updated when rent data is viewed (no background job); totals and lists are always consistent because every rent screen refreshes it first.
- **Email addresses** can only be changed by an admin; there is no email-verification flow. There is no self-service “forgot password” — an admin resets it.
- **No automated UI test suite** is committed; the browser walkthrough used during the audit is described in `PROJECT_AUDIT.md`.
