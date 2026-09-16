# Mirror the single-page skill into the Scene package.
#   references/ -> scene_个性交付/knowledge/   (1:1 mirror, single source of truth)
#   scripts/    -> scene_个性交付/script/      (explicit script set only)
#   powershell -ExecutionPolicy Bypass -File tools\sync-scene.ps1          # sync (write)
#   powershell -ExecutionPolicy Bypass -File tools\sync-scene.ps1 -Check   # drift check only
# Exit code: sync -> 0; -Check -> 0 = in sync, 1 = drift, 2 = bad setup.
# Scene-only files (scene.md / scene.conf / _export_meta.json) are outside knowledge/ and untouched.

param([switch]$Check)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$SkillRoot = Join-Path $RepoRoot 'skills\generating-votafoundry-single-pages'
$Src = Join-Path $SkillRoot 'references'
$Dst = Join-Path $RepoRoot 'scene_个性交付\knowledge'
$ScriptSrc = Join-Path $SkillRoot 'scripts'
$ScriptDst = Join-Path $RepoRoot 'scene_个性交付\script'
# Scene only ships these two scripts; other scripts/ files are CLI/dev assets.
$ScriptSet = @('scene-custom-page-resource.mjs', 'validate-page-resources.mjs')

if (-not (Test-Path -LiteralPath $Src)) { Write-Host "source references/ missing: $Src" -ForegroundColor Red; exit 2 }
if (-not (Test-Path -LiteralPath $ScriptSrc)) { Write-Host "source scripts/ missing: $ScriptSrc" -ForegroundColor Red; exit 2 }

function Get-RelPath([string]$base, [string]$full) { $full.Substring($base.Length).TrimStart('\', '/') }
# .NET SHA256 instead of Get-FileHash: that cmdlet lives in auto-loaded modules and is missing
# when PSModulePath is shadowed; this keeps the drift gate working in any PowerShell host.
function Get-Hash([string]$p) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { [System.BitConverter]::ToString($sha.ComputeHash([System.IO.File]::ReadAllBytes($p))) } finally { $sha.Dispose() }
}

function Get-ChildFiles([string]$dir, $allowList) {
  if (-not (Test-Path -LiteralPath $dir)) { return ,([string[]]@()) }
  $files = @(Get-ChildItem -Recurse -File -LiteralPath $dir | ForEach-Object { Get-RelPath $dir $_.FullName })
  if ($allowList) { $files = @($files | Where-Object { $allowList -contains $_ }) }
  return ,([string[]]$files)
}

# Compare the explicit script set by name/hash; non-listed files in the target dir are drift too.
function Get-Drift([string]$srcDir, [string]$dstDir, $allowList) {
  $srcFiles = Get-ChildFiles $srcDir $allowList
  $dstFiles = Get-ChildFiles $dstDir $null
  $out = [System.Collections.Generic.List[string]]::new()
  foreach ($f in $srcFiles) {
    $s = Join-Path $srcDir $f
    $d = Join-Path $dstDir $f
    if (-not (Test-Path -LiteralPath $d)) { $out.Add("MISSING  $f"); continue }
    if ((Get-Hash $s) -ne (Get-Hash $d)) { $out.Add("DIFF     $f") }
  }
  foreach ($f in $dstFiles) {
    if ($srcFiles -notcontains $f) { $out.Add("EXTRA    $f") }
  }
  return ,([string[]]$out.ToArray())
}

function Sync-Dir([string]$srcDir, [string]$dstDir, $allowList) {
  $srcFiles = Get-ChildFiles $srcDir $allowList
  $dstFiles = Get-ChildFiles $dstDir $null
  foreach ($f in $srcFiles) {
    $s = Join-Path $srcDir $f
    $d = Join-Path $dstDir $f
    $dd = Split-Path -Parent $d
    if (-not (Test-Path -LiteralPath $dd)) { New-Item -ItemType Directory -Force $dd | Out-Null }
    Copy-Item -LiteralPath $s -Destination $d -Force
  }
  foreach ($f in $dstFiles) {
    if ($srcFiles -notcontains $f) { Remove-Item -LiteralPath (Join-Path $dstDir $f) -Force }
  }
  if (Test-Path -LiteralPath $dstDir) {
    Get-ChildItem -Recurse -Directory -LiteralPath $dstDir |
      Where-Object { -not (Get-ChildItem -Recurse -File -LiteralPath $_.FullName) } |
      Sort-Object { $_.FullName.Length } -Descending |
      ForEach-Object { Remove-Item -Recurse -Force $_.FullName }
  }
  return $srcFiles.Count
}

$drift = [System.Collections.Generic.List[string]]::new()
foreach ($d in (Get-Drift $Src $Dst $null)) { $drift.Add($d) }
foreach ($d in (Get-Drift $ScriptSrc $ScriptDst $ScriptSet)) { $drift.Add($d) }

if ($Check) {
  if ($drift.Count -eq 0) {
    Write-Host 'scene mirror in sync with skill references/ + scripts/' -ForegroundColor Green
    exit 0
  }
  Write-Host "scene mirror DRIFT ($($drift.Count) file(s)):" -ForegroundColor Red
  foreach ($d in $drift) { Write-Host "  $d" -ForegroundColor Red }
  Write-Host 'run: powershell -ExecutionPolicy Bypass -File tools\sync-scene.ps1' -ForegroundColor Yellow
  exit 1
}

$knowledgeCount = Sync-Dir $Src $Dst $null
$scriptCount = Sync-Dir $ScriptSrc $ScriptDst $ScriptSet
Write-Host "scene mirror synced: $knowledgeCount references -> $Dst, $scriptCount scripts -> $ScriptDst" -ForegroundColor Green
exit 0
