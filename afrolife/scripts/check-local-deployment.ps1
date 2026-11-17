[CmdletBinding()]
param(
  [string]$Distro = 'Ubuntu'
)

$ErrorActionPreference = 'Stop'
$failed = $false

function Write-Check {
  param(
    [string]$Name,
    [bool]$Passed,
    [string]$Details
  )

  $status = if ($Passed) { 'PASS' } else { 'FAIL' }
  Write-Output "[$status] $Name - $Details"
  if (-not $Passed) {
    $script:failed = $true
  }
}

$nodeVersion = $null
try {
  $nodeVersion = (& node --version 2>$null).Trim()
} catch {
  $nodeVersion = $null
}
$nodeMajor = if ($nodeVersion -match '^v(\d+)\.') { [int]$Matches[1] } else { 0 }
$nodeDetails = if ($nodeVersion) { $nodeVersion } else { 'Node.js was not found' }
Write-Check -Name 'Node.js runtime' -Passed ($nodeMajor -ge 22) -Details $nodeDetails

$projectRoot = Split-Path -Parent $PSScriptRoot
$packageLock = Test-Path -LiteralPath (Join-Path $projectRoot 'package-lock.json') -PathType Leaf
Write-Check -Name 'Reproducible dependency lock' -Passed $packageLock -Details 'package-lock.json is present'

$guestCommand = 'systemctl is-active afrolife nginx postgresql; ss -H -lnt'
# The default WSL user session can be unavailable in a managed Windows shell.
# This probe is read-only, so use root to query systemd and listener state.
$guestResult = & wsl.exe --distribution $Distro --user root --exec bash -lc $guestCommand 2>&1
$guestExitCode = $LASTEXITCODE
$guestLines = @($guestResult | ForEach-Object { "$_".Trim() } | Where-Object { $_ })
$serviceStates = @($guestLines | Select-Object -First 3)
$listenerLines = @($guestLines | Where-Object { $_ -match '^LISTEN\s' })
$bindingsSafe = $true
foreach ($port in 3010, 5432, 8080) {
  $portBindings = @($listenerLines | ForEach-Object { ($_ -split '\s+')[3] } | Where-Object { $_ -match ":$port$" })
  if ($portBindings.Count -ne 1 -or $portBindings[0] -ne "127.0.0.1:$port") {
    $bindingsSafe = $false
  }
}
$servicesActive = $serviceStates.Count -eq 3 -and @($serviceStates | Where-Object { $_ -ne 'active' }).Count -eq 0
$guestReady = $guestExitCode -eq 0 -and $servicesActive -and $bindingsSafe
$guestDetails = "services=$($serviceStates -join ','); bindings=$($listenerLines.Count) listeners; API, DB, and proxy must bind only to IPv4 loopback"
Write-Check -Name "WSL $Distro services and bind addresses" -Passed $guestReady -Details $guestDetails

$healthReady = $false
$healthDetails = '127.0.0.1:3010/readyz must report the database, migrations, private storage, and configured services ready'
try {
  $healthResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:3010/readyz' -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
  $health = $healthResponse.Content | ConvertFrom-Json -ErrorAction Stop
  $unavailableServices = @($health.checks.services | Where-Object { $_.status -eq 'unavailable' })
  $healthReady = $health.ok -eq $true `
    -and $health.checks.database -eq 'connected' `
    -and $health.checks.migrations.current -eq $true `
    -and $health.checks.private_storage -eq 'available' `
    -and $unavailableServices.Count -eq 0
  if (-not $healthReady) {
    $healthDetails += '; one or more readiness checks failed'
  }
} catch {
  $healthDetails += "; probe error: $($_.Exception.Message)"
}
Write-Check -Name 'Local API and database health' -Passed $healthReady -Details $healthDetails

$servedHtml = ''
$proxyDetails = ''
try {
  $servedResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:8080/' -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
  $servedHtml = $servedResponse.Content
} catch {
  $proxyDetails = "; probe error: $($_.Exception.Message)"
}
$sourceHtml = Get-Content -LiteralPath (Join-Path $projectRoot 'public\index.html') -Raw
$expectedBrand = [regex]::Match($sourceHtml, '<title>([^|<]+)\|').Groups[1].Value.Trim()
$servedBrand = [regex]::Match($servedHtml, '<title>([^|<]+)\|').Groups[1].Value.Trim()
$currentReleaseServed = $expectedBrand -and $servedBrand -eq $expectedBrand
$releaseDetails = "127.0.0.1:8080 must serve the current app brand: $expectedBrand"
if ($servedBrand -and -not $currentReleaseServed) {
  $releaseDetails += "; currently serves: $servedBrand"
}
$releaseDetails += $proxyDetails
Write-Check -Name 'Local proxy serves this workspace release' -Passed ([bool]$currentReleaseServed) -Details $releaseDetails

if ($failed) {
  Write-Error 'Local deployment readiness checks failed. Do not treat this environment as production-ready.'
  exit 1
}

Write-Output 'Local deployment readiness checks passed. This confirms local health only; it does not certify public reachability, TLS, regulatory readiness, or production approval.'
