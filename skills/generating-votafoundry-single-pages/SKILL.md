---
name: generating-votafoundry-single-pages
description: Use when generating a single HTML page for VotaFoundry / SemFoundry「个性交付」delivery — data dashboards or generic pages via PanelX-SDK real data, or custom shells/menus/entries via CDP-SDK (主题订阅、动作注册). Triggers: HTML 单页、数据看板、通用页、自定义外壳、PanelX-SDK、CDP-SDK。
---

# 生成 VotaFoundry 个性交付单页

## 概述

交付**单一 HTML 页面**，适用于 VotaFoundry 个性交付。根据需求先判断分支，再选对应模板与 SDK。默认输出与 CDP 主题一致的现代风格单页，可结合前端设计技能做更高质量的视觉表达。

## 何时使用

- 交付单个 HTML 页面
- 需要**数据页面**（看板 / 通用页）：基于 PanelX SDK 的真实数据交互
- 需要**页面入口**（自定义框架 / 入口 / 菜单 / 外壳）：基于 CDP-SDK 的菜单与外壳能力

**不适用**：非单页应用、纯静态无 SDK 交互的普通网页。

## 分支判断

```
需求是什么？
├── 数据展示/看板/表格/表单 + 真实数据交互 → 【数据页面】
│     ↓ PanelX-SDK + 真实接口 (queryFormDataList 等)
├── 菜单+内容区/外壳/入口/主题订阅          → 【页面入口】
│     ↓ CDP-SDK 菜单与外壳，默认不加载 PanelX
└── 明确要求两者都要                         → 数据页面为主，CDP 动作注册为必选
```

## 工作流

1. **检查现有交付物**：若会话前已导入html文件，先读其结构/样式/逻辑，在其上迭代。
2. **判断分支**：数据页面 vs 页面入口。
3. **按需求选择 Prompt 模板学习**：
   - 看板型 → `databoard-generator.md`（多面板整合、关联字段硬编码、Tailwind+ECharts+Lucide、禁止 mock）
   - 通用单页 → `normal-generator.md`（表格/表单/操作按钮/分页/权限对齐/表单弹窗）
   - 自定义外壳 → `custom-shell-generator.md`（菜单+内容区、主题订阅、菜单控制、默认功能集成）
   - 需要 CDP 集成骨架 → `cdp-integration-skeleton.md`
4. **设计与视效**：
   - 先读 `frontend-design.md`，明确目的/受众/技术约束后确定明确审美方向并贯彻到底。
   - 用户未指定 UI 规范时遵循 `default-ui-design.md`；加载态参考 `wave-loading.md`。
   - 默认 `Tailwind CDN + Lucide + (看板场景加 ECharts)`；配色跟随 CDP 主题。
5. **分支执行要点**：
   - **数据页面**：熟读 `panelx-sdk.md`；CDP 主题同步 + 动作注册为必选；SDK 经由 `https://kwaidoo.com/cdn_cdp/sdk/cdp_sdk/panelx-sdk-proxy.js` 引入并正确初始化（`busDomainCode` 必填）。
   - **页面入口**：熟读 `cdp-sdk-guide.md`「自定义 Shell 开发指南」；仅用 CDP-SDK，默认不加载 PanelX、不做动作注册（除非明确要求）。
6. **交付前自检**（见下）。

## 硬约束（红线，必查）

### 通用
- 单文件 HTML；但"单文件"≠忽略宿主共享资源，资源策略优先复用宿主能力。
- 界面文字简体中文；不暴露业务域/面板编号等技术信息。
- Loading/错误/刷新反馈完整；局部失败不影响整体（错误边界 + toast 可降级）。
- 已完成 CDP 主题适配。

### 数据页面
- 使用真实接口，**禁止 mock 常量**。
- 统一经 `panelx-sdk-proxy.js` 引入并正确初始化 SDK。
- 关联字段通过硬编码配置映射。
- **CDP 动作注册（含数据获取动作）是本次交付物的一部分，不是可后补的增强。** 为所有数据相关操作注册 CDP 动作，提供操作指南，参数校验与错误抛出完整。

  **无例外（禁止以下辩词）：**
  - 不得以"动作注册独立于页面渲染、用户只看视觉输出、不影响图表显示"为由跳过。
  - 不得以"演示后再补""只是少一行 `setActions`""可恢复、事后补上"为由推迟——动作注册必须随本次 `index.html` 一并交付。
  - 不得以"用户没要求动作注册""没让接入 AI"为由省略——它为所有数据相关操作注册动作，是数据页面的**必选项**。
  - 不得以"省时间/赶工期"为由减免；省下的时间换来的是评审打回与返工。

  | 合理化借口 | 现实 |
  | --- | --- |
  | "动作注册跟渲染解耦，后补也一样" | 它是交付物的一部分；后补意味着本次交付是残缺的，验收对不上。 |
  | "数据取的是真实接口，注册动作没那么重要" | 真实数据 ≠ 完整交付；未注册的动作让页面在宿主/AI 侧无法被调用。 |
  | "用户没要求动作注册" | 技能红线要求为所有数据相关操作注册动作（含数据获取），与用户是否要求无关。 |

### 自定义外壳 / 页面入口
- 菜单 + 内容区齐全；主题订阅完成。
- 默认功能齐备：主题面板 / AI 助手 / 命令面板 / 用户信息 / 登出（除非用户明确不要）。
- 默认无需 PanelX SDK 与动作注册（除非用户明确要求）。

### Lucide 图标（如用图标则必查）
- 必须先判断并优先复用 `window.semApp?.ui?.lucide`。
- 仅当 `window.semApp?.ui?.lucide` 不存在时，才允许动态创建 `<script>` 加载指定 CDN：
  `https://kwaidoo.com/cdn_general/libs/lucide/0.562.0/umd/lucide.min.js`
- 禁止在 `<head>` 或顶层无条件直引 `lucide.min.js`；禁止 `@latest`、`unpkg.com` 或非指定地址。
- 禁止以"自包含/快速交付/减少代码"为由跳过宿主资源判断。
- 静态 `data-lucide` 渲染后必须调用 `createIcons()`；动态插入/替换/切换图标后必须再次渲染。
- 禁止原生 `<select>` / `alert`；需自定义下拉组件与样式。

## 参考文件

- [PanelX-SDK 手册](references/panelx-sdk.md) — SDK 引入、环境探测、认证、数据查询、权限矩阵、按钮/事件、上传、存储。
- [PanelX 附件字段](references/panelx-attachments.md) — 业务附件上传、附件字段数据流（未入库/已入库）、预览/下载、空数组提交规则。
- [CDP-SDK 指南](references/cdp-sdk-guide.md) — 初始化数据、指令调用、主题订阅、动作注册、「自定义 Shell 开发指南」。
- [CDP 事件及指令指南](references/cdp-events-commands.md) / [结构化 JSON](references/cdp-events-commands.json) — 指令类型与参数/程序化查阅。
- [小程序 SDK 指南](references/weixin-miniprogram-sdk.md) / [JSON](references/weixin-miniprogram-sdk.json) — 需要小程序场景时使用。
- [默认 UI 设计规范](references/default-ui-design.md) — 未指定 UI 时作为默认规范。
- [前端设计](references/frontend-design.md) — 强调大胆审美方向与高质量实现。
- [wave-loading 使用指南](references/wave-loading.md) — 加载态组件。
- [生成模板](references/prompts/databoard-generator.md) · [通用页](references/prompts/normal-generator.md) · [自定义外壳](references/prompts/custom-shell-generator.md) · [CDP 集成骨架](references/prompts/cdp-integration-skeleton.md)
- [CDP 示例](references/examples/) — 动作注册、主题同步、表单提交、自定义外壳等 step-by-step。
