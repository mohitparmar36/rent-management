# RentEase — Project Audit

Audit and repair carried out Oct 25 – Oct 31, 2026.
A snapshot of the code **before** this work is in `.backup/pre-audit-2026-10-31.zip` (source only, no `node_modules`/`bin`/`obj`).

## 1. What was found

| Layer | Found | Matches requirement |
|---|---|---|
| Frontend | React 19 + Vite 8, React Router 7, axios, Recharts, lucide-react | Yes |
| Backend | ASP.NET Core Web API, .NET 8, EF Core 8 (SqlServer), JwtBearer, Swashbuckle | Yes |
| Auth | Own users table, `PasswordHasher<User>` (PBKDF2), self-issued JWT. No external IdP | Yes — kept |
| Database | SQL Server `RentEaseDb`, 8 tables, managed with SQL scripts (no EF migrations) | Yes — kept the SQL-script approach |

State at the start: login worked; an earlier pass (Oct 29) had added controllers and pages, but
the pages read API fields that did not exist, all business logic lived in controllers, and several
security/data-integrity rules were missing. Both projects compiled; the frontend had 15 lint warnings.

## 2. Findings and status

✅ fixed and verified · ⚠️ partly / see note

### Critical — security / data integrity

| # | Issue | Status / fix |
|---|---|---|
| C1 | JWT signing key committed in `appsettings.json` | ✅ Removed; new random key in user-secrets; API refuses to start without one. **The old key should be considered public.** |
| C2 | A landlord viewing a tenant saw that tenant's rentals and rent with **other landlords** | ✅ All reads go through `Common/DataScope.cs`; test “John sees only HIS rental with Zoe” |
| C3 | Property status could be set to `Occupied` by hand, or to `Available` while rented | ✅ Occupied is controlled only by assigning/ending rentals (same transaction) |
| C4 | No DB guarantee of one active rental per property; no protection against billing a month twice | ✅ `02_RentEaseDb_Upgrade.sql`: `BillingMonth` + unique (rental, month), filtered unique index, date/amount/paid-details checks |
| C5 | Deactivated users kept access until their token expired (8 h) | ✅ Token re-validated against the DB on every request |
| C6 | Rent never became `Overdue`, so pending/overdue totals were wrong | ✅ `RentStatusRefresher` runs before every rent view, dashboard and report |
| C7 | Future payment dates accepted; due dates unchecked; a payment could be recorded twice by double-click | ✅ Date rules; mark-paid is a single conditional UPDATE in a transaction (409 on repeat) |
| C8 | Admin could deactivate their own account | ✅ Blocked (and last-admin rule kept) |

### High — broken primary functionality

| # | Issue | Status / fix |
|---|---|---|
| H1 | Dashboards and Reports read fields the API did not return → `$0`/blank | ✅ Pages rebuilt against the real DTOs |
| H2 | Tenants, Rent and other pages used non-existent fields | ✅ Rebuilt |
| H3 | No rent totals endpoint | ✅ `GET /api/rentpayments/summary` |
| H4 | Expired/invalid token not handled in the UI | ✅ 401 → signed out with message; timer signs out at expiry; session verified on load |
| H5 | No detail pages for rent, complaints, rentals, users; tenant could not view their property | ✅ Added |

### Medium

| # | Issue | Status / fix |
|---|---|---|
| M1 | Logic in controllers; user-id parsing copied 10×; `DataScope`/`CurrentUser` unused | ✅ 12 services, thin controllers, single ownership filter |
| M2 | Out-of-scope ids returned empty `403` (revealing the record exists) | ✅ 404 with message |
| M3 | Validation errors in a different shape from other errors | ✅ All errors `{ message, errors? }`; 401/403/429/503 too |
| M4 | Change + notification saved in two steps (could half-succeed) | ✅ One `SaveChanges`/transaction |
| M5 | Dashboards/reports loaded every rent row into memory; chart gaps; future months | ✅ SQL aggregation, gap-free month series |
| M6 | `₹` in notifications, `$` elsewhere | ✅ USD everywhere (`Format.Money`, `formatMoney`) |
| M7 | Inactive user saw “invalid password” | ✅ Clear message, shown only after the password is verified |
| M8 | No login rate limiting | ✅ 10/min/IP (configurable) |
| M9 | Same-status complaint updates; assigning a property under maintenance | ✅ Rejected with messages |
| M10 | Inline styles, duplicated markup, 15 lint warnings | ✅ Shared component system; 0 lint warnings |
| M11 | No sorting | ✅ Sortable columns on all lists |
| M12 | No HTTPS in development | ✅ `https` is the default launch profile; frontend uses `https://localhost:7190` |

### Low

| # | Issue | Status / fix |
|---|---|---|
| L1 | 803 kB single JS bundle | ✅ Route-level code splitting: 269 kB initial, charts loaded only where used |
| L2 | Notification items not individually markable | ✅ Click to mark read; bell stays in sync with the notifications page |
| L3 | Unused `DashboardShell`, `UIComponents`, `shared.css` | ✅ Removed (in backup) |

Bugs found **during verification** and fixed: role check rejected every token (wrong principal in
`OnTokenValidated`); header badge not refreshed after “mark all read”; sign-out timer fired
immediately for long-lived tokens (browser `setTimeout` limit); mobile table cells not stacking;
oversized notification badge; test script failing on paths with spaces.

## 3. Database changes

`database/02_RentEaseDb_Upgrade.sql` (idempotent, no data removed) — applied to the local `RentEaseDb` on Oct 25:

- `RentPayments.BillingMonth DATE NOT NULL` (1st of month), back-filled from `DueDate` (correct for the demo data — every record is due inside the month it bills), `UQ_RentPayments_TenantProperty_BillingMonth`, `CK_RentPayments_BillingMonth`, `IX_RentPayments_DueDate`
- `UX_TenantProperties_ActiveProperty` (one active rental per property), `CK_TenantProperties_Dates`
- `CK_Properties_MonthlyRent`, `CK_RentPayments_Amount`, `CK_RentPayments_PaidDetails`

`01_RentEaseDb_Setup.sql` now creates the same schema for fresh installs. Both scripts were tested
on a scratch database. No new tables were added.

## 4. Verification results (Oct 31, 2026)

| Check | Result |
|---|---|
| `dotnet build` | ✅ 0 warnings, 0 errors |
| `npm run build` | ✅ |
| `npm run lint` | ✅ 0 warnings (was 15) |
| API end-to-end tests (`pwsh tests/run-api-tests.ps1`, fresh test DB) | ✅ **147 / 147** |
| SQL Server down → API response | ✅ `503 { message: "The database is currently unavailable…" }` |
| Demo DB smoke test (login + each dashboard, read-only) | ✅ |
| Browser walkthrough (Edge, headless) — every page for Admin, Landlord, Tenant at 1440 / 1024 / 768 / 390 px: no console errors, no failed API calls, no horizontal overflow; role redirects; other users' records show “not found”; workflows (login validation, wrong password, password toggle, return-to-page after login, invalid token sign-out, logout, tenant reports issue, landlord progresses and resolves it, records a payment and totals update, adds/deletes a property, search/sort, profile name updates header, admin deactivates/reactivates, form validation, Escape closes dialogs, notifications mark-all-read) | ✅ 238 / 238 checks |

The API tests cover every scenario listed in the brief: authentication (valid, invalid, inactive,
unauthenticated, tampered token), role restrictions, cross-landlord and cross-tenant access,
property/assignment/rent/complaint rules, notifications isolation, dashboard figures matching the
database, empty-state dashboards, profile restrictions and rate limiting.

The browser walkthrough script was run from a scratch folder and is **not committed** (it needs
`playwright-core`); the API tests are committed under `tests/`.

## 5. Remaining limitations

- No real payment processing (by design); no partial payments.
- One active rental per tenant and per property.
- Notifications are polled (every minute / on navigation), no email/SMS.
- No self-service password reset or email-change verification (admin handles these).
- JWT stored in `localStorage` — trade-off documented in README → Security notes.
- Responsive layouts were verified with automated screenshots at four widths in Edge; not tested on physical phones or in Safari/Firefox.
- The original JWT key was committed to the folder before this audit; if the project was ever shared or pushed, treat that key as compromised (it is no longer used).
