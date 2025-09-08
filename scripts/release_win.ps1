$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Move to repo root
$ROOT = Split-Path -Parent $PSScriptRoot
Set-Location $ROOT

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Err($msg) { Write-Host "[ERR ] $msg" -ForegroundColor Red }

# Prefer venv python if available
$py = Join-Path $ROOT 'venv\Scripts\python.exe'
if (-not (Test-Path $py)) { $py = 'python' }

Write-Info "Using Python: $py"

# Quick asset checks
$assets = @(
  'assets/react.production.min.js',
  'assets/react-dom.production.min.js',
  'assets/babel-standalone.min.js',
  'assets/tailwind.css'
)

$missing = @()
foreach ($a in $assets) {
  if (-not (Test-Path $a)) { $missing += $a; continue }
  $fi = Get-Item $a
  $min = if ($fi.Extension -eq '.css') { 256 } else { 1024 }
  if ($fi.Length -lt $min) { $missing += $a }
}

if ($missing.Count -gt 0) {
  Write-Err "Missing or placeholder assets:`n - " + ($missing -join "`n - ")
  exit 1
}

Write-Info "Generating dist/index.html (offline)"
& $py 'scripts/generate_index.py'

Write-Info "Building One-Dir package"
Remove-Item -Recurse -Force build, dist -ErrorAction SilentlyContinue
& $py 'build_installer.py'

# Verify output
$onedirExe = Join-Path $ROOT 'dist\RoloMemo\RoloMemo.exe'
$onefileExe = Join-Path $ROOT 'dist\RoloMemo.exe'

if (Test-Path $onedirExe) {
  Write-Host "\nSUCCESS: Built One-Dir -> $onedirExe" -ForegroundColor Green
  exit 0
}
elseif (Test-Path $onefileExe) {
  Write-Host "\nSUCCESS: Built One-File -> $onefileExe" -ForegroundColor Green
  exit 0
}
else {
  Write-Err "Build finished but no executable found in dist/"
  exit 2
}

