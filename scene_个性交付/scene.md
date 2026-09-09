# 个性交付场景指南

## 目标
- 交付 **单个 HTML 页面**，适用于 SemFoundry 个性交付。
- 根据需求分支：
  - **数据页面**（看板/通用）：基于 PanelX SDK 真实数据交互。
  - **页面入口**（自定义框架/入口/菜单/外壳）：基于 CDP-SDK 的菜单与外壳能力，不涉及 PanelX 数据交互（除非用户明确要求）。
- 默认输出与 CDP 主题一致的现代风格单页应用，可根据前端设计技能指南进行更高质量的视觉表达。

## 知识库结构及用途
| 位置 | 内容 | 用途 |
| --- | --- | --- |
| `/data/scene/d00433d5-e81b-4002-827f-c24c4a4604a5/knowledge/PanelX_SDK_文档_20251204_093233.md` | PanelX SDK 全量手册，涵盖 SDK 引入、环境探测、用户认证、数据查询、权限矩阵、按钮/事件调用、文件上传、存储模块等 API | 所有代码必须遵循此文档：`PanelXSdkProxy` 由 CDP 宿主注入，页面直接用全局 `PanelXSdkProxy` 构造函数初始化，调用真实接口、处理异常/权限。 |
| `/knowledge/panelx-attachments.md` | 业务附件处理手册：上传（含分片）、附件数据流、未入库/已入库的预览下载、空数组提交与事件/按钮下载规则 | 当表单/字段涉及 `dataType: 'attach'` 附件字段时，按该文档处理上传、提交、预览/下载与空数组规则。 |
| `/knowledge/frontend-design.md` | 前端设计技能说明，强调大胆审美方向与高质量实现 | 当用户需要组件/页面/应用的设计产出时，先阅读该文档并按其中的设计思路与审美约束执行。 |
| `/knowledge/default-ui-design.md` | 默认 UI 设计规范，包含字体、布局、间距、表格、按钮与输入控件等标准 | 当用户未指定 UI 设计规范时，优先遵循此文档作为默认规范。 |
| `/knowledge/Prompt/databoard_generator_with_sdk_template.md` | “数据看板”场景 Prompt 模板，详细列出多面板数据整合、关联字段硬编码、Tailwind+ECharts+Lucide 使用及常见踩坑 | 当需求是统计看板/仪表盘时，按该模板学习完整工作流、加载流程、Loading/错误处理和关联字段处理方式。 |
| `/knowledge/Prompt/normal_generator_with_sdk_template.md` | “通用页面”场景 Prompt，覆盖表格/表单/操作面板的标准实现、权限获取、按钮调用、交互 Loading 等规范 | 当需求是表格或业务表单时参考此模板，确保实现权限控制、弹窗按钮固定、关联字段渲染等细节。 |
| `/knowledge/Prompt/custom_shell_generator_with_sdk_template.md` | “自定义框架/入口/菜单/外壳”场景 Prompt 模板，覆盖菜单+内容区布局、主题订阅、菜单控制与默认功能集成 | 当需求是自定义 Shell（宿主外壳）时参考此模板，确保按步骤实现菜单、主题与默认功能。 |
| `/knowledge/CDP/CDP-SDK使用指南.md` | CDP-SDK 主文档（以该目录为准），包含初始化数据、指令调用、主题订阅、动作注册等 | 当页面需要与 CDP 双向通讯或注册动作时优先使用该文档。 |
| `/knowledge/CDP/CDP事件及指令使用指南.md` | CDP 指令文档（人类可读） | 需要调用 CDP 指令时，按该文档选择指令类型与参数。 |
| `/knowledge/CDP/CDP事件及指令使用指南.json` | CDP 指令文档（结构化 JSON） | 需要程序化查阅指令时使用。 |
| `/knowledge/CDP/Examples/*.html` | CDP-SDK 示例（step by step） | 注册动作、主题同步、表单提交等流程参考。 |
| `/script` | 目前为空，可在需要时放置辅助脚本 | 暂无可执行脚本。 |

## 工作流程建议
1. **检查现有交付物**：如果用户在会话前已导入交付物（如 `index.html`），先阅读其内容，理解已有结构/样式/逻辑，再在此基础上满足用户的新需求或改动。

2. **先判断分支**：数据页面（看板/通用）还是页面入口（自定义 Shell）。

3. **根据需求选择 Prompt 模板学习**：
   - **看板型** → `Prompt/databoard_generator_with_sdk_template.md`：包含 Tailwind + ECharts + Lucide 的标准骨架、关联字段配置 (`RELATION_FIELD_CONFIG`)、禁止 mock、Loading/错误反馈与刷新行为等红线；其中 Lucide 的“只复用宿主共享实例、禁止 CDN 兜底”规则是强制约束，不得简化为直接 CDN 引入。
   - **通用单页** → `Prompt/normal_generator_with_sdk_template.md`：覆盖表格、表单、操作按钮、分页、权限对齐、表单弹窗结构等；同样强调“真实数据 + SDK 初始化 + Loading”。
   - **自定义框架/入口/菜单/外壳** → `Prompt/custom_shell_generator_with_sdk_template.md`：按步骤实现菜单+内容区、主题订阅、菜单控制与默认功能集成。
   - 两类模板都要求不要在 UI 中展示业务域/面板编号、禁止使用原生 Select/alert，且需要自定义下拉组件和 Tailwind 样式。

4. **设计与视效**：
   - 先阅读 `frontend-design.md`，明确目的、受众与技术约束后选择明确的审美方向并贯彻到底。
   - 若用户未指定 UI 设计规范，则遵循 `default-ui-design.md` 的默认规范（字体、布局、间距、表格、按钮与输入控件）。
   - 默认输出与 CDP 主题一致的风格，使用 `Tailwind CDN + Lucide + (ECharts 看板场景)`，资源标签需带 `data-cdp-resource` + `data-cdp-resource-version` 固定版本声明；其中 Lucide 只复用 `window.semApp?.ui?.lucide`，禁止动态加载任何 CDN 兜底、也禁止把 Lucide CDN 作为默认直引方案。若需求强调视觉表达，按该文档中的排版、配色、动效和构图原则执行。

5. **分支执行要点**：
   - **数据页面（看板/通用）**：
     - 熟读 PanelX SDK 文档：`/data/scene/d00433d5-e81b-4002-827f-c24c4a4604a5/knowledge/PanelX_SDK_文档_20251204_093233.md`。
     - 熟读 CDP 文档：`/knowledge/CDP/CDP-SDK使用指南.md`，重点动作注册与主题同步；initData/dispatch 仅在用户明确要求时使用。
     - PanelX SDK（`PanelXSdkProxy`）由 CDP 宿主注入，页面直接用全局 `PanelXSdkProxy` 构造函数初始化，禁止 script src/本地脚本/preload 加载。
     - 初始化：`busDomainCode` 必填；数据必须通过 `sdk.api.queryFormDataList` 等真实接口获取。
     - CDP：主题同步 + 动作注册为必选项。
   - **页面入口（自定义框架/入口/菜单/外壳）**：
     - 熟读 CDP 文档：`/knowledge/CDP/CDP-SDK使用指南.md` 第三部分「自定义 Shell 开发指南」。
     - 仅使用 CDP-SDK；默认不加载 PanelX SDK、不做动作注册（除非用户明确要求）。
     - 菜单 + 内容区 + 主题订阅 + 主题面板 + AI 助手 + 命令面板 + 用户信息 + 登出为默认必集成功能（除非用户明确不要）。

6. **交付前自检**：
   - **公共项**
     - 页面在单个 HTML 文件内完成
     - “单个 HTML 页面”不等于“忽略宿主共享资源”，资源策略必须优先复用宿主能力
     - 资源声明：Tailwind CSS、wave-loading（及 ECharts，如出现）使用 `data-cdp-resource` + `data-cdp-resource-version` 固定版本声明，资源标签必须早于依赖脚本
     - 界面文字为简体中文
     - 不暴露业务域/面板编号等技术信息
     - Loading/错误/刷新反馈完整
     - 错误边界处理到位（局部失败不影响整体、toast 可降级）
     - 已完成 CDP 主题适配
   - **Lucide 图标资源项（如使用图标则必须检查）**
     - 只复用宿主共享实例：`const lucide = window.semApp?.ui?.lucide; lucide?.createIcons?.();`
     - 禁止动态创建 `<script>` 加载 Lucide CDN；禁止在 `<head>` 或 HTML 顶层无条件直引 `lucide.min.js`
     - 禁止使用 `@latest`、`unpkg.com` 或其他任何 CDN 地址作为交付版本
     - 禁止为了“自包含页面”“快速交付”“减少代码”跳过宿主资源判断
     - 静态 `data-lucide` 渲染后必须调用 `createIcons()`；动态插入、替换或切换图标后必须再次渲染
   - **数据页面**
     - 已使用真实接口且无 mock 常量
     - 使用由 CDP 宿主注入的 `PanelXSdkProxy` 全局构造器初始化并调用真实接口，交付 HTML 不得声明、外链、本地脚本引入或通过 preload 动态加载任何 SDK
     - 关联字段通过硬编码配置映射
     - 已为所有数据相关操作注册 CDP 动作（包含数据获取动作），提供操作指南，参数校验和错误抛出完整
   - **自定义框架/入口/菜单/外壳**
     - 菜单 + 内容区齐全
     - 主题订阅完成
     - 默认功能齐备（主题面板/AI 助手/命令面板/用户信息/登出）
     - 默认无需 PanelX SDK 与动作注册（除非用户明确要求）

按照以上说明，进入 `/compose` 目录即可编写最终 HTML，过程中随时查阅知识库文件获取 SDK、UI、Prompt 参考。
