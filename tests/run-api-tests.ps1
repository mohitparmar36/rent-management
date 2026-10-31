# Runs the RentEase API tests against a throw-away database.
#
#   1. (Re)creates RentEaseDb_Test from database/01_RentEaseDb_Setup.sql
#      - your real RentEaseDb is never touched
#   2. Builds and starts the API pointed at RentEaseDb_Test (environment variables only)
#   3. Runs tests/api_tests.py
#   4. Stops the API
#
# Usage (from the repository root):   pwsh tests/run-api-tests.ps1
# Requires: sqlcmd, .NET 8 SDK, Python 3, a local SQL Server reachable with Windows authentication,
#           and the Jwt:Key user-secret (see README.md).

param(
    [string]$SqlServer = "localhost",
    [string]$TestDatabase = "RentEaseDb_Test"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$api = Join-Path $root "backend/RentEase.Api"

if ($TestDatabase -eq "RentEaseDb") { throw "Refusing to run tests against the demo database." }

Write-Host "==> Creating $TestDatabase"
$setup = (Get-Content (Join-Path $root "database/01_RentEaseDb_Setup.sql") -Raw) -replace '\bRentEaseDb\b', $TestDatabase
$setupFile = Join-Path ([IO.Path]::GetTempPath()) "rentease-test-setup.sql"
Set-Content $setupFile $setup -Encoding UTF8
sqlcmd -S $SqlServer -E -C -b -i $setupFile | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Database setup failed." }

Write-Host "==> Building API"
dotnet build $api --nologo -v quiet | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Build failed." }

Write-Host "==> Starting API on https://localhost:7190 (test database)"
$env:ConnectionStrings__DefaultConnection = "Server=$SqlServer;Database=$TestDatabase;Trusted_Connection=True;TrustServerCertificate=True;"
$env:RateLimiting__LoginsPerMinute = "40"   # the suite signs in ~20 times; the last test exceeds 40
$apiLog = Join-Path ([IO.Path]::GetTempPath()) "rentease-test-api.log"
# The project path is quoted because Start-Process does not quote arguments containing spaces
$process = Start-Process dotnet -ArgumentList "run", "--project", "`"$api`"", "--launch-profile", "https", "--no-build" `
    -PassThru -WindowStyle Hidden -RedirectStandardOutput $apiLog -RedirectStandardError "$apiLog.err"
try {
    $ready = $false
    for ($i = 0; $i -lt 60 -and -not $ready; $i++) {
        try { Invoke-WebRequest "https://localhost:7190/swagger/index.html" -UseBasicParsing -TimeoutSec 2 | Out-Null; $ready = $true }
        catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) { throw "API did not start. See $apiLog" }

    Write-Host "==> Running tests"
    python (Join-Path $PSScriptRoot "api_tests.py")
    $testExit = $LASTEXITCODE
}
finally {
    Write-Host "==> Stopping API"
    Get-Process RentEase.Api -ErrorAction SilentlyContinue | Stop-Process -Force
    if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
    Remove-Item Env:ConnectionStrings__DefaultConnection, Env:RateLimiting__LoginsPerMinute -ErrorAction SilentlyContinue
}
exit $testExit
