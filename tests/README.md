# RentEase tests

`api_tests.py` is an end-to-end test of the REST API: 147 checks covering authentication,
role restrictions, ownership rules (landlord A cannot touch landlord B's data, tenants only see
their own records), validation, rent/payment rules, complaints, notifications, dashboards,
reports, profile changes and login rate limiting.

It makes real HTTP requests and **creates and changes data**, so it runs against a disposable
database, never your demo `RentEaseDb`.

## Run everything with one command

From the repository root, in PowerShell:

```powershell
pwsh tests/run-api-tests.ps1
```

This (re)creates `RentEaseDb_Test` from `database/01_RentEaseDb_Setup.sql`, starts the API pointed
at it on `https://localhost:7190`, runs the tests and stops the API. Stop any API you already
have running on that port first.

Requirements: SQL Server reachable as `localhost` with Windows authentication, `sqlcmd`,
the .NET 8 SDK, Python 3, and the `Jwt:Key` user-secret (see the main README).

When you are done you can remove the test database:

```sql
DROP DATABASE IF EXISTS RentEaseDb_Test;
```
