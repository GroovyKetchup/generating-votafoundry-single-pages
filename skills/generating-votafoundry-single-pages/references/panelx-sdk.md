# PanelX SDK 开发文档

## 简介

PanelX SDK
        是一个功能强大的网页交互开发工具包，提供了完整的API接口封装和用户认证管理功能。由 CDP 宿主注入，通过全局构造器 `PanelXSdk` / `PanelXSdkProxy` 访问。

## 快速开始

### 1. 引入SDK

PanelX SDK（`PanelXSdk` / `PanelXSdkProxy`）统一由 CDP 宿主注入，通过 `window.semApp.panelXSdk` 或全局构造器 `PanelXSdk` / `PanelXSdkProxy` 访问。交付 HTML **禁止**通过 script src、本地脚本或 preload 动态加载。

- ❌ 禁止用 preload 加载器或开发环境下载参数加载 PanelX SDK。
- ❌ 禁止用 script 标签的 `src` 属性外链或本地引入 PanelX SDK。
- ✅ 宿主注入后直接从既有全局构造器初始化。

#### 示例：完整的 HTML 页面

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>PanelX SDK 示例</title>
</head>
<body>
    <h1>PanelX SDK 示例</h1>
    
    <script>
        // SDK 由 CDP 宿主注入，直接从既有全局构造器初始化
        const sdk = new PanelXSdk({
            busDomainCode: 'TODO',
            appCode: 'TODO',
            sessionType: 'login'   // 'login' 独立登录（默认）/ 'inherit' 继承会话
        });
    </script>
</body>
</html>
```

### 2. 初始化SDK

**🎯 智能环境检测**

SDK 会自动检测当前运行环境并获取 API 地址，无需手动配置 baseUrl：

#### 生产环境（域名或IP地址）

SDK 自动从当前 URL 解析 baseUrl，无需配置 `devDefaultBaseUrl`：

```javascript
// 生产环境示例
const sdk = new PanelXSdk({
    busDomainCode: 'TODO',     // 必需:业务域代码
    appCode: 'TODO',           // 可选(强烈推荐):应用编码,用于区分同域不同应用的token/userInfo存储,避免冲突
    sessionType: 'login'       // 可选:'login'(默认,持久登录,localStorage) | 'inherit'(继承会话,sessionStorage)
});
```

#### 本地开发环境（localhost、127.0.0.1、file://）

必须提供 `devDefaultBaseUrl` 参数，指向实际的开发服务器地址：

```javascript
// 本地开发环境示例
const sdk = new PanelXSdk({
    devDefaultBaseUrl: 'http://dev.xxx.com',  // 本地开发时必填
    busDomainCode: 'TODO',     // 必需:业务域代码
    appCode: 'TODO',           // 可选(强烈推荐):应用编码,用于区分同域不同应用的token/userInfo存储,避免冲突
    sessionType: 'login'       // 可选:'login'(默认) | 'inherit'
});
```

> **注意：**
> **提示：**本地开发环境未提供 `devDefaultBaseUrl`、或 `busDomainCode` 缺失时，SDK 会在构造期抛错（同步 throw）。请用 `try / catch` 捕获并自行渲染错误提示。


> **警告：**
> **关于 sessionType：**它决定 SDK 实例使用哪种登录方式 **和** token 存到哪里——一旦确定无法切换。两种模式互不兼容、互不兼顾：

> - `'login'`（默认）— 独立登录模式，调用 `sdk.user.login()`，token / userInfo 写 **localStorage**，关 tab 仍保留（持久会话）。**不能**调 `inheritSession()`。
> - `'inherit'` — 换票/嵌入模式，调用 `sdk.inheritSession({ sourceToken, sourceBusDomainCode })`，token / userInfo 写 **sessionStorage**，关 tab 即清（换票会话）。**不能**调 `login()`。
> - 同一应用同时需要两种来源？创建两个 SDK 实例分别配置即可。


### 3. 两种登录方式

SDK 通过 `sessionType` 决定使用哪种登录方式。**一个实例只支持一种**，错误模式调用会抛错。

#### 方式 A：独立登录（sessionType: 'login'）

用户在**本应用内**用账号密码登录。token 写 `localStorage`，跨 tab 共享、关浏览器仍保留。

```javascript
const sdk = new PanelXSdk({
    busDomainCode: 'TODO',
    appCode: 'TODO',
    sessionType: 'login'   // 显式声明（也可省略，默认就是 'login'）
});

// 登录
try {
    const result = await sdk.user.login({
        userName: 'admin',
        password: '123456'
    });
    console.log('登录成功:', result.user);
    // SDK 已自动把 token / userInfo 写入 localStorage
} catch (err) {
    console.error('登录失败:', err.message);
}

// 之后业务调用
const data = await sdk.api.queryFormDataList({
    panelCode: 'TODO_IML_00061',
    condition: null,
    pageNo: 1,
    pageSize: 10
});
```

#### 方式 B：继承会话（sessionType: 'inherit' / 自动继承 sessionSourceSdk）

子应用嵌入到父应用 iframe / 外链时，**不弹本应用登录表单**，而是用父应用提供的 `sourceToken` 向后端换取本应用 token。token 写 `sessionStorage`，关 tab 即清。

**推荐：自动继承**——构造目标 SDK 时传入 `sessionSourceSdk`（源 SDK 实例）。构造后自动换票，并监听源 SDK 登录 / 重登 / Token 更新 / 业务域变化 / 退出事件主动重新换票；宿主无需手动维护换票判断：

```javascript
// 源 SDK（父应用 / 同页其他实例，通常 sessionType: 'login'）
const sourceSdk = new PanelXSdk({
    busDomainCode: 'SOURCE_DOMAIN',
    appCode: 'TODO',
});

// 目标 SDK（自动继承；构造后立即启动换票）
const sdk = new PanelXSdk({
    busDomainCode: 'TODO',
    appCode: 'TODO',
    sessionSourceSdk: sourceSdk,   // 与 sessionType 互斥，存在时内部固定为 'inherit'
});

// 业务请求无需承担首次换票职责；需要时显式等待初始化完成
await sdk.ready();
const data = await sdk.api.getFormDataList(...);
```

不使用 `sessionSourceSdk` 的显式换票模式（bootstrap 用 `isInheritedFromContext` 守门）：

```javascript
const sdk = new PanelXSdk({
    busDomainCode: 'TODO',
    appCode: 'TODO',
    sessionType: 'inherit'   // 必须显式声明
});

async function bootstrap(sourceToken, sourceBusDomainCode) {
    if (!sourceToken || !sourceBusDomainCode) {
        showLogin();
        return;
    }
    if (sdk.isInheritedFromContext({ sourceToken, sourceBusDomainCode })) {
        // 本地 session 仍源自当前来源上下文，零网络请求直接进页面
        enterPage();
        return;
    }
    try {
        await sdk.inheritSession({ sourceToken, sourceBusDomainCode });
        enterPage();
    } catch (err) {
        // err instanceof InheritSessionError
        // err.reason: 'wrong_session_type' | 'invalid_session_source' | 'sdk_destroyed' | 'no_source_token' | 'no_source_bus_domain_code'
        //           | 'source_token_invalid' | 'cross_user_model' | 'user_not_found' | 'app_not_found'
        //           | 'network_error' | 'unknown'
        console.warn('继承会话失败:', err.reason, err.message);
        showLogin();
    }
}

// sourceToken 与 sourceBusDomainCode 通常由父应用通过 postMessage / URL 参数 / 全局变量等方式注入
bootstrap(getSourceTokenFromHost(), getSourceBusDomainCodeFromHost());
```

> **注意：**
> **怎么选？**

> - 独立部署、用户在本应用做账号密码登录 → `'login'`
> - 嵌入到 GPF / 父应用、用父应用 token 换本应用 token → `'inherit'`
> - 同一应用既要支持独立访问也要支持嵌入访问？创建两个 SDK 实例


## 核心API参考

以下是SDK的完整API参考文档，包含所有方法的详细参数、返回值和使用示例。

#### sdk.user.login

### 认证相关

#### sdk.user.login

**描述：**用户登录（登录成功后会自动保存 token 和用户信息到 `localStorage`）。失败时会抛出错误，需要用 try-catch 捕获。**要求 `sessionType='login'`**：在 `'inherit'` 实例上调用会报错，请改用 `inheritSession()`。严格隔离：login 会话（localStorage）与换票会话（sessionStorage）互不兼容、互不兼顾。

**参数：**

- `payload` (Object) [必需]: 登录参数对象
  - `userName` (string) [必需]: 用户名（注意大小写）
  - `password` (string) [必需]: 密码

**返回值：**`JSON`

返回对象结构：

```javascript
{
  token: string, // JWT令牌
  user: Object, // 用户信息对象，包含id、name、phone、userName等字段
}
```

**示例：**▶ 点击展开

```javascript
// 用户登录
try {
    const result = await sdk.user.login({
        userName: 'admin',  // 注意是 userName，不是 username
        password: '123456'
    });
    
    console.log('登录成功');
    console.log('Token:', result.token);
    console.log('用户信息:', result.user);
    // SDK会自动保存token和用户信息到localStorage
} catch (error) {
    // 错误会包含后台返回的具体错误信息
    console.error('登录失败:', error.message);
    // 例如：用户不存在、密码错误等
}
```

#### sdk.inheritSession

**描述：**继承会话（动作原语）：用调用方提供的源应用 token 与源业务域向后端 /wp-core/api/user/exchangeToken 换取本应用 token，并写入 `sessionStorage`。**要求 `sessionType='inherit'`**：在 `'login'` 实例上调用会抛 `InheritSessionError('wrong_session_type')`，避免误把换票会话写到持久登录 scope。**纯动作语义**：每次调用必发请求、必覆写 storage；本方法不做幂等守卫。成功后会自动刷新自动继承状态机，避免下一请求重复换票。**推荐做法**：使用自动继承——构造目标 SDK 时传入 `sessionSourceSdk`，构造后自动换票并监听源会话变化，宿主无需手动调用本方法（本方法保留为诊断/测试/无来源场景的动作原语）。Bootstrap 场景（未使用自动继承时）请先用 `isInheritedFrom(sourceToken)` 或 `isInheritedFromContext()` 守门——false 才调本方法（参考下方示例）。成功后写 `sessionStorage`（换票会话作用域，关 tab 即清）：token → userInfo → v2 来源记录（仅指纹与域，不存完整源 Token）；严格隔离，不跨场读写同应用的持久登录 `localStorage`。失败统一抛 InheritSessionError（reason / message / state）。sourceToken 与 sourceBusDomainCode 均由调用方自行从宿主获取（postMessage / URL 参数 / 父应用注入等），SDK 不再自动扫描 storage；目标域由当前 SDK 实例的 busDomainCode 决定，不得用其兜底源业务域。

**参数：**

- `options` (Object) [必需]: 继承参数对象
  - `sourceToken` (string) [必需]: 源应用 token（必填）。由调用方自行从宿主获取；空字符串/缺省将抛 InheritSessionError("no_source_token")。
  - `sourceBusDomainCode` (string) [必需]: 源业务域代码（必填）。源 token 所属业务域，由调用方与 sourceToken 一起提供；去除首尾空白后为空将抛 InheritSessionError("no_source_bus_domain_code")，不发请求。

**返回值：**`Promise`

返回对象结构：

```javascript
{
  token: string, // 本应用 token，已写入 sessionStorage
  user: Object, // 用户信息对象，与 login 接口的 user 字段同形态
}
```

**返回对象样例：**▶ 点击展开

```javascript
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "userId": "SdkTest_User_admin",
    "name": "admin",
    "fullName": "admin",
    "appCode": "SdkTest"
  }
}
```

**示例：**▶ 点击展开

```javascript
// ============================================================
// 推荐 bootstrap 模式（嵌入应用启动）
// ============================================================
// ❌ 错误写法（典型坑）：在嵌入模式下用 isAuthenticated() 当登录权威
//    父切用户后子仍展示旧用户数据
//
// if (sdk.user.isAuthenticated()) enterPage();   // ← 不要这样！
// else await sdk.inheritSession({ sourceToken, sourceBusDomainCode });
//
// ✅ 正确写法：用 isInheritedFrom 守门
async function bootstrap(sourceToken, sourceBusDomainCode) {
    if (sourceToken && sourceBusDomainCode) {
        // —— 嵌入模式 ——
        if (sdk.isInheritedFrom(sourceToken)) {
            // 本地 session 仍源自当前 sourceToken，直接进页面（零网络请求）
            enterPage();
            return;
        }
        // 不匹配（首次进入 / 父切用户 / iframe 重建 / 关 tab 重开）→ 换票
        try {
            await sdk.inheritSession({ sourceToken, sourceBusDomainCode });
            enterPage();
        } catch (e) {
            // e instanceof InheritSessionError
            console.warn('继承会话失败:', e.reason, e.message);
            showLogin();
        }
    } else {
        // —— 独立模式 ——
        if (sdk.user.isAuthenticated()) enterPage();
        else showLogin();
    }
}

// ============================================================
// 错误处理细节
// ============================================================
try {
    await sdk.inheritSession({ sourceToken: tokenFromHost, sourceBusDomainCode: domainFromHost });
} catch (e) {
    // e instanceof InheritSessionError
    switch (e.reason) {
        case 'wrong_session_type':   /* SDK 实例不是 sessionType='inherit'，不允许换票 */ break;
        case 'no_source_token':      /* 调用方契约错误：未传 sourceToken */ break;
        case 'no_source_bus_domain_code': /* 调用方契约错误：未传 sourceBusDomainCode */ break;
        case 'source_token_invalid': /* 源 token 验签失败 / 过期 */ break;
        case 'user_not_found':       /* 源用户在本应用不存在 */ break;
        case 'app_not_found':        /* 本应用 / 源应用 / 业务域不存在 */ break;
        case 'network_error':        /* 网络异常 */ break;
        default:                     /* unknown */
    }
}

// 失败原因映射（来自后端 RespondDto.msg 关键字）：
// '源token...'                   → 'source_token_invalid'
// '不属于同一用户模型'             → 'cross_user_model'（后端已放开，future-proof 保留）
// '用户在本应用的用户模型中不存在'   → 'user_not_found'
// '不存在业务域' / '应用...不存在'  → 'app_not_found'
// 网络异常                       → 'network_error'
// 其他                          → 'unknown'

// ============================================================
// 存储作用域说明（严格隔离）
// ============================================================
// SDK 实例初始化时的 sessionType 决定唯一存储后端，不做 cross-scope fallback：
//
//   sessionType: 'login'   → login()           只读写 localStorage   （持久会话）
//   sessionType: 'inherit' → inheritSession()  只读写 sessionStorage （换票会话）
//
// 两类实例不互相兼容：
// - login() 在 'inherit' 实例上调用 → reject
// - inheritSession() 在 'login' 实例上调用 → throw InheritSessionError('wrong_session_type')
// - getToken / getUserInfo / isAuthenticated 均只看本实例 sessionType 对应的 scope
//
// 同一应用同时需要两种会话来源？创建两个 SDK 实例分别配置：
//   const loginSdk   = new PanelXSdk({ ..., sessionType: 'login' });
//   const inheritSdk = new PanelXSdk({ ..., sessionType: 'inherit' });
//
// isInheritedFrom 持久化机制（v2）：
//   换票成功后写入 sessionStorage 的
//   `${busDomainCode}_${appCode}_inherit_source_record` 键（v2 来源记录：仅 SHA-256 指纹 + 源域 + 目标域，不存完整源 Token）。
//   isInheritedFrom 计算传入 token 的指纹比对；isInheritedFromContext 额外校验源域与目标域。
```

#### sdk.isInheritedFrom

**描述：**当前会话是否继承自指定 sourceToken（查询原语，**deprecated**）。与 `inheritSession` 词根对应：问“我是从这个 token 继承来的吗？”。**纯查询，无 I/O，无副作用**——只读 `sessionStorage`，不发请求、不改 storage。**已弃用**：仅校验源 Token 指纹，无法区分源域/目标域；新代码请使用 `isInheritedFromContext({ sourceToken, sourceBusDomainCode })`。**仅在 `sessionType='inherit'` 实例上有意义**：`'login'` 实例直接返回 false（持久登录会话不可能“继承自”某个 sourceToken）。判定基于 v2 来源记录（sessionStorage 中 `${scope}_inherit_source_record`）：计算传入 token 的 SHA-256 指纹与记录比对。相对 isAuthenticated() 的额外保障：父应用切换用户后 sourceToken 变化 → 指纹不匹配 → 返回 false → 触发重换。判定条件（全部成立才返回 true）：(1) sessionType === 'inherit'；(2) 传入 sourceToken 非空；(3) 本地已认证（isAuthenticated）；(4) sessionStorage 中持久化的 source token 与传入完全一致。

**参数：**

- `sourceToken` (string) [必需]: 待校验的源 token。为空字符串直接返回 false。

**返回值：**`boolean`

返回对象结构：

```javascript
{
  value: boolean, // true 当且仅当三个判定条件全部成立
}
```

**示例：**▶ 点击展开

```javascript
// 换票子应用 bootstrap 推荐模板（该实例初始化时 sessionType: 'inherit'）
async function bootstrap(sourceToken, sourceBusDomainCode) {
    if (!sourceToken || !sourceBusDomainCode) {
        // 该实例作为 'inherit' 使用；sourceToken / sourceBusDomainCode 为空 → 不能走换票，跳登录页
        return showLogin();
    }
    if (sdk.isInheritedFrom(sourceToken)) {
        // 本地 session 仍源自当前 sourceToken，复用
        return enterPage();
    }
    // 需要换票
    try {
        await sdk.inheritSession({ sourceToken, sourceBusDomainCode });
        enterPage();
    } catch (e) {
        // e instanceof InheritSessionError；wrong_session_type 表示本实例不是 'inherit' 配置
        showLogin();
    }
}

// 为什么不直接用 isAuthenticated()？
// 因为 isAuthenticated() 只检查“当前 sessionType 对应 scope 有 token”，不感知 token 是从哪个 source 来的。
// 父应用切换用户后：
//   sdk.user.isAuthenticated()              // === true（sessionStorage 仍有旧 sourceToken 换出的 token）
//   sdk.isInheritedFrom(newSourceToken)     // === false（持久化的 source ≠ 新 source）
// 用 isInheritedFrom 才能正确触发换票。

// isInheritedFrom 命中场景（不触发网络请求）：
//   - 子应用内部跳转 / 刷新
//   - 父应用销毁并重建子 iframe（同 tab，sessionStorage 仍在）
//   - 同 sourceToken 重复 bootstrap

// isInheritedFrom 不命中场景（触发 inheritSession）：
//   - 首次进入
//   - 父应用切换用户（sourceToken 变化）
//   - 关闭 tab 后重新打开（sessionStorage 已清）
//   - 调用方手动 sdk.user.logout() 后
//   - 本实例 sessionType 不是 'inherit'（此时 isInheritedFrom 恒返回 false）
```

#### sdk.user.logout

**描述：**用户登出。严格按 sessionType 清理，不跨 scope：`'login'` 实例仅清 `localStorage`中本 scope 的 token / userInfo；`'inherit'` 实例仅清 `sessionStorage`中本 scope 的 token / userInfo / source key。不会误伤同应用另一个 SDK 实例的会话。

**参数：**无

**返回值：**`void`

**示例：**▶ 点击展开

```javascript
// 用户登出（语义随 sessionType 变化）
sdk.user.logout();
console.log('已登出');
```

#### sdk.user.getUserInfo

**描述：**获取当前登录用户信息。仅读本实例 sessionType 对应的 scope：`sessionType='login'` → `localStorage`；`sessionType='inherit'` → `sessionStorage`。不做 cross-scope fallback。

**参数：**无

**返回值：**`Object | null`

返回对象结构：

```javascript
{
  id: string, // 用户ID
  name: string, // 用户名称
  fullName: string, // 用户全名
  raw: Object, // 原始用户信息对象，包含完整的用户数据
}
```

**返回对象样例：**▶ 点击展开

```javascript
{
  "id": "SdkTest_User_admin",
  "name": "admin",
  "fullName": "admin",
  "raw": {
    "appCode": "SdkTest",
    "userId": "SdkTest_User_admin",
    "name": "admin",
    "fullName": "admin",
    "clientIp": "116.23.216.229",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
    "sessionId": "node0110mgoeunabj211nrectwm87we437",
    "expireMilliSec": 2592000000
  }
}
```

**示例：**▶ 点击展开

```javascript
// 获取用户信息
const userInfo = sdk.user.getUserInfo();
if (userInfo) {
    console.log('当前用户:', userInfo.name);
    console.log('用户ID:', userInfo.id);
    console.log('用户全名:', userInfo.fullName);
    console.log('原始用户信息:', userInfo.raw);
    // 访问原始数据中的其他字段
    console.log('客户端IP:', userInfo.raw.clientIp);
    console.log('会话ID:', userInfo.raw.sessionId);
} else {
    console.log('用户未登录');
}
```

#### sdk.user.isAuthenticated

**描述：**检查用户是否已登录。仅检查本实例 sessionType 对应的 scope：`'login'` 看 localStorage；`'inherit'` 看 sessionStorage。**不能用作换票子应用 bootstrap 的唯一守门**——父应用切用户后本值仍为 true 但 sourceToken 已变，请用 `isInheritedFrom(sourceToken)`。

**参数：**无

**返回值：**`boolean`

**示例：**▶ 点击展开

```javascript
// 检查登录状态
if (sdk.user.isAuthenticated()) {
    console.log('用户已登录');
} else {
    console.log('用户未登录');
}
```

### 数据查询

#### sdk.api.queryFormDataList

**描述：**查询表单数据列表（支持分页）

**参数：**

- `payload` (Object) [必需]: 查询参数对象
  - `panelCode` (string) [必需]: 面板编号
  - `condition` (Object) [可选]: 查询条件对象
  - `advancedConditions` (Object) [可选]: Prisma Where 风格高级过滤条件，string key 对象。支持字段等值（{ status: "active" }）、比较（gt/gte/lt/lte）、列表（in/notIn）、模糊匹配（contains/startsWith/endsWith）、空值判断（isNull 或 null）以及 AND/OR/NOT 逻辑组合；同一对象内多个字段默认为 AND。可与 condition 同时使用，最终按 AND 组合。
  - `pageNo` (number) [可选]: 页码，默认1
  - `pageSize` (number) [可选]: 每页大小，默认20
  - `eventName` (string) [可选]: 事件名称
  - `keyword` (string) [可选]: 模糊搜索的关键字
  - `orderBy` (Array) [可选]: 排序规则数组，每项包含 fieldName（字段名）和 order（排序方向：asc/desc，默认asc）
  - `options` (Object) [可选]: 可选配置对象
    - `includeFields` (Array) [可选]: 需要包含的字段名数组（只返回这些字段）
    - `excludeFields` (Array) [可选]: 需要排除的字段名数组（不返回这些字段）

**返回值：**`JSON`

返回对象结构：

```javascript
{
  state: string, // 状态码，成功为"200"
  msg: string, // 消息
  data: Object, // 返回数据
    list: Array<Object>, // 数据列表数组
    privilege: Array<Object>, // 权限列表数组
    totalSize: number, // 总记录数
}
```

**返回对象样例：**▶ 点击展开

```javascript
{
  "state": "200",
  "data": {
    "totalSize": 6,
    "list": [
      {
        "输入1": "aaa_222",
        "测试流程状态": "审批",
        "编号": "8ca462f7_433e_4123_b6c1_2cc9fbf80740"
      },
      {
        "输入1": "aaa_111",
        "输入2": "admin_aaa_111",
        "测试流程状态": "发起",
        "编号": "164bba2b_91d6_42ec_a8f8_56f3aeab1c1e"
      },
      {
        "输入1": "admin_111",
        "测试流程状态": "结束",
        "编号": "27257414_0952_4ea9_986c_3360ec1ac866"
      }
    ]
  }
}
```

**示例：**▶ 点击展开

```javascript
// 查询列表数据（带分页和条件）
const result = await sdk.api.queryFormDataList({
    panelCode: 'PANEL_001',
    condition: { status: 1, type: 'active' },
    advancedConditions: {
        AND: [
            { age: { gte: 18, lte: 65 } },
            {
                OR: [
                    { status: { in: ['active', 'pending'] } },
                    { role: 'admin' }
                ]
            },
            { deletedAt: { isNull: true } }
        ],
        name: { contains: '张三' }
    },
    eventName: 'customQuery',
    keyword: '搜索关键字',
    pageNo: 1,
    pageSize: 20,
    orderBy: [
        { fieldName: 'name', order: 'desc' },
        { fieldName: 'bbb' }  // 不指定order时默认为asc
    ]
});

if (result.state === '200') {
    const list = result.data.list;
    const total = result.data.totalSize;
    console.log(`共 ${total} 条数据，当前页 ${list.length} 条`);
    list.forEach(item => {
        console.log(item);
    });
}

// advancedConditions 常用写法
await sdk.api.queryFormDataList({
    panelCode: 'PANEL_001',
    advancedConditions: {
        createTime: { gte: '2024-01-01', lt: '2025-01-01' }, // 范围查询
        price: { gt: 100, lte: 500 },                        // 比较查询
        status: { in: ['active', 'pending'] },               // IN 查询
        name: { contains: '手机' },                           // LIKE '%手机%'
        deletedAt: null                                      // 等价于 IS NULL
    }
});

// 使用 options 过滤字段
const result2 = await sdk.api.queryFormDataList({
    panelCode: 'PANEL_001',
    pageNo: 1,
    pageSize: 20,
    options: {
        includeFields: ['编号', '名称', '状态'],  // 只返回这三个字段
        // 或者使用 excludeFields: ['备注', '详情'] // 排除某些字段
    }
});
```

#### sdk.api.queryFormData

**描述：**查询单条表单数据（不分页，返回第一条匹配的数据）。

**参数：**

- `payload` (Object) [必需]: 查询参数对象
  - `panelCode` (string) [必需]: 面板编号
  - `condition` (Object) [必需]: 查询条件对象，不可为空对象
  - `options` (Object) [可选]: 可选配置对象
    - `includeFields` (Array) [可选]: 需要包含的字段名数组（只返回这些字段）
    - `excludeFields` (Array) [可选]: 需要排除的字段名数组（不返回这些字段）

**返回值：**`JSON`

返回对象结构：

```javascript
{
  state: string, // 状态码，成功为"200"
  msg: string, // 消息
  data: Object, // 查询结果对象
    list: Array<Object>, // 数据列表，包含表单字段数据
    totalSize: number, // 总记录数 (0 或 1)
}
```

**返回对象样例：**▶ 点击展开

```javascript
{
  "state": "200",
  "data": {
    "totalSize": 1,
    "list": [
      {
        "输入1": "aaa_222",
        "测试流程状态": "审批",
        "编号": "8ca462f7_433e_4123_b6c1_2cc9fbf80740"
      }
    ]
  }
}
```

**示例：**▶ 点击展开

```javascript
// 查询单条数据
const result = await sdk.api.queryFormData({
    panelCode: 'SdkTest_IML_00002',
    condition: { code: '8ca462f7_433e_4123_b6c1_2cc9fbf80740' }
});

if (result.state === '200') {
    console.log('查询到的数据:', result.data);
}

// 使用 options 过滤字段
const result2 = await sdk.api.queryFormData({
    panelCode: 'SdkTest_IML_00002',
    condition: { code: '8ca462f7_433e_4123_b6c1_2cc9fbf80740' },
    options: {
        includeFields: ['编号', '名称', '状态'],  // 只返回这三个字段
        // 或者使用 excludeFields: ['备注'] // 排除某些字段
    }
});
```

#### sdk.api.getRelateDataList

**描述：**获取关联数据列表（用于下拉选择、字典转换等场景）

**参数：**

- `options` (Object) [必需]: 请求参数对象
  - `fieldName` (string) [必需]: 关联字段的中文名称（如"状态"、"类型"）
  - `panelCode` (string) [必需]: 面板编号
  - `extraFieldNames` (Array) [可选]: 额外需要返回的字段名数组（如 ["code", "name"]）
  - `pageNo` (number) [可选]: 页码
  - `pageSize` (number) [可选]: 每页数量
  - `condition` (Object) [可选]: 筛选条件
  - `advancedConditions` (Object) [可选]: Prisma Where 风格高级过滤条件，string key 对象。支持字段等值（{ status: "active" }）、比较（gt/gte/lt/lte）、列表（in/notIn）、模糊匹配（contains/startsWith/endsWith）、空值判断（isNull 或 null）以及 AND/OR/NOT 逻辑组合；同一对象内多个字段默认为 AND。可与 condition 同时使用，最终按 AND 组合。
  - `keyword` (string) [可选]: 搜索关键字

**返回值：**`JSON`

返回对象结构：

```javascript
{
  state: string, // 状态码，成功为"200"
  msg: string, // 消息
  data: Array<Object>, // 关联数据数组，每项包含key、value和extraValue
    key: string, // 关联键值（通常是代码）
    value: string, // 显示值（通常是名称）
    extraValue: Object, // 额外字段对象（如果请求了extraFieldNames）
}
```

**示例：**▶ 点击展开

```javascript
// 获取状态关联数据
const result = await sdk.api.getRelateDataList({
    fieldName: '状态',           // 字段中文名
    panelCode: 'PANEL_001',     // 面板编号
    extraFieldNames: ['code', 'name'], // 需要的额外字段
    advancedConditions: {
        AND: [
            { status: { in: ['active', 'pending'] } },
            { deletedAt: { isNull: true } }
        ],
        name: { contains: '启用' }
    },
    keyword: '启用' // 可选：搜索关键字
});

if (result.state === '200') {
    console.log('关联数据:', result.data);
    
    // 方式1：直接使用key-value
    const statusMap = {};
    result.data.forEach(item => {
        statusMap[item.key] = item.value;
    });
    console.log('映射关系:', statusMap);
    
    // 方式2：使用额外字段
    result.data.forEach(item => {
        console.log(`${item.key}: ${item.value}`, item.extraValue);
    });
} else {
    console.error('获取失败:', result.msg);
}
```

#### sdk.api.getFormData

**描述：**获取表单数据

**参数：**

- `payload` (Object) [必需]: 查询参数对象
  - `panelCode` (string) [必需]: 面板编号
  - `code` (string) [必需]: 数据的编号
  - `options` (Object) [可选]: 可选配置对象
    - `includeFields` (Array) [可选]: 需要包含的字段名数组（只返回这些字段）
    - `excludeFields` (Array) [可选]: 需要排除的字段名数组（不返回这些字段）

**返回值：**`JSON`

返回对象结构：

```javascript
{
  state: string, // 状态码，成功为"200"
  data: Object, // 返回数据
    data: Object, // 表单数据对象
}
```

**返回对象样例：**▶ 点击展开

```javascript
{
  "state": "200",
  "data": {
    "data": {
      "输入1": "aaa_222",
      "测试流程状态": "审批",
      "编号": "8ca462f7_433e_4123_b6c1_2cc9fbf80740"
    }
  }
}
```

**示例：**▶ 点击展开

```javascript
// 获取表单数据
const result = await sdk.api.getFormData({
    panelCode: 'PANEL_001',
    code: 'DATA_CODE_123'
});

if (result.state === '200') {
    const { data } = result.data;
    
    // 使用表单数据
    console.log('表单数据:', data);
    console.log('输入1的值:', data['输入1']);
} else {
    console.error('获取表单数据失败:', result.msg);
}

// 使用 options 过滤字段
const result2 = await sdk.api.getFormData({
    panelCode: 'PANEL_001',
    code: 'DATA_CODE_123',
    options: {
        includeFields: ['输入1', '输入2'],  // 只返回这两个字段
        // 或者使用 excludeFields: ['编号'] // 排除编号字段
    }
});
```

### 权限查询

#### sdk.api.getPermMatrix

**描述：**获取面板的权限矩阵（用于判断当前用户对面板的操作权限）

**参数：**

- `payload` (Object) [必需]: 查询参数对象
  - `panelCode` (string) [必需]: 面板编号

**返回值：**`JSON`

返回对象结构：

```javascript
{
  state: string, // 状态码，成功为"200"
  data: Object, // 返回数据
    privilege: Object, // 权限对象
      actionPrivileges: Array<Object>, // 操作权限列表，每项包含 { name, visible, operatable }
      fieldPrivileges: Array<Object>, // 字段权限列表
      groupPrivileges: Array<Object>, // 分组权限列表
}
```

**返回对象样例：**▶ 点击展开

```javascript
{
  "state": "200",
  "data": {
    "privilege": {
      "actionPrivileges": [
        {
          "name": "新增流程",
          "visible": true,
          "operatable": true
        },
        {
          "name": "按钮1",
          "visible": true,
          "operatable": false
        },
        {
          "name": "按钮2",
          "visible": false,
          "operatable": false
        },
        {
          "name": "按钮3",
          "visible": true,
          "operatable": true
        }
      ],
      "fieldPrivileges": [],
      "groupPrivileges": []
    }
  }
}
```

**示例：**▶ 点击展开

```javascript
// 获取面板的权限矩阵
const result = await sdk.api.getPermMatrix({
    panelCode: 'PANEL_001'
});

if (result.state === '200') {
    const privilege = result.data.privilege;
    
    // 遍历操作权限
    privilege.actionPrivileges.forEach(action => {
        console.log(`操作: ${action.name}, 可见: ${action.visible}, 可操作: ${action.operatable}`);
        // 根据权限控制按钮显示
        if (action.visible && action.operatable) {
            // 显示按钮
            console.log(`可用操作: ${action.name}`);
        }
    });
} else {
    console.error('获取权限失败:', result.msg);
}
```

#### sdk.api.getFormPermMatrix

**描述：**获取表单数据的权限矩阵（用于判断当前用户对特定数据的操作权限）

**参数：**

- `payload` (Object) [必需]: 查询参数对象
  - `panelCode` (string) [必需]: 面板编号
  - `code` (string) [必需]: 数据的编号

**返回值：**`JSON`

返回对象结构：

```javascript
{
  state: string, // 状态码，成功为"200"
  data: Object, // 返回数据
    privilege: Object, // 权限对象
      actionPrivileges: Array<Object>, // 操作权限列表，每项包含 { name, visible, operatable }
      fieldPrivileges: Array<Object>, // 字段权限列表，每项包含 { field, fieldName, visible, writable }
      groupPrivileges: Array<Object>, // 分组权限列表
}
```

**返回对象样例：**▶ 点击展开

```javascript
{
  "state": "200",
  "data": {
    "privilege": {
      "actionPrivileges": [
        {
          "name": "不通过",
          "visible": true,
          "operatable": true
        },
        {
          "name": "通过",
          "visible": true,
          "operatable": true
        },
        {
          "name": "提交",
          "visible": false,
          "operatable": false
        }
      ],
      "fieldPrivileges": [
        {
          "field": "shu1Ru42",
          "visible": true,
          "writable": true,
          "fieldName": "输入2"
        },
        {
          "field": "shu1Ru41",
          "visible": true,
          "writable": false,
          "fieldName": "输入1"
        }
      ],
      "groupPrivileges": []
    }
  }
}
```

**示例：**▶ 点击展开

```javascript
// 获取表单数据的权限矩阵
const result = await sdk.api.getFormPermMatrix({
    panelCode: 'PANEL_001',
    code: 'DATA_CODE_123'
});

if (result.state === '200') {
    const privilege = result.data.privilege;
    
    // 遍历操作权限
    privilege.actionPrivileges.forEach(action => {
        console.log(`操作: ${action.name}, 可见: ${action.visible}, 可操作: ${action.operatable}`);
        // 根据权限控制按钮显示
        if (action.visible && action.operatable) {
            // 显示按钮
        }
    });
    
    // 遍历字段权限
    privilege.fieldPrivileges.forEach(field => {
        console.log(`字段: ${field.fieldName}, 可见: ${field.visible}, 可写: ${field.writable}`);
        // 根据权限控制字段显示和编辑
        if (field.visible && !field.writable) {
            // 设置字段为只读
        }
    });
} else {
    console.error('获取权限失败:', result.msg);
}
```

#### sdk.api.getNewFormPermMatrix

**描述：**获取新建表单数据的权限矩阵

**参数：**

- `payload` (Object) [必需]: 查询参数对象
  - `panelCode` (string) [必需]: 面板编号
  - `operationName` (string) [必需]: 操作名称

**返回值：**`JSON`

返回对象结构：

```javascript
{
  state: string, // 状态码，成功为"200"
  data: Object, // 返回数据
    privilege: Object, // 权限对象
      actionPrivileges: Array<Object>, // 操作权限列表，每项包含 { name, visible, operatable }
      fieldPrivileges: Array<Object>, // 字段权限列表，每项包含 { field, fieldName, visible, writable }
      groupPrivileges: Array<Object>, // 分组权限列表
}
```

**返回对象样例：**▶ 点击展开

```javascript
{
  "state": "200",
  "data": {
    "privilege": {
      "actionPrivileges": [
        {
          "name": "提交",
          "visible": false,
          "operatable": false
        }
      ],
      "fieldPrivileges": [
        {
          "field": "shu1Ru42",
          "visible": true,
          "writable": true,
          "fieldName": "输入2"
        },
        {
          "field": "shu1Ru41",
          "visible": true,
          "writable": false,
          "fieldName": "输入1"
        }
      ],
      "groupPrivileges": []
    }
  }
}
```

**示例：**▶ 点击展开

```javascript
// 获取表单数据的权限矩阵
const result = await sdk.api.getNewFormPermMatrix({
    panelCode: 'PANEL_001',
    operationName: 'edit'
});

if (result.state === '200') {
    const privilege = result.data.privilege;
    
    // 遍历操作权限
    privilege.actionPrivileges.forEach(action => {
        console.log(`操作: ${action.name}, 可见: ${action.visible}, 可操作: ${action.operatable}`);
        // 根据权限控制按钮显示
        if (action.visible && action.operatable) {
            // 显示按钮
        }
    });
    
    // 遍历字段权限
    privilege.fieldPrivileges.forEach(field => {
        console.log(`字段: ${field.fieldName}, 可见: ${field.visible}, 可写: ${field.writable}`);
        // 根据权限控制字段显示和编辑
        if (field.visible && !field.writable) {
            // 设置字段为只读
        }
    });
} else {
    console.error('获取权限失败:', result.msg);
}
```

#### sdk.api.getFormDescriptor

**描述：**获取表单描述符（包含数据、元数据和权限信息）

**参数：**

- `payload` (Object) [必需]: 查询参数对象
  - `panelCode` (string) [必需]: 面板编号
  - `code` (string) [必需]: 数据的编号
  - `options` (Object) [可选]: 可选配置对象
    - `includeFields` (Array) [可选]: 需要包含的字段名数组（只返回这些字段）
    - `excludeFields` (Array) [可选]: 需要排除的字段名数组（不返回这些字段）

**返回值：**`JSON`

返回对象结构：

```javascript
{
  state: string, // 状态码，成功为"200"
  data: Object, // 返回数据
    data: Object, // 表单数据对象
    meta: Array<Object>, // 表单元数据数组，每项包含字段的配置信息
    privilege: Object, // 权限对象
      actionPrivileges: Array<Object>, // 操作权限列表，每项包含 { name, visible, operatable }
      fieldPrivileges: Array<Object>, // 字段权限列表，每项包含 { field, fieldName, visible, writable }
      groupPrivileges: Array<Object>, // 分组权限列表
}
```

**返回对象样例：**▶ 点击展开

```javascript
{
  "state": "200",
  "data": {
    "data": {
      "输入1": "aaa_222",
      "测试流程状态": "审批",
      "编号": "8ca462f7_433e_4123_b6c1_2cc9fbf80740"
    },
    "meta": [
      {
        "code": "shu1Ru41",
        "name": "输入1",
        "dataType": "Text",
        "isNotNull": false,
        "defaultValue": "",
        "dependFormModel": [],
        "isDependInheritable": false,
        "isAssocMultiSelect": false,
        "override": false
      },
      {
        "code": "ce4Shih4Liou2Cheng2Jhuang4Tai4",
        "name": "测试流程状态",
        "dataType": "Text",
        "isNotNull": false,
        "defaultValue": "",
        "dependFormModel": [],
        "isDependInheritable": false,
        "isAssocMultiSelect": false,
        "override": false
      }
    ],
    "privilege": {
      "actionPrivileges": [
        {
          "name": "不通过",
          "visible": true,
          "operatable": true
        },
        {
          "name": "通过",
          "visible": true,
          "operatable": true
        },
        {
          "name": "提交",
          "visible": false,
          "operatable": false
        }
      ],
      "fieldPrivileges": [
        {
          "field": "shu1Ru41",
          "visible": true,
          "writable": false,
          "fieldName": "输入1"
        }
      ],
      "groupPrivileges": []
    }
  }
}
```

**示例：**▶ 点击展开

```javascript
// 获取表单描述符（包含数据、元数据和权限）
const result = await sdk.api.getFormDescriptor({
    panelCode: 'PANEL_001',
    code: 'DATA_CODE_123'
});

if (result.state === '200') {
    const { data, meta, privilege } = result.data;
    
    // 使用表单数据
    console.log('表单数据:', data);
    console.log('输入1的值:', data['输入1']);
    
    // 遍历元数据
    meta.forEach(field => {
        console.log(`字段: ${field.name}, 类型: ${field.dataType}, 必填: ${field.isNotNull}`);
    });
    
    // 根据权限控制UI
    privilege.actionPrivileges.forEach(action => {
        if (action.visible && action.operatable) {
            // 显示可操作的按钮
            console.log(`可用操作: ${action.name}`);
        }
    });
    
    privilege.fieldPrivileges.forEach(field => {
        if (field.visible && !field.writable) {
            // 设置字段为只读
            console.log(`只读字段: ${field.fieldName}`);
        }
    });
} else {
    console.error('获取表单描述符失败:', result.msg);
}

// 使用 options 过滤字段
const result2 = await sdk.api.getFormDescriptor({
    panelCode: 'PANEL_001',
    code: 'DATA_CODE_123',
    options: {
        includeFields: ['输入1', '输入2'],  // 只返回这两个字段
        // 或者使用 excludeFields: ['编号'] // 排除编号字段
    }
});
```

### 操作调用

#### sdk.api.callEvent

**描述：**调用面板事件（新版）

**参数：**

- `payload` (Object) [必需]: 事件调用参数对象
  - `eventName` (string) [必需]: 事件名称
  - `panelCode` (string) [必需]: 面板编号
  - `eventParam` (Object) [可选]: 事件参数对象

**返回值：**`JSON`

返回对象结构：

```javascript
{
  state: string, // 状态码，成功为"200"
  msg: string, // 消息
  data: any, // 事件返回的数据
}
```

**示例：**▶ 点击展开

```javascript
// 调用面板事件（新版）
const result = await sdk.api.callEvent({
    eventName: 'onRefresh',
    panelCode: 'PANEL_001',
    eventParam: { type: 'manual', filter: 'active' },
});

if (result.state === '200') {
    console.log('事件执行成功:', result.data);
} else {
    console.error('事件执行失败:', result.msg);
}
```

#### sdk.api.callEventStream

**描述：**触发事件（支持 SSE 流式响应）。与 `callEvent` 使用相同端点 `/wp-core/api/callEvent2`，但通过回调方式接收数据。若后端操作函数返回 `Flux`，响应 `Content-Type` 为 `text/event-stream`，前端可逐帧接收；若返回普通 JSON，则退化为单次 `onMessage` 回调后 `onComplete`，调用方无需区分。**不返回 Promise**，结果通过回调异步通知。单对象入参，业务字段和回调写在同一个对象里。

**参数：**

- `options` (Object) [必需]: 事件参数 + SSE 回调（混合在同一对象）
  - `panelCode` (string) [必需]: 面板编号
  - `eventName` (string) [必需]: 事件名称
  - `eventParam` (Object) [可选]: 事件参数对象
  - `onMessage` (Function) [可选]: 每收到一条 SSE 事件时调用。参数 event: { event: string, id?: string, data: any }。event.event 为 SSE 事件名（默认 "message"），event.data 为已解析的 JSON 数据。
  - `onError` (Function) [可选]: 发生错误时调用。参数 err: Error。
  - `onComplete` (Function) [可选]: 流结束时调用（无参数）。

**返回值：**`void`

**示例：**▶ 点击展开

```javascript
// 触发事件（SSE 流式响应）
sdk.api.callEventStream({
    panelCode: 'PANEL_001',
    eventName: 'SSE进度推送',
    eventParam: { taskId: 'abc123' },
    onMessage(event) {
        // event.event = "progress" | "message" | ...
        // event.data  = 已解析的 JSON 对象
        console.log('[' + event.event + ']', event.data);
        updateProgressUI(event.data);
    },
    onError(err) {
        console.error('SSE 错误:', err);
    },
    onComplete() {
        console.log('流结束');
    },
});

// 若后端返回普通 JSON（非 SSE），行为等价于：
//   onMessage({ event: 'message', data: <envelope.data> })
//   onComplete()
// 调用方代码无需做任何变更。
```

#### sdk.api.callButton

**描述：**调用面板按钮（新版）

**参数：**

- `payload` (Object) [必需]: 按钮调用参数对象
  - `panelCode` (string) [必需]: 面板编号
  - `buttonName` (string) [必需]: 按钮名称
  - `formData` (Object) [可选]: 表单数据对象（Map）
  - `buttonParam` (Object) [可选]: 按钮参数对象（Map）

**返回值：**`JSON`

返回对象结构：

```javascript
{
  state: string, // 状态码，成功为"200"
  msg: string, // 消息
  data: Object, // 按钮执行返回的数据
    uuid: string, // 数据唯一标识
    formModelId: string, // 表单模型ID
    data: Object, // 表单数据对象，包含所有字段值
    extFields: Object, // 扩展字段对象
}
```

**返回对象样例：**▶ 点击展开

```javascript
{
  "state": "200",
  "data": {
    "uuid": "8c530177_4d23_4367_a3ed_c1ab751148d8",
    "formModelId": "octocm.md.SdkTest.iML_00001_CM",
    "data": {
      "uuid": "8c530177_4d23_4367_a3ed_c1ab751148d8",
      "code": "1775ba1d_c386_44cf_b95e_d1cb32f938a6",
      "name": "test555",
      "bbb": false
    },
    "extFields": {}
  }
}
```

**示例：**▶ 点击展开

```javascript
// 调用按钮（带表单数据）
const result = await sdk.api.callButton({
    panelCode: 'SdkTest_IML_00001',
    buttonName: '保存',
    formData: {
        name: 'test555',
        bbb: false
    }
});

if (result.state === '200') {
    console.log('按钮调用成功');
    console.log('返回的UUID:', result.data.uuid);
    console.log('表单数据:', result.data.data);
    console.log('表单编号:', result.data.data.code);
    // 可能需要刷新数据或更新UI
} else {
    console.error('按钮调用失败:', result.msg);
}
```

#### sdk.api.callButtonStream

**描述：**调用面板按钮（支持 SSE 流式响应）。与 `callButton` 使用相同端点 `/wp-core/api/callButton2`，但通过回调方式接收数据。若后端操作函数返回 `Flux`，响应 `Content-Type` 为 `text/event-stream`，前端可逐帧接收；若返回普通 JSON，则退化为单次 `onMessage` 回调后 `onComplete`，调用方无需区分。**不返回 Promise**，结果通过回调异步通知。单对象入参，业务字段和回调写在同一个对象里。

**参数：**

- `options` (Object) [必需]: 按钮参数 + SSE 回调（混合在同一对象）
  - `panelCode` (string) [必需]: 面板编号
  - `buttonName` (string) [必需]: 按钮名称
  - `formData` (Object) [可选]: 表单数据对象（Map）
  - `buttonParam` (Object) [可选]: 按钮参数对象（Map）
  - `onMessage` (Function) [可选]: 每收到一条 SSE 事件时调用。参数 event: { event: string, id?: string, data: any }。event.event 为 SSE 事件名（默认 "message"），event.data 为已解析的 JSON 数据。
  - `onError` (Function) [可选]: 发生错误时调用。参数 err: Error。
  - `onComplete` (Function) [可选]: 流结束时调用（无参数）。

**返回值：**`void`

**示例：**▶ 点击展开

```javascript
// 调用按钮（SSE 流式响应）
sdk.api.callButtonStream({
    panelCode: 'SdkTest_IML_00001',
    buttonName: 'SSE进度推送',
    formData: { name: 'test' },
    buttonParam: { taskId: 'abc123' },
    onMessage(event) {
        // event.event = "progress" | "message" | ...
        // event.data  = 已解析的 JSON 对象
        console.log('[' + event.event + ']', event.data);
        updateProgressUI(event.data);
    },
    onError(err) {
        console.error('SSE 错误:', err);
    },
    onComplete() {
        console.log('流结束');
    },
});

// 若后端返回普通 JSON（非 SSE），行为等价于：
//   onMessage({ event: 'message', data: <envelope.data> })
//   onComplete()
// 调用方代码无需做任何变更。
```

### 文件管理

#### sdk.file.uploadFile

**描述：**上传文件到服务器

**参数：**

- `file` (File) [必需]: HTML File对象（从input[type="file"]获取）

**返回值：**`JSON`

返回对象结构：

```javascript
{
  state: string, // 状态码，成功为"SUCCEED"或"200"
  msg: string, // 消息
  data: string, // 文件唯一标识码（fileCode）
}
```

**示例：**▶ 点击展开

```javascript
// 上传文件
const fileInput = document.getElementById('fileInput');
const file = fileInput.files[0];

if (!file) {
    console.error('请选择文件');
    return;
}

try {
    const result = await sdk.file.uploadFile(file);
    
    if (result.state === 'SUCCEED' || result.state === '200') {
        console.log('文件上传成功');
        console.log('文件码:', result.data);
    } else {
        console.error('上传失败:', result.msg);
    }
} catch (error) {
    console.error('上传错误:', error.message);
}
```

#### sdk.file.getFilePreviewUrl

**描述：**获取文件预览 URL。按 6 段路径拼接： `busiDomainCode/panelCode/formCode/formUuid/fieldName/attachFileName`。

**参数：**

- `payload` (AttachmentPathOptions) [必需]: 附件路径参数对象

**返回值：**`string`

**示例：**▶ 点击展开

```javascript
// 获取文件预览 URL
const previewUrl = sdk.file.getFilePreviewUrl({
    panelCode: 'SdkTest_IML_00001',
    formCode: 'IML_00007',
    formUuid: '6d793ce9_4649_439a_a364_b9220cd70ea4',
    fieldName: '附件',
    attachFileName: '1.jpeg',
});

console.log('预览URL:', previewUrl);

// 用于 iframe 预览
document.getElementById('preview').src = previewUrl;
```

#### sdk.file.getFileDownloadUrl

**描述：**获取文件下载 URL。支持两种用法：

1) 传 `AttachmentPathOptions` 对象，按 6 段路径拼接 (`busiDomainCode/panelCode/formCode/formUuid/fieldName/attachFileName`)
2) 传已拼接好的原始 path 字符串（兼容旧用法）。

**参数：**

- `payload` (AttachmentPathOptions | string) [必需]: 附件路径参数对象，或已拼接好的原始 path 字符串

**返回值：**`string`

**示例：**▶ 点击展开

```javascript
// 用法 1：传附件路径参数对象（推荐）
const downloadUrl = sdk.file.getFileDownloadUrl({
    panelCode: 'SdkTest_IML_00001',
    formCode: 'IML_00007',
    formUuid: '6d793ce9_4649_439a_a364_b9220cd70ea4',
    fieldName: '附件',
    attachFileName: '1.jpeg',
});

window.open(downloadUrl, '_blank');

// 用法 2：传已拼接好的原始 path（兼容旧用法）
const downloadUrl2 = sdk.file.getFileDownloadUrl(
    'GroupChat_Inst_17677802186957/IML_00007/6d793ce9_4649_439a_a364_b9220cd70ea4/a1c4a911_f349_46f9_b146_c95cf7285286/附件/1.jpeg'
);
```

#### sdk.file.getFileServerConfig

**描述：**获取文件服务器配置（用于分片上传）

**参数：**

- `payload` (Object) [必需]: 配置参数对象
  - `fileName` (string) [必需]: 文件名称

**返回值：**`JSON`

返回对象结构：

```javascript
{
  accessToken: string, // 访问令牌
  baseUrl: string, // 文件服务器基础URL
}
```

**返回对象样例（返回示例）：**▶ 点击展开

```javascript
{
  "baseUrl": "",
  "accessToken": "ewog......."
}
```

**示例：**▶ 点击展开

```javascript
// 获取文件服务器配置（对于同一个文件只需调用一次）
const config = await sdk.file.getFileServerConfig({
    fileName: 'large-file.zip'
});

console.log('文件服务器URL:', config.baseUrl);
console.log('访问令牌:', config.accessToken);
```

#### sdk.file.getChunkUploadProgress

**描述：**查询分片上传进度

**参数：**

- `payload` (Object) [必需]: 查询参数对象
  - `accessToken` (string) [必需]: 访问令牌
  - `fileMd5` (string) [必需]: 文件MD5值
  - `fileName` (string) [必需]: 文件名称
  - `fileSize` (number) [必需]: 文件大小（字节）
  - `baseUrl` (string) [可选]: 文件服务器URL（可选），也就是 getFileServerConfig() 返回的 baseUrl

**返回值：**`JSON`

返回对象结构：

```javascript
{
  totalChunks: number, // 总分片数，complete 状态为 0
  chunkSize: number, // 每片大小（字节），complete 状态为 0
  name: string, // 文件名称
  fileSize: number, // 文件大小（字节）
  md5: string, // 文件MD5值
  status: string, // 状态，uploading 表示上传中，complete 表示上传完成
  missingChunks: Array<number>, // 未上传的分片索引数组，uploading 状态才有
  chunkMd5s: Array<number>, // 已上传的分片MD5值，uploading 状态才有
  filePath: string, // 文件路径，完成上传后才有
  uuid: string, // 文件唯一标识，完成上传后才有
  附件编号: string, // 跟 uuid 一致
  附件名称: string, // 跟 name 一致
}
```

**返回对象样例（已完成上传）：**▶ 点击展开

```javascript
{
  "totalChunks": 0,
  "chunkSize": 0,
  "name": "数据(面板权限).xlsx",
  "fileSize": 11959,
  "filePath": "/admin/2025/202511/20251127/a82c9446_6473_47a3_a321_0dda91fc67b8.xlsx",
  "md5": "bcba613ba62e4a2d3f607b4e13556618",
  "status": "complete",
  "uuid": "fe28bd31_ba4b_4f50_8c84_bf6d60568adb",
  "附件编号": "fe28bd31_ba4b_4f50_8c84_bf6d60568adb",
  "附件名称": "数据(面板权限).xlsx"
}
```

**返回对象样例（未完成上传）：**▶ 点击展开

```javascript
{
  "totalChunks": 16,
  "chunkSize": 10485760,
  "missingChunks": [
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15
  ],
  "chunkMd5s": {},
  "name": "GitHubDesktopSetup-x64.exe",
  "fileSize": 159073384,
  "md5": "04cdc50c969a36440b7e35781aa9c221",
  "status": "uploading"
}
```

**示例：**▶ 点击展开

```javascript
// 查询分片上传进度
const fileConfig = 调用 getFileServerConfig() 获取文件服务器配置;

const progress = await sdk.file.getChunkUploadProgress({
    accessToken: fileConfig.accessToken,
    baseUrl: fileConfig.baseUrl,
    fileMd5: 'abc123...',
    fileName: 'large-file.zip',
    fileSize: 104857600,
});

console.log('总分片数:', progress.totalChunks);
console.log('状态:', progress.status);
```

#### sdk.file.uploadChunk

**描述：**上传文件分片

**参数：**

- `payload` (Object) [必需]: 上传参数对象
  - `chunk` (Blob) [必需]: 分片数据（Blob对象）
  - `accessToken` (string) [必需]: 访问令牌
  - `fileMd5` (string) [必需]: 文件MD5值
  - `index` (number) [必需]: 分片索引（从0开始）
  - `fileName` (string) [必需]: 文件名称
  - `baseUrl` (string) [可选]: 文件服务器URL（可选），也就是 getFileServerConfig() 返回的 baseUrl

**返回值：**`JSON`

返回对象结构：

```javascript
{
  name: string, // 分片名称（索引）
  path: string, // 分片存储路径
  md5: string, // 分片MD5值
  fileSize: number, // 分片大小（字节）
}
```

**返回对象样例（返回示例）：**▶ 点击展开

```javascript
{
  "name": "0",
  "path": "/bad65fff30ac8c3d0f52fac839c4b5a5/0",
  "md5": "bad65fff30ac8c3d0f52fac839c4b5a5",
  "fileSize": 115002
}
```

**示例：**▶ 点击展开

```javascript
// 上传单个分片
const fileConfig = 调用 getFileServerConfig() 获取文件服务器配置;

const file = document.getElementById('fileInput').files[0];
const chunkSize = 1024 * 1024; // 1MB
const start = 0;
const end = Math.min(chunkSize, file.size);
const chunk = file.slice(start, end);

const result = await sdk.file.uploadChunk({
    baseUrl: fileConfig.baseUrl,
    accessToken: fileConfig.accessToken,
    chunk: chunk,
    fileMd5: 'abc123...',
    index: 0,
    fileName: file.name,
});

console.log('分片上传结果:', result);
```

#### sdk.file.mergeChunks

**描述：**合并文件分片（所有分片上传完成后调用）

**参数：**

- `payload` (Object) [必需]: 合并参数对象
  - `accessToken` (string) [必需]: 访问令牌
  - `fileName` (string) [必需]: 文件名称
  - `fileSize` (number) [必需]: 文件大小（字节）
  - `fileMd5` (string) [必需]: 文件MD5值
  - `baseUrl` (string) [可选]: 文件服务器URL（可选）

**返回值：**`JSON`

返回对象结构：

```javascript
{
  uuid: string, // 文件唯一标识
  name: string, // 文件名称
  附件编号: string, // 跟 uuid 一致
  附件名称: string, // 跟 name 一致
}
```

**返回对象样例（返回示例）：**▶ 点击展开

```javascript
{
  "totalChunks": 0,
  "chunkSize": 0,
  "name": "xclip-master.zip",
  "fileSize": 47832,
  "filePath": "/admin/2025/202511/20251128/92971470_61e8_4bff_bbd9_8a3eec1449c7.zip",
  "md5": "0997d52bf46272cbb5c60a172b6159c7",
  "status": "complete",
  "uuid": "92971470_61e8_4bff_bbd9_8a3eec1449c7",
  "附件编号": "92971470_61e8_4bff_bbd9_8a3eec1449c7",
  "附件名称": "xclip-master.zip"
}
```

**示例：**▶ 点击展开

```javascript
// 合并所有分片
const fileConfig = 调用 getFileServerConfig() 获取文件服务器配置;

const result = await sdk.file.mergeChunks({
    accessToken: fileConfig.accessToken,
    baseUrl: fileConfig.baseUrl,
    fileName: 'large-file.zip',
    fileSize: 104857600,
    fileMd5: 'abc123...',
});

console.log('文件合并成功');
console.log('附件编号:', result.附件编号);
console.log('附件名称:', result.附件名称);
```

#### sdk.file.uploadWebFile

**描述：**上传Web文件（用于单分片文件的直接上传）

**参数：**

- `payload` (Object) [必需]: 上传参数对象
  - `accessToken` (string) [必需]: 访问令牌（从 getFileServerConfig 获取）
  - `file` (File) [必需]: 要上传的文件对象
  - `baseUrl` (string) [可选]: 文件服务器URL（可选），也就是 getFileServerConfig() 返回的 baseUrl

**返回值：**`JSON`

返回对象结构：

```javascript
{
  name: string, // 文件名称
  fileSize: number, // 文件大小（字节）
  filePath: string, // 文件存储路径
  md5: string, // 文件MD5值
  uuid: string, // 文件唯一标识
  status: string, // 上传状态，成功为"complete"
  附件编号: string, // 附件编号（同uuid）
  附件名称: string, // 附件名称（同name）
}
```

**返回对象样例（返回示例）：**▶ 点击展开

```javascript
{
  "name": "index.html",
  "fileSize": 29525,
  "filePath": "/admin/2025/202512/20251201/2e9e49b3_1d21_4dcb_ab22_924df16eae41.html",
  "md5": "7613507804ede49b681aa89a962485b2",
  "uuid": "2e9e49b3_1d21_4dcb_ab22_924df16eae41",
  "status": "complete",
  "附件编号": "2e9e49b3_1d21_4dcb_ab22_924df16eae41",
  "附件名称": "index.html"
}
```

**示例：**▶ 点击展开

```javascript
// 上传单分片文件
const fileConfig = await sdk.file.getFileServerConfig({
    fileName: 'document.pdf'
});

const fileInput = document.getElementById('fileInput');
const file = fileInput.files[0];

const result = await sdk.file.uploadWebFile({
    accessToken: fileConfig.accessToken,
    file: file,
    baseUrl: fileConfig.baseUrl
});

if (result.status === 'complete') {
    console.log('文件上传成功');
    console.log('附件编号:', result.附件编号);
    console.log('附件名称:', result.附件名称);
    console.log('文件路径:', result.filePath);
} else {
    console.error('文件上传失败');
}
```

### 本地存储

#### sdk.storage.getToken

**描述：**获取本地存储的 JWT 令牌。仅读本实例 sessionType 对应的 scope：`'login'` → `localStorage`；`'inherit'` → `sessionStorage`。不做 cross-scope fallback。

**参数：**无

**返回值：**`string | null`

**示例：**▶ 点击展开

```javascript
// 获取令牌
const token = await sdk.storage.getToken();
if (token) {
    console.log('当前令牌:', token);
}
```

#### sdk.storage.setToken

**描述：**设置 JWT 令牌。仅写本实例 sessionType 对应的 scope：`'login'` → `localStorage`；`'inherit'` → `sessionStorage`。不接受额外的持久化选项——后端由 sessionType 锁定。

**参数：**

- `token` (string) [必需]: JWT 令牌字符串

**返回值：**`void`

**示例：**▶ 点击展开

```javascript
// 设置令牌
sdk.storage.setToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
```

#### sdk.storage.removeToken

**描述：**删除本地存储的 JWT 令牌。仅清本实例 sessionType 对应的 scope。

**参数：**无

**返回值：**`void`

**示例：**▶ 点击展开

```javascript
// 删除令牌
sdk.storage.removeToken();
```

#### sdk.storage.getCurrentUser

**描述：**获取当前登录用户信息（同 getUserInfo）。仅读本实例 sessionType 对应的 scope。

**参数：**无

**返回值：**`Object | null`

返回对象结构：

```javascript
{
  id: string, // 用户ID
  name: string, // 用户名称
  phone: string, // 手机号
  userName: string, // 登录用户名
  busDomainCode: string, // 所属业务域
}
```

**示例：**▶ 点击展开

```javascript
// 获取当前用户
const user = sdk.storage.getCurrentUser();
if (user) {
    console.log('用户名:', user.name);
    console.log('用户ID:', user.id);
} else {
    console.log('用户未登录');
}
```

### 设计态（面板/应用配置）

#### sdk.api.getAppConfig

**描述：**获取应用配置。公开接口（无需登录，`ignoreAuth`），登录页配置也走此接口。**注意**：返回的 `data` 是 JSON 字符串，需调用方自行 `JSON.parse`，下方“返回对象结构”为 `JSON.parse` 后的内容。

**参数：**

- `appCode` (string) [必需]: 应用编号

**返回值：**`JSON`

返回对象结构：

```javascript
{
  appCode: string, // 应用编号
  appName: string, // 应用名称
  businessDomain: string, // 所属业务域
  shellType: string, // 壳类型，如 CustomShell
  customPageConfig: Object, // 自定义页面配置
  menu: Array<Object>, // 菜单树（面板/文件夹，文件夹可递归嵌套 children）
    uuid: string, // 节点唯一标识
    type: string, // 节点类型：Panel 面板 / Folder 文件夹
    title: string, // 节点标题
    icon: string, // 图标名（可选）
    businessDomain: string, // 所属业务域
    panelCode: string, // 面板编号（type=Panel 时存在）
    ssoEnabled: boolean, // 是否启用 SSO
    children: Array<Object>, // 子节点（type=Folder 时递归，结构同 menu 项）
  globalEventDefinitions: Object, // 全局事件定义
    revision: string, // 修订号
    events: Array<Object>, // 全局事件列表
}
```

**示例：**▶ 点击展开

```javascript
// 获取应用配置
try {
    const res = await sdk.api.getAppConfig('myApp');
    if (Number(res.state) === 200) {
        const config = JSON.parse(res.data);
        console.log('应用配置:', config);
    }
} catch (error) {
    console.error('获取应用配置失败:', error.message);
}
```

#### sdk.api.getPanelConfig

**描述：**获取面板配置。可选鉴权（`optionalAuth`）：有 token 时自动携带 Authorization，无 token 时匿名访问。后端将 `data` 以 JSON 字符串回传，SDK 已自动解析为对象（无需调用方手动 JSON.parse），下方“返回对象结构”即 `data` 内容。

**参数：**

- `panelCode` (string) [必需]: 面板编号

**返回值：**`JSON`

返回对象结构：

```javascript
{
  metadata: Object, // 面板元数据
    panelCode: string, // 面板编号
    panelName: string, // 面板名称
    panelCategory: string, // 面板分类
    panelState: Object, // 面板状态配置（dataName/dataType/defaultOptions）
    panelPageDto: Object, // 页面定义（startPageName/tablePages/formPages/externalPages）
    panelButtons: Array<Object>, // 面板按钮列表（buttonName/buttonDisplayName/preventDefault）
    description: string, // 面板描述（业务动机/目标/场景说明）
    version: string, // 版本号
  dataSchema: Object, // 数据模型定义
    type: string, // 模型类型，如 object
    fields: Array<Object>, // 字段定义（dataName/dataType/isRequired/defaultValue/alias）
  uiSchema: Object, // UI 结构定义（页面渲染树）
    startPageId: string, // 起始页面 ID
    pages: Array<Object>, // 页面列表（Form/Table 组件树 + pageSelfData）
}
```

**示例：**▶ 点击展开

```javascript
// 获取面板配置
try {
    const res = await sdk.api.getPanelConfig('panel_123');
    if (Number(res.state) === 200) {
        console.log('面板配置:', res.data);
    }
} catch (error) {
    console.error('获取面板配置失败:', error.message);
}
```

#### sdk.api.getExternalPage

**描述：**获取外部页面。**不走 RespondDto 包装**：请求成功时直接返回内容（非 {state, msg, data} 信封）。返回形态取决于后台配置：可能是 HTML 字符串、外部 URL 或前端页面配置，可嵌入 iframe 展示。

**参数：**

- `panelCode` (string) [必需]: 面板编号

**返回值：**`string（HTML / URL / 前端页面配置）`

**示例：**▶ 点击展开

```javascript
// 获取外部页面（返回形态取决于后台配置：HTML / URL / 前端页面配置）
try {
    const page = await sdk.api.getExternalPage('panel_123');
    console.log('外部页面:', page);
    // 若返回 HTML：document.getElementById('container').innerHTML = page;
    // 若返回 URL：iframe.src = page;
} catch (error) {
    console.error('获取外部页面失败:', error.message);
}
```

### PanelXSdk 主类

SDK的主要入口类，负责初始化和管理各个功能模块。

#### 构造函数

```javascript
new PanelXSdk(config: Object)
```

**参数：**

- `config.busDomainCode` (string, 必需) - 业务域代码
  - 必须提供，用于标识所属的业务域
  - 常见值：'TODO', 'IML', 'COP' 等
- `config.appCode` (string, 可选, 强烈推荐) - 应用编码
  - 用于区分**同一业务域下不同应用**的 token / userInfo 存储键作用域，避免互相覆盖
  - 不提供时不参与存储键拼接，初始化时会在控制台 warn 提示
  - 存储键格式：`${busDomainCode}_${appCode}_${tokenKey | userInfoKey}`，没有 appCode 时为 `${busDomainCode}_${tokenKey | userInfoKey}`
- `config.devDefaultBaseUrl` (string, 本地开发时必需) - 开发环境默认 API 基础 URL
  - 仅在本地开发环境（localhost/file://）时需要提供
  - 生产环境会自动从当前 URL 解析，无需配置
- `config.sessionSourceSdk` (SessionSourceSdk, 可选) - 自动会话继承来源 SDK（运行时对象引用）
  - 传入后启用自动继承：构造完成即启动换票，并监听源 SDK 的 `auth-state-change` 事件（登录 / 重登 / Token 更新 / 业务域变化 / 退出）主动重新换票
  - 与 `config.sessionType` 互斥——同时传入会在构造期抛错；存在来源时内部固定为 `'inherit'`
  - 运行时对象引用，**不会**出现在 `getConfig()` / JSON Schema 配置快照中；禁止直接或间接自继承循环（抛 `invalid_session_source`）
  - 目标显式 `logout()` 后关闭该实例自动继承；`destroy()` 移除监听并中止在途换票
- `config.sessionType` (`'login'` | `'inherit'`, 可选, 默认 `'login'`) - 会话类型
  - `'login'` — 独立登录模式，调用 `sdk.user.login()`，token / userInfo 写 **localStorage**，关 tab 仍保留
  - `'inherit'` — 继承会话模式，调用 `sdk.inheritSession({ sourceToken, sourceBusDomainCode })`，token / userInfo 写 **sessionStorage**，关 tab 即清
  - 实例创建后**不可切换**；错误模式下调用对应登录方法会抛错
  - 非法值（除 `'login'` / `'inherit'` 外）会在构造期抛错
  - 详见 快速开始 中"两种登录方式"小节

**环境检测：**

- SDK 会自动检测当前运行环境（域名/IP/localhost/file://）
- 生产环境：自动解析 baseUrl，无需任何配置
- 本地开发：必须提供 `devDefaultBaseUrl`

#### 属性

- `sdk.auth` - 认证模块
- `sdk.api` - API调用模块
- `sdk.file` - 文件操作模块
- `sdk.user` - 用户管理模块

#### 方法

| 方法                            | 说明           | 返回值 |
| ------------------------------- | -------------- | ------ |
| setBusDomainCode(busDomainCode) | 设置业务域代码 | void   |
| getConfig()                     | 获取配置信息   | Object |
| destroy()                       | 销毁SDK实例    | void   |

### 认证模块 (sdk.auth)

处理用户认证相关的功能，包括令牌管理和登录状态检查。

#### 方法

| 方法              | 说明            | 参数          | 返回值  |
| ----------------- | --------------- | ------------- | ------- |
| getToken()        | 获取当前JWT令牌 | 无            | string  |
| setToken(token)   | 设置JWT令牌     | token: string | void    |
| clearToken()      | 清除JWT令牌     | 无            | void    |
| isAuthenticated() | 检查是否已认证  | 无            | boolean |

### API模块 (sdk.api)

提供各种API接口调用功能，包括面板事件、按钮调用、数据查询等。

#### 面板事件调用

```javascript
sdk.api.callPanelEvent(eventName, eventParam, panelCode)
```

**参数：**

- `eventName` (string, 必需) - 事件名称
- `eventParam` (Object, 可选) - 事件参数
- `panelCode` (string, 必需) - 面板编号

**返回值：** Promise<Object>

#### 按钮调用

```javascript
sdk.api.callPanelButton(buttonName, formData, panelCode)
```

**参数：**

- `buttonName` (string, 必需) - 按钮名称
- `formData` (Object, 可选) - 表单数据
- `panelCode` (string, 必需) - 面板编号

**返回值：** Promise<Object>

#### 查询表单数据列表

```javascript
sdk.api.queryFormDataList(payload)
```

**参数：**

- `payload.panelCode` (string, 必需) - 面板编号
- `payload.condition` (Object, 可选) - 查询条件
- `payload.pageNo` (number, 可选) - 页码，默认1
- `payload.pageSize` (number, 可选) - 页大小，默认20
- `payload.eventName` (string, 可选) - 事件名称
- `payload.appCode` (string, 可选) - 应用编号，默认使用SDK配置中的appCode
- `payload.keyword` (string, 可选) - 模糊搜索的关键字

**返回值：** Promise<Object>

#### 查询单条表单数据

```javascript
sdk.api.queryFormData(payload)
```

**参数：**

- `payload.panelCode` (string, 必需) - 面板编号
- `payload.condition` (Object, 必需) - 查询条件，不可为空对象

**返回值：** Promise<Object>

#### 获取关联数据

```javascript
sdk.api.getRelateDataList(options)
```

```javascript
sdk.api.getRelateDataList(fieldName, panelCode, extraFieldNames) (旧版用法)
```

**参数 (Object用法)：**

- `options.fieldName` (string, 必需) - 关联字段中文名
- `options.panelCode` (string, 必需) - 面板编号
- `options.extraFieldNames` (Array<string>, 可选) - 额外需要返回的字段名数组
- `options.condition` (Object, 可选) - 筛选条件
- `options.keyword` (string, 可选) - 搜索关键字

**参数 (旧版用法)：**

- `fieldName` (string, 必需) - 关联字段中文名
- `panelCode` (string, 必需) - 面板编号
- `extraFieldNames` (Array<string>, 可选) - 额外需要返回的字段名数组

**返回值：** Promise<Object>

#### 获取应用配置

```javascript
sdk.api.getAppConfig(appCode)
```

**参数：**

- `appCode` (string, 必需) - 应用编号

**返回值：** Promise<Object>

**注意：**公开接口（无需登录）；返回的 `data` 是 JSON 字符串，需要调用方自行
        `JSON.parse`。

#### 获取面板配置

```javascript
sdk.api.getPanelConfig(panelCode)
```

**参数：**

- `panelCode` (string, 必需) - 面板编号

**返回值：** Promise<Object>

**注意：**可选鉴权（有 token 自动携带 Authorization，无 token 匿名访问）；返回的
        `data` 已由 SDK 自动解析为对象。

#### 获取外部页面

```javascript
sdk.api.getExternalPage(panelCode)
```

**参数：**

- `panelCode` (string, 必需) - 面板编号

**返回值：** Promise<string>（HTML / URL / 前端页面配置）

**注意：**不走 RespondDto 包装，成功时直接返回内容；返回形态取决于后台配置——可能是 HTML
        字符串、外部 URL 或前端页面配置，可嵌入 iframe 展示。

### 文件模块 (sdk.file)

处理文件上传、下载和删除操作。

#### 方法

| 方法                                   | 说明             | 参数                               | 返回值          |
| -------------------------------------- | ---------------- | ---------------------------------- | --------------- |
| uploadFile(file)                       | 上传文件         | file: File                         | Blob            |
| deleteFile(fileCode)                   | 删除文件         | fileCode: string                   | Promise<Object> |
| getFileDownloadUrl(fileCode, fileName) | 获取文件下载链接 | fileCode: string, fileName: string | string          |

### 用户模块 (sdk.user)

处理用户认证和用户信息管理。

#### 用户登录

```javascript
sdk.user.login(credentials)
```

**参数：**

- `credentials.userName` (string, 必需) - 用户名
- `credentials.password` (string, 必需) - 密码

**返回值：** Promise<Object>

#### 其他方法

| 方法              | 说明             | 返回值  |
| ----------------- | ---------------- | ------- |
| logout()          | 用户登出         | void    |
| getCurrentUser()  | 获取当前用户信息 | Object  |
| isAuthenticated() | 检查是否已认证   | boolean |

## 错误处理

SDK中的所有异步方法都返回Promise，建议使用try-catch进行错误处理：

```javascript
try {
    const result = await sdk.api.queryFormDataList({
        panelCode: 'TODO_IML_00061',
        condition: null,
        pageNo: 1,
        pageSize: 10
    });
    console.log('查询成功:', result);
} catch (error) {
    console.error('查询失败:', error);
    // 处理错误
}
```

## HTTP头部

SDK会自动在所有API请求中添加以下HTTP头部：

- `Authorization`: JWT token（如果用户已登录）
- `BusDomainCode`: 业务域代码
- `Content-Type`: application/json（POST请求）

## 浏览器兼容性

SDK支持所有现代浏览器，包括：

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

> **注意：**
> **注意：** SDK使用了fetch
>      API和async/await语法，不支持IE浏览器。如需支持IE，请使用相应的polyfill。


## 版本信息

当前版本：**v1.4.0**

获取版本信息：

```javascript
console.log(PanelXSdk.version); // "1.4.0"
```

## 示例项目

完整的使用示例请参考"SDK 样例"页面，那里提供了所有功能的交互式演示。

> **警告：**
> **重要提醒：**
>      在生产环境中使用时，请确保API接口的安全性，避免在客户端暴露敏感信息。
