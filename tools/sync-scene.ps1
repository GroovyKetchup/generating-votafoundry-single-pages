# Mirror skills/generating-votafoundry-single-pages/references/ -> scene_个性交付/knowledge/
# Single source of truth = the skill's references/; the scene's knowledge/ is a 1:1 mirror.
#   powershell -ExecutionPolicy Bypass -File tools\sync-scene.ps1          # sync (write)
#   powershell -ExecutionPolicy Bypass -File tools\sync-scene.ps1 -Check   # drift check only
# Exit code: sync -> 0; -Check -> 0 = in sync, 1 = drift, 2 = bad setup.
# Scene-only files (scene.md / scene.conf / _export_meta.json) are outside knowledge/ and untouched.

param([switch]$Check)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Src = Join-Path $RepoRoot 'skills\generating-votafoundry-single-pages\references'
$Dst = Join-Path $RepoRoot 'scene_个性交付\knowledge'

if (-not (Test-Path -LiteralPath $Src)) { Write-Host "source references/ missing: $Src" -ForegroundColor Red; exit 2 }

function Get-RelPath([string]$base, [string]$full) { $full.Substring($base.Length).TrimStart('\', '/') }
function Get-Hash([string]$p) { (Get-FileHash -Algorithm SHA256 -LiteralPath $p).Hash }

$srcFiles = @(Get-ChildItem -Recurse -File -LiteralPath $Src | ForEach-Object { Get-RelPath $Src $_.FullName })
$dstFiles = if (Test-Path -LiteralPath $Dst) {
  @(Get-ChildItem -Recurse -File -LiteralPath $Dst | ForEach-Object { Get-RelPath $Dst $_.FullName })
} else { @() }

$drift = [System.Collections.Generic.List[string]]::new()
foreach ($f in $srcFiles) {
  $s = Join-Path $Src $f
  $d = Join-Path $Dst $f
  if (-not (Test-Path -LiteralPath $d)) { $drift.Add("MISSING  $f"); continue }
  if ((Get-Hash $s) -ne (Get-Hash $d)) { $drift.Add("DIFF     $f") }
}
foreach ($f in $dstFiles) {
  if ($srcFiles -notcontains $f) { $drift.Add("EXTRA    $f") }
}

if ($Check) {
  if ($drift.Count -eq 0) {
    Write-Host "scene mirror in sync with references/ ($($srcFiles.Count) files)" -ForegroundColor Green
    exit 0
  }
  Write-Host "scene mirror DRIFT ($($drift.Count) file(s)):" -ForegroundColor Red
  foreach ($d in $drift) { Write-Host "  $d" -ForegroundColor Red }
  Write-Host 'run: powershell -ExecutionPolicy Bypass -File tools\sync-scene.ps1' -ForegroundColor Yellow
  exit 1
}

foreach ($f in $srcFiles) {
  $s = Join-Path $Src $f
  $d = Join-Path $Dst $f
  $dd = Split-Path -Parent $d
  if (-not (Test-Path -LiteralPath $dd)) { New-Item -ItemType Directory -Force $dd | Out-Null }
  Copy-Item -LiteralPath $s -Destination $d -Force
}
foreach ($f in $dstFiles) {
  if ($srcFiles -notcontains $f) { Remove-Item -LiteralPath (Join-Path $Dst $f) -Force }
}
if (Test-Path -LiteralPath $Dst) {
  Get-ChildItem -Recurse -Directory -LiteralPath $Dst |
    Where-Object { -not (Get-ChildItem -Recurse -File -LiteralPath $_.FullName) } |
    Sort-Object { $_.FullName.Length } -Descending |
    ForEach-Object { Remove-Item -Recurse -Force $_.FullName }
}
Write-Host "scene mirror synced: $($srcFiles.Count) files -> $Dst" -ForegroundColor Green
exit 0
