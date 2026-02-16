param(
  [string]$AssetRoot = "assets/brand"
)

$required = @(
  "app-icon.png",
  "splash.png",
  "adaptive-icon-foreground.png",
  "adaptive-icon-background.png"
)

Write-Host "EventPeepo Mobile Asset Checklist"
Write-Host "==============================="
Write-Host ""
Write-Host "Asset folder: $AssetRoot"
Write-Host ""

$missing = @()
foreach ($file in $required) {
  $path = Join-Path $AssetRoot $file
  if (Test-Path -LiteralPath $path) {
    Write-Host "[OK] $path"
  } else {
    Write-Host "[MISSING] $path"
    $missing += $path
  }
}

if ($missing.Count -gt 0) {
  Write-Host ""
  Write-Host "Create the missing PNG files, then run:"
  Write-Host "  npx @capacitor/assets generate --android --ios"
  exit 1
}

Write-Host ""
Write-Host "All required source files are present."
Write-Host "Run this next command to generate Android/iOS icons and splash:"
Write-Host "  npx @capacitor/assets generate --android --ios"
Write-Host ""
Write-Host "After generation:"
Write-Host "  npx cap sync android"
Write-Host "  npx cap sync ios"
