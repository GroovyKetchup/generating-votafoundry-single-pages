# 技能校验 / 压力测试

本目录存放 `generating-votafoundry-single-pages` 技能的**开发期验证资产**（不随技能交付）。
交付源在仓库根 `skills/generating-votafoundry-single-pages`，两套验证均为红绿门禁，用于交付前自检、以及后续改技能后防止红线被重新绕过。

所有命令从**仓库根**执行（PowerShell）。

## Tier 1 — 确定性结构校验（无需 agent，可进 CI）

```powershell
powershell -ExecutionPolicy Bypass -File tests\run-validation.ps1
```

校验项：
- `SKILL.md` + `references/` 存在
- 交付目录里**无** `test-pressure*`（确保不会带出测试）
- frontmatter：`name` 符合 `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`；`description` 存在、≤1024 字符、含 "Use when" 触发
- frontmatter 必须是**合法 YAML**：未加引号的标量值里出现 `: ` 或 ` #` 即 FAIL（规范解析器会当作 mapping/注释，导致 CLI/IDE 加载技能失败）
- `SKILL.md` 中所有相对链接可解析
- 未泄漏平台绝对路径（`/data/scene/`、`/knowledge/`、`/compose`）
- 示例里无 `@latest` / `unpkg.com` 直引
- `scene_个性交付/knowledge` 与 `references/` 镜像一致（调用 `tools/sync-scene.ps1 -Check`；不一致即 FAIL）

退出码：`0`=PASS，`1`=FAIL。

## Tier 2 — 子智能体压力测试（需 agent）

子智能体只能由 agent 用 `run_subagent` 派生，脚本无法直接 spawn。因此通过 CLI 非交互模式驱动：

```powershell
devin --print --prompt-file tests\agent-run-pressure-tests.md --respect-workspace-trust false
```

编排文件已锁定最终输出行为，可用如下方式解析门禁（示例：Node 或 PowerShell 读输出，判定存在 `PRESSURE_RESULT: PASS`）：

```powershell
$out = devin --print --prompt-file tests\agent-run-pressure-tests.md --respect-workspace-trust false
if ($out -match 'PRESSURE_RESULT: PASS') { Write-Host 'tier2 PASS' } else { Write-Host 'tier2 FAIL'; exit 1 }
```

> 注：Tier 2 每次会派生 4 个 `subagent_explore`，按子智能体独立计费。改动技能红线后建议至少跑一次；常规提交可只跑 Tier 1。

## Tier 1.5 — 内部资源校验器确定性测试（Node，无依赖）

```powershell
node --test tests\validate-page-resources.test.mjs
```

覆盖 `skills/generating-votafoundry-single-pages/scripts/validate-page-resources.mjs`：统一纳管与显式旧版非托管模式互斥；统一纳管时恰好一个 `data-cdp-internal-resources` manifest、路径规范与去重、
引用必须包含在 manifest 中、根绝对引用 / 逃出受管根的 `..` / 非法百分号编码被拒、系统资源与外部 URL 被排除、系统资源注册表为单一来源。退出码非 0 = FAIL。

## Tier 1.6 — Scene 业务资源 helper / 契约 / 镜像确定性测试（Node，无依赖）

```powershell
node --test tests\scene-custom-page-resource.test.mjs
```

覆盖 `skills/generating-votafoundry-single-pages/scripts/scene-custom-page-resource.mjs`、生成的 `references/custom-page-resource-contract.json` 与 `scene_个性交付/{knowledge,script}` 镜像：
无 `.scene` 时零请求并提示改用 CLI；有 `.scene` 但无 `.cdp/resource-context.json` 时零请求（判 CDP 不支持）；上下文非法则停止且零请求；
合法上下文下 `list`、`upload`、`--overwrite` 的 method / path / 字段 / `X-Scene-Session-Id` / `BusDomainCode` 与契约一致且不发 `Authorization`；
会话或鉴权失败暂停且与 404 / 405 的「能力不可用」错误码区分；契约漂移、知识镜像漂移、`/script` 镜像漂移均判失败；
`/script` + `/knowledge` 布局下校验器可用。
panelx-http-api 真源默认取同级 `..\sdk_test\skills\panelx-http-api`，可用 `PANELX_SKILL_ROOT` 覆盖；真源缺失时该契约用例跳过。退出码非 0 = FAIL。

## 失败即重构（把漏洞堵回技能）

若某场景返回 **B/C（不合规）**，说明技能存在一条可被"合理化"绕过的红线。做法（见 `writing-skills` TDD 循环）：
1. 逐字记录该场景的**合理化借口**。
2. 在 `skills/.../SKILL.md` 对应红线处补一条**明确否定** + 可选**合理化借口对照表**。
3. 重跑该场景，确认改为 A 且引用新增条款。

## 文件清单

| 文件 | 用途 |
| --- | --- |
| `run-validation.ps1` | Tier 1 确定性门禁 |
| `agent-run-pressure-tests.md` | Tier 2 压力测试编排（`devin -p` 使用） |
| `skills/generating-votafoundry-single-pages/` | 技能交付源（不随 tests 一起交付） |
| `skills/.../test-pressure-*.md` | 4 个压力场景，实际位于 `tests\skills\generating-votafoundry-single-pages\` |
| `validate-page-resources.test.mjs` | 内部资源校验器确定性测试（Tier 1.5） |
| `scene-custom-page-resource.test.mjs` | Scene helper / 契约子集 / 镜像确定性测试（Tier 1.6） |
