# 自定义页面业务资源能力与 Scene 接入设计

## 1. 与既有能力的关系

[自定义页面业务资源能力探测与旧版降级设计](./2026-09-16-custom-page-resource-capability-design.md) 已完成实施，继续作为 CLI 和公共资源流程的基线。本设计只增加 Scene 环境的能力识别、鉴权和 skill 执行适配，不替换、不回退既有设计，也不要求重做其实施计划。

既有规则保持不变：

- 页面确实需要业务资源时才进入能力探测；
- webPage 接口可用时自动统一纳管；
- HTTP `404`、`405` 或协议不匹配时，由用户选择升级或旧版非托管模式；
- 鉴权、网络和服务错误不触发自动降级；
- 页面运行时不探测版本或切换资源模式；
- 系统资源排除、资源批次、manifest、相对路径、`accessPath` 禁写和机械校验规则不变。

## 2. Scene 环境识别

工作区根目录存在 `.scene` 时进入 Scene 分支；不存在时继续执行已落地的 CLI 分支。

`.scene` 只标识当前运行在 Scene 工作区，不表示 CDP 已支持业务资源管理。

## 3. Scene 的 CDP 能力标识

支持业务资源管理的 CDP 宿主在 Scene 会话初始化完成后，通过现有工作区文件能力写入：

```json
// .cdp/resource-context.json
{
  "version": 1,
  "baseUrl": "https://demo.kwaidoo.com/VF_DEV/",
  "businessDomain": "GroupChat_Inst_xxx"
}
```

该文件同时承担：

1. **CDP 能力标识**：文件存在表示当前 CDP 宿主支持业务资源管理；
2. **非敏感寻址上下文**：向 Scene helper 提供 webPage 服务基址和当前业务域。

文件不得包含 JWT、Authorization、用户名、密码或其他用户凭据。

旧版 CDP 不创建该文件。单纯缺少该文件按“当前 CDP 不支持业务资源管理”处理，不再解释为 Scene 集成故障。

文件存在但 JSON 非法、`version` 不支持、`baseUrl` 或 `businessDomain` 缺失时，说明支持能力的宿主输出了错误上下文；此时停止并报告宿主上下文错误，不自动进入旧版模式。

## 4. Scene 能力决策流程

```text
存在 .scene？
├── 否 → 执行已落地的 CLI 能力探测流程
└── 是
    ├── .cdp/resource-context.json 不存在
    │   → 判定当前 CDP 不支持业务资源管理
    │   → 让用户选择升级或旧版非托管模式
    └── 文件存在且合法
        → 判定当前 CDP 支持业务资源管理
        → 使用 Scene 会话鉴权调用 listFiles
            ├── 成功 → 进入统一纳管
            ├── 404 / 405 / 协议不匹配 → 按既有 webPage 不支持分支处理
            └── 鉴权 / 网络 / 5xx → 按既有错误规则处理，不降级
```

因此两种环境的区别只有 CDP 前端能力判断：

- **CLI**：无法读取目标 CDP 能力，只能在 webPage 接口成功后交付提醒用户确认 CDP 最低版本；
- **Scene**：以 `.cdp/resource-context.json` 是否存在判断 CDP 能力；文件存在且合法后无需再提示用户人工确认 CDP 版本。

`listFiles` 在 Scene 中仍然必需，但只验证 webPage 资源接口和 Scene 鉴权可用，不再用于推断 CDP 版本。

## 5. Scene 活跃会话鉴权

### 5.1 适用接口

| 接口 | JWT | 活跃 Scene 会话 |
| --- | --- | --- |
| `GET /wp-cdn/api/listFiles` | 允许 | 允许 |
| `POST /wp-cdn/api/uploadFile` | 允许 | 允许 |
| `GET /wp-cdn/api/exportPackage` | 必需 | 不允许 |
| `POST /wp-cdn/api/importPackage` | 必需 | 不允许 |

Scene helper 发送：

```http
X-Scene-Session-Id: <.scene.sessionId>
BusDomainCode: <resource-context.businessDomain>
```

### 5.2 校验规则

1. 携带 `Authorization` 时只走现有 JWT 鉴权；JWT 无效时不回退 Scene 鉴权。
2. 未携带 `Authorization` 时，只有 `listFiles`、`uploadFile` 可以尝试 Scene 鉴权。
3. 使用现有 `AgentChatClient.loadState(sessionId)` 查询状态。
4. 返回的 `conversationId` 必须一致，且 `isLive()==true`。
5. sessionId 缺失、非法、不存在、已结束，或 Agent 状态服务不可用时失败关闭。
6. 每个请求实时校验，不增加长期缓存。
7. 上传开始处理后，不因 Agent run 随后结束而中断该单文件写入。

Scene 备用鉴权应在 CDN 专属请求链的统一入口执行。全局鉴权层最多只允许这两个无 JWT 请求进入 CDN 专属校验，不保存业务域绑定或 Scene 授权状态。

### 5.3 已确认的简化

- 不绑定 `sessionId` 与 `businessDomain`。
- 不新增 `resourceGrant`。
- 不收紧当前免鉴权的 Agent 会话列表。
- Scene 会话通过校验后，可以对请求提供的任意业务域调用 `list`、`upload`。
- Scene 与 JWT 上传使用相同的 `overwrite` 语义；不得因 Scene 身份拒绝 `overwrite=true`。
- Scene helper 的 `--overwrite` 不增加人工确认；公共资源流程仍默认优先复用或选择无碰撞新路径。

已接受的安全边界：

> 能访问相关 HTTP 接口的调用方可以枚举并借用当前 `isLive=true` 的 sessionId，在该 run 的活跃窗口内，对其指定的业务域执行列举、上传和显式覆盖上传。

实现应以 `ponytail:` 注释记录该上限。只有出现实际滥用、越权或审计需求后，再考虑业务域绑定、独立短期凭据或会话列表收紧。

## 6. skills 统一维护与环境分支

### 6.1 公共规则真源

`skills/generating-votafoundry-single-pages/references/internal-resources.md` 继续作为业务资源流程的唯一文本真源，并通过现有 `tools/sync-scene.ps1` 镜像到 `scene_个性交付/knowledge/internal-resources.md`。

公共文档只增加环境路由：

```text
存在 .scene
  → 读取 .cdp/resource-context.json
  → 使用 Scene 轻量 helper

不存在 .scene
  → 必需子技能：panelx-http-api
  → 使用既有 custom-page-resource CLI
```

CLI 和 Scene 共用资源分类、完整 list、ETag 复用、路径分配、上传批次、manifest、失败处理和校验规则。

### 6.2 薄入口

- CLI `SKILL.md` 只链接公共资源规则，不复制 PanelX 登录流程。
- Scene `scene.md` 只说明公共知识文件和 `/script` 命令，不复制完整资源流程。
- Scene 不加载完整的 `panelx-http-api` skill。
- Scene 缺少或无法解析资源上下文时，不退回 CLI 登录。

## 7. Scene 轻量 helper 与校验器

单页 skill 维护以下脚本，并同步到 Scene：

```text
skills/generating-votafoundry-single-pages/scripts/scene-custom-page-resource.mjs
  → scene_个性交付/script/scene-custom-page-resource.mjs

skills/generating-votafoundry-single-pages/scripts/validate-page-resources.mjs
  → scene_个性交付/script/validate-page-resources.mjs
```

Scene helper 只提供：

```bash
node /script/scene-custom-page-resource.mjs list [--prefix <path>]

node /script/scene-custom-page-resource.mjs upload \
  --file <local-file> \
  [--resource-path <path>] \
  [--overwrite]
```

helper 负责解析 `.scene`、资源上下文、请求头、multipart 和 RespondDto；不实现登录、Token/profile、导出、导入、资源分类、重试引擎或 manifest 写入。

Scene 使用 `/script/validate-page-resources.mjs` 执行与 CLI 相同的机械校验，不引用服务器上不存在的 CLI skill 路径。

## 8. HTTP 契约防漂移

`panelx-http-api/references/endpoint-catalog.json` 是 method、path、请求字段、响应类型和鉴权头的唯一 HTTP 契约真源。

`listCustomPageResources`、`uploadCustomPageResource` 增加机器可读的备用鉴权：

```json
{
  "auth": "required",
  "alternateAuth": {
    "kind": "active-scene-session",
    "header": "X-Scene-Session-Id"
  }
}
```

并显式声明可选字段：

- list：`prefix`；
- upload：`resourcePath`、`overwrite`。

发布工具只提取这两个操作，生成：

```text
skills/generating-votafoundry-single-pages/references/custom-page-resource-contract.json
```

生成文件不手工编辑。Scene helper 读取该契约，不在代码或知识文档中重复硬编码接口信息。

发布前检查：

1. PanelX catalog 与两接口生成子集一致；
2. skill `references/` 与 Scene `knowledge/` 一致；
3. 指定的 skill scripts 与 Scene `/script` 一致。

跨仓库工具通过显式 skill 根路径运行，不把开发机绝对路径写入分发包。

## 9. 错误与降级

- 单文件冲突或载荷过大：保留已成功文件，继续处理独立文件，失败项进入下一轮。
- Scene session 不活跃、上下文非法、Agent 状态服务不可用、网络错误或 `5xx`：暂停整批，不写未完成 manifest，不降级。
- 资源上下文不存在：判定 CDP 不支持，由用户选择升级或旧版非托管。
- 资源上下文存在且合法，但 list 返回 `404`、`405` 或协议不匹配：判定 webPage 资源能力不可用，由用户选择升级或旧版非托管。
- 旧版模式继续使用已经落地的 `--legacy-unmanaged` 校验。

## 10. 验收标准

1. 旧的能力探测与旧版降级规格、实现和计划保持不变。
2. 无 `.scene` 时行为与现有 CLI 完全一致。
3. 有 `.scene`、无资源上下文时，不调用 `listFiles`，直接进入升级或旧版选择。
4. 有合法资源上下文时，确认 CDP 能力并通过 Scene 会话调用 `listFiles`；不再提醒用户人工确认 CDP 版本。
5. 资源上下文存在但非法时报告宿主上下文错误，不自动降级。
6. 无 JWT、携带有效且 `isLive=true` 的 Scene session 时，list、普通上传和 `overwrite=true` 上传成功。
7. session 无效或不活跃时 list、upload 被拒绝；Agent 状态服务不可用时失败关闭。
8. 无 JWT 时 export、import 仍被拒绝。
9. 不新增业务域绑定、resourceGrant、会话列表收紧或宿主上传编排。
10. Scene helper 不含登录、Token、导出和导入。
11. 公共资源文档、两接口契约、Scene knowledge 和 Scene scripts 均有可执行的漂移检查。
12. 系统资源排除、相对 resourcePath、唯一 manifest、accessPath 禁写和旧版非托管规则不回归。

## 11. 实施计划

既有 `2026-09-16-custom-page-resource-capability.md` 对应已落地的基线，不修改、不废弃。Scene 增量在本规格获批后单独编写实施计划。
