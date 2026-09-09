# 自定义菜单/框架/入口/外壳生成器（Custom Shell）

## 🎯 任务目标

生成一个自定义菜单/框架/入口/外壳（Shell）HTML 页面。菜单 + 内容区为必实现项，默认必须集成功能除非用户明确不要。

## 🔴 核心原则

- 按 CDP-SDK 1.6.0 及以上版本生成；必须先完成 SDK 引入与可用性检查，再执行后续逻辑。
- 菜单 + 内容区必须存在。单容器模式使用固定 Portal 容器；Tab、窗口、分栏等多容器模式必须为每个页面准备稳定且唯一的容器。
- 所有 SDK 调用必须 `showToast` 友好提示，并具备错误边界处理（主题订阅静默默认样式兜底）。
- 默认必须集成功能：应用标题、主题订阅、主题面板按钮、AI 助手按钮、命令面板唤起、用户信息、登出。
- 禁止使用 `alert/confirm/prompt`，统一用 toast 或页面提示。
- 菜单与应用数据来源均为 CDP SDK，默认**无需**动作注册（除非用户明确要求）。
- 默认**无需**加载 PanelX SDK（不涉及数据获取/后端交互，除非用户明确要求）。
- 页面严禁出现“自定义外壳”“自定义”“外壳”等技术概念字样。

## 🧩 实现步骤

### 步骤 1：SDK 引入方式

#### 方式 A：自动注入（推荐）
如果页面通过 **ExternalPage 组件（面板网页）** 加载，CDP 会自动注入 SDK。

#### 方式 B：禁止手动引入
CDP-SDK 统一由宿主注入。交付 HTML **禁止**用 script 标签的 `src` 属性外链或本地引入，也禁止 preload 动态加载；宿主注入后直接从 `window.semApp.cdpSdk` 使用。

### 步骤 2：SDK 可用性与版本检查

**必须先检查 CDP-SDK 是否存在，再读取 `window.semApp.cdpSdk.version` 做数值分段版本比较。禁止用字符串直接比较版本号。**

```javascript
const REQUIRED_MENU_MOUNT_VERSION = '1.6.0';
const cdpSdk = window.semApp?.cdpSdk;

function isVersionAtLeast(currentVersion, requiredVersion) {
  const parse = (value) => {
    const normalized = String(value || '').trim().split('-')[0];
    const parts = normalized.split('.');
    if (parts.length < 2 || parts.some((part) => !/^\d+$/.test(part))) return null;
    return parts.map(Number);
  };

  const current = parse(currentVersion);
  const required = parse(requiredVersion);
  if (!current || !required) return false;

  const length = Math.max(current.length, required.length);
  for (let index = 0; index < length; index += 1) {
    const currentPart = current[index] || 0;
    const requiredPart = required[index] || 0;
    if (currentPart > requiredPart) return true;
    if (currentPart < requiredPart) return false;
  }
  return true;
}

if (!cdpSdk) {
  throw new Error('CDP-SDK 未加载');
}

const supportsMenuMount = isVersionAtLeast(
  cdpSdk.version,
  REQUIRED_MENU_MOUNT_VERSION,
);
```

版本门禁规则：

- 调用任何菜单 API 前必须完成上述检查，不能仅判断 `window.semApp?.cdpSdk` 存在。
- `supportsMenuMount === true` 才能使用 `menuController.mount()` 和多容器菜单模式。
- SDK 低于 1.6.0 时，普通菜单可降级为 `init(menuTree, { contentContainer })` 单容器模式。
- 用户明确要求 Tab、多窗口、分栏、多页面并存或保活时，不允许静默降级；必须显示“当前 CDP-SDK 版本过低，请升级到 1.6.0 或更高版本”的阻断错误。
- 低版本下禁止由 AI 自行解析菜单编码并改用 `controllers.portal.mountPage()` 模拟 `menuController.mount()`。
- `cdpSdk.version` 缺失、为空或格式非法时按“不支持 1.6.0 能力”处理。

**单容器基础布局：菜单 + 内容区（Portal 容器必须有固定 ID）**

```html
<div class="shell">
  <aside class="menu">
    <div id="menu-root"></div>
  </aside>
  <main class="content">
    <div id="content-area"></div>
  </main>
</div>
```

多容器场景不要只生成一个 `#content-area`；应按步骤 3.4 为每个可挂载页面创建稳定容器。

---

### 步骤 3：菜单与内容承载（CDP-SDK 1.6.0+）

#### 3.1 获取基础数据（用户/应用/菜单）

```javascript
renderMenuSkeleton();
const user = await cdpSdk.data.auth.getCurrentUser(); // CurrentUser
const appConfig = await cdpSdk.data.getAppConfig();   // AppConfig
const menuTree = await cdpSdk.data.getMenu();
```

> **所有 SDK 调用都必须配套 `showToast()` 的友好提示与错误兜底。**

#### 3.2 根据需求选择渲染模式

CDP-SDK 1.6.0+ 提供两种菜单内容渲染方式。必须先根据用户需求选择，不得混用：

1. **单容器模式（兼容保留）**：适合普通左侧菜单 + 单内容区。通过 `init(menuTree, { contentContainer })` 让当前路由页面进入固定容器。
2. **多容器模式**：适合 Tab、窗口、分栏、多个页面并存或保活。通过 `init(menuTree)` 管理菜单状态，再调用 `menuController.mount(item, { containerId })` 按需挂载页面。

未提出 Tab、多窗口、分栏或保活需求时，默认生成单容器模式。提出上述任一需求时，必须先通过版本门禁，再使用多容器模式：

```javascript
if (!supportsMenuMount) {
  throw new Error(
    `当前 CDP-SDK 版本为 ${cdpSdk.version || '未知'}，多容器菜单要求 1.6.0 或更高版本`,
  );
}
```

#### 3.3 单容器模式（先订阅，再初始化）

`menuState` 类型为 `MenuState`。

```javascript
const menuController = cdpSdk.controllers.createMenu();
menuController.onStateChange(({ menuTree, activeId }) => {
  renderMenu(menuTree, activeId);
});
await menuController.init(menuTree, { contentContainer: '#content-area' });
```

菜单点击只调用 `select()`：

```javascript
document.getElementById('menu-root').addEventListener('click', async (event) => {
  const element = event.target.closest('[data-id]');
  if (!element) return;
  const selected = findMenuItemById(menuTree, element.dataset.id);
  if (selected) await menuController.select(selected);
});
```

#### 3.4 多容器模式（Tab / 窗口 / 分栏 / 保活）

```javascript
const menuController = cdpSdk.controllers.createMenu();
const mountedItems = new Map();

menuController.onStateChange(({ menuTree, activeId }) => {
  renderMenuAndTabs(menuTree, activeId);
});
await menuController.init(menuTree);

async function activateMenuTab(item) {
  await menuController.select(item);

  if (!mountedItems.has(item.id)) {
    const unmount = await menuController.mount(item, {
      containerId: getSafeContainerSelector(item),
    });
    mountedItems.set(item.id, unmount);
  }

  showOnlyTab(item.id);
}

async function closeMenuTab(itemId) {
  const unmount = mountedItems.get(itemId);
  if (unmount) await unmount();
  mountedItems.delete(itemId);
}
```

强制规则：

- `mount()` 接收完整菜单节点，不传 ID，不从菜单节点手工提取参数调用 `controllers.portal.mountPage()`。
- `mount()` 只负责挂载，不会调用 `select()`，标准导航 Tab 必须显式组合二者。
- 每个已挂载页面必须有稳定且唯一的容器；不得在状态更新时用 `innerHTML` 重建或删除这些容器。
- 隐藏容器但不调用 `unmount` 即保活；关闭 Tab 或永久移除页面时必须调用对应卸载函数。
- 菜单 ID 可能包含 CSS 特殊字符，必须生成安全 DOM ID，不能直接把业务菜单 ID 拼成选择器。
- 一级菜单、二级 Tab、三级及更深层 Tab 均由业务递归渲染，SDK 不限制菜单层级。

#### 3.5 清理资源

页面卸载时必须销毁 MenuController；多容器模式还必须释放所有动态挂载。

```javascript
window.addEventListener('beforeunload', () => {
  if (typeof mountedItems !== 'undefined') {
    mountedItems.forEach((unmount) => {
      void unmount();
    });
    mountedItems.clear();
  }
  menuController?.destroy();
});
```

---

### 步骤 4：默认必须功能集成（除非用户明确不要）

**默认必须集成功能：**
- 应用标题显示（来自 `appConfig`）
- 主题订阅（`cdpSdk.app.theme.getState` + `cdpSdk.app.theme.onChange`）
- 主题面板按钮（打开主题选择 UI）
- AI 助手按钮（`sdk.ui.aiAssistant`）
- 命令面板唤起框（`sdk.ui.commandPalette`）
- 用户信息显示（来自 `getCurrentUser`）
- 登出入口（`sdk.app.logout`）

#### 4.1 主题订阅（必须）
主题状态类型为 `ThemeStateWithEffective`，颜色为 HSL 值

```javascript
async function subscribeTheme() {
  try {
    const themeState = await cdpSdk.app.theme.getState();
    applyTheme(themeState);
    cdpSdk.app.theme.onChange((state) => applyTheme(state));
  } catch (error) {
    showToast('主题加载失败', { type: 'warning', description: error.message });
  }
}
```

```javascript
function applyTheme(themeState) {
  const { effectiveMode, currentColors } = themeState || {};
  const colors = effectiveMode === 'dark' ? currentColors?.dark : currentColors?.light;
  if (!colors) return;
  const root = document.documentElement;
  root.style.setProperty('--primary-color', `hsl(${colors.primary})`);
  root.style.setProperty('--success-color', `hsl(${colors.success})`);
  root.style.setProperty('--warning-color', `hsl(${colors.warning})`);
  root.style.setProperty('--danger-color', `hsl(${colors.danger})`);
  root.style.setProperty('--info-color', `hsl(${colors.info})`);
  root.style.setProperty('--bg-color', effectiveMode === 'dark' ? '#0f172a' : '#ffffff');
  root.style.setProperty('--text-color', effectiveMode === 'dark' ? '#e2e8f0' : '#0f172a');
}
```

#### 4.2 主题面板按钮（示例）
主题模式类型为 `ThemeMode`，主题预设类型为`ThemePreset[]`

```javascript
async function openThemePanel() {
  try {
    const modes = await cdpSdk.app.theme.getModes();
    const presets = await cdpSdk.app.theme.getPresets();
    renderThemePanel(modes, presets);
  } catch (error) {
    showToast('主题面板加载失败', { type: 'error', description: error.message });
  }
}
```

```javascript
async function changeThemeMode(mode) {
  try {
    await cdpSdk.app.theme.setMode(mode);
  } catch (error) {
    showToast('切换主题模式失败', { type: 'error', description: error.message });
  }
}

async function changeThemePreset(presetId) {
  try {
    await cdpSdk.app.theme.setPreset(presetId);
  } catch (error) {
    showToast('切换主题预设失败', { type: 'error', description: error.message });
  }
}
```

#### 4.3 AI 助手按钮（示例）
```javascript
async function openAiAssistant() {
  try {
    await cdpSdk.ui.aiAssistant.open();
  } catch (error) {
    showToast('AI 助手打开失败', { type: 'error', description: error.message });
  }
}
```

#### 4.4 命令面板唤起框（示例）
```javascript
async function openCommandPanel() {
  try {
    await cdpSdk.ui.commandPalette.open();
  } catch (error) {
    showToast('命令面板打开失败', { type: 'error', description: error.message });
  }
}
```

#### 4.5 用户信息与登出（示例）
```javascript
async function handleLogout() {
  try {
    await cdpSdk.app.logout();
  } catch (error) {
    showToast('登出失败', { type: 'error', description: error.message });
  }
}
```

---

### 步骤 5：可选功能

#### 5.1 任意层级菜单 Tab（CDP-SDK 1.6.0+）

用户要求 Tab 菜单时，默认采用以下通用结构：

- 第一层菜单显示在左侧；
- 当前第一层节点的 children 显示为右侧第一层 Tab；
- 子节点仍有 children 时，在对应 TabPane 内递归渲染下一层 Tab；
- 无 children 且具有 `panelId/panelCode` 的节点作为可挂载页面；
- 切换 Tab 只更新 `hidden`、`aria-selected` 和激活样式，不重建已挂载容器。

```javascript
function getChildren(item) {
  return Array.isArray(item?.children) ? item.children : [];
}

function findFirstMountable(item) {
  if (!item) return null;
  if (getChildren(item).length === 0 && (item.panelId || item.panelCode)) return item;
  for (const child of getChildren(item)) {
    const target = findFirstMountable(child);
    if (target) return target;
  }
  return null;
}

function createTabGroup(items, depth = 0) {
  const group = document.createElement('section');
  group.className = 'menu-tab-group';
  group.dataset.depth = String(depth);

  const tabList = document.createElement('div');
  tabList.setAttribute('role', 'tablist');
  const panels = document.createElement('div');
  panels.className = 'menu-tab-panels';

  for (const item of items) {
    const tab = createTabButton(item);
    const pane = createStableTabPane(item);
    tab.addEventListener('click', () => {
      const target = findFirstMountable(item);
      if (!target) return;
      activateMenuTab(target).catch((error) => {
        showToast('页面打开失败', { type: 'error', description: error.message });
      });
    });
    tabList.appendChild(tab);
    panels.appendChild(pane);

    const children = getChildren(item);
    if (children.length > 0) {
      pane.appendChild(createTabGroup(children, depth + 1));
    } else if (item.panelId || item.panelCode) {
      pane.appendChild(createStablePortalContainer(item));
    }
  }

  group.append(tabList, panels);
  return group;
}
```

`createTabButton()`、`createStableTabPane()`、`createStablePortalContainer()`、`showOnlyTab()` 和 `getSafeContainerSelector()` 必须在最终 HTML 中提供完整实现，不能保留占位函数。Tab 应使用 `role="tablist"`、`role="tab"`、`role="tabpanel"`、`aria-selected` 和键盘焦点状态。

#### 5.2 目录节点折叠（示例）

```javascript
function renderMenuWithExpandState(menuTree, activeId, expandedIds) {
  const root = document.getElementById('menu-root');
  root.innerHTML = menuTree.map(item => renderMenuItem(item, activeId, expandedIds)).join('');
}

function renderMenuItem(item, activeId, expandedIds) {
  const isExpanded = expandedIds?.has(item.id);
  const isDirectory = item.type === MENU_ITEM_TYPE.FOLDER || item.type === MENU_ITEM_TYPE.GROUP;
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  return `
    <div class="menu-item ${item.id === activeId ? 'active' : ''}" data-id="${item.id}">
      <div class="menu-row">
        ${isDirectory ? `<button class="menu-toggle" data-id="${item.id}">${isExpanded ? '▾' : '▸'}</button>` : ''}
        <span>${item.title}</span>
      </div>
      ${hasChildren && isExpanded ? `<div class="menu-children">${item.children.map(child => renderMenuItem(child, activeId, expandedIds)).join('')}</div>` : ''}
    </div>
  `;
}

// 初始化订阅
menuController.onStateChange(({ menuTree, activeId, expandedIds }) => {
  renderMenuWithExpandState(menuTree, activeId, expandedIds);
});

// 折叠/展开交互
document.getElementById('menu-root').addEventListener('click', (e) => {
  const toggleBtn = e.target.closest('.menu-toggle');
  if (!toggleBtn) return;
  menuController.toggle(toggleBtn.dataset.id);
});
```

---

### 步骤 6：错误边界处理（必须）

- 所有 SDK 调用必须 `try/catch`，并通过 `showToast()` 给出友好提示。
- 主题、菜单、用户信息等模块**局部失败**必须降级兜底，不能导致整页崩溃。
- `showToast()` 自身可能失败，需降级为页面内自实现 toast（不依赖 `cdpSdk`）。

### 推荐 showToast 封装
```javascript
async function showToast(message, options = {}) {
  try {
    await cdpSdk.toast(message, options);
  } catch {
    // 降级为页面内 toast（不依赖 cdpSdk）
    showLocalToast(message, options);
  }
}

function showLocalToast(message, options = {}) {
  // TODO: 页面内自实现 toast
  console.warn(message, options);
}
```

---

## 🧾 实现细节

### 类型定义

#### `ThemeMode`

主题模式。

```typescript
type ThemeMode = 'system' | 'light' | 'dark';
```

#### `ThemeColors`

主题色配置

```typescript
interface ThemeColors {
    primary: string;   // 主色调,格式:'221.2 83.2% 53.3%' (HSL)
    success: string;   // 成功色
    warning: string;   // 警告色
    danger: string;    // 危险色
    info: string;      // 信息色
}
```

#### `ThemeColorPair`

主题颜色对。

```typescript
interface ThemeColorPair {
    light: ThemeColors;
    dark: ThemeColors;
}
```

#### `ThemeStateWithEffective`

主题状态(包含实际生效模式)。

```typescript
interface ThemeStateWithEffective {
    mode: ThemeMode;                    // 用户设置的模式
    effectiveMode: 'light' | 'dark';    // 实际生效的模式
    activePresetId: string | null;      // 当前预设ID
    currentColors: ThemeColorPair;      // 当前颜色配置
}
```

#### `ThemePreset`

主题预设配置。

```typescript
interface ThemePreset {
    id: string;                         // 预设ID,如 'ocean'、'forest'
    name: string;                       // 预设名称,如 '海洋蓝'
    description: string;                // 预设描述
    light: ThemeColors;                 // 浅色模式颜色配置
    dark: ThemeColors;                  // 深色模式颜色配置
}
```

> 主题订阅部分的 `themeState` 使用 `ThemeStateWithEffective`。
> 主题面板部分的 `modes` 使用 `ThemeMode`，`presets` 使用 `ThemePreset`。

#### `IMenuItem`

菜单项

```typescript
interface IMenuItem {
  id: string;
  uuid?: string;
  parentUuid?: string;
  type: MenuItemType;
  title: string;
  icon?: string;
  panelId?: string;        // 可挂载时格式为 {panelCode}_v_{pageId}
  panelCode?: string;      // panelId 为空时使用，格式同上
  businessDomain?: string;
  children?: IMenuItem[];
}

const MENU_ITEM_TYPE = {
  PANEL: "Panel",
  FOLDER: "Folder",
  EXTERNAL_PAGE: "ExternalPage",
  GROUP: "group",
  ITEM: "item",
};

type MenuItemType = typeof MENU_ITEM_TYPE[keyof typeof MENU_ITEM_TYPE];
```

> 菜单部分 `menuTree` 类型为 `IMenuItem[]`。

#### `AppConfig`

```typescript
interface AppConfig {
  appCode: string;
  appName: string;
  businessDomain: string;
}
```

#### `CurrentUser`

```typescript
interface CurrentUser {
  id: string;
  fullName: string;
  role: string;
  phone?: string;
  raw: any;
}
```

#### `MenuState`

菜单状态

```typescript
interface MenuState {
    activeId: string | null;
    expandedIds: Set<string>;
    menuTree: IMenuItem[];
}
```

### MenuController 其他 API

##### `mount(menuItem, options)`（CDP-SDK 1.6.0+）

将菜单节点对应的页面挂载到指定容器。SDK 优先解析 `menuItem.panelId`，为空时解析 `menuItem.panelCode`。

**参数：**
- `menuItem: IMenuItem`（必需）— 完整菜单节点，不是菜单 ID；
- `options.containerId: string`（必需）— CustomShell 文档内稳定的 CSS 容器选择器。

**返回值：**
- `Promise<() => Promise<void>>` — 对应页面实例的异步卸载函数。

```javascript
const unmount = await menuController.mount(menuItem, {
  containerId: '#menu-content-1',
});

// 关闭 Tab 或永久移除页面时调用
await unmount();
```

`mount()` 不改变路由和菜单激活态。标准菜单导航应先调用 `select(menuItem)`，再按需调用 `mount()`；仅嵌入页面而不导航时可以只调用 `mount()`。

---

##### `toggle(id)`

切换菜单项的展开/折叠状态。

**参数:**
- `id: string` (必需) - 菜单项ID

**示例:**
```javascript
menuController.toggle('menu-item-1');
```

---

##### `expand(id)`

展开指定菜单项。

**参数:**
- `id: string` (必需) - 菜单项ID

**示例:**
```javascript
menuController.expand('menu-item-1');
```

---

##### `collapse(id)`

折叠指定菜单项。

**参数:**
- `id: string` (必需) - 菜单项ID

**示例:**
```javascript
menuController.collapse('menu-item-1');
```

---

##### `expandAll()`

展开所有菜单项。

**示例:**
```javascript
menuController.expandAll();
```

---

##### `collapseAll()`

折叠所有菜单项。

**示例:**
```javascript
menuController.collapseAll();
```

---

##### `getState()`

获取当前菜单状态。

**返回值:**
- `MenuState` - 菜单状态对象
  - `menuTree: IMenuItem[]` - 菜单树
  - `activeId: string | null` - 当前激活的菜单ID
  - `expandedIds: Set<string>` - 已展开的菜单ID集合

**示例:**
```javascript
const state = menuController.getState();
console.log('当前激活:', state.activeId);
console.log('已展开:', Array.from(state.expandedIds));
```

---

---

## 🎨 UI 实现（样式与图标）

- **样式建议**：使用 Tailwind CSS 本地资源协议声明
  `<script data-cdp-resource="tailwindcss" data-cdp-resource-version="3.4.17" src="https://kwaidoo.com/cdn_general/libs/tailwindcss/3.4.17/tailwindcss.min.js"></script>`
- **图标资源加载规则（强制）**：只复用宿主共享实例 `window.semApp?.ui?.lucide`；禁止任何 CDN fallback
- **明确禁令**：禁止动态创建 `<script>` 加载 Lucide CDN；禁止 `@latest`、`unpkg.com` 或任何 CDN 地址；禁止为了“自包含页面”或“快速交付”跳过宿主资源判断；“自包含页面”不等于“忽略宿主共享资源”
- **图标渲染**：DOM 中静态 `data-lucide` 渲染后必须调用可用实例的 `createIcons()`；动态插入、替换或切换图标后，必须再次执行渲染
- **执行伪代码**：`const lucide = window.semApp?.ui?.lucide; lucide?.createIcons?.();`
- **Loading 组件**（默认使用）：
  `<script data-cdp-resource="wave-loading" data-cdp-resource-version="1.0.0" src="https://kwaidoo.com/cdn_general/libs/@generalui/wave-loading/1.0.0/wave-loading.js"></script>`

使用示例（建议配合 Tailwind CSS 容器）：
```html
<!-- 全局加载（页面初始化） -->
<div class="h-full flex items-center justify-center">
  <wave-loading text="加载中..."></wave-loading>
</div>

<!-- 局部加载（例如表格数据） -->
<div class="relative w-full h-full flex items-center justify-center min-h-[400px]">
  <wave-loading text="加载数据..."></wave-loading>
</div>
```

默认所有 Loading 使用该组件（除非用户指定调整）。

### 设计原则
1. **现代化设计**：使用圆角、阴影、渐变效果
2. **微交互**：添加 hover 效果和过渡动画
3. **层次感**：通过阴影和颜色区分层级
4. **响应式**：确保在不同屏幕尺寸下都有良好体验

### 配色方案
应同步 CDP 主题暗/亮模式，使用主题色：**主色**、**成功**、**警告**、**危险**、**信息**等。
建议通过 CSS 变量统一使用：`--primary-color`、`--success-color`、`--warning-color`、`--danger-color`、`--info-color`、`--bg-color`、`--text-color`。
所有样式都应该有dark模式下对应的样式。

### 默认布局（必须）
- 顶部栏 + 左侧菜单栏 + 右侧内容区
- 整体容器**禁止出现滚动条**
- 左侧菜单栏 + 右侧内容区高度应占满整体容器剩余高度，允许内部滚动
- 菜单栏 + 右侧内容区不需要多余的描述，直接渲染菜单列表及内容
- 应用标题不要有多余的描述及默认值显示

#### 顶部栏（必须）
1. 最左侧显示应用名
2. 中间显示命令搜索框（点击打开命令面板）
3. 最右侧操作栏：主题切换下拉按钮 + AI 助手按钮 + 用户信息（点击下拉登出选项）
4. 主题切换下拉按钮与 AI 助手按钮使用图标，并提供 tooltip 提示

---

## 🧱 骨架模板（默认单容器模式）

以下骨架用于未要求 Tab、多窗口、分栏或保活的普通场景。若用户要求上述能力，必须按“3.4 多容器模式”和“5.1 任意层级菜单 Tab”改造：`init(menuTree)` 不传 `contentContainer`，为页面节点创建稳定容器，并使用 `menuController.mount()`；不得同时保留默认 `#content-area` 路由 Portal 来重复渲染同一页面。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>自定义外壳</title>
  <script data-cdp-resource="tailwindcss" data-cdp-resource-version="3.4.17" src="https://kwaidoo.com/cdn_general/libs/tailwindcss/3.4.17/tailwindcss.min.js"></script>
  <script data-cdp-resource="wave-loading" data-cdp-resource-version="1.0.0" src="https://kwaidoo.com/cdn_general/libs/@generalui/wave-loading/1.0.0/wave-loading.js"></script>
</head>
<body>
  <div id="loading" class="h-full flex items-center justify-center">
    <wave-loading text="加载中..."></wave-loading>
  </div>
  <div id="error" style="display:none"></div>
  <div class="shell" id="shell" style="display:none">
    <aside class="menu">
      <div class="app-header">
        <div id="app-title">应用标题</div>
        <button onclick="openThemePanel()">主题面板</button>
        <button onclick="openAiAssistant()">AI 助手</button>
        <button onclick="openCommandPanel()">命令面板</button>
      </div>
      <div id="menu-root"></div>
      <div class="user-info">
        <span id="user-name"></span>
        <button onclick="handleLogout()">登出</button>
      </div>
    </aside>
    <main class="content">
      <div id="content-area"></div>
    </main>
  </div>

  <script>
    const REQUIRED_MENU_MOUNT_VERSION = '1.6.0';
    const cdpSdk = window.semApp?.cdpSdk;

    function isVersionAtLeast(currentVersion, requiredVersion) {
      const parse = (value) => {
        const parts = String(value || '').trim().split('-')[0].split('.');
        if (parts.length < 2 || parts.some((part) => !/^\d+$/.test(part))) return null;
        return parts.map(Number);
      };
      const current = parse(currentVersion);
      const required = parse(requiredVersion);
      if (!current || !required) return false;
      const length = Math.max(current.length, required.length);
      for (let index = 0; index < length; index += 1) {
        if ((current[index] || 0) > (required[index] || 0)) return true;
        if ((current[index] || 0) < (required[index] || 0)) return false;
      }
      return true;
    }

    const supportsMenuMount = Boolean(cdpSdk) && isVersionAtLeast(
      cdpSdk.version,
      REQUIRED_MENU_MOUNT_VERSION,
    );
    let menuTree = [];
    let menuController;

    async function showToast(message, options = {}) {
      try {
        await cdpSdk.toast(message, options);
      } catch {
        showLocalToast(message, options);
      }
    }

    function showLocalToast(message, options = {}) {
      // TODO: 页面内自实现 toast
      console.warn(message, options);
    }

    function applyTheme(themeState) {
      const { effectiveMode, currentColors } = themeState || {};
      const colors = effectiveMode === 'dark' ? currentColors?.dark : currentColors?.light;
      if (!colors) return;
      const root = document.documentElement;
      root.style.setProperty('--primary-color', `hsl(${colors.primary})`);
      root.style.setProperty('--success-color', `hsl(${colors.success})`);
      root.style.setProperty('--warning-color', `hsl(${colors.warning})`);
      root.style.setProperty('--danger-color', `hsl(${colors.danger})`);
      root.style.setProperty('--info-color', `hsl(${colors.info})`);
      root.style.setProperty('--bg-color', effectiveMode === 'dark' ? '#0f172a' : '#ffffff');
      root.style.setProperty('--text-color', effectiveMode === 'dark' ? '#e2e8f0' : '#0f172a');
    }

    async function subscribeTheme() {
      try {
        const themeState = await cdpSdk.app.theme.getState();
        applyTheme(themeState);
        cdpSdk.app.theme.onChange((state) => applyTheme(state));
      } catch (error) {
        await showToast('主题订阅失败', { type: 'warning', description: error.message });
      }
    }

    function renderMenu(tree, activeId) {
      const root = document.getElementById('menu-root');
      if (!tree || tree.length === 0) {
        root.innerHTML = '<div class="menu-item">暂无菜单</div>';
        return;
      }
      root.innerHTML = tree.map(item => `
        <div class="menu-item ${item.id === activeId ? 'active' : ''}" data-id="${item.id}">
          ${item.title}
        </div>
      `).join('');
    }

function findMenuItemById(items, id) {
      for (const item of items) {
        if (item.id === id) return item;
        if (item.children) {
          const found = findMenuItemById(item.children, id);
          if (found) return found;
        }
      }
      return null;
}

function renderMenuSkeleton() {
  const root = document.getElementById('menu-root');
  root.innerHTML = `
    <div class="menu-skeleton">
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
    </div>
  `;
}

    async function initMenu() {
      try {
        renderMenuSkeleton();
        menuTree = await cdpSdk.data.getMenu();
        menuController = cdpSdk.controllers.createMenu();
        menuController.onStateChange(({ menuTree, activeId }) => renderMenu(menuTree, activeId));
        await menuController.init(menuTree, { contentContainer: '#content-area' });
      } catch (error) {
        await showToast('菜单初始化失败', { type: 'error', description: error.message });
      }
    }

    async function openThemePanel() {
      try {
        const modes = await cdpSdk.app.theme.getModes();
        const presets = await cdpSdk.app.theme.getPresets();
        // TODO: 渲染主题面板
      } catch (error) {
        await showToast('主题面板加载失败', { type: 'error', description: error.message });
      }
    }

    async function openAiAssistant() {
      try {
        await cdpSdk.ui.aiAssistant.open();
      } catch (error) {
        await showToast('AI 助手打开失败', { type: 'error', description: error.message });
      }
    }

    async function openCommandPanel() {
      try {
        await cdpSdk.ui.commandPalette.open();
      } catch (error) {
        await showToast('命令面板打开失败', { type: 'error', description: error.message });
      }
    }

    async function handleLogout() {
      try {
        await cdpSdk.app.logout();
      } catch (error) {
        await showToast('登出失败', { type: 'error', description: error.message });
      }
    }

    async function initUserInfo() {
      const result = await cdpSdk.data.auth.getCurrentUser();
      document.getElementById('user-name').textContent = result?.name || '当前用户';
    }

    async function initAppConfig() {
      const result = await cdpSdk.data.getAppConfig();
      document.getElementById('app-title').textContent = result?.name || '应用';
    }

    async function initCoreModules() {
      await Promise.allSettled([subscribeTheme(), initMenu()]);
    }

    async function initShell() {
      const loading = document.getElementById('loading');
      const error = document.getElementById('error');
      const shell = document.getElementById('shell');

      if (!cdpSdk) {
        error.textContent = '加载失败：CDP-SDK 未加载';
        error.style.display = 'block';
        loading.style.display = 'none';
        return;
      }

      if (!supportsMenuMount) {
        showLocalToast(
          `当前 CDP-SDK 版本为 ${cdpSdk.version || '未知'}，仅启用兼容单容器菜单模式`,
          { type: 'warning' },
        );
      }

      const tasks = [
        initUserInfo().catch((err) =>
          showToast('用户信息获取失败', { type: 'warning', description: err.message })
        ),
        initAppConfig().catch((err) =>
          showToast('应用配置获取失败', { type: 'warning', description: err.message })
        ),
        initCoreModules()
      ];

      await Promise.allSettled(tasks);

      loading.style.display = 'none';
      shell.style.display = 'flex';
    }

    window.addEventListener('load', () => {
      initShell().catch((err) => {
        const error = document.getElementById('error');
        const loading = document.getElementById('loading');
        error.textContent = `加载失败：${err.message}`;
        error.style.display = 'block';
        loading.style.display = 'none';
      });
    });

    window.addEventListener('beforeunload', function () {
        if (menuController) {
            menuController.destroy();
            console.log('[CustomShell] MenuController 已清理');
        }
    });
  </script>
</body>
</html>
```

---

## ✅ 检查清单

- [ ] 按 CDP-SDK 1.6.0+ 的菜单规则生成
- [ ] SDK 存在后读取了 `window.semApp.cdpSdk.version`，并用数值分段比较完成 1.6.0 版本门禁，没有直接比较版本字符串
- [ ] `version` 缺失、非法或低于 1.6.0 时没有调用 `menuController.mount()`；多容器需求会阻断并提示升级，普通菜单才允许降级为单容器
- [ ] 菜单 + 内容区已实现；单容器使用固定 Portal，Tab/窗口/分栏为每个页面使用稳定唯一容器
- [ ] 未要求多页面并存时使用 `init(menuTree, { contentContainer })`；要求 Tab、窗口、分栏或保活时使用 `init(menuTree)` + `menuController.mount()`
- [ ] 多容器模式传给 `mount()` 的是完整 MenuItem，而不是 ID，也没有自行拆分编码调用 `portal.mountPage()`
- [ ] `select()` 与 `mount()` 按需求显式组合，没有误认为 `mount()` 会自动导航
- [ ] Tab 场景不会通过 `innerHTML` 重建已挂载容器；隐藏不卸载用于保活，关闭时调用卸载函数
- [ ] 多容器模式在页面卸载时释放全部挂载实例，并调用 `menuController.destroy()`
- [ ] 先检查 CDP-SDK，再初始化逻辑
- [ ] 应用标题、主题订阅、主题面板、AI 助手、命令面板、用户信息、登出均已集成（除非用户明确不要）
- [ ] 所有样式都合理同步使用 CDP 主题模式/颜色，有默认样式兜底，且都有深色模式对应样式
- [ ] 所有 SDK 调用都有 `showToast` 友好提示与错误兜底（主题订阅静默默认样式兜底）
- [ ] 各模块功能正常，且模块级错误不影响整体渲染
- [ ] 若使用 Lucide 图标，已优先判断并复用 `window.semApp?.ui?.lucide`
- [ ] 若使用 Lucide 图标，没有动态加载任何 Lucide CDN
- [ ] 若使用 Lucide 图标，没有在 `<head>` 或 HTML 顶层无条件直引 `lucide.min.js`
- [ ] 若使用 Lucide 图标，没有为了“单页自包含”“快速交付”“减少代码”而跳过宿主资源判断
- [ ] 若使用 Lucide 图标，静态 `data-lucide` 渲染后已调用 `createIcons()`，动态插入、替换或切换图标后已再次渲染
