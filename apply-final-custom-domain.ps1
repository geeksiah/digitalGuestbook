$ErrorActionPreference = 'Stop'

Write-Host "EventPeepo final custom-domain patch installer" -ForegroundColor Cyan
Write-Host ""

# Confirm this is a Git work tree.
git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Run this script from the root of the EventPeepo Git repository." -ForegroundColor Red
    exit 1
}

# Refuse to operate on uncommitted source changes. Patch files themselves are ignored.
$dirty = git status --porcelain | Where-Object {
    $_ -notmatch 'eventpeepo-custom-domain.*\.patch$' -and
    $_ -notmatch 'apply-final-custom-domain\.ps1$'
}
if ($dirty) {
    Write-Host "ERROR: You have uncommitted project changes." -ForegroundColor Red
    Write-Host "Commit/stash them first, then run this script again." -ForegroundColor Yellow
    $dirty | ForEach-Object { Write-Host $_ }
    exit 1
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$variants = @(
    'eventpeepo-custom-domain-final-after-two-patches.patch',
    'eventpeepo-custom-domain-final-after-first.patch',
    'eventpeepo-custom-domain-final-all-in-one.patch'
)

$chosen = $null
foreach ($name in $variants) {
    $path = Join-Path $scriptDir $name
    if (-not (Test-Path $path)) { continue }

    Write-Host "Testing $name ..." -ForegroundColor DarkGray
    & git apply --check --whitespace=nowarn $path 2>$null
    if ($LASTEXITCODE -eq 0) {
        $chosen = $path
        Write-Host "Matched repository state: $name" -ForegroundColor Green
        break
    }
}

if (-not $chosen) {
    Write-Host "" 
    Write-Host "No supplied patch matches this repository state." -ForegroundColor Red
    Write-Host "Do NOT force-apply a patch." -ForegroundColor Yellow
    Write-Host "Zip your CURRENT repository (excluding node_modules/.next if desired) and upload it so an exact-state patch can be generated." -ForegroundColor Yellow
    exit 2
}

Write-Host ""
Write-Host "Applying final custom-domain implementation..." -ForegroundColor Cyan
& git apply --whitespace=nowarn $chosen
if ($LASTEXITCODE -ne 0) {
    Write-Host "Patch application unexpectedly failed. No forced merge was attempted." -ForegroundColor Red
    exit 3
}

Write-Host ""
Write-Host "SUCCESS: final custom-domain patch applied." -ForegroundColor Green
Write-Host "Review with: git diff" -ForegroundColor Cyan
Write-Host "Then build backend and frontend before committing." -ForegroundColor Cyan
