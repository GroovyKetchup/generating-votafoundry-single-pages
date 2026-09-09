# HTML 通用页面生成器

## 🎯 你的任务

根据**用户需求**和配置 JSON 中的业务信息，创建一个完整的 HTML 页面。

**🚨 最终产出以用户需求为准**：
- 用户需求明确时，按用户需求生成
- 用户需求不明确时，根据配置 JSON 推断合适的页面类型（表格、表单、看板、详情页等）

## 🔴 三条红线（违反即失败）

1. **✅ 必须使用 PanelXSdkProxy 获取真实数据**：`sdk.api.queryFormDataList({ panelCode: 'IML_XXXXX' })`
2. **✅ 必须正确初始化 PanelXSdkProxy**：PanelXSdkProxy 由 CDP 宿主注入，页面直接用全局 `PanelXSdkProxy` 构造函数初始化，**禁止**通过 script src、本地脚本或 preload 动态加载
3. **🚫 严禁 Mock 数据**：不允许任何 `const data = [...]` 硬编码数据；若用户明确要求使用 Mock 数据，则按用户要求执行（优先级最高）。

## 📋 配置 JSON 的作用

配置 JSON **是业务参考文档**，帮助你理解数据结构和业务场景：

- `metadata`：页面标题、描述、面板编号
- `dataSchema.datas`：告诉你"有哪些字段、字段类型、选项配置"
- `uiSchema.pages`：提供一个参考布局（表格列、表单字段、按钮等）

**🚨 关键理解**：
- ✅ **应该**理解业务意图，用你自己的方式实现
- ✅ **应该**根据用户需求决定页面类型和布局
- ✅ **可以参考** `uiSchema` 中的配置，但不必完全照搬
- ✅ **应该**根据 `dataSchema.datas` 中的字段类型和选项配置渲染正确的控件

## 📊 多面板数据整合

当配置中包含**多个面板**时，这些面板的数据可能需要**结合使用**才能完成用户的需求：

**常见场景**：
1. **主从关联**：从面板A获取主数据，从面板B获取关联/明细数据
2. **数据汇总**：将多个面板的数据进行汇总统计
3. **多表联动**：在同一页面上管理多个相关联的数据表

**实现方式**：
```javascript
// 从多个面板获取数据
const [dataA, dataB] = await Promise.all([
  sdk.api.queryFormDataList({ panelCode: 'IML_00001' }),
  sdk.api.queryFormDataList({ panelCode: 'IML_00002' })
]);

// 数据整合示例
const listA = dataA?.data?.list || [];
const listB = dataB?.data?.list || [];

// 根据业务需求进行数据关联
const combined = listA.map(a => ({
  ...a,
  relatedItems: listB.filter(b => b['关联ID'] === a['ID'])
}));
```

**🚨 注意**：如果配置中的 `_说明` 字段提示"多个面板作为数据来源"，请仔细阅读各面板的 `metadata` 和 `dataSchema`，理解它们之间的业务关系。

---

## ✅ 输出规范

- **格式**：单个 HTML 文件，直接输出代码，**不要任何解释、说明或markdown标记**
- **CDN 资源声明**：Tailwind CSS、wave-loading 必须使用固定版本声明标签；Lucide 只复用宿主共享实例 `window.semApp?.ui?.lucide`，禁止任何 CDN fallback。
  - Tailwind: `<script data-cdp-resource="tailwindcss" data-cdp-resource-version="3.4.17" src="https://kwaidoo.com/cdn_general/libs/tailwindcss/3.4.17/tailwindcss.min.js"></script>`
  - Loading: `<script data-cdp-resource="wave-loading" data-cdp-resource-version="1.0.0" src="https://kwaidoo.com/cdn_general/libs/@generalui/wave-loading/1.0.0/wave-loading.js"></script>`
- **语言**：所有界面文字使用简体中文
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

### 4. 动作注册（必须 - 表格场景）

对于表格+表单管理页面，**必须注册以下动作**：

```javascript
// === 状态管理 ===
let appState = {
    isFormOpen: false,           // 表单是否打开
    formMode: null,              // 'add' | 'edit' | null
    formData: null,              // 当前表单数据
    tableData: [],               // 表格数据
    selectedRows: [],            // 选中的行
    currentPage: 1,              // 当前页码
    totalCount: 0                // 总数据量
};

// === 动作定义 ===
const actionDefinitions = [
    // 获取上下文（必须）
    {
        actionName: 'getContext',
        actionAlias: '获取页面上下文',
        actionDescription: '获取当前页面的完整状态，包括表单状态、表格数据等',
        actionParameterSchema: { type: 'object', properties: {}, required: [] },
        actionReturnSchema: {
            type: 'object',
            properties: {
                isFormOpen: { type: 'boolean', description: '表单是否打开' },
                formMode: { type: 'string', description: '表单模式: add/edit/null' },
                formData: { type: 'object', description: '当前表单数据' },
                tableData: { type: 'array', description: '表格数据列表' },
                selectedRows: { type: 'array', description: '选中的行' },
                totalCount: { type: 'number', description: '总数据量' }
            }
        }
    },
    // 打开新增表单（必须）
    {
        actionName: 'openAddForm',
        actionAlias: '打开新增表单',
        actionDescription: '打开新增数据的表单弹窗',
        actionParameterSchema: { type: 'object', properties: {}, required: [] }
    },
    // 打开编辑表单（必须）
    {
        actionName: 'openEditForm',
        actionAlias: '打开编辑表单',
        actionDescription: '打开编辑指定记录的表单弹窗',
        actionParameterSchema: {
            type: 'object',
            properties: {
                recordCode: { type: 'string', description: '要编辑的记录编号' }
            },
            required: ['recordCode']
        }
    },
    // 关闭表单（必须）
    {
        actionName: 'closeForm',
        actionAlias: '关闭表单',
        actionDescription: '关闭当前打开的表单弹窗',
        actionParameterSchema: { type: 'object', properties: {}, required: [] }
    },
    // 刷新表格数据
    {
        actionName: 'refreshTable',
        actionAlias: '刷新表格',
        actionDescription: '重新加载表格数据',
        actionParameterSchema: { type: 'object', properties: {}, required: [] }
    },
    // 搜索数据
    {
        actionName: 'searchData',
        actionAlias: '搜索数据',
        actionDescription: '根据关键词搜索表格数据',
        actionParameterSchema: {
            type: 'object',
            properties: {
                keyword: { type: 'string', description: '搜索关键词' }
            },
            required: ['keyword']
        }
    }
];

// === 动作处理器 ===
const actionHandlers = {
    // 获取上下文
    getContext: async () => {
        return {
            success: true,
            message: '已获取页面上下文',
            data: {
                isFormOpen: appState.isFormOpen,
                formMode: appState.formMode,
                formData: appState.formData,
                tableData: appState.tableData,
                selectedRows: appState.selectedRows,
                totalCount: appState.totalCount
            }
        };
    },
    // 打开新增表单
    openAddForm: async () => {
        openForm('add');
        return { success: true, message: '已打开新增表单' };
    },
    // 打开编辑表单
    openEditForm: async ({ recordCode }) => {
        if (!recordCode) {
            return { success: false, message: '缺少记录编号' };
        }
        openForm('edit', recordCode);
        return { success: true, message: '已打开编辑表单' };
    },
    // 关闭表单
    closeForm: async () => {
        closeFormModal();
        return { success: true, message: '已关闭表单' };
    },
    // 刷新表格
    refreshTable: async () => {
        await loadTableData(appState.currentPage);
        return { success: true, message: '已刷新表格' };
    },
    // 搜索数据
    searchData: async ({ keyword }) => {
        await loadTableData(1, keyword);
        return { success: true, message: `已搜索: ${keyword}` };
    }
};

// === 操作指南 ===
const actionGuidance = `
## 页面概览
这是一个数据管理页面，包含表格展示和表单操作功能。

## 必须先调用的动作
在执行任何操作前，建议先调用 \`getContext()\` 获取当前页面状态。

## 可用操作
- 获取上下文: \`getContext()\` - 获取页面完整状态
- 打开新增表单: \`openAddForm()\` - 打开新增数据的弹窗
- 打开编辑表单: \`openEditForm({recordCode})\` - 打开编辑指定记录的弹窗
- 关闭表单: \`closeForm()\` - 关闭当前表单弹窗
- 刷新表格: \`refreshTable()\` - 重新加载表格数据
- 搜索数据: \`searchData({keyword})\` - 根据关键词搜索

## 上下文信息说明
- isFormOpen: 表单是否打开
- formMode: 表单模式 (add=新增, edit=编辑, null=未打开)
- formData: 当前表单中的数据
- tableData: 表格中的所有数据
- selectedRows: 用户选中的行

## 典型示例
- "新增一条数据" → openAddForm()
- "编辑第一条数据" → 先 getContext() 获取 tableData，然后 openEditForm({recordCode})
- "关闭弹窗" → closeForm()
- "刷新列表" → refreshTable()
`.trim();

// === 注册动作到 CDP（不影响页面主要功能，异步进行，让它在后台跑） ===
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
await window.semApp.cdpSdk.closeModal('confirm');  // 确认关闭
await window.semApp.cdpSdk.closeModal('cancel');   // 取消关闭

// 获取初始化数据
const initData = window.semApp.cdpSdk.getInitData();
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

---

## 🎨 UI 实现参考（表格+表单示例）

以下是一个**表格+表单管理页面**的实现示例，仅供参考。根据用户需求，你可以生成其他类型的页面。

### 表格组件示例

如果需要实现表格，可以参考 `uiSchema.pages[0].props` 中的配置：

```javascript
// columns: 表格列配置
const columns = [
  { title: '商机名称', dataIndex: '商机名称', width: 100 },
  { title: '关联客户', dataIndex: '关联客户', width: 120, remoteOptionConfig: {...} },
  // ...
];

// topBar: 顶部按钮
const topBar = [
  { buttonName: '商机管理_新增', buttonDisplayName: '新增' },
  { buttonName: '刷新', buttonDisplayName: '刷新' }
];

// searchBar: 搜索字段
const searchBar = ['商机名称', '关联客户', '当前阶段'];

// rowOperationBar: 行操作按钮
const rowOperationBar = [
  { buttonName: '编辑', buttonDisplayName: '编辑' },
  { buttonName: '删除', buttonDisplayName: '删除' }
];
```

### 表单组件示例

### 1. 引入 SDK

PanelXSdkProxy 由 CDP 宿主注入，页面**禁止**用 script 标签的 `src` 属性外链或本地引入，也禁止 preload 动态加载；直接用全局 `PanelXSdkProxy` 构造函数初始化。


### 2. 初始化 SDK

```javascript
if (typeof PanelXSdkProxy === 'undefined') {
  throw new Error('SDK 未加载');
}

const sdk = new PanelXSdkProxy({
  busDomainCode: '{{busDomainCode}}',
  // timeout: 60000   // ⚠ Proxy 专属参数（非原生 PanelXSdk）：请求超时（毫秒），默认 5 分钟；用户有超时要求时显式传入
});
```

> **说明：**`timeout` 是 **`PanelXSdkProxy`（CDP 宿主下发、已内置 `PanelXSdk` 的代理类）** 的参数，**不是**原生 `PanelXSdk` 的参数；单页无需自行引入 `PanelXSdk`。默认请求超时 **5 分钟**，用户有要求时传 `timeout`（毫秒）。

---

## 📊 核心 API 使用

### 1. 查询表格数据（分页）

```javascript
const result = await sdk.api.queryFormDataList({
  panelCode: 'IML_00004',
  pageNo: 1,
  pageSize: 10,
  keyword: ''  // 可选，搜索关键词
});

const dataList = result?.data?.list || [];
const totalSize = result?.data?.totalSize || 0;
```

### 2. 获取权限矩阵（按钮权限）

```javascript
const permResult = await sdk.api.getPermMatrix({ 
  panelCode: 'IML_00004' 
});

const actionPrivileges = permResult?.data?.privilege?.actionPrivileges || [];
// 每个 action: { name: '新增', visible: true, operatable: true }
```

权限判定规则：
- 如果返回数据里不包含权限/Privileges 相关字段（如 `privilege` 或 `actionPrivileges`），视为未启用权限控制，前端不做任何权限过滤或禁用。
- 只有在返回了权限/Privileges 且值为 `[]` 时，才表示已启用权限但当前无权限。

### 3. 获取新建表单配置

```javascript
const formResult = await sdk.api.getNewFormPermMatrix({
  panelCode: 'IML_00004',
  operationName: '新增'  // 对应 topBar 中的按钮名
});

const { data, meta, privilege } = formResult.data;
// data: 表单初始数据
// meta: 字段元数据
// privilege: 字段权限和操作权限
```

### 4. 获取编辑表单配置

```javascript
const formResult = await sdk.api.getFormDescriptor({
  panelCode: 'IML_00004',
  code: '记录编号'  // 行数据中的"编号"字段
});

const { data, meta, privilege } = formResult.data;
```

### 5. 调用按钮操作

```javascript
// 表单操作（新增/编辑/提交等）
const result = await sdk.api.callButton({
  panelCode: 'IML_00004',
  buttonName: '保存',
  formData: { 字段名: 值, ... }
});

// 批量操作（删除/审批等）
const result = await sdk.api.callButton({
  panelCode: 'IML_00004',
  buttonName: '删除',
  buttonParam: {
    rowCodes: ['编号1', '编号2']  // 选中行的编号
  }
});
```

**表单提交字段规则（必须）**
- **不要**在 `formData` 中传空字符串、`null`、`undefined`，尤其是时间字段（避免后端校验报错）。
- 仅提交用户实际填写的值；未填写的字段直接从 `formData` 中移除。
- 时间字段必须传时间戳；若为空则不传该字段。

```javascript
// ✅ 正确示例：移除空值字段
const rawFormData = { ... };
const formData = Object.fromEntries(
  Object.entries(rawFormData).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
);
```

### 6. 获取关联字段映射（重要！）

某些字段存储的是关联记录的 ID，需要转换为可读的名称。

**如何识别关联字段？**
查看 `dataSchema.datas` 中的字段定义，如果字段有 `remoteOptionConfig` 属性，则该字段是关联字段。

```javascript
/**
 * 获取关联字段的映射表
 * @param {PanelXSdkProxy} sdk - SDK 实例
 * @param {Array} fields - dataSchema.datas 字段列表
 * @returns {Promise<Object>} { 字段名: Map<ID, 显示名> }
 */
async function getRelationMaps(sdk, fields) {
  const maps = {};
  
  // 找出所有有 remoteOptionConfig 的字段
  const relationFields = fields.filter(f => f.remoteOptionConfig);
  
  if (relationFields.length === 0) {
    return maps;
  }
  
  // 为每个关联字段获取映射表
  await Promise.all(relationFields.map(async (field) => {
    try {
      const result = await sdk.api.getRelateDataList(
        field.remoteOptionConfig.fieldName,
        field.remoteOptionConfig.panelCode
      );
      
      if (result.state === '200' && result.data) {
        const map = new Map();
        result.data.forEach(item => {
          map.set(item.key, item.value);
        });
        maps[field.dataName] = map;
      }
    } catch (err) {
      console.error(`获取关联映射失败 [${field.dataName}]:`, err);
    }
  }));
  
  return maps;
}

// 使用示例
const relationMaps = await getRelationMaps(sdk, dataSchema.datas);

// 渲染表格时转换关联字段
function getDisplayValue(fieldName, value) {
  if (relationMaps[fieldName] && relationMaps[fieldName].has(value)) {
    return relationMaps[fieldName].get(value);
  }
  return value || '-';
}
```

---

## 🎨 UI 实现参考（表格+表单示例）

以下是一个**表格+表单管理页面**的实现示例，仅供参考。根据用户需求，你可以生成其他类型的页面。

### 表格组件示例

如果需要实现表格，可以参考 `uiSchema.pages[0].props` 中的配置：

```javascript
// columns: 表格列配置
const columns = [
  { title: '商机名称', dataIndex: '商机名称', width: 100 },
  { title: '关联客户', dataIndex: '关联客户', width: 120, remoteOptionConfig: {...} },
  // ...
];

// topBar: 顶部按钮
const topBar = [
  { buttonName: '商机管理_新增', buttonDisplayName: '新增' },
  { buttonName: '刷新', buttonDisplayName: '刷新' }
];

// searchBar: 搜索字段
const searchBar = ['商机名称', '关联客户', '当前阶段'];

// rowOperationBar: 行操作按钮
const rowOperationBar = [
  { buttonName: '编辑', buttonDisplayName: '编辑' },
  { buttonName: '删除', buttonDisplayName: '删除' }
];
```

### 表单组件示例

如果需要实现表单，可以参考 `uiSchema.pages[1].elements` 中的配置：

| componentType | 渲染控件                  | 说明                             |
| ------------- | ------------------------- | -------------------------------- |
| `Input`       | `<input type="text">`     | 文本输入框                       |
| `InputNumber` | `<input type="number">`   | 数字输入框                       |
| `Select`      | `<select>`                | 单选下拉框，使用 `props.options` |
| `MultiSelect` | 多选下拉框                | 使用 `props.options`，值为数组   |
| `DatePicker`  | `<input type="date">`     | 日期选择器                       |
| `Switch`      | `<input type="checkbox">` | 开关                             |

> **附件字段：**`dataType: 'attach'` 的附件字段不在上表；其上传、表单提交、未入库/已入库的预览下载以及空数组提交规则，见 [panelx-attachments.md](../panelx-attachments.md)。

### 表单字段权限处理

如果需要处理字段权限，可以从 `getFormDescriptor` 或 `getNewFormPermMatrix` 返回的 `privilege.fieldPrivileges` 中获取：

```javascript
const fieldPrivileges = privilege?.fieldPrivileges || [];
// 每个字段: { fieldName: '商机名称', visible: true, writable: true }

// 创建权限映射
const fieldPrivilegeMap = {};
fieldPrivileges.forEach(fp => {
  fieldPrivilegeMap[fp.fieldName] = fp;
});

// 渲染字段时检查权限
function renderField(field) {
  const privilege = fieldPrivilegeMap[field.props.name];
  
  // 不可见则跳过
  if (privilege && !privilege.visible) return '';
  
  // 不可写则禁用
  const isDisabled = privilege ? !privilege.writable : false;
  
  return `<input ... ${isDisabled ? 'disabled' : ''} />`;
}
```

---

## 🎨 图标使用（Lucide Icons）

### 图标资源加载规则（强制）

1. **只复用宿主共享实例**：`const lucide = window.semApp?.ui?.lucide; lucide?.createIcons?.();`。
2. 禁止动态创建 `<script>` 加载 Lucide CDN；禁止 `@latest`、`unpkg.com` 或任何 CDN 地址。
3. **禁止为了“自包含页面”或“快速交付”跳过宿主资源判断**；“自包含页面”不等于“忽略宿主共享资源”。
4. DOM 中静态 `data-lucide` 渲染后必须调用 `createIcons()`；动态插入、替换或切换图标后，必须再次执行渲染。


```html
<!-- ✅ Tailwind CSS - 必须使用本地资源协议声明 -->
<script data-cdp-resource="tailwindcss" data-cdp-resource-version="3.4.17" src="https://kwaidoo.com/cdn_general/libs/tailwindcss/3.4.17/tailwindcss.min.js"></script>

<!-- ✅ Lucide Icons - 复用宿主共享实例，禁止 CDN fallback -->
<script>
  function renderLucideIcons() {
    const lucide = window.semApp?.ui?.lucide;
    lucide?.createIcons?.();
  }
</script>
```

### 禁止写法

### 生成前验收项（不得省略）

- 是否先判断 `window.semApp?.ui?.lucide`。
- 是否只复用 `window.semApp?.ui?.lucide`，没有动态加载任何 Lucide CDN。
- 是否没有把 Lucide CDN 写成直引 `<script src="...lucide.min.js"></script>`。
- 是否在静态 `data-lucide` 渲染后调用 `createIcons()`。
- 是否在动态插入、替换或切换图标后再次调用 `createIcons()`。
```

⚠️ **禁止使用以下已失效的 CDN**：
- ❌ `cdn.staticfile.org` - 已失效
- ❌ `cdn.bootcss.com` - 不稳定

### 使用方法

```html
<!-- 在 HTML 中使用 data-lucide 属性 -->
<i data-lucide="plus" class="w-4 h-4"></i>
<i data-lucide="refresh-cw" class="w-4 h-4"></i>
<i data-lucide="edit" class="w-4 h-4"></i>
<i data-lucide="trash-2" class="w-4 h-4"></i>
<i data-lucide="search" class="w-4 h-4"></i>
<i data-lucide="x" class="w-4 h-4"></i>

<!-- 页面加载后调用可用实例的 createIcons() 渲染图标 -->
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    await renderLucideIcons();
  });
</script>
```

### 常用图标

| 场景 | 图标名称         |
| ---- | ---------------- |
| 新增 | `plus`           |
| 刷新 | `refresh-cw`     |
| 编辑 | `edit`, `pencil` |
| 删除 | `trash-2`        |
| 搜索 | `search`         |
| 关闭 | `x`              |
| 保存 | `save`           |
| 用户 | `user`, `users`  |
| 日历 | `calendar`       |
| 设置 | `settings`       |

---

## 🚀 完整启动流程

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const app = document.getElementById('app');
  
  try {
    if (typeof PanelXSdkProxy === 'undefined') {
      throw new Error('SDK 未加载');
    }
    console.log('✅ SDK 已加载');
    
    // 1. 初始化 SDK
    const sdk = new PanelXSdkProxy({
      busDomainCode: '{{busDomainCode}}'
    });
    console.log('✅ SDK 初始化成功');

    // 2. 获取关联字段映射（从配置中提取）
    const relationMaps = await getRelationMaps(sdk, dataSchema.datas);
    console.log('✅ 关联映射获取成功');
    
    // 3. 获取权限矩阵
    const permResult = await sdk.api.getPermMatrix({ panelCode: CONFIG.panelCode });
    const actionPrivileges = permResult?.data?.privilege?.actionPrivileges || [];
    console.log('✅ 权限加载成功');
    
    // 4. 渲染顶部按钮（根据权限过滤）
    renderTopBar(actionPrivileges);
    
    // 5. 加载表格数据
    await loadTableData(1);
    
    loading.style.display = 'none';
    app.style.display = 'block';
  } catch (err) {
    console.error('❌ 初始化失败:', err);
    error.textContent = `加载失败：${err.message}`;
    error.style.display = 'block';
    loading.style.display = 'none';
  }
});
```

---

## 📐 页面结构参考（表格+表单示例）

以下是一个表格+表单管理页面的结构示例，仅供参考：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>页面标题</title>
  <!-- ✅ 本地资源协议声明 -->
  <script data-cdp-resource="tailwindcss" data-cdp-resource-version="3.4.17" src="https://kwaidoo.com/cdn_general/libs/tailwindcss/3.4.17/tailwindcss.min.js"></script>
  <!-- Lucide Icons 复用 window.semApp?.ui?.lucide，禁止 CDN fallback -->
  <script data-cdp-resource="wave-loading" data-cdp-resource-version="1.0.0" src="https://kwaidoo.com/cdn_general/libs/@generalui/wave-loading/1.0.0/wave-loading.js"></script>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- 加载状态 -->
  <div id="loading" class="h-full flex items-center justify-center">
    <wave-loading text="加载中..."></wave-loading>
  </div>
  
  <!-- 错误状态 -->
  <div id="error" class="..." style="display:none"></div>
  
  <!-- 主应用 -->
  <div id="app" style="display:none">
    <!-- 根据用户需求设计页面结构 -->
  </div>
  
  <script>
    // SDK 初始化和业务逻辑
  </script>
</body>
</html>
```

---

## 📥 输入变量

### 1. 当前面板配置（current_panel_config）

描述面板的完整配置：

```json
{{current_panel_config}}
```

### 2. 业务域代码

`{{busDomainCode}}`

---

## ⚠️ 常见错误（必须避免）

以下是常见的 UI/UX 问题，**必须在生成代码时避免**：

### 1. 表单按钮必须悬浮显示
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

### 2. 数据操作/加载必须有 Loading 状态

**默认使用 Loading 组件**：

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
- ❌ **错误**：点击保存/删除/刷新后无任何反馈，用户不知道操作是否在进行
- ✅ **正确**：所有数据操作（增删改查）必须显示 loading 状态

```javascript
// ✅ 正确示例：带 loading 的保存操作
async function handleSave() {
  const saveBtn = document.getElementById('saveBtn');
  const originalText = saveBtn.innerHTML;
  
  // 显示 loading
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 保存中...';
  await renderLucideIcons();
  
  try {
    await sdk.api.callButton({ ... });
    showToast('保存成功', 'success');
    closeModal();
    await refreshTable();
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  } finally {
    // 恢复按钮
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalText;
    await renderLucideIcons();
  }
}
```

### 3. 表格刷新必须有 Loading
- ❌ **错误**：刷新表格时页面无变化，用户不知道是否在加载
- ✅ **正确**：表格区域显示 loading 遮罩或骨架屏

### 4. 不要显示业务域信息
- ❌ **错误**：在页面上显示"业务域：GroupChat_Inst_xxx"等技术信息
- ✅ **正确**：业务域代码仅用于 SDK 初始化，**不要在界面上展示**

### 5. 不要显示面板技术信息
- ❌ **错误**：在页面上显示"面板编号：IML_00001"、"面板介绍：xxx"等配置信息
- ✅ **正确**：面板编号仅用于 API 调用，**不要在界面上展示**。页面标题应使用业务名称（如"客户管理"）

### 6. 时间字段处理
- ❌ **错误**：将时间戳当作字符串显示，或使用错误的日期格式
- ❌ **错误**：时间字段数据将显示的字符串传给后端
- ✅ **正确**：时间字段返回的是**时间戳**，需要使用 `new Date(timestamp)` 转换
- ✅ **正确**：显示时使用合适的格式，如 `2024-12-09 14:30` 或 `2024/12/09`
- ✅ **正确**：时间字段数据传给后端需要转换为**时间戳**，若为空则**不传该字段**

### 7. 主题切换
- ❌ **错误**：添加夜晚/白天模式切换按钮或逻辑
- ✅ **正确**：同步使用CDP的主题

### 8. 界面展示
- ❌ **错误**：使用浏览器原生的 `<select>`, `<input type="date">`, `alert()`, `confirm()`
- ❌ **错误**：使用原生的 CSS 样式（如 `border: 1px solid black`）而不使用 Tailwind
- ✅ **正确**：使用 Tailwind CSS 构建现代化组件，自定义下拉框、弹窗等
- ✅ **正确**：下拉框必须自己实现（div + ul/li），支持搜索、键盘导航等交互
- ✅ **正确**：响应式设计

### 9. 禁止解释和提示
- ❌ **错误**：在页面顶部显示"本页面用于展示XXX数据"等解释性文字
- ❌ **错误**：在页面上显示用户的原始需求描述
- ✅ **正确**：直接展示功能界面，无需多余解释

---

## ✅ 最终检查清单

开始生成前，确认：

### 必须项
- [ ] 理解了用户需求（如果有）
- [ ] 理解了 `current_panel_config` 的业务意图
- [ ] 确认 PanelXSdkProxy 由宿主注入，交付 HTML 未通过 script src/本地脚本/preload 加载任何 SDK
- [ ] 没有任何硬编码的 mock 数据
- [ ] 所有界面文字使用简体中文
- [ ] 直接输出 HTML 代码，不包含 markdown 代码块
- [ ] **所有数据操作都有 loading 状态反馈**
- [ ] **不在界面上显示业务域代码**
- [ ] **不在界面上显示面板编号等技术信息**
- [ ] **使用默认主题**
- [ ] **错误边界处理（局部失败不影响整体，提供降级与提示）**
- [ ] 若使用 Lucide 图标，已优先判断并复用 `window.semApp?.ui?.lucide`
- [ ] 若使用 Lucide 图标，没有动态加载任何 Lucide CDN
- [ ] 若使用 Lucide 图标，没有在 `<head>` 或 HTML 顶层无条件直引 `lucide.min.js`
- [ ] 若使用 Lucide 图标，没有为了“单页自包含”“快速交付”“减少代码”而跳过宿主资源判断
- [ ] 若使用 Lucide 图标，静态 `data-lucide` 渲染后已调用 `createIcons()`，动态插入、替换或切换图标后已再次渲染

### 根据需求选用的 SDK API
- `sdk.api.queryFormDataList` - 查询数据列表
- `sdk.api.getPermMatrix` - 获取按钮权限
- `sdk.api.getNewFormPermMatrix` - 获取新建表单配置
- `sdk.api.getFormDescriptor` - 获取编辑表单配置
- `sdk.api.callButton` - 执行按钮操作
- `sdk.api.getRelateDataList` - 获取关联字段映射

### 可选功能（根据用户需求）
- 表格展示、分页、搜索
- 表单新增、编辑
- 数据看板、统计图表
- 详情页展示
- 其他自定义功能

**现在请根据用户需求生成完整的 HTML 文件。**
