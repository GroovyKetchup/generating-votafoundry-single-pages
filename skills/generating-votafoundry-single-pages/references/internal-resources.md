# 内部资源（custom page internal resources）生成期工作流

页面里除宿主提供的系统资源之外的**业务资源**（图片、字体、自定义 CSS/JS、SVG 等），仅在 Scene 资源接口可用时统一走「内部资源」：上传后在页面里用**恰好一个** manifest 声明。

## 一、资源分类

| 类别 | 判定 | 处理 |
| --- | --- | --- |
| **系统资源** | `data-cdp-resource` 引用；或命中 [system-resources.json](system-resources.json) 的精确 legacy URL | 宿主提供。**不写 manifest，也不进入上传流程** |
| **第三方静态资源** | `script[src]`、样式/图标 `link[href]`、图片/字体/CSS `url()` 等位置的 `http(s):` 或 `//` URL | **必须**下载并作为业务资源上传；页面不得保留外链 CDN |
| **内联/服务 URL** | `data:` / `blob:`，以及页面导航链接、接口地址等非静态载入 URL | 原样保留，**不写 manifest，不上传** |
| **业务资源** | 其余相对路径（含 `./` 与非逃逸 `..`） | **必须**写进 manifest，且已成功上传 |

系统资源的**单一来源**是 [system-resources.json](system-resources.json)（`data-cdp-resource` 名称 + 精确 legacy URL）。新增或升级系统资源只改这个文件，不要在页面里临时发明地址或版本。

```html
<!-- 系统资源：宿主提供，用 data-cdp-resource 固定版本声明；不进 manifest -->
<script data-cdp-resource="tailwindcss" data-cdp-resource-version="3.4.17" src="https://kwaidoo.com/cdn_general/libs/tailwindcss/3.4.17/tailwindcss.min.js"></script>
<!-- legacy 形式同样算系统资源：src="/cdn_general/libs/@generalui/wave-loading/1.0.0/wave-loading.js" -->
```

## 二、环境路由与能力探测

先看工作区根目录有没有 `.scene`：**没有**走 CLI 本地交付，**有**走 Scene 统一纳管。资源接口、复用、批次、manifest 与校验只适用于 Scene 分支。

不能猜测 CDP 部署根或版本，也不加入页面运行时探测、双轨资源引用或自动降级。一律按结构化 `ok`、HTTP `status`、`code` / `state` 判断，不匹配错误文案。

### 无 `.scene`：CLI 分支

**CLI 分支只在工作区交付 HTML**。不查找、不加载 `panelx-http-api` 技能，不调用 `custom-page-resource list` / `upload` 或任何资源服务，也不自行部署、上传或写受管 manifest。服务端资源管理仅在 Scene 分支执行；若用户明确另行要求服务器资源操作，再由独立的 HTTP 技能处理。

### 有 `.scene`：Scene 分支

Scene 会话不登录、不读取 Token、不调用 `custom-page-resource` CLI，只用随技能分发的轻量 helper（技能内 `scripts/scene-custom-page-resource.mjs`，场景工作区为 `/script/scene-custom-page-resource.mjs`）。

1. **读资源上下文** `.cdp/resource-context.json`（`version: 1`、`baseUrl`、`businessDomain`）：
   - **不存在** → 当前 CDP 不支持业务资源管理：**不调用 listFiles**，直接让用户选择升级后重试或旧版非托管模式；
   - **存在但非法**（JSON 无效、`version` 不为 1、缺 `baseUrl` 或 `businessDomain`）→ 停止并报告宿主上下文错误，**不降级**；
   - **存在且合法** → 判定 CDP 支持业务资源管理，继续第 2 步。
2. **能力探测**只验证 webPage 资源接口与 Scene 会话：

```powershell
node /script/scene-custom-page-resource.mjs list [--prefix <path>]
```

- `ok:true`：进入统一纳管模式，不再提醒用户人工确认 CDP 版本。
- HTTP `404` / `405` 或协议不匹配：webPage 资源能力不可用，让用户选择升级后重试或旧版非托管模式。
- 会话无效、`401` / `403`、网络错误、超时、`5xx`：暂停整批，不降级，也不用 CLI 重新探测。

helper 只提供两个操作，`list` 之外的上传也走它：

```powershell
node /script/scene-custom-page-resource.mjs upload --file <local-file> [--resource-path <path>] [--overwrite]
```

`--overwrite` 与 CLI 的 `overwrite` 语义一致，Scene 侧不额外要求人工确认。helper 不做登录、导出、导入、资源分类、manifest 写入和重试调度；机械校验仍用 `/script/validate-page-resources.mjs`。接口 method、path、字段与会话头以 `custom-page-resource-contract.json`（由 `panelx-http-api` 的 catalog 生成，勿手改）为准。

### 统一纳管模式

继续下方的 list、复用、上传、唯一 manifest 与托管校验流程（Scene 分支的 list/upload 用上面的 helper，其余步骤相同）。交付时提醒：请确认 CDP ≥ 1.20.0，且 webPage ≥ 1.4.2 的资源接口已验证可用。

### 旧版非托管模式

不上传、不写 manifest，第三方静态资源可按旧方式引用。执行：

```powershell
node skills/generating-votafoundry-single-pages/scripts/validate-page-resources.mjs --legacy-unmanaged index.html
```

Scene 分支下校验器路径为 `/script/validate-page-resources.mjs`，参数相同。

交付时说明：该模式不保证统一迁移、内网离线部署和平台依赖分析。

## 三、一个页面 = 一个批次（统一纳管模式）

同一页面的资源**作为一个批次**处理，顺序执行，不做并发：

1. **发现**：静态扫描 HTML/CSS 的引用 —— `link[href]`、`src`、`srcset`、`poster`、`data`、样式表里的 `url()` / `@import`。**JS 不解析**：静态可知的 JS 路径由你**手工列出**并纳入本批次。
2. **分类**：按上表剔除系统资源与内联/服务 URL；第三方静态资源先下载，连同其依赖闭包一起作为业务资源。
3. **一次完整 list**：调用 Scene helper 的完整 `list`（分页取全量，不要截断），拿到服务器现有资源及其 `etag`。
4. **自主决定复用**：**复用是可选决策**，不是看到同名或兼容 `etag` 就必须复用。根据页面需求、内容/版本、依赖闭包和路径语义自行判断；决定复用时，必须确认内容与 `etag` 兼容。CSS/JS/HTML/SVG 的闭包内任一文件变化时不能半复用；决定不复用则分配无碰撞的新 `resourcePath` 并上传整组。
5. **分配 resourcePath**：可读、无碰撞（不要撞上服务器上别的资源），相对页面根，Unicode/空格原样写，不要 `%` 编码。
6. **顺序上传**缺失文件：逐个上传，**不覆盖**已有资源。
7. **收集结果**：只收集**上传成功**返回的最终路径。
8. **一次性写 HTML + manifest**：manifest 只列成功落地的业务路径。
9. **再 list/校验一次**：确认服务器侧与 manifest 一致。

## 四、manifest 写法（统一纳管模式）

```html
<script type="application/json" data-cdp-internal-resources>{"version":1,"resources":["图片/背景 图.png","assets/app.css"]}</script>
```

- 每个受管页面**恰好一个**；`{"version":1,"resources":[]}`（空数组）表示该页没有业务资源，合法。
- 路径相对**页面根**，原样可读（Unicode/空格），无 `./` `..` 段，无重复，不得是根绝对路径或 URL。
- 条目可以是路径字符串，也可以是含 `resourcePath` 的对象（例如附带 `etag`）。
- 页面里引用的每个业务路径都必须能在 manifest 中找到；只被 JS 动态拼接的路径不在静态校验范围内，因此必须由你手工列进 manifest。

## 五、错误语义（统一纳管模式）

- **单文件冲突 / 载荷过大**：跳过该文件，其余**独立**文件继续；本轮结束后把失败文件放进**下一轮**重试。不在客户端加第二个 64MiB 上限——服务端载荷限制是唯一真源。
- **系统级错误**（鉴权失效、5xx、网络中断等）：**暂停整批**，不要继续上传，也不要写 manifest。
- 不写死错误文案：按服务端的 **HTTP 状态 + 结构化错误字段** 判断，不做字符串精确匹配。
- 不做强制并发 / 自动重试引擎，也不做运行期错误 UI。

## 六、accessPath

`accessPath` 只是**检查用**数据（人工核对服务器上落地的资源）。**永远不要**把它写进 HTML、CSS、JS 或 manifest。

## 七、校验（统一纳管模式）

```powershell
node skills/generating-votafoundry-single-pages/scripts/validate-page-resources.mjs index.html assets/app.css
```

静态检查：恰好一个 manifest；manifest 路径规范且无重复；HTML/CSS 引用的业务路径都在 manifest 中；第三方静态 CDN URL、根绝对业务引用、逃出受管根的 `..`、非法百分号编码一律拒绝；系统资源与 data/blob URL 不参与校验，也不得进入 manifest。

> `srcset` 按空白分词，因此**引用**里的空格必须按规范写 `%20`（manifest 里的路径仍写原样空格）——这正是"接受已有正确百分号编码引用"的由来。
