# Tier 1: deterministic skill validation (no agent needed). Run from anywhere.
#   powershell -ExecutionPolicy Bypass -File tests\run-validation.ps1
# Gates: structure, deliverable cleanliness, frontmatter, relative links, no leaked platform paths, scene mirror sync.
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

# 6. sanity: Lucide 禁止 @latest / unpkg（不得直引或动态加载任何 Lucide CDN）
$exampleDir = Join-Path $SkillDir 'references\examples'
$badCdn = Get-ChildItem -Recurse $exampleDir -File -ErrorAction SilentlyContinue |
  Select-String -SimpleMatch '"@latest"', 'unpkg.com', 'lucide@latest'
if ($badCdn) { Warn "examples reference @latest/unpkg: $($badCdn.Line -join ' | ')" }

# 7. local-resource declaration protocol gate
$deliveryFiles = Get-ChildItem -Recurse $SkillDir -File -Include *.md
$deliveryText = ($deliveryFiles | ForEach-Object { Get-Content -Raw -Encoding UTF8 $_.FullName }) -join "`n"
# SDK/preload/Lucide 门禁扫描 markdown 与 html 合并文本；历史 HTML 资源示例不纳入固定 CDN 声明协议
$deliveryAllFiles = Get-ChildItem -Recurse $SkillDir -File -Include *.md, *.html
$deliveryAllText = ($deliveryAllFiles | ForEach-Object { Get-Content -Raw -Encoding UTF8 $_.FullName }) -join "`n"

# 固定 CDN URL -> 本地资源名/版本的精确映射，逐个校验而非只检查两个属性存在
$fixedCdnMap = @{
  'https://kwaidoo.com/cdn_general/libs/tailwindcss/3.4.17/tailwindcss.min.js'        = @{ name = 'tailwindcss';  version = '3.4.17' }
  'https://kwaidoo.com/cdn_general/libs/@generalui/wave-loading/1.0.0/wave-loading.js' = @{ name = 'wave-loading'; version = '1.0.0' }
  'https://kwaidoo.com/cdn_general/libs/echarts/5.6.0/dist/echarts.min.js'            = @{ name = 'echarts';      version = '5.6.0' }
}
$fixedCdnScriptRe = '(?s)<script(?=[^>]*src="https://kwaidoo\.com/cdn_general/libs/[^"]+")[^>]*>'
$fixedCdnScripts = [regex]::Matches($deliveryText, $fixedCdnScriptRe)
if ($fixedCdnScripts.Count -eq 0) {
  Fail '未发现任何固定 CDN script 标签，至少应存在 tailwindcss/wave-loading 声明'
} else {
  $mismatches = @()
  foreach ($m in $fixedCdnScripts) {
    $tag = $m.Value
    $srcM = [regex]::Match($tag, 'src="([^"]+)"')
    if (-not $srcM.Success) {
      $mismatches += '缺少 src: ' + $tag.Substring(0, [Math]::Min($tag.Length, 60))
      continue
    }
    $src = $srcM.Groups[1].Value
    if (-not $fixedCdnMap.ContainsKey($src)) {
      $mismatches += "未知固定 CDN: $src"
      continue
    }
    $expected = $fixedCdnMap[$src]
    $nameM = [regex]::Match($tag, 'data-cdp-resource="([^"]*)"')
    $verM = [regex]::Match($tag, 'data-cdp-resource-version="([^"]*)"')
    if (-not $nameM.Success -or $nameM.Groups[1].Value -ne $expected.name) {
      $got = if ($nameM.Success) { $nameM.Groups[1].Value } else { '无' }
      $mismatches += "$src 的 data-cdp-resource 应为 '$($expected.name)'，实际 '$got'"
    }
    if (-not $verM.Success -or $verM.Groups[1].Value -ne $expected.version) {
      $got = if ($verM.Success) { $verM.Groups[1].Value } else { '无' }
      $mismatches += "$src 的 data-cdp-resource-version 应为 '$($expected.version)'，实际 '$got'"
    }
  }
  if ($mismatches.Count -gt 0) {
    Fail "固定 CDN script 资源映射不匹配: $($mismatches -join ' | ')"
  } else {
    Ok "每个固定 CDN script 均与资源名/版本精确匹配 ($($fixedCdnScripts.Count) found)"
  }
}

# 通用资源至少各出现一个已声明标签，避免整块示例被删后漏检
foreach ($requiredName in @('tailwindcss', 'wave-loading')) {
  $needle = 'data-cdp-resource="' + $requiredName + '"'
  if ($deliveryText -notmatch [regex]::Escape($needle)) {
    Fail "缺少已声明的本地资源标签: $requiredName"
  }
}
if ($deliveryText -match 'cdn_general/libs/lucide|loadLucideFallback|动态加载 Lucide CDN') {
  Fail 'Lucide must use window.semApp.ui.lucide without CDN fallback'
}
Ok "local-resource declaration protocol ok"

# ---- 8. SDK 注入协议门禁：交付 markdown 不得加载 CDP-SDK / PanelX ----
# 任何 script src 标签加载 cdp-sdk/cdp_sdk / panelx-sdk/panelx_sdk / PanelXSdkProxy/PanelXSdk（含本地相对地址）
$sdkScriptRe = '(?is)<script[^>]*\bsrc\s*=\s*["'']?[^>]*?(?:cdp[-_]?sdk|panelx[-_]?sdk)[^>]*>'
$sdkScriptMatches = [regex]::Matches($deliveryAllText, $sdkScriptRe)
if ($sdkScriptMatches.Count -gt 0) {
  Fail "交付文档不得通过 script src 加载 CDP-SDK/PanelX SDK: $($sdkScriptMatches[0].Value)"
} else {
  Ok 'no script src loading cdp/panelx sdk'
}

# preload.js 脚本标签或 devSdkUrl（用于下载 PanelX SDK）
$preloadScriptRe = '(?s)<script[^>]*\bsrc\s*=\s*["'']?[^>]*?preload\.js[^>]*>'
if ([regex]::IsMatch($deliveryAllText, $preloadScriptRe)) {
  Fail '交付文档不得通过 preload.js 脚本标签加载 SDK'
} elseif ($deliveryAllText -match '(?i)devSdkUrl') {
  Fail '交付文档不得使用 devSdkUrl 下载 PanelX SDK'
} else {
  Ok 'no preload.js / devSdkUrl'
}

# Lucide 禁令：任何含 lucide 的 http/https URL、window.lucide、loadLucideFallback
$lucideUrlRe = '(?i)https?://[^\s"'']*lucide'
$lucideUrlMatch = [regex]::Match($deliveryAllText, $lucideUrlRe)
if ($lucideUrlMatch.Success) {
  Fail "交付文档不得包含含 lucide 的 http/https URL: $($lucideUrlMatch.Value)"
} elseif ($deliveryAllText -match '(?i)\bwindow\.lucide\b') {
  Fail '交付文档不得使用 window.lucide 全局'
} elseif ($deliveryAllText -match '(?i)loadLucideFallback') {
  Fail '交付文档不得包含 loadLucideFallback'
} else {
  Ok 'no lucide CDN URL / window.lucide / loadLucideFallback'
}

# 与 Lucide 同一代码块中的动态 script 创建/赋 src（简单正则，不构建解析器）：
# createElement('script')、脚本变量的 .src 赋值、setAttribute('src', ...) 任一形式均判失败；
# 不误伤 lucide.createElement 图标 API
$codeBlockRe = '(?s)```.*?```'
$dynScriptLucide = $false
foreach ($m in [regex]::Matches($deliveryAllText, $codeBlockRe)) {
  $block = $m.Value
  if ($block -notmatch 'lucide') { continue }
  $hasCreateScript = $block -match 'createElement\(\s*["'']script["'']'
  $hasSrcAssign = $block -match '\.src\s*=\s*'
  $hasSetAttrSrc = $block -match 'setAttribute\(\s*["'']src["'']'
  if ($hasCreateScript -or $hasSrcAssign -or $hasSetAttrSrc) {
    $dynScriptLucide = $true
    break
  }
}
if ($dynScriptLucide) {
  Fail '交付文档不得在与 Lucide 同一代码块中动态创建 script 并赋 src'
} else {
  Ok 'no dynamic script creation with lucide'
}

# ---- 9. scene mirror drift gate: scene_个性交付/knowledge must mirror references/ ----
$syncScript = Join-Path $RepoRoot 'tools\sync-scene.ps1'
if (Test-Path $syncScript) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $syncScript -Check
  if ($LASTEXITCODE -ne 0) {
    Fail 'scene_个性交付/knowledge 与 references/ 不一致（运行 tools\sync-scene.ps1 同步）'
  } else {
    Ok 'scene_个性交付/knowledge 与 references/ 镜像一致'
  }
} else {
  Warn 'tools\sync-scene.ps1 未找到，跳过 scene 镜像校验'
}

# ---- summary ----
Write-Host ''
if ($failures.Count -gt 0) {
  Write-Host "RESULT: FAIL ($($failures.Count) errors)" -ForegroundColor Red
  exit 1
}
Write-Host 'RESULT: PASS' -ForegroundColor Green
if ($warnings.Count -gt 0) { Write-Host "($($warnings.Count) warning(s))" -ForegroundColor Yellow }
exit 0
