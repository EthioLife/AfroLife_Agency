param(
  [ValidateSet('Setup', 'Start', 'Stop', 'Status')]
  [string]$Action = 'Status'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Port = 5433
$DataDir = Join-Path $env:LOCALAPPDATA 'AfroLife\postgresql'
$LogFile = Join-Path $DataDir 'server.log'
$EnvFile = Join-Path (Split-Path -Parent $DataDir) 'afrolife.env'

$postgresRoot = Join-Path $env:ProgramFiles 'PostgreSQL'
$postgresInstall = Get-ChildItem $postgresRoot -Directory -ErrorAction SilentlyContinue |
  Sort-Object { [version]("$($_.Name).0") } -Descending |
  Where-Object { Test-Path (Join-Path $_.FullName 'bin\initdb.exe') } |
  Select-Object -First 1
if (-not $postgresInstall) {
  throw 'PostgreSQL 14+ command-line tools are required. Install PostgreSQL, then rerun this command.'
}

$binDir = Join-Path $postgresInstall.FullName 'bin'
$initdb = Join-Path $binDir 'initdb.exe'
$pgCtl = Join-Path $binDir 'pg_ctl.exe'
$psql = Join-Path $binDir 'psql.exe'
$pgIsReady = Join-Path $binDir 'pg_isready.exe'

function Test-LocalDatabase {
  & $pgIsReady -h 127.0.0.1 -p $Port -q
  return $LASTEXITCODE -eq 0
}

function Get-MigrationPassword {
  if (-not (Test-Path $EnvFile)) { throw "$EnvFile is required to manage the local PostgreSQL database." }
  $line = Get-Content $EnvFile | Where-Object { $_ -like 'MIGRATION_DATABASE_URL=*' }
  if ($line -notmatch '^MIGRATION_DATABASE_URL=postgres://postgres:([^@\r\n]+)@127\.0\.0\.1:5433/afrolife$') {
    throw 'MIGRATION_DATABASE_URL in the local AfroLife environment file does not match the local database configuration.'
  }
  return $Matches[1]
}

function Invoke-AdminSql([string]$Sql, [string]$Password) {
  $previousPassword = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = $Password
    & $psql -h 127.0.0.1 -p $Port -U postgres -d afrolife -w -v ON_ERROR_STOP=1 -c $Sql
    if ($LASTEXITCODE -ne 0) { throw 'Database role grants failed.' }
  } finally {
    if ($null -eq $previousPassword) {
      Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    } else {
      $env:PGPASSWORD = $previousPassword
    }
  }
}

function Start-LocalDatabase {
  if (-not (Test-Path (Join-Path $DataDir 'PG_VERSION'))) {
    throw "Local database is not initialized. Run 'npm run db:local:setup' first."
  }
  if (Test-LocalDatabase) {
    Write-Output "AfroLife PostgreSQL is already running on 127.0.0.1:$Port."
    return
  }
  & $pgCtl -D $DataDir -l $LogFile -o "-h 127.0.0.1 -p $Port" -w start
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL failed to start. Inspect $LogFile." }
}

switch ($Action) {
  'Status' {
    if (Test-LocalDatabase) {
      Write-Output "AfroLife PostgreSQL is accepting connections on 127.0.0.1:$Port."
    } else {
      Write-Output "AfroLife PostgreSQL is stopped (data directory: $DataDir)."
      exit 1
    }
  }
  'Start' {
    Start-LocalDatabase
  }
  'Stop' {
    if (Test-Path (Join-Path $DataDir 'PG_VERSION')) {
      & $pgCtl -D $DataDir -m fast -w stop
      if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL failed to stop cleanly.' }
    } else {
      Write-Output 'AfroLife PostgreSQL is not initialized.'
    }
  }
  'Setup' {
    if (Test-Path (Join-Path $DataDir 'PG_VERSION')) {
      if (-not (Test-Path $EnvFile)) {
        throw "The local database already exists but $EnvFile is missing. Restore its connection settings before continuing."
      }
      Start-LocalDatabase
      Push-Location $ProjectRoot
      try {
        & npm.cmd run db:migrate
        if ($LASTEXITCODE -ne 0) { throw 'Database migrations failed.' }
      } finally {
        Pop-Location
      }
      $adminPassword = Get-MigrationPassword
      Invoke-AdminSql 'GRANT USAGE ON SCHEMA public TO afrolife_app; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO afrolife_app; GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO afrolife_app; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO afrolife_app;' $adminPassword
      Write-Output "AfroLife local database is ready. Connection details are stored outside the project in $EnvFile."
      break
    }

    if (Test-Path $EnvFile) {
      throw "$EnvFile already exists. The setup will not overwrite existing database credentials; configure it manually or move it aside first."
    }
    New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

    $adminPassword = (& node -p "require('node:crypto').randomBytes(48).toString('base64url')").Trim()
    $appPassword = (& node -p "require('node:crypto').randomBytes(48).toString('base64url')").Trim()
    $jwtSecret = (& node -p "require('node:crypto').randomBytes(48).toString('base64url')").Trim()
    $mfaKey = (& node -p "require('node:crypto').randomBytes(48).toString('base64url')").Trim()
    $passwordFile = [System.IO.Path]::GetTempFileName()

    try {
      [System.IO.File]::WriteAllText($passwordFile, $adminPassword, [System.Text.UTF8Encoding]::new($false))
      & $initdb -D $DataDir -U postgres --encoding=UTF8 --locale=C --auth-local=scram-sha-256 --auth-host=scram-sha-256 --pwfile=$passwordFile --data-checksums
      if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL cluster initialization failed.' }
    } finally {
      if (Test-Path $passwordFile) { Remove-Item -LiteralPath $passwordFile -Force }
    }

    $envLines = @(
      'NODE_ENV=development',
      'PORT=3010',
      "DATABASE_URL=postgres://afrolife_app:$appPassword@127.0.0.1:$Port/afrolife",
      "MIGRATION_DATABASE_URL=postgres://postgres:$adminPassword@127.0.0.1:$Port/afrolife",
      "JWT_SECRET=$jwtSecret",
      "MFA_ENC_KEY=$mfaKey",
      'FILE_STORAGE_DIR=./data/private-files',
      'REQUIRE_MFA_FOR_STAFF=0',
      'CORS_ORIGINS=https://localhost'
    )
    $envText = [string]::Join([Environment]::NewLine, $envLines) + [Environment]::NewLine
    [System.IO.File]::WriteAllText($EnvFile, $envText, [System.Text.UTF8Encoding]::new($false))

    Start-LocalDatabase
    $env:PGPASSWORD = $adminPassword
    try {
      $createRole = "CREATE ROLE afrolife_app LOGIN PASSWORD '$appPassword' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;"
      & $psql -h 127.0.0.1 -p $Port -U postgres -d postgres -w -v ON_ERROR_STOP=1 -c $createRole
      if ($LASTEXITCODE -ne 0) { throw 'Could not create the AfroLife database and restricted runtime role.' }
      & (Join-Path $binDir 'createdb.exe') -h 127.0.0.1 -p $Port -U postgres -w afrolife
      if ($LASTEXITCODE -ne 0) { throw 'Could not create the AfroLife database.' }

      $bootstrap = 'CREATE EXTENSION IF NOT EXISTS pgcrypto; GRANT USAGE ON SCHEMA public TO afrolife_app; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO afrolife_app; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO afrolife_app; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO afrolife_app;'
      & $psql -h 127.0.0.1 -p $Port -U postgres -d afrolife -w -v ON_ERROR_STOP=1 -c $bootstrap
      if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the database extension and runtime grants.' }
    } finally {
      Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }

    Push-Location $ProjectRoot
    try {
      & npm.cmd run db:migrate
      if ($LASTEXITCODE -ne 0) { throw 'Database migrations failed.' }
    } finally {
      Pop-Location
    }
    Invoke-AdminSql 'GRANT USAGE ON SCHEMA public TO afrolife_app; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO afrolife_app; GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO afrolife_app; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO afrolife_app;' $adminPassword
    Write-Output 'AfroLife local database is ready on 127.0.0.1:5433.'
    Write-Output "The app uses a non-superuser role with row-level security enabled. Credentials are stored outside the project in $EnvFile."
    Write-Output "To start the app, create the initial administrator as described in README.md, then run 'npm run dev'."
  }
}
