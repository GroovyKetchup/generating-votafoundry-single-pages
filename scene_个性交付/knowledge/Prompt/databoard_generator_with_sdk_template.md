# HTML 数据看板生成器

## 🎯 任务目标

根据配置 JSON 生成一个现代化的数据看板 HTML 文件，实现数据的可视化展示和交互分析。

## 🔴 核心原则（必须遵守）

1. **✅ 必须使用 PanelXSdkProxy 获取真实数据**：通过 `sdk.api.queryFormDataList({ panelCode: 'IML_XXXXX' })` 从指定面板获取数据
2. **✅ 必须正确初始化 PanelXSdkProxy**：PanelXSdkProxy 由 CDP 宿主注入，页面直接用全局 `PanelXSdkProxy` 构造函数初始化，**禁止**通过 script src、本地脚本或 preload 动态加载
3. **🚫 严禁 Mock 数据**：不允许硬编码数据；仅在明确要求或作为降级方案时使用

## 📋 配置文件解读

### 配置 JSON 的本质
配置 JSON 是**业务需求文档**，不是技术规范：

- `metadata`：看板的基本信息和业务背景
- `dataSchema.dataSources`：指示数据来源和字段结构
- `uiSchema.pages`：描述界面展示需求

### 关键理解
- ❌ 不要逐字解析 SQL 语句
- ❌ 不要机械渲染组件树
- ✅ 理解业务意图，用最佳实践实现

**示例**：
```
配置说：SELECT COUNT(*) as total FROM t1
你应该：从对应面板获取数据，用 data.length 计算
而不是：实现 SQL 解析器
```

## 📊 多数据源处理

当配置包含多个面板时，需要整合数据：

### 常见场景
1. **主从关联**：主数据 + 明细数据
2. **数据汇总**：多源统计报表
3. **多维展示**：综合信息看板

### 实现方式
```javascript
// 并行获取多源数据
const [dataA, dataB] = await Promise.all([
  sdk.api.queryFormDataList({ panelCode: 'IML_00001' }),
  sdk.api.queryFormDataList({ panelCode: 'IML_00002' })
]);

// 数据整合
const listA = dataA?.data?.list || [];
const listB = dataB?.data?.list || [];

// 根据业务需求处理
const combined = listA.map(a => ({
  ...a,
  details: listB.filter(b => b.关联ID === a.ID)
}));
```

## ✅ 输出规范

- **格式**：单个 HTML 文件，直接输出代码，**不要任何解释、说明或markdown标记**
- **CDN 资源声明**：
  - Tailwind CSS: `<script data-cdp-resource="tailwindcss" data-cdp-resource-version="3.4.17" src="https://kwaidoo.com/cdn_general/libs/tailwindcss/3.4.17/tailwindcss.min.js"></script>`
  - ECharts: `<script data-cdp-resource="echarts" data-cdp-resource-version="5.6.0" src="https://kwaidoo.com/cdn_general/libs/echarts/5.6.0/dist/echarts.min.js"></script>`
  - Lucide Icons：只复用 `window.semApp?.ui?.lucide`，禁止任何 CDN fallback
  - Loading: `<script data-cdp-resource="wave-loading" data-cdp-resource-version="1.0.0" src="https://kwaidoo.com/cdn_general/libs/@generalui/wave-loading/1.0.0/wave-loading.js"></script>`
- **语言**：简体中文
- **重要**：只返回纯 HTML 代码，从 `<!DOCTYPE html>` 开始到 `</html>` 结束，不要包含任何其他内容

---

## ⚠️ 错误边界处理（必须）

- API/主题/权限等**局部**失败必须被局部兜底处理，禁止导致整页崩溃或阻断其他模块渲染。
- 失败时提供降级展示（空态/默认样式/跳过该模块），并通过 `toast()` 等方式友好提示用户；`toast()` 自身也可能失败，至少静默兜底（不影响渲染），也可降级为页面内自实现 toast（不依赖 `cdpSdk`）。
- **任何报错必须 `console.error` 打印出来**（便于外部监测），即便已 toast 或降级。
- 例如主题适配失败或超时，直接使用页面默认样式继续渲染。

---

## 🤝 CDP-SDK 集成（必须）

> **重要**：CDP-SDK 用于与 CDP 宿主环境进行双向通信，实现主题同步和 AI 动作调用。

### 1. SDK 引入方式

#### 方式 A：自动注入（推荐）
如果页面通过 **ExternalPage 组件（面板网页）** 加载，CDP 会自动注入 SDK，无需任何操作。

#### 方式 B：禁止手动引入
CDP-SDK 统一由宿主注入。交付 HTML **禁止**用 script 标签的 `src` 属性外链或本地引入，也禁止 preload 动态加载；宿主注入后直接从 `window.semApp.cdpSdk` 使用。

### 2. SDK 可用性检查

```javascript
if (window.semApp && window.semApp.cdpSdk) {
    console.log('✅ CDP-SDK 已加载');
} else {
    console.error('❌ CDP-SDK 未加载');
}
```

### 3. 主题适配（必须）

```javascript
// 应用主题到页面
function applyTheme(themeConfig) {
    if (!themeConfig || !themeConfig.preset) return;
    
    // 设置主题模式
    document.documentElement.setAttribute('data-cdp-theme', themeConfig.mode);
    document.documentElement.classList.toggle('dark', themeConfig.mode === 'dark');
    
    // 获取当前模式的颜色
    const colors = themeConfig.mode === 'dark' 
        ? themeConfig.preset.dark 
        : themeConfig.preset.light;
    
    // 设置 CSS 变量
    document.documentElement.style.setProperty('--primary', `hsl(${colors.primary})`);
    document.documentElement.style.setProperty('--success', `hsl(${colors.success})`);
    document.documentElement.style.setProperty('--warning', `hsl(${colors.warning})`);
    document.documentElement.style.setProperty('--danger', `hsl(${colors.danger})`);
    document.documentElement.style.setProperty('--info', `hsl(${colors.info})`);
    
    // 重新渲染图表以应用主题
    renderCharts();
}

// 初始化主题并订阅变化（越早调用越好，如果有其他异步任务可以用Promise.all并行跑，在主题同步前注意做默认视觉反馈（例如loadgin/骨架屏））
async function setupTheme() {
    if (!window.semApp || !window.semApp.cdpSdk) {
        console.error('CDP-SDK 未加载');
        return;
    }
    try {
        // 获取当前主题
        const themeConfig = await window.semApp.cdpSdk.getTheme();
        applyTheme(themeConfig);
        
        // 订阅主题变化
        window.semApp.cdpSdk.onThemeChange((newTheme) => {
            applyTheme(newTheme);
        });
    } catch (error) {
        console.error('主题适配失败:', error);
    }
}
```

### 4. 动作注册（必须）

将页面功能注册到 CDP，让 AI 智能体可以调用：

```javascript
// 动作定义
const actionDefinitions = [
    {
        actionName: 'getData',
        actionAlias: '获取数据',
        actionDescription: '获取当前看板的所有数据',
        actionParameterSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        actionName: 'refreshData',
        actionAlias: '刷新数据',
        actionDescription: '重新拉取并刷新看板数据',
        actionParameterSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    }
    // 根据业务需求添加更多动作
];

// 动作处理器
const actionHandlers = {
    getData: async () => {
        const data = getCurrentDashboardData();
        return { success: true, message: '已获取数据', data };
    },
    refreshData: async () => {
        await loadDashboardData();
        return { success: true, message: '已刷新' };
    }
};

// 操作指南（帮助 AI 理解页面功能）
const actionGuidance = `
## 页面概览
这是一个数据看板页面，展示关键业务指标和统计图表。

## 可用操作
- 获取数据: \`getData()\` - 获取当前看板的所有数据
- 刷新数据: \`refreshData()\` - 重新拉取并刷新看板数据

## 典型示例
- "获取当前数据"
- "刷新看板数据"
- "重新加载统计信息"
`.trim();

// 注册动作到 CDP（不影响页面主要功能，异步进行，让它在后台跑）
async function registerActions() {
    if (!window.semApp || !window.semApp.cdpSdk) {
        console.error('CDP-SDK 未加载');
        return;
    }
    try {
        await window.semApp.cdpSdk.setActions({
            guidance: actionGuidance,
            definitions: actionDefinitions,
            handlers: actionHandlers,
            registrationDelay: 100
        });
        console.log('✅ 动作注册成功');
    } catch (error) {
        console.error('❌ 动作注册失败:', error);
    }
}
```

### 5. 便捷方法

```javascript
// 显示提示消息
await window.semApp.cdpSdk.toast('操作成功');
await window.semApp.cdpSdk.toast('操作失败', { type: 'error', description: '详细错误信息' });

// 关闭弹窗（如果页面在弹窗中）
await window.semApp.cdpSdk.closeModal('confirm');  // 确认关闭，触发父页面刷新
await window.semApp.cdpSdk.closeModal('cancel');   // 取消关闭

// 获取初始化数据（弹窗场景）
const initData = window.semApp.cdpSdk.getInitData();
```

---

## ✅ 完整集成示例

```javascript
// === 主题适配 ===
function applyTheme(themeConfig) {
    if (!themeConfig || !themeConfig.preset) return;
    document.documentElement.setAttribute('data-cdp-theme', themeConfig.mode);
    document.documentElement.classList.toggle('dark', themeConfig.mode === 'dark');
    const colors = themeConfig.mode === 'dark' ? themeConfig.preset.dark : themeConfig.preset.light;
    document.documentElement.style.setProperty('--primary', `hsl(${colors.primary})`);
    document.documentElement.style.setProperty('--success', `hsl(${colors.success})`);
    document.documentElement.style.setProperty('--warning', `hsl(${colors.warning})`);
    document.documentElement.style.setProperty('--danger', `hsl(${colors.danger})`);
    document.documentElement.style.setProperty('--info', `hsl(${colors.info})`);
    renderCharts(); // 重新渲染图表
}

async function setupTheme() {
    if (!window.semApp || !window.semApp.cdpSdk) return;
    try {
        const themeConfig = await window.semApp.cdpSdk.getTheme();
        applyTheme(themeConfig);
        window.semApp.cdpSdk.onThemeChange(applyTheme);
    } catch (error) {
        console.error('主题适配失败:', error);
    }
}

// === 动作注册 ===
const actionDefinitions = [
    {
        actionName: 'getData',
        actionAlias: '获取数据',
        actionDescription: '获取当前看板的所有数据',
        actionParameterSchema: { type: 'object', properties: {}, required: [] }
    },
    {
        actionName: 'refreshData',
        actionAlias: '刷新数据',
        actionDescription: '重新拉取并刷新看板数据',
        actionParameterSchema: { type: 'object', properties: {}, required: [] }
    }
];

const actionHandlers = {
    getData: async () => {
        return { success: true, message: '已获取数据', data: dashboardData };
    },
    refreshData: async () => {
        await loadDashboardData();
        return { success: true, message: '已刷新' };
    }
};

const actionGuidance = `
## 页面概览
数据看板页面，展示关键业务指标和统计图表。

## 可用操作
- 获取数据: \`getData()\` - 获取当前看板数据
- 刷新数据: \`refreshData()\` - 刷新看板数据

## 典型示例
- "获取当前数据"
- "刷新看板"
`.trim();

async function registerActions() {
    if (!window.semApp || !window.semApp.cdpSdk) return;
    try {
        await window.semApp.cdpSdk.setActions({
            guidance: actionGuidance,
            definitions: actionDefinitions,
            handlers: actionHandlers,
            registrationDelay: 100
        });
        console.log('✅ 动作注册成功');
    } catch (error) {
        console.error('❌ 动作注册失败:', error);
    }
}
```

### CDP-SDK API 参考

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `getInitData()` | 获取初始化数据 | `Object` |
| `getTheme()` | 获取当前主题配置 | `Promise<ThemeConfig>` |
| `onThemeChange(callback)` | 订阅主题变化 | `Function`（取消订阅） |
| `toast(message, options)` | 显示提示消息 | `Promise<void>` |
| `closeModal(reason)` | 关闭弹窗 | `Promise<void>` |
| `setActions(config)` | 注册动作到 CDP | `Promise<boolean>` |
| `dispatch(instruction)` | 分发指令到 CDP | `Promise<any>` |
| `destroy()` | 销毁 SDK 连接 | `void` |

## 📐 布局规范

### 防止横向滚动
- 使用 `w-full` 或百分比宽度
- 最外层容器添加 `overflow-x-hidden`
- Grid 使用响应式列数：`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`

### 正确示例
```html
<div class="w-full overflow-x-hidden">
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
    <!-- 内容 -->
  </div>
</div>
```

## 🎨 图标使用

### 图标资源加载规则（强制）

1. **只复用宿主共享实例**：`const lucide = window.semApp?.ui?.lucide; lucide?.createIcons?.();`。
2. 禁止动态创建 `<script>` 加载 Lucide CDN；禁止 `@latest`、`unpkg.com` 或任何 CDN 地址。
3. **禁止为了“自包含页面”或“快速交付”跳过宿主资源判断**；“自包含页面”不等于“忽略宿主共享资源”。
4. DOM 中静态 `data-lucide` 渲染后必须调用 `createIcons()`；动态插入、替换或切换图标后，必须再次执行渲染。

### 引入方式
```html
<script>
  function renderLucideIcons() {
    const lucide = window.semApp?.ui?.lucide;
    lucide?.createIcons?.();
  }
</script>
```

### 使用方法
```html
<i data-lucide="users" class="w-6 h-6"></i>
<script>
  renderLucideIcons();
</script>
```

### 生成前验收项（不得省略）

- 是否先判断 `window.semApp?.ui?.lucide`。
- 是否只复用 `window.semApp?.ui?.lucide`，没有动态加载任何 Lucide CDN。
- 是否没有把 Lucide CDN 写成默认直引 `<script src="...lucide.min.js"></script>`。
- 是否在静态 `data-lucide` 渲染后调用 `createIcons()`。
- 是否在动态插入、替换或切换图标后再次调用 `createIcons()`。

### 常用图标推荐
| 场景 | 图标                       | 用途      |
| ---- | -------------------------- | --------- |
| 用户 | users, user                | 人员统计  |
| 数据 | bar-chart-2, pie-chart     | 数据图表  |
| 趋势 | trending-up, activity      | 增长趋势  |
| 状态 | check-circle, alert-circle | 成功/警告 |
| 操作 | refresh-cw, download       | 刷新/下载 |

## 🔧 PanelXSdkProxy 使用详解

### 1. SDK 初始化
```javascript
const sdk = new PanelXSdkProxy({
  busDomainCode: '{{busDomainCode}}',
  // timeout: 60000   // ⚠ Proxy 专属参数（非原生 PanelXSdk）：请求超时（毫秒），默认 5 分钟；用户有超时要求时显式传入
});
```

> **说明：**`timeout` 是 **`PanelXSdkProxy`（CDP 宿主下发、已内置 `PanelXSdk` 的代理类）** 的参数，**不是**原生 `PanelXSdk` 的参数；单页无需自行引入 `PanelXSdk`。默认请求超时 **5 分钟**，用户有要求时传 `timeout`（毫秒）。

### 2. 获取数据
```javascript
// 根据配置信息硬编码面板代码
// current_panel_config 包含所有相关面板的配置，你需要从中提取并硬编码
const CUSTOMER_PANEL = 'IML_00003';  // 客户管理面板
const LEAD_PANEL = 'IML_00005';       // 线索管理面板
const OPPORTUNITY_PANEL = 'IML_00006'; // 商机管理面板
const ACTIVITY_PANEL = 'IML_00007';   // 销售活动面板
const CONTRACT_PANEL = 'IML_00008';   // 合同管理面板

// 并行获取所有面板数据
const [customerRes, leadRes, opportunityRes, activityRes, contractRes] = await Promise.all([
  sdk.api.queryFormDataList({ panelCode: CUSTOMER_PANEL }),
  sdk.api.queryFormDataList({ panelCode: LEAD_PANEL }),
  sdk.api.queryFormDataList({ panelCode: OPPORTUNITY_PANEL }),
  sdk.api.queryFormDataList({ panelCode: ACTIVITY_PANEL }),
  sdk.api.queryFormDataList({ panelCode: CONTRACT_PANEL })
]);

const data = {
  customers: customerRes?.data?.list || [],
  leads: leadRes?.data?.list || [],
  opportunities: opportunityRes?.data?.list || [],
  activities: activityRes?.data?.list || [],
  contracts: contractRes?.data?.list || []
};
```

### 3. 处理关联字段

#### 识别关联字段
查看 `current_panel_config` 中每个面板的 `dataSchema.fields`，找出有 `remoteOptionConfig` 的字段。

#### 实现步骤
1. **硬编码配置**（根据配置信息）：
```javascript
const RELATION_FIELD_CONFIG = {
  'IML_00003': [
    { 
      fieldName: '创建人', 
      remotePanelCode: 'IML_USER', 
      remoteFieldName: '姓名' 
    }
  ]
};
```

2. **获取映射数据**：
```javascript
async function getRelationMaps(sdk, panelCode) {
  const maps = {};
  const config = RELATION_FIELD_CONFIG[panelCode] || [];
  
  await Promise.all(config.map(async field => {
    const result = await sdk.api.getRelateDataList(
      field.remoteFieldName,
      field.remotePanelCode
    );
    
    if (result.state === '200' && result.data) {
      const map = new Map();
      result.data.forEach(item => {
        map.set(item.key, item.value);
      });
      maps[field.fieldName] = map;
    }
  }));
  
  return maps;
}
```

3. **转换数据**：
```javascript
function enrichDataWithRelations(data, relationMaps) {
  return data.map(item => {
    const newItem = { ...item };
    Object.entries(relationMaps).forEach(([fieldName, map]) => {
      const value = item[fieldName];
      if (value && map.has(value)) {
        newItem[`${fieldName}_名称`] = map.get(value);
      }
    });
    return newItem;
  });
}
```

## 🚀 完整实现流程

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. 初始化 SDK
    const sdk = new PanelXSdkProxy({
      busDomainCode: '{{busDomainCode}}'
    });
    
    // 2. 注册动作
    registerActions();
    
    // 3. 并行执行 主题设置 和 数据加载
    await Promise.all([
        setupTheme(),       // 包含获取主题 + 应用 CSS 变量
        loadDashboardData() // 网络请求
    ]);
    
    // 4. 渲染界面
    renderDashboard();
    
  } catch (err) {
    console.error('初始化失败:', err);
    showError(err.message);
  }
});
```

---

## 📥 输入变量

### 1. 当前看板配置（current_panel_config）

包含所有相关面板的完整配置信息：

```json
{{current_panel_config}}
```

**配置结构说明**：
- 是一个包含多个面板配置的 JSON 数组
- 每个元素包含：
  - `metadata.panelCode`：面板编号（如 'IML_00003'）
  - `metadata.panelName`：面板名称（如 '客户管理'）
  - `dataSchema.fields`：字段定义列表
  - `description`：业务描述

**如何使用**：
1. **提取面板代码**：从每个配置的 `metadata.panelCode` 提取
2. **识别关联字段**：查看 `dataSchema.fields` 中有 `remoteOptionConfig` 的字段
3. **硬编码到代码**：将提取的信息硬编码到生成的代码中

### 2. 业务域代码

`{{busDomainCode}}`

---

## 🔍 配置解析示例

假设 `current_panel_config` 包含以下面板配置：

```json
[
  {
    "metadata": {
      "panelCode": "IML_00003",
      "panelName": "客户管理"
    },
    "dataSchema": {
      "fields": [
        {"dataName": "客户名称", "dataType": "STRING"},
        {"dataName": "创建人", "dataType": "STRING", "remoteOptionConfig": {"panelCode": "IML_USER", "fieldName": "姓名"}}
      ]
    }
  }
]
```

**你应该生成的代码**：

```javascript
// 1. 硬编码面板代码
const CUSTOMER_PANEL = 'IML_00003';

// 2. 硬编码关联字段配置
const RELATION_FIELD_CONFIG = {
  'IML_00003': [
    { fieldName: '创建人', remotePanelCode: 'IML_USER', remoteFieldName: '姓名' }
  ]
};

// 3. 使用这些常量获取数据
const customerData = await sdk.api.queryFormDataList({ panelCode: CUSTOMER_PANEL });
```

## 📊 数据可视化

### ECharts 最佳实践

1. **容器设置**：
```html
<div id="chart" style="width: 100%; height: 350px;"></div>
```

2. **响应式处理**：
```javascript
const chart = echarts.init(container);
window.addEventListener('resize', () => chart.resize());
```

3. **颜色处理（重要）**：
ECharts 无法直接在 JavaScript 配置中解析 `var(--primary)` 这种 CSS 变量。应直接使用硬编码的颜色值。
```javascript
// 根据主题模式直接使用硬编码颜色
const isDark = document.documentElement.getAttribute('data-cdp-theme') === 'dark';
const primaryColor = isDark ? '#818cf8' : '#4f46e5';
const textColor = isDark ? '#cbd5e1' : '#334155';
const axisLineColor = isDark ? '#475569' : '#e2e8f0';
const splitLineColor = isDark ? '#334155' : '#f1f5f9';
// 在配置中使用这些颜色变量
```

4. **主题同步**：
```javascript
const isDark = document.documentElement.getAttribute('data-cdp-theme') === 'dark';
const chart = echarts.init(container, isDark ? 'dark' : null);
```

## ⚠️ 常见错误避免

### 1. 数据加载
- ✅ 显示 loading 状态
- ✅ 错误处理和降级方案
- ❌ 无反馈的长时间等待
- ❌ **不要在代码中解析 `current_panel_config`**，它只是参考信息

### 2. 表单按钮必须悬浮显示
- ❌ **错误**：表单按钮（保存、取消）放在表单底部，需要滚动才能看到
- ✅ **正确**：表单按钮应该**固定在弹窗底部**，使用 `sticky bottom-0` 或固定定位，确保用户无需滚动即可操作

```html
<!-- ✅ 正确示例：表单弹窗结构 -->
<div class="modal-content flex flex-col max-h-[80vh]">
  <div class="modal-header flex-shrink-0">...</div>
  <div class="modal-body flex-1 overflow-auto p-6">
    <!-- 表单字段，可滚动 -->
  </div>
  <div class="modal-footer flex-shrink-0 sticky bottom-0 bg-white border-t p-4">
    <!-- 按钮始终可见 -->
    <button>取消</button>
    <button>保存</button>
  </div>
</div>
```

### 3. 不要显示业务域信息
- ❌ **错误**：在页面上显示"业务域：GroupChat_Inst_xxx"等技术信息
- ✅ **正确**：业务域代码仅用于 SDK 初始化，**不要在界面上展示**

### 4. 不要显示面板技术信息
- ❌ **错误**：在页面上显示"面板编号：IML_00001"、"面板介绍：xxx"等配置信息
- ✅ **正确**：面板编号仅用于 API 调用，**不要在界面上展示**。页面标题应使用业务名称（如"销售看板"）

### 5. 时间字段处理
- ❌ **错误**：将时间戳当作字符串显示，或使用错误的日期格式
- ❌ **错误**：时间字段数据将显示的字符串传给后端
- ✅ **正确**：时间字段返回的是**时间戳**，需要使用 `new Date(timestamp)` 转换
- ✅ **正确**：显示时使用合适的格式，如 `2024-12-09 14:30` 或 `2024/12/09`
- ✅ **正确**：时间字段数据传给后端是需要转换为**时间戳**，若为空的话传null

### 6. 界面展示
- ❌ **错误**：使用浏览器原生的 `<select>`, `<input type="date">`, `alert()`, `confirm()`
- ❌ **错误**：使用原生的 CSS 样式（如 `border: 1px solid black`）而不使用 Tailwind
- ✅ **正确**：使用 Tailwind CSS 构建现代化组件，自定义下拉框、弹窗等
- ✅ **正确**：下拉框必须自己实现（div + ul/li），支持搜索、键盘导航等交互
- ✅ **正确**：响应式设计

### 7. 用户体验
- ✅ 操作反馈（loading）
- ✅ 错误提示友好
- ❌ 技术信息暴露
- ❌ **绝对禁止将 Object 直接传给 textContent**，这会导致 React Error #31。数据必须先处理为字符串。
- ❌ **绝对禁止在 ECharts 配置中直接使用 `var(--primary)` 或 `color-mix` 等复杂 CSS 颜色函数**，必须使用硬编码的颜色值。

### 8. 禁止解释和提示
- ❌ **错误**：在页面顶部显示"本页面用于展示XXX数据"等解释性文字
- ❌ **错误**：在页面上显示用户的原始需求描述
- ✅ **正确**：直接展示功能界面，无需多余解释

### 9. 配置处理（重要）
- ❌ **不要解析 `current_panel_config` JSON**，它不是运行时数据
- ✅ 根据配置信息**硬编码**面板代码和逻辑到代码中
- ✅ `source_panel_schema` 仅用于识别关联字段，不要在代码中使用

### 10. 🚨 深色模式适配（强制）

**所有文本和背景颜色必须同时提供浅色和深色模式的样式！**

- ❌ **禁止使用固定颜色而不提供 dark: 变体**
- ✅ **所有文本颜色必须有 dark: 对应样式**
- ✅ **所有背景颜色必须有 dark: 对应样式**
- ✅ **所有边框颜色必须有 dark: 对应样式**

**强制规则**：
```
❌ 错误：text-slate-800                    → 深色模式下不可见
✅ 正确：text-slate-800 dark:text-slate-100  → 两种模式都可见

❌ 错误：bg-white                           → 深色模式下刺眼
✅ 正确：bg-white dark:bg-slate-800          → 两种模式都和谐

❌ 错误：border-slate-200                    → 深色模式下不明显
✅ 正确：border-slate-200 dark:border-slate-700 → 两种模式都清晰
```

**常用颜色映射表**：
| 元素 | 浅色模式 | 深色模式 |
|------|----------|----------|
| 页面背景 | `bg-gray-50` | `dark:bg-slate-900` |
| 卡片背景 | `bg-white` | `dark:bg-slate-800` |
| 主标题 | `text-slate-900` | `dark:text-white` |
| 副标题 | `text-slate-700` | `dark:text-slate-200` |
| 正文文本 | `text-slate-600` | `dark:text-slate-300` |
| 辅助文本 | `text-slate-500` | `dark:text-slate-400` |
| 边框 | `border-slate-200` | `dark:border-slate-700` |
| KPI 数字 | `text-slate-900` | `dark:text-white` |
| 按钮文本 | `text-slate-700` | `dark:text-slate-200` |

## 🎨 设计建议

### KPI 卡片设计
```html
<!-- ✅ 正确示例：所有颜色都有 dark: 变体 -->
<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
  <div class="flex items-center gap-3 mb-2">
    <div class="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
      <i data-lucide="users" class="w-5 h-5 text-blue-500 dark:text-blue-400"></i>
    </div>
    <span class="text-slate-500 dark:text-slate-400 text-sm">指标名称</span>
  </div>
  <div class="text-3xl font-bold text-slate-900 dark:text-white">128</div>
  <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">较上月 +12%</div>
</div>
```

### 设计原则
1. **现代化设计**：使用圆角、阴影、渐变效果
2. **微交互**：添加 hover 效果和过渡动画
3. **层次感**：通过阴影和颜色区分层级
4. **响应式**：确保在不同屏幕尺寸下都有良好体验

### 配色方案
- **主色**：使用硬编码颜色值，如浅色模式 `#4f46e5`，深色模式 `#818cf8`
- **成功**：使用硬编码颜色值，如 `#10b981`
- **警告**：使用硬编码颜色值，如 `#f59e0b`
- **危险**：使用硬编码颜色值，如 `#ef4444`
- **信息**：使用硬编码颜色值，如 `#3b82f6`

注意：在 ECharts 配置中，必须根据主题模式使用对应的硬编码颜色值，不能使用 CSS 变量或 CSS 函数。

### 图表容器设计
```html
<!-- ✅ 正确示例：所有颜色都有 dark: 变体 -->
<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-semibold text-slate-900 dark:text-white">图表标题</h3>
    <div class="flex items-center gap-2">
      <span class="text-sm text-slate-500 dark:text-slate-400">数据更新时间</span>
      <i data-lucide="clock" class="w-4 h-4 text-slate-400 dark:text-slate-500"></i>
    </div>
  </div>
  <div id="chart" style="width: 100%; height: 350px;"></div>
</div>
```

### 错误处理设计
```html
<!-- ✅ 正确示例：所有颜色都有 dark: 变体 -->
<div id="error-message" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
  <div class="flex items-start gap-3">
    <div class="p-1 rounded-full bg-red-100 dark:bg-red-900/30">
      <i data-lucide="alert-circle" class="w-4 h-4 text-red-600 dark:text-red-400"></i>
    </div>
    <div class="flex-1">
      <h4 class="text-sm font-medium text-red-800 dark:text-red-300">错误提示</h4>
      <p class="text-sm text-red-600 dark:text-red-400 mt-1" id="error-text"></p>
    </div>
    <button onclick="this.parentElement.parentElement.classList.add('hidden')" 
            class="text-red-400 hover:text-red-600">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  </div>
</div>
```

### Loading 组件（默认使用）

引入：
```html
<script data-cdp-resource="wave-loading" data-cdp-resource-version="1.0.0" src="https://kwaidoo.com/cdn_general/libs/@generalui/wave-loading/1.0.0/wave-loading.js"></script>
```

使用（建议配合 Tailwind CSS 容器）：
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

## 检查清单

生成前确认：
- [ ] 理解业务需求（非字面解析）
- [ ] 使用正确 SDK 引入
- [ ] 实现真实数据获取
- [ ] 处理关联字段
- [ ] 适配 CDP 主题
- [ ] 注册数据操作
- [ ] 提供操作指南
- [ ] 响应式布局
- [ ] 错误处理机制
- [ ] 错误边界处理（局部失败不影响整体，提供降级与提示）
- [ ] 加载状态反馈
- [ ] 无技术信息暴露
- [ ] 从 `current_panel_config` 提取面板代码并硬编码
- [ ] 从 `dataSchema.fields` 识别关联字段并硬编码配置
- [ ] 不解析任何配置 JSON，仅作为参考信息
- [ ] 所有文本颜色都有 dark: 变体
- [ ] 所有背景颜色都有 dark: 变体
- [ ] 所有边框颜色都有 dark: 变体
- [ ] 若使用 Lucide 图标，已优先判断并复用 `window.semApp?.ui?.lucide`
- [ ] 若使用 Lucide 图标，没有动态加载任何 Lucide CDN
- [ ] 若使用 Lucide 图标，没有在 `<head>` 或 HTML 顶层无条件直引 `lucide.min.js`
- [ ] 若使用 Lucide 图标，没有为了“单页自包含”“快速交付”“减少代码”而跳过宿主资源判断
- [ ] 若使用 Lucide 图标，静态 `data-lucide` 渲染后已调用 `createIcons()`，动态插入、替换或切换图标后已再次渲染

## 代码示例

### 正确的数据获取方式
```javascript
// 正确：硬编码面板代码
const CUSTOMER_PANEL = 'IML_00003';
const OPPORTUNITY_PANEL = 'IML_00006';

async function loadDashboardData() {
  showLoading();
  
  try {
    // 并行获取数据
    const results = await Promise.allSettled([
      sdk.api.queryFormDataList({ panelCode: CUSTOMER_PANEL }),
      sdk.api.queryFormDataList({ panelCode: OPPORTUNITY_PANEL })
    ]);
    
    // 处理结果
    const data = results.map(result => 
      result.status === 'fulfilled' ? result.value?.data?.list || [] : []
    );
    
    // 渲染
    renderCharts(data);
    
  } catch (err) {
    showError('加载失败: ' + err.message);
  } finally {
    hideLoading();
  }
}
```

### 错误示例（不要这样做）
```javascript
// 错误：不要解析配置
// const configs = JSON.parse('{{current_panel_config}}');
// const panelCode = configs[0].metadata.panelCode;

// 错误：PanelXSdkProxy 没有 toast 方法，应使用 CDP-SDK
// sdk.toast()  // 错误！

// 正确：使用 CDP-SDK 的 toast
// await window.semApp.cdpSdk.toast('操作成功');
```

## 记住
始终以用户体验为先，创建美观、实用、可靠的数据看板。同时确保 CDP-SDK 主题适配和动作注册正确实现。
