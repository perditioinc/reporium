# Reporium rebuild script for PowerShell
# Usage: .\scripts\rebuild.ps1
# Options: .\scripts\rebuild.ps1 -full   (force regenerate everything)
#          .\scripts\rebuild.ps1 -dev    (rebuild then start dev server)

param(
  [switch]$full,
  [switch]$dev
)

$libraryJson = "public/data/library.json"
$trendsJson  = "public/data/trends.json"
$gapsJson    = "public/data/gaps.json"
$digestMd    = "DIGEST.md"

# Returns $true if the file is missing or older than $maxAgeMinutes
function NeedsRegenerate($file, $maxAgeMinutes) {
  if (-not (Test-Path $file)) { return $true }
  $age = (Get-Date) - (Get-Item $file).LastWriteTime
  return $age.TotalMinutes -gt $maxAgeMinutes
}

Write-Host "Reporium rebuild starting..." -ForegroundColor Cyan

# ── 1. Generate library.json ──────────────────────────────────────────────────
if ($full -or (NeedsRegenerate $libraryJson 60)) {
  Write-Host "Generating library data..." -ForegroundColor Yellow
  npm run generate
  if ($LASTEXITCODE -ne 0) { Write-Host "Generate failed" -ForegroundColor Red; exit 1 }
} else {
  Write-Host "Library data is fresh, skipping generate" -ForegroundColor Green
}

# ── 2. Detect trends ──────────────────────────────────────────────────────────
if ($full -or (NeedsRegenerate $trendsJson 60)) {
  Write-Host "Detecting trends..." -ForegroundColor Yellow
  npm run detect-trends
  if ($LASTEXITCODE -ne 0) { Write-Host "Trends failed" -ForegroundColor Red; exit 1 }
} else {
  Write-Host "Trends data is fresh, skipping" -ForegroundColor Green
}

# ── 3. Gap analysis ───────────────────────────────────────────────────────────
if ($full -or (NeedsRegenerate $gapsJson 60)) {
  Write-Host "Building gap analysis..." -ForegroundColor Yellow
  npm run gap-analysis
  if ($LASTEXITCODE -ne 0) { Write-Host "Gap analysis failed" -ForegroundColor Red; exit 1 }
} else {
  Write-Host "Gap analysis is fresh, skipping" -ForegroundColor Green
}

# ── 4. Daily digest (always fast — always run) ────────────────────────────────
Write-Host "Generating daily digest..." -ForegroundColor Yellow
npm run digest

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Rebuild complete!" -ForegroundColor Green
Write-Host "Library : $(if (Test-Path $libraryJson) { (Get-Item $libraryJson).LastWriteTime } else { 'MISSING' })"
Write-Host "Trends  : $(if (Test-Path $trendsJson)  { (Get-Item $trendsJson).LastWriteTime  } else { 'MISSING' })"
Write-Host "Gaps    : $(if (Test-Path $gapsJson)    { (Get-Item $gapsJson).LastWriteTime    } else { 'MISSING' })"
Write-Host "Digest  : $(if (Test-Path $digestMd)    { (Get-Item $digestMd).LastWriteTime    } else { 'MISSING' })"

if ($dev) {
  Write-Host ""
  Write-Host "Starting dev server..." -ForegroundColor Cyan
  npm run dev
}
