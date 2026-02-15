Param(
  [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$mobileDir = Join-Path $repoRoot "owner-mobile"
$mobileEnvPath = Join-Path $mobileDir ".env"
$androidDir = Join-Path $mobileDir "android"
$androidLocalPropsPath = Join-Path $androidDir "local.properties"
$preferredJdks = @(
  "C:\Program Files\Java\jdk-21",
  "C:\Program Files\Java\jdk-23"
)
$preferredSdkPaths = @(
  "$env:LOCALAPPDATA\Android\Sdk",
  "C:\Android\Sdk"
)

Write-Host ""
Write-Host "EventPeepo Owner Mobile (Android Live Mode)" -ForegroundColor Cyan
Write-Host "==========================================="

# Some environments set broken local proxy vars (e.g. 127.0.0.1:9) that block Gradle downloads.
$proxyVars = @(
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "GIT_HTTP_PROXY",
  "GIT_HTTPS_PROXY"
)
$clearedProxyVars = @()
foreach ($proxyVar in $proxyVars) {
  $proxyValue = [Environment]::GetEnvironmentVariable($proxyVar, "Process")
  if (
    $proxyValue -and (
      $proxyValue -match "127\.0\.0\.1:9" -or
      $proxyValue -match "localhost:9"
    )
  ) {
    Remove-Item -Path "Env:$proxyVar" -ErrorAction SilentlyContinue
    $clearedProxyVars += $proxyVar
  }
}

if ($clearedProxyVars.Count -gt 0) {
  Write-Host ""
  Write-Host "Cleared broken proxy environment variables for this session:" -ForegroundColor Yellow
  Write-Host ($clearedProxyVars -join ", ")
}

$selectedJdk = $preferredJdks | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $selectedJdk) {
  Write-Host ""
  Write-Host "No compatible JDK found (expected 21 or 23)." -ForegroundColor Red
  Write-Host "Install JDK 21 (recommended) or 23, then run this script again." -ForegroundColor Red
  exit 1
}

$env:JAVA_HOME = $selectedJdk
$env:Path = "$selectedJdk\bin;$env:Path"
Write-Host ""
Write-Host "Using Java from: $selectedJdk" -ForegroundColor Green

$selectedAndroidSdk = $preferredSdkPaths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $selectedAndroidSdk) {
  Write-Host ""
  Write-Host "Android SDK not found." -ForegroundColor Red
  Write-Host "Install Android Studio + SDK, then run this script again." -ForegroundColor Red
  exit 1
}

$env:ANDROID_HOME = $selectedAndroidSdk
$env:ANDROID_SDK_ROOT = $selectedAndroidSdk
$env:Path = "$selectedAndroidSdk\platform-tools;$selectedAndroidSdk\emulator;$env:Path"

if (Test-Path $androidDir) {
  $escapedSdkPath = $selectedAndroidSdk -replace '\\', '/'
  @"
sdk.dir=$escapedSdkPath
"@ | Set-Content -LiteralPath $androidLocalPropsPath -NoNewline
}

Write-Host "Using Android SDK from: $selectedAndroidSdk" -ForegroundColor Green

if (-not (Test-Path $mobileEnvPath)) {
  Write-Host ""
  Write-Host "Creating owner-mobile/.env with emulator-safe API URL..." -ForegroundColor Yellow
  @"
VITE_API_BASE_URL=http://10.0.2.2:3001/api
"@ | Set-Content -LiteralPath $mobileEnvPath -NoNewline
}

if (-not $SkipBackend) {
  Write-Host ""
  Write-Host "Starting backend API in a new terminal..." -ForegroundColor Green
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$backendDir'; npm run dev"
  ) | Out-Null
}

Write-Host ""
Write-Host "Starting mobile live mode in this terminal..." -ForegroundColor Green
Write-Host "If Android emulator is not open yet, open Android Studio Device Manager and start one." -ForegroundColor DarkYellow
Write-Host ""

Set-Location $mobileDir

Write-Host "Starting Vite dev server in a new terminal..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$mobileDir'; npm run dev:host"
) | Out-Null

Write-Host ""
Write-Host "Launching Capacitor run in this terminal (device picker input works here)." -ForegroundColor Green
Write-Host "Use arrow keys and Enter to select your emulator/device." -ForegroundColor DarkYellow
Write-Host ""

Start-Sleep -Seconds 4
npx cap run android -l --host 10.0.2.2 --port 5174
