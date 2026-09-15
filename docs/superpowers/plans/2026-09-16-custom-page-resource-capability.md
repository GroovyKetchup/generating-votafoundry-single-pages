# 自定义页面业务资源能力探测实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在单页技能的业务资源工作流中，以 `listFiles` 探测 webPage 资源能力；支持显式旧版非托管分支，且不增加页面运行时兼容逻辑。

**架构：** 技能文档在生成期先以既有 `custom-page-resource list` 命令做无副作用探测，按 HTTP 状态、结构化错误代码与响应协议分流。校验器新增显式 `--legacy-unmanaged` 模式：只验证页面没有托管 manifest，避免把新资源规则施加到用户明确选择的旧版页面。PanelX HTTP CLI 已保留 `status`、`state` 与错误代码，因此不修改 `C:/project/js/sdk_test`。

**技术栈：** Markdown 技能文档、Node.js 标准库、`node:test`、PowerShell 场景镜像脚本。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `skills/generating-votafoundry-single-pages/scripts/validate-page-resources.mjs` | 新增受控的旧版非托管校验入口，不改变托管模式的既有规则。 |
| `tests/validate-page-resources.test.mjs` | 覆盖旧版模式允许旧资源引用、拒绝 manifest 的行为，并锁定文档分支。 |
| `skills/generating-votafoundry-single-pages/references/internal-resources.md` | 资源发现后、上传前的能力探测、分支和交付提醒单一来源。 |
| `skills/generating-votafoundry-single-pages/SKILL.md` | 将硬约束限定到统一纳管模式，并链接到能力探测流程。 |
| `skills/generating-votafoundry-single-pages/references/prompts/{normal-generator,databoard-generator,custom-shell-generator}.md` | 三类生成入口均先遵守能力探测与旧版分支。 |
| `tests/README.md` | 补充旧版校验模式的测试覆盖说明。 |
| `scene_个性交付/knowledge/**` | 由 `tools/sync-scene.ps1` 从 `references/` 自动同步，禁止手工编辑。 |

### 任务 1：为校验器增加显式旧版非托管模式

**文件：**
- 修改：`tests/validate-page-resources.test.mjs`
- 修改：`skills/generating-votafoundry-single-pages/scripts/validate-page-resources.mjs`

- [ ] **步骤 1：先编写失败测试**

将 `runPage` 改为接受第三个 `options` 参数，并仅在 `options.legacyUnmanaged` 为真时把 `--legacy-unmanaged` 放在校验器命令的第一个业务参数：

```js
function runPage(files, entry = 'index.html', options = {}) {
  // 现有的临时目录和文件写入保持不变
  const args = [VALIDATOR];
  if (options.legacyUnmanaged) args.push('--legacy-unmanaged');
  args.push(join(dir, entry), ...extra);
  return spawnSync(process.execPath, args, { encoding: 'utf8' });
}
```

新增确定性测试：无 manifest 的外部静态资源页面在旧版模式通过；带 manifest 的页面在旧版模式失败。

```js
test('旧版非托管模式允许旧资源引用但拒绝 manifest', () => {
  const legacy = page('', '<script src="https://cdn.example.test/legacy.js"></script>');
  assertPass(runPage({ 'index.html': legacy }, 'index.html', { legacyUnmanaged: true }));

  const managed = page(manifestTag([]));
  assertFail(
    runPage({ 'index.html': managed }, 'index.html', { legacyUnmanaged: true }),
    /旧版非托管页面不得包含内部资源 manifest/,
  );
});
```

- [ ] **步骤 2：运行测试，确认其因未知 CLI 标志失败**

运行：

```powershell
node --test tests/validate-page-resources.test.mjs
```

预期：新增测试失败；现有校验器将 `--legacy-unmanaged` 当成页面文件，或报告用法/文件不存在。

- [ ] **步骤 3：实现最少的解析分支**

在校验器 CLI 入口解析首个可选标志，并把模式传入 `validate`：

```js
const input = process.argv.slice(2);
const legacyUnmanaged = input[0] === '--legacy-unmanaged';
const files = legacyUnmanaged ? input.slice(1) : input;
```

把函数签名改为：

```js
function validate(files, { legacyUnmanaged = false } = {}) {
```

保留现有 manifest 扫描；扫描结束后、解析 JSON 及引用扫描前插入唯一的旧版分支：

```js
if (legacyUnmanaged) {
  if (manifests.length !== 0) fail('旧版非托管页面不得包含内部资源 manifest');
  return failures;
}
```

更新顶端用法和注释为：

```text
node .../validate-page-resources.mjs [--legacy-unmanaged] <页面.html> [更多.css ...]
```

旧版分支不扫描相对路径、外部 CDN、CSS 或资源清单；它只保证用户明确选择的非托管页面没有错误的托管声明。托管模式原有所有校验必须保持不变。

- [ ] **步骤 4：运行测试，确认通过**

运行：

```powershell
node --test tests/validate-page-resources.test.mjs
```

预期：全部测试通过，包括新增的旧版模式测试。

- [ ] **步骤 5：提交校验器行为**

```powershell
git add -- skills/generating-votafoundry-single-pages/scripts/validate-page-resources.mjs tests/validate-page-resources.test.mjs
git commit -m "feat: 支持旧版非托管页面校验"
```

### 任务 2：把能力探测和两种生成模式写入技能单一来源

**文件：**
- 修改：`skills/generating-votafoundry-single-pages/references/internal-resources.md`
- 修改：`skills/generating-votafoundry-single-pages/SKILL.md`
- 修改：`skills/generating-votafoundry-single-pages/references/prompts/normal-generator.md`
- 修改：`skills/generating-votafoundry-single-pages/references/prompts/databoard-generator.md`
- 修改：`skills/generating-votafoundry-single-pages/references/prompts/custom-shell-generator.md`
- 修改：`tests/validate-page-resources.test.mjs`
- 修改：`tests/README.md`

- [ ] **步骤 1：先增加文档回归断言**

在“系统资源注册表是单一来源且与技能文档声明一致”测试末尾，断言资源流程包含探测命令、显式旧版标志、最低版本和交付提醒；三个生成提示词均包含同一探测短句：

```js
assert.match(refDoc, /先调用一次 `custom-page-resource list` 进行能力探测/);
assert.match(refDoc, /--legacy-unmanaged/);
assert.match(refDoc, /CDP.*1[.]20[.]0/);
assert.match(refDoc, /webPage.*1[.]4[.]2/);
for (const prompt of ['normal-generator.md', 'databoard-generator.md', 'custom-shell-generator.md']) {
  const content = readFileSync(join(SKILL, 'references', 'prompts', prompt), 'utf8');
  assert.match(content, /先调用一次 `custom-page-resource list` 进行能力探测/);
}
```

- [ ] **步骤 2：运行测试，确认文档断言失败**

运行：

```powershell
node --test tests/validate-page-resources.test.mjs
```

预期：新增断言失败，指出尚未写入能力探测规则。

- [ ] **步骤 3：更新内部资源工作流**

在 `internal-resources.md` 的“一个页面 = 一个批次”之前增加“能力探测与模式选择”章节，并包含以下精确规则：

```markdown
页面发现业务资源后，先调用一次 `custom-page-resource list` 进行能力探测。

- `ok:true`：直接进入统一纳管模式，不询问用户。
- HTTP `404` / `405`，或成功 HTTP 响应但不符合 RespondDto 协议：让用户选择升级后重试，或旧版非托管模式。
- `401` / `403`、其他 `4xx`、网络错误、超时、`5xx`：按鉴权或服务错误处理，不降级。
```

接着写明两种模式：

```markdown
统一纳管模式：继续现有 list、复用、上传、唯一 manifest 和托管校验流程；交付时提醒“请确认 CDP ≥ 1.20.0，webPage 资源接口已验证可用”。

旧版非托管模式：不上传、不写 manifest、第三方静态资源可按旧方式引用；执行 `node .../validate-page-resources.mjs --legacy-unmanaged index.html`；交付时说明不保证统一迁移、内网离线部署和平台依赖分析。
```

明确最低版本：CDP `1.20.0`、webPage `1.4.2`。明确 Agent 不能猜测 CDP 部署根或版本，且不加入页面运行时探测、双轨资源引用或自动降级。

- [ ] **步骤 4：收紧 SKILL 与三类生成提示词**

将 `SKILL.md` 的“受管页面恰好一个 manifest”改为只约束“统一纳管模式”；增加旧版非托管模式不写 manifest、调用 `--legacy-unmanaged` 的说明。三个生成提示词均替换内部资源段落为以下共同前置句：

```markdown
发现业务资源后，先调用一次 `custom-page-resource list` 进行能力探测：可用则自动统一纳管；仅 HTTP `404` / `405` 或协议不匹配时才让用户选择升级或旧版非托管模式。
```

并写明 `401` / `403`、其他 `4xx`、网络错误、超时、`5xx` 不能触发降级；旧版模式不写 manifest。

- [ ] **步骤 5：更新测试说明并同步场景镜像**

在 `tests/README.md` 的 Tier 1.5 覆盖描述中加入“统一纳管与显式旧版非托管模式互斥”。随后只运行现有同步脚本，不直接编辑镜像文件：

```powershell
powershell -ExecutionPolicy Bypass -File tools/sync-scene.ps1
```

- [ ] **步骤 6：运行全量技能验证**

运行：

```powershell
powershell -ExecutionPolicy Bypass -File tests/run-validation.ps1
node --test tests/validate-page-resources.test.mjs
```

预期：结构验证显示 `RESULT: PASS`，Node 测试全部通过，场景镜像无漂移。

- [ ] **步骤 7：提交技能规则与镜像**

```powershell
git add -- skills/generating-votafoundry-single-pages/SKILL.md skills/generating-votafoundry-single-pages/references/internal-resources.md skills/generating-votafoundry-single-pages/references/prompts/normal-generator.md skills/generating-votafoundry-single-pages/references/prompts/databoard-generator.md skills/generating-votafoundry-single-pages/references/prompts/custom-shell-generator.md scene_个性交付/knowledge tests/README.md tests/validate-page-resources.test.mjs
git commit -m "feat: 增加业务资源能力探测流程"
```

### 任务 3：最终范围审查与交付验证

**文件：**
- 检查：`docs/superpowers/specs/2026-09-16-custom-page-resource-capability-design.md`
- 检查：任务 1、任务 2 的所有文件

- [ ] **步骤 1：核对规格覆盖**

执行：

```powershell
rg -n "custom-page-resource list|404|405|1[.]20[.]0|1[.]4[.]2|legacy-unmanaged|运行时" skills/generating-votafoundry-single-pages tests/validate-page-resources.test.mjs
```

预期：技能和测试同时覆盖探测、仅路由不存在可降级、版本提醒、显式旧版模式与禁止运行时探测。

- [ ] **步骤 2：检查变更范围与工作区保护**

执行：

```powershell
git diff --check
git status --short
git log -3 --oneline
```

预期：无空白错误；只报告本计划文件，以及开始实施前已存在的未提交文件。不得覆盖或暂存用户的 `index.html`。

- [ ] **步骤 3：重新运行新鲜验证**

执行：

```powershell
powershell -ExecutionPolicy Bypass -File tests/run-validation.ps1
node --test tests/validate-page-resources.test.mjs
```

预期：两条命令均退出 `0`。

- [ ] **步骤 4：提交最终文档调整（若任务 1、2 后仍有未提交的本计划范围文件）**

```powershell
git add -- docs/superpowers/plans/2026-09-16-custom-page-resource-capability.md
git commit -m "docs: 补充业务资源能力探测实施计划"
```

若计划文件已在开始实施前单独提交，则本步骤只确认工作树干净，不创建空提交。
/
