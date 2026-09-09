# generating-votafoundry-single-pages

用于 **VotaFoundry / SemFoundry「个性交付」** 场景的 Agent 技能：生成**单个 HTML 页面**（数据看板 / 通用页 / 自定义外壳）。

## 它是什么

一个参考类技能，把"个性交付"所需的知识库与红线固化下来，让 Agent 能稳定交付单个 HTML 单页：

- 先判断分支：**数据页面**（基于 PanelX-SDK 真实数据交互）还是**页面入口/自定义外壳**（基于 CDP-SDK 菜单与外壳）。
- 内置硬约束：Lucide 图标宿主优先、禁用原生 select/alert、真实接口禁 mock、单文件但复用宿主资源、CDP 动作注册、主题适配等。

## 目录结构

```
skills/generating-votafoundry-single-pages/
├── SKILL.md          # 主文档：分支判断 / 工作流 / 硬约束红线 / 自检清单 / 参考链接
└── references/       # 参考素材：PanelX-SDK 手册、CDP-SDK 指南、生成模板、设计规范、示例

tests/
├── run-validation.ps1               # Tier 1 确定性校验（结构/链接/红线残留 + scene 镜像一致）
└── agent-run-pressure-tests.md      # Tier 2 子智能体压力测试编排（devin -p 使用）

tools/
└── sync-scene.ps1                   # 把 references/ 镜像到 scene_个性交付/knowledge/；-Check 为漂移门禁
```

## 安装到你的技能环境

把 `skills/generating-votafoundry-single-pages/` 整个目录复制到你的技能目录：

- Devin CLI（项目级）：`<仓库>/.devin/skills/generating-votafoundry-single-pages`
- 全局（其它 Agent）：`~/.agents/skills/generating-votafoundry-single-pages`

## 验证

```powershell
# Tier 1：确定性结构校验（可进 CI）
powershell -ExecutionPolicy Bypass -File tests\run-validation.ps1

# Tier 2：子智能体压力测试（需 agent，用 CLI 非交互模式驱动）
devin --print --prompt-file tests\agent-run-pressure-tests.md --respect-workspace-trust false
```
