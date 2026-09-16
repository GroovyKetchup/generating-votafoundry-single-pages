# Scene 自定义页面业务资源接入实施计划

> 规格来源：[自定义页面业务资源能力与 Scene 接入设计](../specs/2026-09-16-custom-page-resource-scene-integration-design.md)。
> 既有 CLI 能力探测/旧版降级实现及其计划不改动。

## 范围与并行边界

三个任务可并行：它们分别修改 webPage、CDP 前端、两套 JS skill 仓库；不共享可写文件。公共 HTTP 契约先按本计划冻结的字段实施，集成时再交叉验证。

| 任务 | 工作区 | 产物 |
| --- | --- | --- |
| A | `C:\eclipse\project\webPage` | 活跃 Scene session 对 `listFiles` / `uploadFile` 的备用鉴权 |
| B | `C:\project\js\backup\gpf_dc_Cdp_frontent2` | Scene 初始化后写 `.cdp/resource-context.json` |
| C | `C:\project\js\sdk_test`、`C:\project\js\generating-votafoundry-single-pages` | 契约子集、Scene helper、公共知识与双向漂移检查 |

## A. webPage：最小备用鉴权

1. 先阅读 `CCustomPageResourceController`、`SdkCdnDispatcherMappingBuilder` 和 `AuthInterceptor` 的实际拦截顺序；不要在控制器复制鉴权逻辑，也不要改 Agent 路由或会话列表。
2. 在 CDN 映射的鉴权接缝增加一个仅覆盖 `GET /wp-cdn/api/listFiles`、`POST /wp-cdn/api/uploadFile` 的分支：
   - `Authorization` 存在时仍完整走现有 JWT；无效 JWT 不得回退到 Scene。
   - 无 `Authorization` 时仅读取 `X-Scene-Session-Id`；用既有 `AgentChatClient.loadState(sessionId)` 查询状态，只有请求会话 ID 匹配且 `isLive=true` 才放行。
   - 状态查询异常、空状态、无效/不活跃 session 一律拒绝（失败关闭）。
   - `exportPackage`、`importPackage` 保持 JWT-only。
3. 不增加 businessDomain 绑定、resourceGrant、绑定 API、缓存或前端编排。保留一个 `ponytail:` 注释，说明当前已知的会话枚举/跨业务域窗口风险，以及仅在出现滥用或审计需求时再加入会话列表收紧、业务域绑定或短期密钥。
4. 按项目现有测试方式补最小测试：有效 live session 的 list、upload、overwrite 成功；无效/inactive/状态异常被拒绝；无 JWT 的 export/import 被拒绝；JWT 存在时不触发备用逻辑。
5. 运行受影响测试和项目可用的编译检查，报告命令与结果。

## B. CDP 前端：写非敏感资源上下文

1. 在 `SceneCodeGenerationService` 完成新建或恢复 Scene session、且 `writeFile` 可用后，以一个私有 helper 写 `.cdp/resource-context.json`；不要在各个页面调用点散落写入。
2. 内容严格为 `{ version: 1, baseUrl, businessDomain }`：
   - `businessDomain` 取该 service 已持有的 `busDomainCode`；缺失则不写，保持原有 Scene 行为。
   - `baseUrl` 取当前 CDP 已有的后端服务基址配置，归一化为末尾 `/`；不猜测 CDP 部署目录。
   - 不写 token、用户名、password、Authorization、sessionId 或 sharedSpaceKey。
3. 上下文写入失败应使 Scene 初始化失败，避免 agent 把错误上下文视为受支持能力；恢复会话也必须写入/刷新该文件。
4. 使用项目现有 TypeScript 测试或最小可运行测试覆盖：新会话/恢复写文件、字段正确、没有业务域时不写、写入异常失败；运行 lint/typecheck/build 中现有可用检查。

## C. HTTP 真源、Scene helper 与知识同步

### C1. panelx-http-api 真源

1. 在 `skills/panelx-http-api/references/endpoint-catalog.json` 的 `listCustomPageResources`、`uploadCustomPageResource` 增加：

```json
"alternateAuth": { "kind": "active-scene-session", "header": "X-Scene-Session-Id" }
```

   并在 request 明确 `optional`：list 为 `["prefix"]`；upload 为 `["resourcePath", "overwrite"]`。`auth: "required"` 保持不变，CLI 仍只走 JWT。
2. 只扩展 `validate-contract.mjs` 所需 schema 校验和测试；更新 `custom-page-resource.md`，说明备用鉴权只给 Scene server helper，PanelX CLI 不读取/不发送 session header。

### C2. 从真源生成消费子集

1. 在 single-page 仓库实现 Node 标准库生成/校验脚本，接收显式 `--panelx-skill-root`，只提取上述两个 operation，生成 `skills/generating-votafoundry-single-pages/references/custom-page-resource-contract.json`。
2. 生成的契约是只读产物；检查模式应在 catalog、操作字段或产物任何一处漂移时非零退出。不得向分发文件写开发机绝对路径。

### C3. Scene helper 与统一知识

1. 新建 `skills/generating-votafoundry-single-pages/scripts/scene-custom-page-resource.mjs`，并镜像到 `scene_个性交付/script/`。只用 Node 内建 `fetch`/`FormData`：
   - 从工作区 `.scene` 判定 Scene；读取/校验 `.cdp/resource-context.json`（version=1、baseUrl、businessDomain）。
   - 实现 `list [--prefix]`、`upload --file ... [--resource-path] [--overwrite]`，从生成的子集读取 method/path/字段/备用 header；发送 `X-Scene-Session-Id` 和既有业务域请求头。
   - 输出结构化 JSON；不实现登录、凭据读取、export/import、资源分类、manifest 写入、重试调度或确认弹窗。
2. 更新唯一来源 `references/internal-resources.md`：`.scene` 不存在沿用现有 CLI 探测；存在而无 context 时不请求 list、进入升级/legacy 选择；context 非法停止；合法 context 后 helper list 只验证 webPage+会话。镜像到 `scene_个性交付/knowledge/`。
3. 镜像 `validate-page-resources.mjs` 至 `scene_个性交付/script/`，扩展 `tools/sync-scene.ps1` 同时同步/检查该显式 script 集合；`scene.md` 只指向知识与脚本，不复制流程。
4. 更新 Scene prompts 的内部资源段，避免它们继续指示 Scene 登录或直接调用 CLI；保持无 `.scene` 的 CLI 文字不变。
5. 用最小 Node 测试覆盖：无 `.scene` 不使用 helper；`.scene` 无 context 不发请求；合法 context 的 list/upload/overwrite 请求头与契约一致；无效/不活跃 session 的错误保持为暂停而非降级；生成契约、知识镜像、脚本镜像任一漂移均检查失败。

## 集成验收

1. 分别运行 A/B/C 的测试与静态检查；`git diff --check` 在四个工作区均通过。
2. 在部署环境用一个 active Scene session 验证 list、普通 upload、overwrite upload；验证 inactive session 拒绝；无 JWT 不可 export/import。测试资源使用隔离路径并在结果中标明。
3. 最后检查：原有 capability 规格和计划没有 diff；不纳入已有的用户文件 `index.html`；不提交凭据或真实 token。
