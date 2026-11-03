[CmdletBinding()]
param(
  [ValidateSet('Up', 'Down', 'Status', 'Seed')]
  [string]$Action = 'Up'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvironmentFile = Join-Path $ProjectRoot '.env.docker'
$CredentialDirectory = Join-Path $ProjectRoot '.local-qa'
$ComposeFile = Join-Path $ProjectRoot 'compose.qa.yaml'

function Invoke-Compose {
  param([string[]]$Arguments)
  & docker compose --env-file $EnvironmentFile -f $ComposeFile @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose failed: $($Arguments -join ' ')"
  }
}

function New-LocalEnvironment {
  if (Test-Path -LiteralPath $EnvironmentFile) {
    $requiredKeys = @(
      'AFROLIFE_DB_ADMIN_PASSWORD',
      'AFROLIFE_DB_APP_PASSWORD',
      'JWT_SECRET',
      'MFA_ENC_KEY'
    )
    $existingKeys = @(Get-Content -LiteralPath $EnvironmentFile |
      ForEach-Object { if ($_ -match '^([A-Z0-9_]+)=.+$') { $Matches[1] } })
    $missingKeys = @($requiredKeys | Where-Object { $_ -notin $existingKeys })
    if ($missingKeys.Count) {
      throw "$EnvironmentFile exists but is missing required settings: $($missingKeys -join ', '). It was left untouched."
    }
    $accountingSettings = [ordered]@{
      AFROLIFE_ACCOUNTING_DB_ADMIN_PASSWORD = (& node -p "require('node:crypto').randomBytes(48).toString('base64url')").Trim()
      AFROLIFE_ACCOUNTING_DB_RUNTIME_PASSWORD = (& node -p "require('node:crypto').randomBytes(48).toString('base64url')").Trim()
      ACCOUNTING_GATEWAY_SECRET = (& node -p "require('node:crypto').randomBytes(48).toString('base64url')").Trim()
      ACCOUNTING_INGEST_SECRET = (& node -p "require('node:crypto').randomBytes(48).toString('base64url')").Trim()
    }
    $missingAccountingSettings = @($accountingSettings.Keys | Where-Object { $_ -notin $existingKeys })
    if ($missingAccountingSettings.Count) {
      $appendLines = @($missingAccountingSettings | ForEach-Object { "$_=$($accountingSettings[$_])" })
      [System.IO.File]::AppendAllText(
        $EnvironmentFile,
        ([string]::Join([Environment]::NewLine, $appendLines) + [Environment]::NewLine),
        [System.Text.UTF8Encoding]::new($false)
      )
    }
    return
  }

  $secret = { (& node -p "require('node:crypto').randomBytes(48).toString('base64url')").Trim() }
  $adminPassword = & $secret
  $appPassword = & $secret
  $jwtSecret = & $secret
  $mfaKey = & $secret
  $accountingDbAdminPassword = & $secret
  $accountingDbRuntimePassword = & $secret
  $accountingGatewaySecret = & $secret
  $accountingIngestSecret = & $secret
  $databaseHttpPort = Get-DatabaseHttpPort
  $lines = @(
    'NODE_ENV=development',
    'AFROLIFE_HTTP_PORT=3010',
    "AFROLIFE_DB_HTTP_PORT=$databaseHttpPort",
    "AFROLIFE_DB_ADMIN_PASSWORD=$adminPassword",
    "AFROLIFE_DB_APP_PASSWORD=$appPassword",
    "DATABASE_URL=postgres://afrolife_app:$appPassword@127.0.0.1:$databaseHttpPort/afrolife",
    "MIGRATION_DATABASE_URL=postgres://postgres:$adminPassword@127.0.0.1:$databaseHttpPort/afrolife",
    "JWT_SECRET=$jwtSecret",
    "MFA_ENC_KEY=$mfaKey",
    "AFROLIFE_ACCOUNTING_DB_ADMIN_PASSWORD=$accountingDbAdminPassword",
    "AFROLIFE_ACCOUNTING_DB_RUNTIME_PASSWORD=$accountingDbRuntimePassword",
    "ACCOUNTING_GATEWAY_SECRET=$accountingGatewaySecret",
    "ACCOUNTING_INGEST_SECRET=$accountingIngestSecret",
    'MFI_PILOT_ENABLED=1',
    'INSURANCE_BROKERAGE_MODE=sandbox'
  )
  [System.IO.File]::WriteAllText(
    $EnvironmentFile,
    ([string]::Join([Environment]::NewLine, $lines) + [Environment]::NewLine),
    [System.Text.UTF8Encoding]::new($false)
  )
}

function Get-HttpPort {
  $environmentPort = $env:AFROLIFE_HTTP_PORT
  if (-not [string]::IsNullOrWhiteSpace($environmentPort)) {
    if ($environmentPort -notmatch '^\d+$') {
      throw 'AFROLIFE_HTTP_PORT must be an integer between 1 and 65535.'
    }
    $configuredPort = [int]$environmentPort
    if ($configuredPort -lt 1 -or $configuredPort -gt 65535) {
      throw 'AFROLIFE_HTTP_PORT must be between 1 and 65535.'
    }
    return $configuredPort
  }

  if (-not (Test-Path -LiteralPath $EnvironmentFile)) {
    return 3010
  }

  foreach ($line in Get-Content -LiteralPath $EnvironmentFile) {
    if ($line -match '^AFROLIFE_HTTP_PORT=(\d+)$') {
      $configuredPort = [int]$Matches[1]
      if ($configuredPort -lt 1 -or $configuredPort -gt 65535) {
        throw 'AFROLIFE_HTTP_PORT must be between 1 and 65535.'
      }
      return $configuredPort
    }
  }

  return 3010
}

function Get-DatabaseHttpPort {
  $environmentPort = $env:AFROLIFE_DB_HTTP_PORT
  if (-not [string]::IsNullOrWhiteSpace($environmentPort)) {
    if ($environmentPort -notmatch '^\d+$') {
      throw 'AFROLIFE_DB_HTTP_PORT must be an integer between 1 and 65535.'
    }
    $configuredPort = [int]$environmentPort
    if ($configuredPort -lt 1 -or $configuredPort -gt 65535) {
      throw 'AFROLIFE_DB_HTTP_PORT must be between 1 and 65535.'
    }
    return $configuredPort
  }

  if (-not (Test-Path -LiteralPath $EnvironmentFile)) {
    return 5433
  }

  foreach ($line in Get-Content -LiteralPath $EnvironmentFile) {
    if ($line -match '^AFROLIFE_DB_HTTP_PORT=(\d+)$') {
      $configuredPort = [int]$Matches[1]
      if ($configuredPort -lt 1 -or $configuredPort -gt 65535) {
        throw 'AFROLIFE_DB_HTTP_PORT must be between 1 and 65535.'
      }
      return $configuredPort
    }
  }

  return 5433
}

Push-Location $ProjectRoot
try {
  if ($Action -eq 'Up') {
    & docker info --format '{{.ServerVersion}}' *> $null
    if ($LASTEXITCODE -ne 0) {
      throw 'Docker Desktop is not running or this session cannot access its engine. Start Docker Desktop and retry.'
    }
    New-LocalEnvironment
    $httpPort = Get-HttpPort
    $databaseHttpPort = Get-DatabaseHttpPort
    Invoke-Compose -Arguments @('config', '--quiet')
    Invoke-Compose -Arguments @('up', '--build', '-d')

    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
      try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$httpPort/readyz" -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200 -and ($response.Content | ConvertFrom-Json).ok -eq $true) {
          $ready = $true
          break
        }
      } catch {
        Start-Sleep -Seconds 2
      }
    }
    if (-not $ready) {
      Invoke-Compose -Arguments @('ps')
      throw "The app did not become ready at http://127.0.0.1:$httpPort/readyz. Review logs with npm run qa:docker:logs."
    }
    Write-Output "AfroLife QA app is ready at http://localhost:$httpPort."
    Write-Output "PostgreSQL is private to loopback port $databaseHttpPort; database and private uploads use Docker-managed named volumes."
    Write-Output 'No existing project data or private-file directory was removed.'
  } elseif ($Action -eq 'Down') {
    if (-not (Test-Path -LiteralPath $EnvironmentFile)) {
      Write-Output 'No Docker QA environment file exists; nothing was stopped.'
      break
    }
    Invoke-Compose -Arguments @('down')
    Write-Output 'QA containers are stopped. Named volumes and local secrets were preserved.'
  } elseif ($Action -eq 'Status') {
    if (-not (Test-Path -LiteralPath $EnvironmentFile)) {
      Write-Output 'Docker QA environment is not initialized.'
      break
    }
    Invoke-Compose -Arguments @('ps')
  } elseif ($Action -eq 'Seed') {
    if (-not (Test-Path -LiteralPath $EnvironmentFile)) {
      throw 'Run npm run qa:docker:up before creating synthetic QA accounts.'
    }
    $qaEnvironment = @{}
    foreach ($line in Get-Content -LiteralPath $EnvironmentFile) {
      if ($line -match '^(DATABASE_URL|MIGRATION_DATABASE_URL)=(.*)$') {
        $qaEnvironment[$Matches[1]] = $Matches[2]
      }
    }
    foreach ($key in @('DATABASE_URL', 'MIGRATION_DATABASE_URL')) {
      if (-not $qaEnvironment.ContainsKey($key)) {
        throw "$EnvironmentFile is missing $key. No QA accounts were created."
      }
    }
    New-Item -ItemType Directory -Force -Path $CredentialDirectory | Out-Null
    $env:AFROLIFE_ENV_FILE = $EnvironmentFile
    $env:AFROLIFE_TEST_USERS_FILE = Join-Path $CredentialDirectory 'local-test-users.txt'
    $env:AFROLIFE_DOCKER_QA = '1'
    $env:DATABASE_URL = $qaEnvironment.DATABASE_URL
    $env:MIGRATION_DATABASE_URL = $qaEnvironment.MIGRATION_DATABASE_URL
    Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
    & npm.cmd run seed:local-test-users
    if ($LASTEXITCODE -ne 0) {
      throw 'Synthetic QA account seeding failed. No existing credential file was overwritten.'
    }
    Write-Output "Synthetic test credentials are saved at $env:AFROLIFE_TEST_USERS_FILE."
  }
} finally {
  Remove-Item Env:AFROLIFE_ENV_FILE -ErrorAction SilentlyContinue
  Remove-Item Env:AFROLIFE_TEST_USERS_FILE -ErrorAction SilentlyContinue
  Remove-Item Env:AFROLIFE_DOCKER_QA -ErrorAction SilentlyContinue
  Remove-Item Env:DATABASE_URL,Env:MIGRATION_DATABASE_URL,Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
  Pop-Location
}
