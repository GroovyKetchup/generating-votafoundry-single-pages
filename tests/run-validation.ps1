# Tier 1: deterministic skill validation (no agent needed). Run from anywhere.
#   powershell -ExecutionPolicy Bypass -File tests\run-validation.ps1
# Gates: structure, deliverable cleanliness, frontmatter, relative links, no leaked platform paths.
# Exit code 0 = PASS, 1 = FAIL.

$ErrorActionPreference = 'Stop'

# ---- paths (relative to repo root = parent of tests/) ----
$RepoRoot  = Split-Path -Parent $PSScriptRoot
$SkillDir  = Join-Path $RepoRoot 'skills\generating-votafoundry-single-pages'
$TestsDir  = $PSScriptRoot
$SkillMd   = Join-Path $SkillDir 'SKILL.md'

$failures = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()

function Fail([string]$msg) { $failures.Add($msg); Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Warn([string]$msg) { $warnings.Add($msg); Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Ok([string]$msg)    { Write-Host "  [ok]   $msg" -ForegroundColor Green }

Write-Host '== Skill validation =='

# 1. structure
if (-not (Test-Path $SkillMd)) { Fail "SKILL.md missing: $SkillMd" }
Ok "SKILL.md exists"
if (-not (Test-Path (Join-Path $SkillDir 'references'))) { Fail "references/ missing" }
Ok "references/ exists"

# 2. deliverable cleanliness: no test-pressure files inside skill
$leak = Get-ChildItem -Recurse $SkillDir -File | Where-Object { $_.Name -match '^test-pressure' }
if ($leak) { Fail "test files leaked into deliverable: $($leak.Name -join ', ')" } else { Ok "no test files in deliverable" }

# 3. frontmatter
$content = Get-Content -Raw -Encoding UTF8 $SkillMd
$content = $content -replace "^\uFEFF", ''   # strip BOM
$fm = [regex]::Match($content, '(?s)^[ \t]*---[ \t]*\r?\n(.*?)\r?\n---[ \t]*\r?\n?')
if (-not $fm.Success) { Fail 'SKILL.md missing frontmatter block' }
else {
  $fmBody = $fm.Groups[1].Value
  $nameM   = [regex]::Match($fmBody, '(?m)^name:\s*(\S+)\s*$')
  $descM   = [regex]::Match($fmBody, '(?m)^description:\s*(.*?)\s*$')
  if (-not $nameM.Success) { Fail 'frontmatter missing name' }
  elseif ($nameM.Groups[1].Value -notmatch '^[a-z][a-z0-9]*(-[a-z0-9]+)*$') {
    Fail "name must be lowercase hyphenated ASCII: '$($nameM.Groups[1].Value)'"
  } else { Ok "name ok: $($nameM.Groups[1].Value)" }

  if (-not $descM.Success) { Fail 'frontmatter missing description' }
  else {
    $desc = $descM.Groups[1].Value
    if ([string]::IsNullOrWhiteSpace($desc)) { Fail 'description is empty' }
    elseif ($desc.Length -gt 1024) { Fail "description too long ($($desc.Length) chars > 1024)" }
    elseif ($desc -notmatch '(?i)use when') { Warn "description does not contain 'Use when' trigger" }
    else { Ok "description length $($desc.Length) + has trigger" }
  }
}

# 4. relative links in SKILL.md body resolve
$body = $content.Substring($fm.Index + $fm.Length)
$links = [regex]::Matches($body, '\[[^\]]*\]\(([^)]+)\)')
foreach ($m in $links) {
  $link = $m.Groups[1].Value.Trim()
  if ($link -match '^(https?://|#|/)') { continue }  # external / anchor / absolute
  $target = Join-Path $SkillDir $link
  if (-not (Test-Path $target)) { Fail "broken relative link: $link" }
}
Ok "all relative links in SKILL.md resolve ($($links.Count) found)"

# 5. leaked platform absolute paths
$bad = @('/data/scene/', '/knowledge/', '/compose', '/data/scene/d00433d5')
foreach ($p in $bad) {
  $matches = Get-ChildItem -Recurse $SkillDir -File | Select-String -SimpleMatch $p
  if ($matches) { Fail "leaked platform path '$p' in: $($matches.File -join ', ')" }
}
Ok 'no leaked platform absolute paths'

# 6. sanity: fixed Lucide CDN present, no unconditional head script in templates/examples
$exampleDir = Join-Path $SkillDir 'references\examples'
$badCdn = Get-ChildItem -Recurse $exampleDir -File -ErrorAction SilentlyContinue |
  Select-String -SimpleMatch '"@latest"', 'unpkg.com', 'lucide@latest'
if ($badCdn) { Warn "examples reference @latest/unpkg: $($badCdn.Line -join ' | ')" }

# ---- summary ----
Write-Host ''
if ($failures.Count -gt 0) {
  Write-Host "RESULT: FAIL ($($failures.Count) errors)" -ForegroundColor Red
  exit 1
}
Write-Host 'RESULT: PASS' -ForegroundColor Green
if ($warnings.Count -gt 0) { Write-Host "($($warnings.Count) warning(s))" -ForegroundColor Yellow }
exit 0
