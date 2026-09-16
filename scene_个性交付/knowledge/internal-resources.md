# 内部资源（custom page internal resources）生成期工作流

页面里除宿主提供的系统资源之外的**业务资源**（图片、字体、自定义 CSS/JS、SVG 等），统一走「内部资源」：上传后在页面里用**恰好一个** manifest 声明。

> **鉴权前置**：登录、鉴权、请求头、接口地址一律按 `panelx-http-api` 技能执行，本文件不重复其步骤。

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

## 二、一个页面 = 一个批次

同一页面的资源**作为一个批次**处理，顺序执行，不做并发：

1. **发现**：静态扫描 HTML/CSS 的引用 —— `link[href]`、`src`、`srcset`、`poster`、`data`、样式表里的 `url()` / `@import`。**JS 不解析**：静态可知的 JS 路径由你**手工列出**并纳入本批次。
2. **分类**：按上表剔除系统资源与内联/服务 URL；第三方静态资源先下载，连同其依赖闭包一起作为业务资源。
3. **一次完整 list**：调用一次完整的 `custom-page-resource list`（分页取全量，不要截断），拿到服务器现有资源及其 `etag`。
4. **etag 复用**：只有内容与 `etag` 兼容才复用已有内容。CSS/JS/HTML/SVG 存在**依赖闭包**：闭包内任一文件变化就不能半复用，整组重传。其余一律按「缺失」处理。
5. **分配 resourcePath**：可读、无碰撞（不要撞上服务器上别的资源），相对页面根，Unicode/空格原样写，不要 `%` 编码。
6. **顺序上传**缺失文件：逐个上传，**不覆盖**已有资源。
7. **收集结果**：只收集**上传成功**返回的最终路径。
8. **一次性写 HTML + manifest**：manifest 只列成功落地的业务路径。
9. **再 list/校验一次**：确认服务器侧与 manifest 一致。

## 三、manifest 写法

```html
<script type="application/json" data-cdp-internal-resources>{"version":1,"resources":["图片/背景 图.png","assets/app.css"]}</script>
```

- 每个受管页面**恰好一个**；`{"version":1,"resources":[]}`（空数组）表示该页没有业务资源，合法。
- 路径相对**页面根**，原样可读（Unicode/空格），无 `./` `..` 段，无重复，不得是根绝对路径或 URL。
- 条目可以是路径字符串，也可以是含 `resourcePath` 的对象（例如附带 `etag`）。
- 页面里引用的每个业务路径都必须能在 manifest 中找到；只被 JS 动态拼接的路径不在静态校验范围内，因此必须由你手工列进 manifest。

## 四、错误语义

- **单文件冲突 / 载荷过大**：跳过该文件，其余**独立**文件继续；本轮结束后把失败文件放进**下一轮**重试。不在客户端加第二个 64MiB 上限——服务端载荷限制是唯一真源。
- **系统级错误**（鉴权失效、5xx、网络中断等）：**暂停整批**，不要继续上传，也不要写 manifest。
- 不写死错误文案：按服务端 **HTTP 状态 + message** 自行判断，不做字符串精确匹配。
- 不做强制并发 / 自动重试引擎，也不做运行期错误 UI。

## 五、accessPath

`accessPath` 只是**检查用**数据（人工核对服务器上落地的资源）。**永远不要**把它写进 HTML、CSS、JS 或 manifest。

## 六、校验

```powershell
node skills/generating-votafoundry-single-pages/scripts/validate-page-resources.mjs index.html assets/app.css
```

静态检查：恰好一个 manifest；manifest 路径规范且无重复；HTML/CSS 引用的业务路径都在 manifest 中；第三方静态 CDN URL、根绝对业务引用、逃出受管根的 `..`、非法百分号编码一律拒绝；系统资源与 data/blob URL 不参与校验，也不得进入 manifest。

> `srcset` 按空白分词，因此**引用**里的空格必须按规范写 `%20`（manifest 里的路径仍写原样空格）——这正是"接受已有正确百分号编码引用"的由来。
