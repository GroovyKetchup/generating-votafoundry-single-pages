# CDP-SDK 使用指南

> **版本**: 1.6.0 
> **更新日期**: 2026-08-24

## 📖 概述

CDP-SDK 是 SemApp CDP 平台提供的 JavaScript SDK,用于在嵌入的网页(iframe)中与 CDP 宿主环境进行双向通信。

**核心功能:**
- 🔄 **调用 CDP 功能** - 从 iframe 调用 CDP 平台的各种功能(显示提示、关闭弹窗、执行指令等)
- 🎯 **注册动作到 CDP** - 将 iframe 的功能注册到 CDP,让 AI 智能体可以调用你的页面功能

---

## 🚀 第一部分:调用 CDP 功能

本部分介绍如何在你的 iframe 页面中调用 CDP 平台提供的功能。

### Step 1: 引入 SDK

CDP-SDK 提供两种引入方式:

#### 方式 A: 自动注入(推荐)

如果你的页面通过 **ExternalPage 组件(面板网页)** 加载,CDP 会自动注入 SDK,无需任何操作。

#### 方式 B: 禁止手动引入

CDP-SDK 统一由宿主注入。交付 HTML **禁止**用 script 标签的 `src` 属性外链或本地引入，也禁止 preload 动态加载；宿主注入后直接从 `window.semApp.cdpSdk` 使用。

### Step 2: 检查 SDK 是否可用

在使用 SDK 前,先确认它已正确加载:

```javascript
if (window.semApp && window.semApp.cdpSdk) {
    console.log('✅ CDP-SDK 已加载');
    // 可以安全使用 SDK
} else {
    console.error('❌ CDP-SDK 未加载');
    // 处理 SDK 未加载的情况
}
```

### Step 3: 获取初始化数据

当页面作为弹窗打开时,可以获取传递的初始化数据:

```javascript
const initData = window.semApp.cdpSdk.getInitData();
console.log('初始化数据:', initData);

// 示例:使用初始化数据
if (initData.userId) {
    document.getElementById('userName').textContent = initData.userName;
    loadUserData(initData.userId);
}
```

### Step 4: 调用 CDP 功能

#### 4.1 使用便捷方法

CDP-SDK 提供了常用功能的便捷方法:

**显示提示消息:**
```javascript
// 成功提示
await window.semApp.cdpSdk.toast('保存成功');

// 错误提示
await window.semApp.cdpSdk.toast('保存失败', { 
    type: 'error',
    description: '网络连接超时,请重试'
});

// 警告提示
await window.semApp.cdpSdk.toast('请注意', { 
    type: 'warning',
    duration: 5000 
});
```

**关闭当前弹窗:**
```javascript
// 确认关闭(会触发父页面刷新)
await window.semApp.cdpSdk.closeModal('confirm');

// 取消关闭(不刷新数据)
await window.semApp.cdpSdk.closeModal('cancel');
```

**获取主题配置:**
```javascript
const themeConfig = await window.semApp.cdpSdk.getTheme();
console.log('当前主题:', themeConfig);
// {
//   mode: 'dark',
//   preset: {
//     id: 'ocean',
//     name: '海洋蓝',
//     light: { primary: '...', success: '...', ... },
//     dark: { primary: '...', success: '...', ... }
//   }
// }

// 应用主题到你的页面
const colors = themeConfig.mode === 'dark' 
    ? themeConfig.preset.dark 
    : themeConfig.preset.light;
document.documentElement.style.setProperty('--primary', `hsl(${colors.primary})`);
```

**订阅主题变化:**
```javascript
// 订阅主题变化,实现自动同步
const unsubscribe = window.semApp.cdpSdk.onThemeChange((newThemeConfig) => {
    console.log('主题已变化:', newThemeConfig);
    
    // 自动应用新主题
    const colors = newThemeConfig.mode === 'dark' 
        ? newThemeConfig.preset.dark 
        : newThemeConfig.preset.light;
    document.documentElement.style.setProperty('--primary', `hsl(${colors.primary})`);
});

// 需要时取消订阅
// unsubscribe();
```

#### 4.2 使用 dispatch 方法

对于更复杂的功能,使用 `dispatch()` 方法分发指令:

```javascript
// 基本用法
await window.semApp.cdpSdk.dispatch({
    type: 'ui.toast',
    params: {
        message: '操作成功',
        type: 'success'
    }
});

// 自定义超时
await window.semApp.cdpSdk.dispatch({
    type: 'ui.modal.open',
    params: { pageId: 'formPage' }
}, { timeout: 5000 });
```

> 💡 **提示**: 关于完整的指令列表和参数说明,请查阅《[事件及指令使用指南](https://drive.weixin.qq.com/s?k=AO0ABAelAD4QAsm8Qt)》。

#### 4.3 使用全局事件

`app.globalEvent` 用于在同一应用内的页面、组件或 iframe 之间广播和订阅业务事件。

##### 发送全局事件

使用 `emit(type, payload?)` 广播事件。`type` 为必填的事件类型，`payload` 为可选的业务数据对象。

```javascript
const result = await window.semApp.cdpSdk.app.globalEvent.emit('order:updated', {
    orderId: 'order-001',
    status: 'paid'
});

console.log(result);
// { type: 'order:updated', listenerCount: 1 }
```

返回值中的 `listenerCount` 表示本次广播命中的订阅数量。

##### 订阅全局事件

使用 `on(type, handler, options?)` 订阅事件。方法会同步返回取消订阅函数，页面卸载或不再需要监听时应调用该函数。

```javascript
const unsubscribe = window.semApp.cdpSdk.app.globalEvent.on(
    'order:updated',
    (event) => {
        console.log('订单编号:', event.orderId);
        console.log('订单状态:', event.status);
        console.log('事件来源:', event.$source);
        console.log('事件时间:', event.$timestamp);
    }
);

// 页面销毁时取消订阅
unsubscribe();
```

回调收到的事件对象会将业务 `payload` 平铺到顶层，并自动附带以下系统字段：

- `$source`: 事件来源，包含 `panelCode`、`pageId`、`componentId`。
- `$type`: 事件类型。
- `$timestamp`: 事件产生时间戳。

##### 按来源过滤事件

可以通过 `sourceFilter` 限制当前订阅接收的来源。未配置的字段不限制；数组表示匹配其中任意一个值；多个字段同时配置时必须全部匹配。

```javascript
const unsubscribe = window.semApp.cdpSdk.app.globalEvent.on(
    'order:updated',
    (event) => {
        console.log('待办列表收到订单更新:', event.orderId);
    },
    {
        sourceFilter: {
            panelCode: 'approval-center',
            pageId: ['todo-list', 'order-detail']
        }
    }
);
```

**注意事项:**

- `payload` 只放业务字段，不要传入 `$source`、`$type` 或 `$timestamp`，这些字段会由 SDK 和宿主统一生成。
- 订阅建立依赖 SDK 与宿主的连接；即使立即调用取消订阅，也不会留下远端订阅。

### 完整示例 - 表单提交

```javascript
async function handleSubmit() {
    try {
        // 1. 提交数据到后端
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        // 2. 显示成功提示
        await window.semApp.cdpSdk.toast('保存成功');
        
        // 3. 关闭弹窗(confirm 会触发父页面刷新)
        await window.semApp.cdpSdk.closeModal('confirm');
        
    } catch (error) {
        // 4. 显示错误提示
        await window.semApp.cdpSdk.toast('保存失败', { 
            type: 'error',
            description: error.message 
        });
    }
}
```

---

## 🎯 第二部分:注册动作到 CDP

本部分介绍如何将你的页面功能注册到 CDP,让 AI 智能体可以调用。

### Step 1: 理解动作注册机制

**什么是动作注册?**
- 将你的 iframe 页面的功能(JavaScript 函数)注册到 CDP 平台
- AI 智能体可以理解并调用这些功能
- 用户可以通过自然语言与你的页面交互

**注册流程:**
```
你的页面 → 定义动作 → 注册到 CDP → AI 理解 → 用户调用
```

### Step 2: 定义动作处理器

首先,定义你的页面可以执行的动作:

```javascript
// 定义动作处理器对象
const actionHandlers = {
    // 动作 1: 获取数据
    getData: async (params) => {
        // 你的业务逻辑
        const data = getCurrentPageData();
        
        return data;
    },
    
    // 动作 2: 设置数据
    setData: async (params) => {
        const { value } = params;
        
        // 验证参数
        if (!value) {
            throw new Error('缺少 value 参数');
        }
        
        // 执行业务逻辑
        updatePageData(value);
        
        return { newValue: value };
    },
    
    // 动作 3: 执行操作
    performAction: async (params) => {
        const { actionType, payload } = params;
        
        switch (actionType) {
            case 'create':
                return await createItem(payload);
            case 'update':
                return await updateItem(payload);
            case 'delete':
                return await deleteItem(payload);
            default:
                throw new Error(`未知操作类型: ${actionType}`);
        }
    }
};
```

### Step 3: 定义动作元数据

为每个动作定义元数据,帮助 AI 理解如何使用:

```javascript
const actionDefinitions = [
    {
        actionName: 'getData',              // 动作名称(唯一标识)
        actionAlias: '获取数据',             // 可选:人类可读的别名
        actionDescription: '获取当前页面的数据',
        actionParameterSchema: {            // 参数 JSON Schema
            type: 'object',
            properties: {},                 // 无参数
            required: []
        },
        actionReturnSchema: {               // 返回结果 JSON Schema
            type: 'object',
            properties: {
                data: {
                    type: 'object',
                    description: '页面数据对象'
                }
            },
            required: ['data']
        }
    },
    {
        actionName: 'setData',
        actionAlias: '设置数据',
        actionDescription: '设置页面数据',
        actionParameterSchema: {
            type: 'object',
            properties: {
                value: {
                    type: 'string',
                    description: '要设置的数据值'
                }
            },
            required: ['value']             // value 是必需参数
        },
        actionReturnSchema: {               // 推荐包含执行结果状态及简短信息
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    description: '执行是否成功'
                },
                message: {
                    type: 'string',
                    description: '执行结果的简短描述'
                },
                newValue: {
                    type: 'string',
                    description: '设置后的新值'
                }
            },
            required: ['success', 'message']
        }
    },
    {
        actionName: 'performAction',
        actionAlias: '执行操作',
        actionDescription: '执行指定的 CRUD 操作',
        actionParameterSchema: {
            type: 'object',
            properties: {
                actionType: {
                    type: 'string',
                    description: '操作类型: create, update, delete'
                },
                payload: {
                    type: 'object',
                    description: '操作数据'
                }
            },
            required: ['actionType', 'payload']
        },
        actionReturnSchema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    description: '操作是否成功'
                },
                message: {
                    type: 'string',
                    description: '操作结果信息'
                },
                data: {
                    type: 'object',
                    description: '操作返回的数据'
                }
            },
            required: ['success', 'message']
        }
    }
];
```

### Step 4: 编写操作指南(可选但推荐)

提供操作指南,帮助 AI 更好地理解你的页面:

```javascript
const actionGuidance = `
## 我的页面

这是一个数据管理页面,支持查看、编辑和管理数据。

### 功能特性
- 🎯 **数据查看**: 实时查看当前数据
- ⚡ **数据编辑**: 快速修改数据
- 🔧 **CRUD 操作**: 完整的增删改查功能

### 可用操作
- 获取数据: \`getData()\` - 获取当前页面数据
- 设置数据: \`setData({"value": "新值"})\` - 设置页面数据
- 执行操作: \`performAction({"actionType": "create", "payload": {...}})\` - 执行 CRUD 操作

### 使用示例
- "帮我获取当前数据"
- "把数据设置为新的值"
- "创建一个新项目"
- "更新现有数据"
- "删除选中的项"
`.trim();
```

### Step 5: 注册动作到 CDP

使用 `setActions()` 方法一次性注册所有内容:

```javascript
// 页面加载完成后注册
window.addEventListener('DOMContentLoaded', async () => {
    // 检查 SDK 是否可用
    if (!window.semApp || !window.semApp.cdpSdk) {
        console.error('CDP-SDK 未加载');
        return;
    }
    
    try {
        // 注册动作到 CDP
        await window.semApp.cdpSdk.setActions({
            guidance: actionGuidance,        // 操作指南(可选)
            definitions: actionDefinitions,     // 动作定义(必需)
            handlers: actionHandlers,           // 动作处理器(必需)
            registrationDelay: 100              // 注册延迟(可选,默认 100ms)
        });
        
        console.log('✅ 动作注册成功');
        
    } catch (error) {
        console.error('❌ 动作注册失败:', error);
    }
});
```

### 完整示例

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>CDP 集成示例</title>
</head>
<body>
    <h1>我的应用</h1>
    <div id="data-display"></div>
    <input id="data-input" type="text" placeholder="输入数据">
    <button onclick="handleSetData()">设置数据</button>

    <script>
        // 页面状态
        let currentData = '初始值';

        // 动作处理器
        const actionHandlers = {
            getData: async () => {
                return { success: true, data: currentData };
            },
            
            setData: async (params) => {
                const { value } = params;
                if (!value) throw new Error('缺少 value 参数');
                
                currentData = value;
                updateDisplay();
                
                return { success: true, newValue: value };
            }
        };

        // 动作定义
        const actionDefinitions = [
            {
                actionName: 'getData',
                actionAlias: '获取数据',
                actionDescription: '获取当前数据',
                actionParameterSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                actionName: 'setData',
                actionAlias: '设置数据',
                actionDescription: '设置数据值',
                actionParameterSchema: {
                    type: 'object',
                    properties: {
                        value: {
                            type: 'string',
                            description: '新的数据值'
                        }
                    },
                    required: ['value']
                }
            }
        ];

        // 操作指南
        const operationGuidance = `
## 数据管理应用

简单的数据查看和编辑应用。

### 可用操作
- 获取数据: \`getData()\`
- 设置数据: \`setData({"value": "新值"})\`

### 使用示例
- "显示当前数据"
- "把数据改成 Hello World"
        `.trim();

        // 更新显示
        function updateDisplay() {
            document.getElementById('data-display').textContent = 
                `当前数据: ${currentData}`;
        }

        // 按钮点击处理
        async function handleSetData() {
            const value = document.getElementById('data-input').value;
            if (value) {
                await actionHandlers.setData({ value });
                await window.semApp.cdpSdk.toast('数据已更新');
            }
        }

        // 初始化
        window.addEventListener('DOMContentLoaded', async () => {
            updateDisplay();
            
            // 注册动作
            if (window.semApp && window.semApp.cdpSdk) {
                try {
                    await window.semApp.cdpSdk.setActions({
                        guidance: operationGuidance,
                        definitions: actionDefinitions,
                        handlers: actionHandlers
                    });
                    console.log('✅ 动作注册成功');
                } catch (error) {
                    console.error('❌ 动作注册失败:', error);
                }
            }
        });
    </script>
</body>
</html>
```

---

## ⚠️ 注意事项

### 1. SDK 生命周期管理

CDP-SDK 会自动管理连接的生命周期:

- **自动连接**: SDK 在页面加载时自动检测 iframe 环境并建立连接,无需手动初始化
- **自动清理**: 页面卸载时自动销毁连接并清理资源(保底机制)
- **手动控制**: 你也可以在需要时手动调用 `destroy()` 方法提前销毁连接

```javascript
// ✅ 推荐:让 SDK 自动管理
// SDK 会在页面卸载时自动清理

// ✅ 也可以手动控制销毁时机
function cleanup() {
    // 取消所有订阅
    unsubscribeTheme();
    
    // 手动销毁 SDK 连接
    window.semApp.cdpSdk.destroy();
}

// 在某个特定时机调用
document.getElementById('closeBtn').addEventListener('click', cleanup);
```

**destroy() 方法**:
```javascript
window.semApp.cdpSdk.destroy();
```
- 销毁与父窗口的连接
- 清理所有动作处理器
- 清理所有主题订阅监听器
- 移除事件监听器

### 2. 动作处理器返回值

**推荐返回结构化的对象:**

```javascript
// ✅ 推荐:返回结构化对象
const actionHandlers = {
    getData: async () => {
        const data = { id: 1, name: '任务1' };
        return { success: true, data };
    },
    
    createTask: async (params) => {
        const task = createNewTask(params);
        return { success: true, data: task };
    }
};
```

**错误处理:**

使用 `try-catch` 捕获错误并抛出结构化的错误信息:

```javascript
const actionHandlers = {
    riskyAction: async (params) => {
        try {
            // 你的业务逻辑
            const result = await performRiskyOperation(params);
            return { success: true, data: result };
        } catch (error) {
            // 抛出结构化错误信息
            throw new Error(`操作失败: ${error.message}`);
        }
    },
    
    getData: async (params) => {
        // 参数验证
        if (!params.id) {
            throw new Error('缺少 id 参数');
        }
        
        try {
            const data = await fetchData(params.id);
            return { success: true, data };
        } catch (error) {
            throw new Error(`获取数据失败: ${error.message}`);
        }
    }
};
```


### 3. 异步操作

所有 SDK 方法都是异步的,返回 Promise:

```javascript
// ✅ 正确
await window.semApp.cdpSdk.toast('成功');

// ❌ 错误(未等待 Promise)
window.semApp.cdpSdk.toast('成功');
console.log('提示已显示'); // 可能在提示显示前执行
```

### 4. SDK 可用性检查

使用前务必检查 SDK 是否已加载:

```javascript
if (!window.semApp || !window.semApp.cdpSdk) {
    console.error('CDP-SDK 未加载');
    return;
}
```

### 5. 动作 Schema 格式

`actionParameterSchema` 和 `actionReturnSchema` 都必须使用标准的 JSON Schema 格式:

```javascript
// ✅ 正确 - 参数 Schema
actionParameterSchema: {
    type: 'object',
    properties: {
        value: { type: 'string', description: '值' }
    },
    required: ['value']
}

// ✅ 正确 - 返回值 Schema
actionReturnSchema: {
    type: 'object',
    properties: {
        success: { type: 'boolean', description: '操作是否成功' },
        data: { type: 'object', description: '返回的数据' }
    },
    required: ['success', 'data']
}

// ❌ 错误(数组格式)
actionParameterSchema: [
    { name: 'value', type: 'string', required: true }
]
```

---

## 🧩 第三部分:自定义 Shell 开发指南

CDP 支持开发人员创建完全自定义的 Shell (宿主环境) 来承载业务内容。自定义 Shell 本质上是一个 HTML 页面，通过 CDP SDK 与主应用进行通信。

### 核心概念

1.  **SDK 集成**: 通过引入 `cdp-sdk.js` 与主应用建立连接。
2.  **动态 Portal**: 主应用的内容(页面/表单)通过 React Portal 渲染到 Shell 指定的容器中。
3.  **菜单控制**: 使用 `MenuController` 接管菜单状态和路由导航。

### 实现步骤 (Step-by-Step)

> **💡 提示**: 在页面卸载时,必须调用 `menuController.destroy()` 清理资源,避免内存泄漏。

#### 1. 准备布局结构
创建一个包含侧边栏(菜单)和主内容区(渲染容器)的 HTML 布局。

```html
<div class="app-container">
    <aside class="sidebar">...</aside>
    <main class="main-content">
        <!-- 🔥 Portal 渲染目标容器, 必须指定 ID -->
        <div id="content-area"></div>
    </main>
</div>
```

#### 2. 初始化 SDK
等待 SDK 加载并获取实例。

```javascript
window.addEventListener('load', async function () {
    const sdk = window.semApp?.cdpSdk;
    if (!sdk) return;
    
    // 初始化业务逻辑
});
```

#### 3. 获取基础数据
使用 SDK 的数据 API 获取用户信息、应用配置和菜单数据。

```javascript
// 获取用户信息
const user = await sdk.data.auth.getCurrentUser();

// 获取应用配置
const appConfig = await sdk.data.getAppConfig();

// 获取菜单树
const menuTree = await sdk.data.getMenu();
```

#### 4. 接管菜单控制
使用 `MenuController` 初始化菜单并配置渲染目标。

> **⚠️ 重要**: 必须先调用 `onStateChange()` 订阅状态,再调用 `init()` 初始化,这样才能监听到初始化过程中的所有状态变化。

CustomShell 支持两种菜单内容挂载模式：

- **单容器兼容模式**: `init(menuTree, { contentContainer })`，适合一次只显示当前路由内容的旧 Shell；
- **多容器组合模式**: `init(menuTree)` + `menuController.mount(item, { containerId })`，适合 Tab、窗口、分栏和按需保活场景；
- `menuTree` 可来自 `sdk.data.getMenu()`，也可由业务自行构建；
- 可挂载节点的 `panelId` 或 `panelCode` 必须采用 `{panelCode}_v_{pageId}` 编码；
- `mount()` 不调用 `select()`，标准导航 Tab 需显式组合两者。

**单容器兼容模式（兼容保留）:**

```javascript
// 创建控制器
const menuController = sdk.controllers.createMenu();

// 🔥 重要:先订阅状态变化
menuController.onStateChange((state) => {
    const { menuTree, activeId } = state;
    // 渲染你的菜单 UI
    renderMenu(menuTree, activeId);
});

// 🔥 再初始化并指定容器 (异步方法)
try {
    await menuController.init(menuTree, {
        contentContainer: '#content-area' // 对应 HTML 中的容器 ID
    });
    console.log('菜单初始化成功');
} catch (error) {
    console.error('菜单初始化失败:', error);
    // 显示错误提示
    showErrorToast('菜单加载失败', error.message);
}
```

**多容器组合模式（Tab / 分栏 / 按需保活）:**

```javascript
const mountedItems = new Map();

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

> **💡 提示**: 隐藏但不卸载即保活。真实 HTML 中若菜单 ID 含特殊字符，应生成安全的 DOM ID，不能直接用菜单 ID 拼接 CSS 选择器。

**处理初始状态和错误状态:**

```javascript
function renderMenu(menuTree, activeId) {
    const menuContainer = document.getElementById('menu-root');
    
    // 如果菜单树为空,显示空状态
    if (!menuTree || menuTree.length === 0) {
        menuContainer.innerHTML = `
                    <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--sidebar-text-secondary);">
                        <div>暂无菜单</div>
                    </div>
                `;
        return;
    }
    
    // 渲染菜单项
    menuContainer.innerHTML = menuTree.map(item => `
        <div class="menu-item ${item.id === activeId ? 'active' : ''}" 
             data-id="${item.id}">
            ${item.title}
        </div>
    `).join('');
}
```

#### 5. 绑定交互事件
在点击菜单项时调用 `menuController.select(item)`。

```javascript
// 使用事件委托处理菜单点击
document.getElementById('menu-root').addEventListener('click', async (e) => {
    const menuItem = e.target.closest('.menu-item');
    if (!menuItem) return;
    
    const itemId = menuItem.dataset.id;
    const item = findMenuItemById(menuTree, itemId);
    
    if (item) {
        await menuController.select(item);
    }
});

// 辅助函数:根据 ID 查找菜单项
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
```

#### 6. 清理资源
在页面卸载时销毁 MenuController,清理事件监听器。

```javascript
// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (menuController) {
        menuController.destroy();
    }
});

// 或在特定时机手动清理
function cleanup() {
    menuController.destroy();
    console.log('MenuController 已销毁');
}
```

### 6. 可选功能集成

CDP SDK 提供了丰富的内置 UI 能力,你可以通过简单的 API 调用将它们集成到你的 Shell 中。

#### 主题系统集成

##### 订阅主题变化
实现主题自动同步,让你的 Shell 跟随 CDP 主题变化。

```javascript
// 订阅主题变化
async function subscribeTheme(sdk) {
    try {
        // 获取初始主题状态
        const themeState = await sdk.app.theme.getState();
        applyTheme(themeState);
        
        // 监听主题变化
        sdk.app.theme.onChange((state) => {
            console.log('主题已变化:', state);
            applyTheme(state);
        });
    } catch (error) {
        console.error('订阅主题失败:', error);
    }
}

// 应用主题到页面
function applyTheme(themeState) {
    const { effectiveMode, currentColors } = themeState;
    const colors = effectiveMode === 'dark' ? currentColors.dark : currentColors.light;
    
    // 应用 CSS 变量
    const root = document.documentElement;
    root.style.setProperty('--primary-color', `hsl(${colors.primary})`);
    root.style.setProperty('--bg-color', effectiveMode === 'dark' ? '#1e1e2e' : '#ffffff');
    root.style.setProperty('--text-color', effectiveMode === 'dark' ? '#ffffff' : '#1a1a1a');
}
```

> 💡 **类型参考**: `themeState` 的完整类型定义请参见 [`ThemeStateWithEffective`](#themestatewitheffective)

##### 主题选择面板
提供主题模式和预设选择功能。

```javascript
// 加载主题选项
async function loadThemeOptions(sdk) {
    // 获取可用的主题模式
    const modes = await sdk.app.theme.getModes();
    // modes: ['system', 'light', 'dark']
    
    // 获取主题预设列表
    const presets = await sdk.app.theme.getPresets();
    
    // 渲染主题选择 UI
    renderThemeSelector(modes, presets);
}

// 切换主题模式
async function changeThemeMode(mode) {
    try {
        await sdk.app.theme.setMode(mode); // 'light' | 'dark' | 'auto'
        console.log('主题模式已切换:', mode);
    } catch (error) {
        console.error('切换主题模式失败:', error);
    }
}

// 切换主题预设
async function changeThemePreset(presetId) {
    try {
        await sdk.app.theme.setPreset(presetId);
        console.log('主题预设已切换:', presetId);
    } catch (error) {
        console.error('切换主题预设失败:', error);
    }
}
```

> 💡 **类型参考**: `modes` 的类型定义请参见 [`ThemeMode`](#thememode),`presets` 的类型定义请参见 [`ThemePreset`](#themepreset)

#### AI 助手 (AI Assistant)
呼出侧边栏 AI 助手,提供智能问答和辅助功能。

```javascript
// 打开 AI 助手
await sdk.ui.aiAssistant.open();

// 带提示词打开
await sdk.ui.aiAssistant.open('帮我分析这份数据');

// 关闭或切换
await sdk.ui.aiAssistant.close();
await sdk.ui.aiAssistant.toggle();
```

#### 命令面板 (Command Palette)
呼出全局命令面板(通常绑定快捷键 `Ctrl+K`)。

```javascript
// 打开命令面板
await sdk.ui.commandPalette.open();

// 绑定快捷键
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        sdk.ui.commandPalette.open();
    }
});
```

#### 模态框 (Modal)
打开/关闭 CDP 模态框弹窗。

```javascript
// 打开面板页面弹窗，等待关闭结果
const result = await sdk.ui.modal.open({
    pageId: 'formPage',
    title: '新建记录',
    width: 600,
    data: { mode: 'create' }
});
if (result.reason === 'confirm') {
    console.log('用户确认，返回数据:', result.data);
}

// 打开 iframe 链接弹窗
await sdk.ui.modal.open({ url: 'https://example.com', title: '外部页面', width: '80%' });

// 关闭当前弹窗并返回数据（在弹窗内部调用）
await sdk.ui.modal.close({ reason: 'confirm', data: { saved: true } });
```

#### Toast 通知 (`sdk.ui.toast`)
通过 `sdk.ui` 命名空间发送通知消息。

```javascript
await sdk.ui.toast('操作成功');
await sdk.ui.toast('保存失败', { type: 'error', description: '网络超时，请重试' });
await sdk.ui.toast('请注意', { type: 'warning', duration: 5000 });
```

---

#### 用户登出 (Logout)
执行完整的登出流程,清除会话并刷新页面。

```javascript
try {
    // 使用 app.logout() 会自动清除会话并刷新父窗口
    await sdk.app.logout();
} catch (error) {
    console.error('登出失败:', error);
}
```

#### 动态 Portal (按需页面挂载)
在第三方系统（如 iframe）特定的 DOM 节点中按需挂载并渲染指定的低代码微页面片段,页面享有主应用提供的一切低代码上下文环境。

**基础用法（旧签名，兼容保留）：**
```javascript
// 挂载低代码页面到指定容器
const unmountFn = await sdk.controllers.portal.mountPage(
    'IML_00009',             // 目标面板 Code
    '销售阶段配置',          // 目标页面 ID
    '#lowcode-portal-anchor' // 挂载容器选择器
);

// 卸载并销毁该页面实例
await unmountFn();
```

**完整用法（新签名，推荐使用）：**
```javascript
// 使用对象参数传递完整配置
const unmountFn = await sdk.controllers.portal.mountPage({
    panelCode: 'IML_00009',              // 目标面板 Code
    pageId: '销售阶段配置',              // 目标页面 ID
    containerId: '#lowcode-portal-anchor', // 挂载容器选择器
    businessDomainCode: 'sales',          // 业务域编码（可选，覆盖渲染页面的业务域上下文）
    pageInputs: {                         // 页面业务输入参数
        customerId: '12345',
        source: 'external'
    },
    pageInitialData: {                    // 页面初始化数据
        selectedRow: { id: 1, name: '张三' }
    },
    formMode: 'edit'                      // 表单模式：'create' | 'edit' | 'view'
});

// 卸载并销毁该页面实例
await unmountFn();
```

**参数说明：**
- `panelCode`: 目标面板代码
- `pageId`: 目标页面 ID
- `containerId`: 挂载容器的 CSS 选择器
- `businessDomainCode`: 业务域编码（可选）。传入后会作为所挂载页面的业务域上下文（`businessDomain`）向下透传，影响该页面的业务域相关逻辑
- `pageInputs`: 业务输入参数，通过 `$page.inputs` 访问
- `pageInitialData`: 页面初始化数据，通过 `$page.initialData` 访问
- `formMode`: 表单模式，影响表单组件的行为（只读/编辑等），可选：`create`、`edit`、`view`。（edit/view + pageInitialData传入编号/code为详情表单查询）

### 7. 最小实现骨架

以下是一个最简的 Custom Shell 实现代码，可作为开发的起点：

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        .layout { display: flex; height: 100vh; }
        .sidebar { width: 200px; background: #eee; padding: 10px; }
        .content { flex: 1; position: relative; }
        .menu-item { padding: 8px; cursor: pointer; }
        .menu-item.active { background: #007bff; color: white; }
        #portal-container { width: 100%; height: 100%; }
    </style>
</head>
<body>
    <div class="layout">
        <aside class="sidebar" id="menu-root"></aside>
        <main class="content">
            <div id="portal-container"></div>
        </main>
    </div>

    <script>
        // 初始化逻辑 - 不建议阻塞 load 事件，使用异步调用
        window.addEventListener('load', () => {
            const sdk = window.semApp?.cdpSdk;
            if (!sdk) return console.error('SDK Not Found');

            // 使用 IIFE (立即执行异步函数) 启动初始化
            (async () => {
                // 此时可以设置菜单列表为加载状态/骨架屏

                // 1. 获取菜单数据
                const menuTree = await sdk.data.getMenu();

                // 2. 初始化控制器
                const controller = sdk.controllers.createMenu();
                controller.init(menuTree, { contentContainer: '#portal-container' });

                // 3. 响应状态变化渲染UI
                controller.onStateChange(({ menuTree, activeId }) => {
                    const root = document.getElementById('menu-root');
                    // 简化渲染逻辑：仅展示一级菜单用于演示
                    root.innerHTML = menuTree.map(item => `
                        <div class="menu-item ${item.id === activeId ? 'active' : ''}" 
                             onclick="selectMenu('${item.id}')">
                            ${item.title}
                        </div>
                    `).join('');
                });

                // 4. 处理菜单点击
                window.selectMenu = (id) => {
                    // 实际项目中由于菜单树的复杂性，建议使用递归查找
                    const item = menuTree.find(i => i.id === id); 
                    if (item) controller.select(item);
                };
            })();
        });
    </script>
</body>
</html>
```

**关键要点:**

1. **菜单初始化顺序**: 先调用 `onStateChange()` 订阅,再调用 `init()` 初始化
2. **模块独立性**: 使用 `Promise.allSettled()` 让各模块独立处理错误,互不影响
3. **错误提示策略**: 
   - 关键错误(菜单加载失败)使用 Toast 错误提示
   - 非关键错误(主题失败)使用 Toast 警告提示或静默降级
   - 所有错误都记录到 console
4. **状态区分**: 明确区分加载中(骨架屏)、空列表(文字提示)、加载失败(Toast提示)
5. **资源清理**: 在页面卸载时销毁 MenuController
6. **并行初始化**: 使用 `Promise.allSettled()` 并行加载,提升加载速度且容错性更强

---

## 📚 第四部分:API 参考

本部分提供 CDP-SDK 的完整 API 参考文档。

### 4.1 核心 API

#### `window.semApp.cdpSdk`

CDP-SDK 的全局实例,所有 API 都通过此对象访问。

**属性:**

| 属性 | 类型 | 描述 |
|------|------|------|
| `version` | `string` | SDK 版本号 (当前: `1.1.0`) |
| `name` | `string` | SDK 名称 (`CdpSdk`) |

---

#### `getInitData()`

获取初始化数据。当页面作为弹窗打开时,可以获取传递的初始化数据。

**语法:**
```javascript
const initData = window.semApp.cdpSdk.getInitData();
```

**返回值:**
- `Record<string, any>` - 初始化数据对象

**示例:**
```javascript
const initData = window.semApp.cdpSdk.getInitData();
console.log('用户ID:', initData.userId);
console.log('用户名:', initData.userName);
```

---

#### `dispatch(instruction, options?)`

向宿主环境分发指令,这是调用 CDP 功能的核心方法。

**语法:**
```javascript
await window.semApp.cdpSdk.dispatch(instruction, options);
```

**参数:**
- `instruction` (必需) - 指令对象
  - `type: string` - 指令类型
  - `params?: any` - 指令参数
- `options` (可选) - 执行选项
  - `timeout?: number` - 超时时间(毫秒)

**返回值:**

- `Promise<any>` - 指令执行结果

**示例:**

```javascript
// 显示提示消息
await window.semApp.cdpSdk.dispatch({
    type: 'ui.toast',
    params: {
        message: '操作成功',
        type: 'success'
    }
});

// 自定义超时
await window.semApp.cdpSdk.dispatch({
    type: 'ui.modal.open',
    params: { pageId: 'formPage' }
}, { timeout: 5000 });
```

---

#### `batchDispatch(instructionSet, options?)`

批量分发指令集,用于一次性执行多个指令。

**语法:**
```javascript
await window.semApp.cdpSdk.batchDispatch(instructionSet, options);
```

**参数:**
- `instructionSet` (必需) - 指令集对象
- `options` (可选) - 执行选项

**返回值:**
- `Promise<any>` - 批量执行结果

**示例:**
```javascript
await window.semApp.cdpSdk.batchDispatch({
    instructions: [
        { type: 'ui.toast', params: { message: '步骤1完成' } },
        { type: 'ui.toast', params: { message: '步骤2完成' } }
    ]
});
```

---

#### `toast(message, options?)`

显示提示消息的便捷方法。

**语法:**
```javascript
await window.semApp.cdpSdk.toast(message, options);
```

**参数:**
- `message: string` (必需) - 提示消息内容
- `options` (可选) - 提示选项
  - `type?: 'success' | 'error' | 'warning' | 'info'` - 提示类型(默认: `'success'`)
  - `description?: string` - 详细描述
  - `duration?: number` - 显示时长(毫秒)

**返回值:**
- `Promise<any>` - 执行结果

**示例:**
```javascript
// 成功提示
await window.semApp.cdpSdk.toast('保存成功');

// 错误提示
await window.semApp.cdpSdk.toast('保存失败', { 
    type: 'error',
    description: '网络连接超时,请重试'
});

// 自定义时长
await window.semApp.cdpSdk.toast('请注意', { 
    type: 'warning',
    duration: 5000 
});
```

---

#### `closeModal(reason?, data?)`

关闭当前弹窗的便捷方法。

**语法:**
```javascript
await window.semApp.cdpSdk.closeModal(reason, data);
```

**参数:**
- `reason?: string` (可选) - 关闭原因
  - `'confirm'` - 确认关闭(会触发父页面刷新)
  - `'cancel'` - 取消关闭(不刷新数据)

**返回值:**
- `Promise<any>` - 执行结果

**示例:**
```javascript
// 确认关闭(触发刷新)
await window.semApp.cdpSdk.closeModal('confirm');

// 取消关闭(不刷新)
await window.semApp.cdpSdk.closeModal('cancel');
```

---

#### `log(message)`

向宿主环境发送日志消息。

**语法:**
```javascript
await window.semApp.cdpSdk.log(message);
```

**参数:**
- `message: string` (必需) - 日志消息

**返回值:**
- `Promise<void>`

**示例:**
```javascript
await window.semApp.cdpSdk.log('用户执行了操作A');
```

---

#### `destroy()`

销毁 SDK 连接并清理资源。通常不需要手动调用,SDK 会在页面卸载时自动清理。

**语法:**
```javascript
window.semApp.cdpSdk.destroy();
```

**返回值:**
- `void`

**示例:**
```javascript
// 手动销毁连接
window.semApp.cdpSdk.destroy();
```

---

#### `getHostWindow(timeout?)`

获取宿主窗口对象。

**语法:**
```javascript
const hostWindow = await window.semApp.cdpSdk.getHostWindow(timeout);
```

**参数:**
- `timeout?: number` (可选) - 超时时间(毫秒,默认: 5000)

**返回值:**
- `Promise<Window>` - 宿主窗口对象

**示例:**

```javascript
const hostWindow = await window.semApp.cdpSdk.getHostWindow();
console.log('宿主窗口:', hostWindow);
```

---

### 4.2 UI API (`sdk.ui`)

UI API 提供了控制 CDP 内置 UI 组件的方法。

#### `sdk.ui.aiAssistant`

控制 AI 助手面板。

**方法:**

##### `open(params?)`

打开 AI 助手面板。

**语法:**
```javascript
await window.semApp.cdpSdk.ui.aiAssistant.open(params);
```

**参数:**
- `params?: string | { prompt: string }` (可选) - 提示词

**示例:**
```javascript
// 打开 AI 助手
await window.semApp.cdpSdk.ui.aiAssistant.open();

// 带提示词打开
await window.semApp.cdpSdk.ui.aiAssistant.open('帮我分析这份数据');
```

##### `close()`

关闭 AI 助手面板。

**语法:**
```javascript
await window.semApp.cdpSdk.ui.aiAssistant.close();
```

##### `toggle()`

切换 AI 助手面板的显示状态。

**语法:**
```javascript
await window.semApp.cdpSdk.ui.aiAssistant.toggle();
```

---

#### `sdk.ui.commandPalette`

控制命令面板。

**方法:**

##### `open()`

打开命令面板。

**语法:**
```javascript
await window.semApp.cdpSdk.ui.commandPalette.open();
```

##### `close()`

关闭命令面板。

**语法:**
```javascript
await window.semApp.cdpSdk.ui.commandPalette.close();
```

##### `toggle()`

切换命令面板的显示状态。

**语法:**
```javascript
await window.semApp.cdpSdk.ui.commandPalette.toggle();
```

---

#### `sdk.ui.developerTools`

控制开发者工具。

**方法:**

##### `open()`

打开开发者工具。

**语法:**
```javascript
await window.semApp.cdpSdk.ui.developerTools.open();
```

##### `close()`

关闭开发者工具。

**语法:**
```javascript
await window.semApp.cdpSdk.ui.developerTools.close();
```

##### `toggle()`

切换开发者工具的显示状态。

**语法:**
```javascript
await window.semApp.cdpSdk.ui.developerTools.toggle();
```

---

#### `sdk.ui.modal`

控制 CDP 模态框弹窗。

**方法:**

##### `open(options)`

打开模态框。

**语法:**
```javascript
const result = await window.semApp.cdpSdk.ui.modal.open(options);
```

**参数:**
- `options: OpenModalOptions` (必需) - 弹窗配置
  - `businessDomain?: string` - 业务域（可选）
  - `panelCode?: string` - 面板编码（可选，不传时使用当前面板）
  - `pageId?: string` - 面板页面 ID（pageId 模式）
  - `url?: string` - 外部链接（iframe 模式）
  - `title?: string` - 弹窗标题
  - `width?: string | number` - 宽度（支持 px 或 %）
  - `height?: string | number` - 高度（支持 px 或 %）
  - `mode?: 'create' | 'edit'` - 表单模式
  - `data?: Record<string, unknown>` - 传递给页面的数据
  - `mask?: boolean` - 是否显示遮罩层（默认 `true`）
  - `hideHeader?: boolean` - 隐藏标题栏（默认 `false`）

**返回值:**
- `Promise<{ reason?: string; data?: any }>` - 弹窗关闭结果
  - `reason` - 关闭原因：`'confirm'`（确认）、`'cancel'`（取消）、`'dismiss'`（点击遮罩/关闭图标）
  - `data` - 弹窗返回的数据

**示例:**
```javascript
// 打开面板页面弹窗
const result = await window.semApp.cdpSdk.ui.modal.open({
    pageId: 'formPage',
    title: '新建记录',
    width: 600,
    data: { mode: 'create' }
});
if (result.reason === 'confirm') {
    console.log('用户确认，返回数据:', result.data);
}

// 打开外部 iframe 弹窗
await window.semApp.cdpSdk.ui.modal.open({
    url: 'https://example.com',
    title: '外部页面',
    width: '80%',
    height: 600
});
```

##### `close(params?)`

关闭当前模态框。

**语法:**
```javascript
await window.semApp.cdpSdk.ui.modal.close(params);
```

**参数:**
- `params?: object` (可选) - 关闭参数
  - `reason?: string` - 关闭原因（`'confirm'` | `'cancel'`）
  - `data?: any` - 返回给调用方的数据

**返回值:**
- `Promise<any>` - 执行结果

**示例:**
```javascript
// 确认关闭并返回数据（在弹窗内部调用）
await window.semApp.cdpSdk.ui.modal.close({ reason: 'confirm', data: { saved: true } });

// 取消关闭
await window.semApp.cdpSdk.ui.modal.close({ reason: 'cancel' });
```

---

#### `sdk.ui.toast(message, options?)`

显示 Toast 通知消息。

**语法:**
```javascript
await window.semApp.cdpSdk.ui.toast(message, options);
```

**参数:**
- `message: string` (必需) - 提示消息内容
- `options` (可选) - 提示选项
  - `type?: 'success' | 'error' | 'warning' | 'info'` - 提示类型（默认: `'success'`）
  - `description?: string` - 详细描述
  - `duration?: number` - 显示时长（毫秒）

**返回值:**
- `Promise<any>` - 执行结果

**示例:**
```javascript
await window.semApp.cdpSdk.ui.toast('保存成功');

await window.semApp.cdpSdk.ui.toast('保存失败', {
    type: 'error',
    description: '网络连接超时，请重试'
});
```

> 💡 **提示**: 顶层的 `cdpSdk.toast()` 是此 API 的语法糖，内部调用 `ui.toast()`。

---

#### `sdk.ui.navigation`

导航控制 API。

**方法:**

##### `openMenu(nameOrPath, params?)`

打开指定名称或路径的菜单，并可传递参数。

**语法:**
```javascript
await window.semApp.cdpSdk.ui.navigation.openMenu(nameOrPath, params);
```

**参数:**
- `nameOrPath: string` (必需) - 菜单名称或菜单路径
- `params?: Record<string, any>` (可选) - 传递给页面的参数对象

**示例:**
```javascript
// 通过路由路径打开菜单
await window.semApp.cdpSdk.ui.navigation.openMenu('/folder/node');

// 带参数打开菜单
await window.semApp.cdpSdk.ui.navigation.openMenu('菜单名称', { id: '123' });
```

##### `getCurrentParams()`

获取当前页面 URL 中传递的查询参数。

**语法:**
```javascript
const params = await window.semApp.cdpSdk.ui.navigation.getCurrentParams();
```

**返回值:**
- `Promise<Record<string, string>>` - 包含查询参数的键值对对象

**示例:**
```javascript
const params = await window.semApp.cdpSdk.ui.navigation.getCurrentParams();
console.log('当前页面参数:', params);
```

---

### 4.3 数据 API (`sdk.data`)

数据 API 提供了获取 CDP 平台数据的方法。

#### `sdk.data.getMenu()`

获取菜单数据。

**语法:**
```javascript
const menuTree = await window.semApp.cdpSdk.data.getMenu();
```

**返回值:**
- `Promise<IMenuItem[]>` - 菜单树数组

**示例:**
```javascript
const menuTree = await window.semApp.cdpSdk.data.getMenu();
console.log('菜单数据:', menuTree);
```

---

#### `sdk.data.getAppConfig()`

获取应用配置。

**语法:**
```javascript
const appConfig = await window.semApp.cdpSdk.data.getAppConfig();
```

**返回值:**
- `Promise<{ appCode: string; appName: string; businessDomain: string }>` - 应用配置对象

**示例:**
```javascript
const appConfig = await window.semApp.cdpSdk.data.getAppConfig();
console.log('应用代码:', appConfig.appCode);
console.log('应用名称:', appConfig.appName);
console.log('业务域:', appConfig.businessDomain);
```

---

#### `sdk.data.auth`

认证相关 API。

##### `getCurrentUser()`

获取当前登录用户信息。

**语法:**
```javascript
const user = await window.semApp.cdpSdk.data.auth.getCurrentUser();
```

**返回值:**
- `Promise<{ id: string; fullName: string; role: string; phone?: string; raw: any }>` - 用户信息对象

**示例:**
```javascript
const user = await window.semApp.cdpSdk.data.auth.getCurrentUser();
console.log('用户ID:', user.id);
console.log('用户名:', user.fullName);
console.log('角色:', user.role);
```

##### `logout()`

执行登出操作(仅清除会话,不刷新页面)。

**语法:**
```javascript
await window.semApp.cdpSdk.data.auth.logout();
```

**返回值:**
- `Promise<any>` - 登出结果

**示例:**
```javascript
await window.semApp.cdpSdk.data.auth.logout();
console.log('已登出');
```

---

### 4.4 工具 API (`sdk.utils`)

工具 API 提供了宿主侧的工具能力（自 SDK 1.5.3 起支持）。

#### `sdk.utils.transformDataSchemaToComponents(backendDataSchema, options)`

将后端 `dataSchema` 的全部字段转换为前端组件配置（表单元素数组），便于业务方拿到后端数据结构后自行编排成 `pageConfig` 挂载渲染。

**语法:**
```javascript
const components = await window.semApp.cdpSdk.utils.transformDataSchemaToComponents(backendDataSchema, options);
```

**参数:**
- `backendDataSchema: object` (必需) - 后端 dataSchema（`{ type, fields: [...] }`）；兼容已转换的前端结构（`{ datas: [...] }`）
- `options?: object` - 可选配置
  - `panelCode?: string` - 面板编码（透传给字段转换）
  - `filterSystemFields?: boolean` - 是否过滤系统字段（`id`/`createdAt`/`updatedAt`/`createdBy`/`updatedBy`），默认 `true`

**返回值:**
- `Promise<any[]>` - 前端组件配置数组（每个元素为 `{ type, id, props }`，可直接作为 Form 的 `children` 或编排进 `pageConfig`）

**示例:**
```javascript
const backendDataSchema = {
    type: 'object',
    fields: [
        { dataName: '阶段名称', dataType: 'STRING', alias: '阶段名称', defaultOptions: [{ label: '测试1', value: '测试1' }] },
        { dataName: '阶段描述', dataType: 'STRING', alias: '阶段描述' }
    ]
};

// 1. 后端 dataSchema → 前端组件配置
const components = await window.semApp.cdpSdk.utils.transformDataSchemaToComponents(backendDataSchema);
console.log('组件配置:', components);

// 2. 编排成 pageConfig 挂载渲染
const unmountFn = await window.semApp.cdpSdk.controllers.portal.mountPage({
    panelCode: 'IML_00009',
    pageId: '销售阶段配置_表单',
    containerId: '#lowcode-portal-anchor',
    pageConfig: {
        pageId: '销售阶段配置_表单',
        pageName: '销售阶段配置_表单',
        component: {
            type: 'Section',
            id: 'section_xxx',
            children: [
                {
                    type: 'FlexBox',
                    id: 'flex_xxx',
                    props: { direction: 'column', gap: 3 },
                    children: [
                        { type: 'Form', id: '销售阶段配置_表单', children: components, props: { operations: [] } }
                    ]
                }
            ]
        },
        pageSelfData: { dataSource: [] }
    }
});
```

---

### 4.5 应用 API (`sdk.app`)

应用 API 提供了应用级别的功能。

#### `sdk.app.theme`

主题控制 API。

##### `getModes()`

获取所有可用的主题模式。

**语法:**
```javascript
const modes = await window.semApp.cdpSdk.app.theme.getModes();
```

**返回值:**
- `Promise<ThemeMode[]>` - 主题模式数组 (`['light', 'dark', 'auto']`)

**示例:**
```javascript
const modes = await window.semApp.cdpSdk.app.theme.getModes();
console.log('可用模式:', modes);
```

##### `setMode(mode)`

设置主题模式。

**语法:**
```javascript
await window.semApp.cdpSdk.app.theme.setMode(mode);
```

**参数:**
- `mode: 'light' | 'dark' | 'auto'` (必需) - 主题模式

**示例:**
```javascript
// 设置为深色模式
await window.semApp.cdpSdk.app.theme.setMode('dark');

// 设置为浅色模式
await window.semApp.cdpSdk.app.theme.setMode('light');

// 设置为自动模式
await window.semApp.cdpSdk.app.theme.setMode('auto');
```

##### `setPreset(presetId)`

设置主题预设。

**语法:**
```javascript
await window.semApp.cdpSdk.app.theme.setPreset(presetId);
```

**参数:**
- `presetId: string` (必需) - 预设ID

**示例:**
```javascript
await window.semApp.cdpSdk.app.theme.setPreset('ocean');
```

##### `setCustomColors(colors)`

设置自定义主题颜色。

**语法:**
```javascript
await window.semApp.cdpSdk.app.theme.setCustomColors(colors);
```

**参数:**
- `colors: ThemeColorPair` (必需) - 自定义颜色对象
  - `light: { primary: string; success: string; ... }` - 浅色模式颜色
  - `dark: { primary: string; success: string; ... }` - 深色模式颜色

**示例:**
```javascript
await window.semApp.cdpSdk.app.theme.setCustomColors({
    light: {
        primary: '210 100% 50%',
        success: '120 100% 40%',
        // ... 其他颜色
    },
    dark: {
        primary: '210 100% 60%',
        success: '120 100% 50%',
        // ... 其他颜色
    }
});
```

##### `toggleMode()`

切换主题模式(在 light 和 dark 之间切换)。

**语法:**
```javascript
await window.semApp.cdpSdk.app.theme.toggleMode();
```

**示例:**
```javascript
// 切换主题模式
await window.semApp.cdpSdk.app.theme.toggleMode();
```

##### `getPresets()`

获取所有可用的主题预设。

**语法:**
```javascript
const presets = await window.semApp.cdpSdk.app.theme.getPresets();
```

**返回值:**
- `Promise<any>` - 主题预设列表

**示例:**
```javascript
const presets = await window.semApp.cdpSdk.app.theme.getPresets();
console.log('可用预设:', presets);
```

##### `getState()`

获取当前主题状态。

**语法:**
```javascript
const state = await window.semApp.cdpSdk.app.theme.getState();
```

**返回值:**
- `Promise<ThemeStateWithEffective>` - 主题状态对象
  - `mode: ThemeMode` - 用户设置的模式
  - `effectiveMode: 'light' | 'dark'` - 实际生效的模式
  - `activePresetId: string | null` - 当前预设ID
  - `currentColors: ThemeColorPair` - 当前颜色配置

**示例:**
```javascript
const state = await window.semApp.cdpSdk.app.theme.getState();
console.log('设置模式:', state.mode);
console.log('实际模式:', state.effectiveMode);
console.log('当前预设:', state.activePresetId);
console.log('当前颜色:', state.currentColors);
```

##### `onChange(callback)`

订阅主题变化事件。

**语法:**
```javascript
const unsubscribe = window.semApp.cdpSdk.app.theme.onChange(callback);
```

**参数:**
- `callback: (state: ThemeStateWithEffective) => void` (必需) - 回调函数

**返回值:**
- `() => void` - 取消订阅函数

**示例:**
```javascript
// 订阅主题变化
const unsubscribe = window.semApp.cdpSdk.app.theme.onChange((state) => {
    console.log('主题已变化:', state);
    
    // 应用新主题
    const colors = state.effectiveMode === 'dark' 
        ? state.currentColors.dark 
        : state.currentColors.light;
    document.documentElement.style.setProperty('--primary', `hsl(${colors.primary})`);
});

// 需要时取消订阅
// unsubscribe();
```

---

#### `sdk.app.globalEvent`

全局事件 API，用于在应用内广播和订阅业务事件。

##### `emit(type, payload?)`

广播一个全局事件。

**语法:**
```javascript
const result = await window.semApp.cdpSdk.app.globalEvent.emit(type, payload);
```

**参数:**
- `type: string`（必需）- 事件类型。
- `payload: Record<string, any>`（可选）- 业务载荷，默认为 `{}`。

**返回值:**
- `Promise<{ type: string; listenerCount: number }>` - 事件类型和本次命中的订阅数量。

##### `on(type, handler, options?)`

订阅全局事件。

**语法:**
```javascript
const unsubscribe = window.semApp.cdpSdk.app.globalEvent.on(
    type,
    handler,
    { sourceFilter: { panelCode: 'approval-center' } }
);
```

**参数:**
- `type: string`（必需）- 要订阅的事件类型。
- `handler: (event) => void | Promise<void>`（必需）- 事件处理函数。
- `options.sourceFilter`（可选）- 来源过滤条件，支持 `panelCode`、`pageId`、`componentId`，每个字段可传字符串或字符串数组。

**返回值:**
- `() => void` - 取消订阅函数。

事件回调参数格式如下：

```javascript
{
    // payload 中的业务字段会平铺到顶层
    orderId: 'order-001',
    status: 'paid',

    // SDK / 宿主自动附带的系统字段
    $source: {
        panelCode: 'approval-center',
        pageId: 'order-detail',
        componentId: 'submit-button'
    },
    $type: 'order:updated',
    $timestamp: 1753238400000
}
```

---

#### `sdk.app.logout()`

执行完整的登出流程(清除会话并刷新父窗口)。

**语法:**
```javascript
await window.semApp.cdpSdk.app.logout();
```

**返回值:**
- `Promise<void>`

**示例:**
```javascript
try {
    await window.semApp.cdpSdk.app.logout();
    // 登出成功后会自动刷新页面
} catch (error) {
    console.error('登出失败:', error);
}
```

---

### 4.6 控制器 API (`sdk.controllers`)

控制器 API 提供了高级控制功能。

#### `sdk.controllers.createMenu()`

创建菜单控制器实例。用于自定义 Shell 开发。

**语法:**
```javascript
const menuController = window.semApp.cdpSdk.controllers.createMenu();
```

**返回值:**
- `MenuController` - 菜单控制器实例

**MenuController 方法:**

##### `init(menuTree, options?)`

初始化菜单控制器。

**参数:**
- `menuTree: MenuItem[]` (必需) - 菜单树，来源不限
- `options?: object` (可选) - 配置选项
  - `contentContainer?: string` - 兼容保留的单内容容器选择器；多 Tab Shell 可省略并使用 `mount()`

**示例:**
```javascript
const menuController = window.semApp.cdpSdk.controllers.createMenu();

menuController.init(menuTree, {
    contentContainer: '#portal-container'
});
```

##### `onStateChange(callback)`

订阅菜单状态变化。

**参数:**
- `callback: (state) => void` (必需) - 状态变化回调
  - `state.menuTree: IMenuItem[]` - 菜单树
  - `state.activeId: string | null` - 当前激活的菜单ID
  - `state.expandedIds: Set<string>` - 已展开的菜单ID集合

**返回值:**
- `() => void` - 取消订阅函数

**示例:**
```javascript
menuController.onStateChange((state) => {
    const { menuTree, activeId } = state;
    // 渲染你的菜单 UI
    renderMenu(menuTree, activeId);
});
```

##### `select(menuItem)`

选择菜单项并触发导航。

**参数:**
- `menuItem: IMenuItem` (必需) - 菜单项对象

**返回值:**
- `Promise<void>` - 异步操作

**示例:**
```javascript
await menuController.select(menuItem);
```

---

##### `mount(menuItem, options)`

解析菜单节点 `panelId`（优先）或 `panelCode` 中的 `{panelCode}_v_{pageId}`，并复用 `PortalController.mountPage()` 将页面挂载到 CustomShell 指定容器。该方法不修改菜单状态、不触发导航，也不要求菜单来自 `sdk.data.getMenu()`。

**参数:**
- `menuItem: MenuItem` (必需) - 完整菜单节点
- `options.containerId: string` (必需) - 目标 iframe 文档内 CSS 选择器

**返回值:**
- `Promise<() => Promise<void>>` - 专属于该容器的卸载函数，关闭 Tab 时调用

**契约:**
- 不按菜单类型分支，只要求 `panelId/panelCode` 中至少一个是合法页面编码；
- `panelId` 与 `panelCode` 同时存在时优先 `panelId`；
- `businessDomain` 作为 `businessDomainCode` 传给挂载页面；
- 隐藏但不卸载即保活，关闭 Tab 时调用卸载函数；
- 同一容器再次挂载沿用现有 `mountPage()` 的替换语义。

**示例:**
```javascript
// 首次打开叶子时挂载并缓存卸载函数
const unmount = await menuController.mount(item, {
    containerId: '#menu-content-1'
});

// 关闭 Tab 时卸载
await unmount();
```

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

##### `destroy()`

销毁菜单控制器,清理事件监听器。

**示例:**
```javascript
menuController.destroy();
```

---

#### `sdk.controllers.portal`

Portal 控制器 API。提供向当前所在的主应用发起跨域渲染请求，在第三方系统（或自定义 Shell 环境）特定的 DOM 节点中按需挂载低代码面板微页面片段的能力，且生命周期归外部框架完全掌控。

> **⚠️ Menu 与 Portal 边界**:
> - `portal.mountPage()` 仍是原子的页面挂载能力；
> - `menuController.mount()` 是菜单领域便捷入口，只负责解析菜单页面编码并委托 `mountPage()`；
> - 两者最终走同一 dynamicPortal，不存在第二种菜单 Portal 类型。

##### `mountPage(panelCode, pageId, containerSelector)` / `mountPage(options)`

按需挂载页面到指定的 DOM 容器中。支持双签名：旧签名（3 个参数）与对象签名（单个选项对象）。对象签名自 SDK 1.5.1 起支持（`pageInputs`/`pageInitialData`/`formMode`），1.5.2 起支持 `businessDomainCode`，1.5.3 起支持 `pageConfig`。

**语法:**
```javascript
// 旧签名：按面板编码 + 页面 ID 挂载（宿主按 panelCode 加载面板配置）
const unmountFn = await window.semApp.cdpSdk.controllers.portal.mountPage(panelCode, pageId, containerSelector);

// 对象签名：直接下发 pageConfig 挂载（宿主基于 pageConfig 构建独立 panelConfig 渲染，不修改原面板配置）
const unmountFn = await window.semApp.cdpSdk.controllers.portal.mountPage({
    panelCode: 'IML_00009',          // 可选：面板标识（构建的 panelConfig.metadata.panelCode 优先取它，否则取原 config 的 panelCode）
    pageId: '销售阶段配置_表单',      // 页面 ID（传入 pageConfig 时优先取 pageConfig.pageId）
    containerId: '#lowcode-portal-anchor', // 挂载到的 DOM 容器选择器
    pageConfig: { /* 页面 UI Schema：{ pageId, pageName, component, pageSelfData } */ },
    pageInitialData: { /* 按表单字段 name 注入的初始值 */ },
    pageInputs: {},          // 可选：页面参数
    formMode: 'view',        // 可选：表单模式
    businessDomainCode: ''   // 可选：业务域编码
});
```

**参数（旧签名）:**
- `panelCode: string` (必需) - 目标面板 Code
- `pageId: string` (必需) - 目标页面 ID
- `containerSelector: string` (必需) - 挂载到的 DOM 容器选择器

**参数（对象签名）:**
- `panelCode?: string` - 面板标识（可选，作为构建出的 panelConfig 的面板身份）
- `pageId: string` (必需) - 页面 ID
- `containerId: string` (必需) - 挂载到的 DOM 容器选择器
- `pageConfig?: object` - 页面配置（页面级 UI Schema）。传入时宿主基于它构建独立 `panelConfig` 渲染，`pageId` 优先取 `pageConfig.pageId`，且不会修改原面板配置
- `pageInitialData?: object` - 初始数据（按表单字段 `name` 注入）
- `pageInputs?: object` - 页面参数
- `formMode?: string` - 表单模式
- `businessDomainCode?: string` - 业务域编码

**`pageConfig` 结构:**

`pageConfig` 是一个页面级 UI Schema，用于向宿主完整描述一个页面：

```javascript
{
    pageId: '销售阶段配置_表单',          // 页面 ID（挂载时优先于对象签名中的 pageId）
    pageName: '销售阶段配置_表单',        // 页面名称
    component: {                          // 页面根组件（页面本身就是一个组件实例）
        type: 'Section',
        id: 'section_xxx',
        children: [ /* 组件树，可包含 Form / Input / Select 等 */ ]
    },
    pageSelfData: {                       // 可选：页面自身数据（如数据源）
        dataSource: []
    }
}
```

**行为说明:**
- **传入 `pageConfig`**：宿主基于该配置**新建**一个独立 `panelConfig`（`uiSchema.pages` 仅包含该页）直接渲染，不读取、不修改宿主当前面板配置；`panelCode` 优先取选项中的 `panelCode`，否则回退宿主原配置的 `panelCode`；`pageId` 优先取 `pageConfig.pageId`。
- **不传 `pageConfig`**：宿主按 `panelCode` 从后端加载面板配置，渲染其中 `pageId` 对应的页面（旧行为）。

**返回值:**
- `Promise<() => Promise<void>>` - 返回一个异步卸载方法，调用该方法可向主应用发出卸载销毁请求。

**示例（旧签名）:**
```javascript
try {
    // 挂载页面
    const unmountTargetPage = await window.semApp.cdpSdk.controllers.portal.mountPage(
        'IML_00009',
        '销售阶段配置',
        '#lowcode-portal-anchor'
    );
    
    console.log('跨面板页面加载完毕！');

    // 卸载页面
    // await unmountTargetPage();
} catch (error) {
    console.error('挂载页面失败:', error);
}
```

**示例（对象签名 + pageConfig）:**
```javascript
try {
    // 直接下发页面配置挂载，同时注入表单初始值
    const unmountTargetPage = await window.semApp.cdpSdk.controllers.portal.mountPage({
        panelCode: 'IML_00009',                       // 面板标识（作为页面身份）
        pageId: '销售阶段配置_表单',
        containerId: '#lowcode-portal-anchor',
        pageConfig: {                                 // 🆕 页面配置
            pageId: '销售阶段配置_表单',
            pageName: '销售阶段配置_表单',
            component: {
                type: 'Section',
                id: 'section_xxx',
                children: [
                    { type: 'Form', id: '销售阶段配置_表单', children: [ /* 表单字段 */ ] }
                ]
            },
            pageSelfData: { dataSource: [] }
        },
        pageInitialData: {                            // 表单初始值（按字段 name 注入）
            阶段名称: '测试1',
            阶段描述: '未开始'
        }
    });

    // 卸载页面（离开页面时自动调用，详见示例文件）
    // await unmountTargetPage();
} catch (error) {
    console.error('挂载页面失败:', error);
}
```

> 💡 完整可运行的 `pageConfig` 自动挂载示例见 `docs/examples/cdp-sdk-example-9-page-config-mount.html`（加载后自动挂载、离开页面自动卸载，含初始值注入与 `component.invoke` 获取表单值）。

---

### 4.7 动作注册 API

#### `setActions(config)`

注册动作到 CDP 平台,让 AI 智能体可以调用你的页面功能。

**语法:**
```javascript
await window.semApp.cdpSdk.setActions(config);
```

**参数:**
- `config` (必需) - 配置对象
  - `guidance?: string` - 操作指南(Markdown 格式)
  - `definitions?: ActionDefinition[]` - 动作定义数组
  - `handlers?: ActionHandlers` - 动作处理器对象
  - `registrationDelay?: number` - 注册延迟(毫秒,默认: 100)

**ActionDefinition 结构:**
```typescript
{
    actionName: string;              // 动作名称(唯一标识)
    actionAlias?: string;            // 人类可读的别名
    actionDescription: string;       // 动作描述
    actionParameterSchema: object;   // 参数 JSON Schema
    actionReturnSchema?: object;     // 返回值 JSON Schema
}
```

**返回值:**
- `Promise<boolean>` - 注册是否成功

**示例:**
```javascript
await window.semApp.cdpSdk.setActions({
    guidance: '这是一个数据管理页面...',
    definitions: [
        {
            actionName: 'getData',
            actionAlias: '获取数据',
            actionDescription: '获取当前页面数据',
            actionParameterSchema: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    ],
    handlers: {
        getData: async () => {
            return { success: true, data: getCurrentData() };
        }
    }
});
```

---

#### `updateActionHandlers(handlers)`

增量更新动作处理器(不通知父窗口)。

**语法:**
```javascript
window.semApp.cdpSdk.updateActionHandlers(handlers);
```

**参数:**
- `handlers: ActionHandlers` (必需) - 动作处理器对象

**示例:**
```javascript
window.semApp.cdpSdk.updateActionHandlers({
    newAction: async (params) => {
        // 新的处理逻辑
        return { success: true };
    }
});
```

---

#### `addActionHandler(name, handler)`

添加单个动作处理器(不通知父窗口)。

**语法:**
```javascript
window.semApp.cdpSdk.addActionHandler(name, handler);
```

**参数:**
- `name: string` (必需) - 动作名称
- `handler: ActionHandler` (必需) - 动作处理函数

**示例:**
```javascript
window.semApp.cdpSdk.addActionHandler('myAction', async (params) => {
    console.log('执行动作:', params);
    return { success: true };
});
```

---

### 4.8 兼容性 API (已废弃)

以下 API 仍然可用,但建议使用新的 API 替代。

#### `getTheme()` ⚠️ 已废弃

获取主题配置(旧版兼容)。

**语法:**
```javascript
const themeConfig = await window.semApp.cdpSdk.getTheme();
```

**返回值:**
- `Promise<ThemeConfig>` - 主题配置对象

**推荐替代:**
```javascript
// 使用新 API
const state = await window.semApp.cdpSdk.app.theme.getState();
```

---

#### `onThemeChange(callback)` ⚠️ 已废弃

订阅主题变化(旧版兼容)。

**语法:**
```javascript
const unsubscribe = window.semApp.cdpSdk.onThemeChange(callback);
```

**推荐替代:**
```javascript
// 使用新 API
const unsubscribe = window.semApp.cdpSdk.app.theme.onChange(callback);
```

---

### 4.9 类型定义

#### `Instruction`

指令对象类型。

```typescript
interface Instruction {
    type: string;      // 指令类型
    params?: any;      // 指令参数
}
```

#### `InstructionExecutionOptions`

指令执行选项。

```typescript
interface InstructionExecutionOptions {
    timeout?: number;  // 超时时间(毫秒)
}
```

#### `ToastOptions`

提示选项。

```typescript
interface ToastOptions {
    type?: 'success' | 'error' | 'warning' | 'info';  // 提示类型
    description?: string;                              // 详细描述
    duration?: number;                                 // 显示时长(毫秒)
}
```

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


#### `IMenuItem`

菜单项

```typescript
interface IMenuItem {
  uuid?: string;           // UUID
  parentUuid?: string;     // 父级UUID
  type: MenuItemType;      // 
  title: string;
  icon?: string;
  panelId?: string;        // Panel 类型使用
  panelCode?: string;      // ExternalPage 类型使用
  children?: IMenuItem[];
}

const MENU_ITEM_TYPE = {
    PANEL: "Panel",
    FOLDER: "Folder",
    EXTERNAL_PAGE: "ExternalPage",
    GROUP: "group",
    ITEM: "item",
}

type MenuItemType = typeof MENU_ITEM_TYPE[keyof typeof MENU_ITEM_TYPE]
```

---

## 🔗 第五部分:PanelX SDK

PanelX SDK 由 CDP 宿主环境自动注入，通过 `window.semApp.panelXSdk` 访问。

### 获取实例

```javascript
const panelXSdk = window.semApp?.panelXSdk;
if (panelXSdk) {
    console.log('✅ PanelX SDK 已加载');
} else {
    console.error('❌ PanelX SDK 未加载');
}
```

### API 文档

完整的 API 声明及使用说明请参阅：[PanelX SDK API 文档](https://demo.kwaidoo.com/VF_DEV/sdk/docs.html)

---

## 📱 第六部分:微信小程序 SDK

微信小程序 SDK 由 CDP 宿主环境自动注入，通过 `window.semApp.wxminiSdk` 访问。

### 获取实例

```javascript
const wxminiSdk = window.semApp?.wxminiSdk;
if (wxminiSdk) {
    console.log('✅ 微信小程序 SDK 已加载');
} else {
    console.error('❌ 微信小程序 SDK 未加载');
}
```

### API 文档

完整的 API 声明及使用说明请参阅：[微信小程序 SDK API 文档](https://drive.weixin.qq.com/s?k=AO0ABAelAD46zXOgQJ)

---

## 🎨 第七部分:宿主 UI 资源 — lucide 图标库

> **版本要求**：CDP **1.11.4 及以上**。低于该版本 `window.semApp.ui` 不存在。

CDP 宿主环境会把已加载的 `lucide.dev` 图标库引用挂载到
`window.semApp.ui.lucide`，iframe 业务代码可直接复用，无需在自己的页面里再引入一份
lucide，**节省体积、保证图标视觉与宿主一致**。

> 与 `cdpSdk` / `panelXSdk` / `wxminiSdk` 不同：`semApp.ui.lucide` 不是通信代理，而是
> 直接共享的库引用。CDP 在 SDK 初始化时会自动完成跨 realm 适配，使用方按 lucide
> 官方标准用法调用即可。

### 使用前提

- **同源 iframe**：当前 iframe 与 CDP 宿主同源（含 `srcdoc` / 同站 URL）
- **跨域 iframe 暂不支持**：跨域场景下 `window.semApp.ui.lucide` 为 `undefined`，
  需要业务自行降级（不显示图标 / 改用文字 / 自带内置 SVG）

### 获取实例与降级判断

```javascript
const lucide = window.semApp?.ui?.lucide;

if (lucide) {
    console.log('✅ 已获取宿主 lucide 实例');
    // 正常使用
} else {
    console.warn('⚠️ lucide 不可用，使用降级方案');
    // 降级：占位文字 / 自带内置 SVG / 不显示图标
}
```

### 用法 A：DOM 自动扫描 `createIcons()`

最适合**静态布局**。给元素加 `data-lucide="图标名"`（**kebab-case**），
调用一次 `createIcons()` 即可一次性渲染。

```html
<i data-lucide="search"></i>
<i data-lucide="settings"></i>
<i data-lucide="check-circle"></i>

<script>
    window.semApp.ui.lucide.createIcons();
</script>
```

### 用法 B：编程式 `createElement(icons[Name])`

最适合**动态生成图标**的场景。键名是 **PascalCase**（与 DOM 扫描的 kebab-case 不同）。

```javascript
const { createElement, icons } = window.semApp.ui.lucide;

const el = createElement(icons.AlertTriangle);
el.setAttribute('width', 18);
el.setAttribute('height', 18);
container.appendChild(el);
```

> 新版 lucide **不再提供 `.toSvg()` 方法**。若需要 SVG 字符串，可读 `el.outerHTML`。

### 用法 C：动态切换图标

收藏 / 点赞这种切换状态的场景，重建占位元素后再调一次 `createIcons()`：

```javascript
function toggleFavorite(favored) {
    // 上一次 createIcons 已经把 <i> 换成 <svg>，这里需要重建占位
    const oldIcon = document.getElementById('fav-icon');
    const placeholder = document.createElement('i');
    placeholder.id = 'fav-icon';
    placeholder.setAttribute('data-lucide', favored ? 'heart-off' : 'heart');
    oldIcon.parentNode.replaceChild(placeholder, oldIcon);

    window.semApp.ui.lucide.createIcons();
}
```

### 注意事项

1. **图标名大小写**：DOM 扫描用 `data-lucide="check-circle"`（kebab-case），
   编程式用 `icons.CheckCircle`（PascalCase）
2. **图标可用性**：`Object.keys(lucide.icons)` 可枚举所有可用图标名；完整图标列表见
   [lucide.dev/icons](https://lucide.dev/icons/)
3. **跨域降级**：必须在调用前判断 `window.semApp?.ui?.lucide` 是否存在，否则跨域
   场景会抛 `Cannot read properties of undefined`
4. **不要自己 `import 'lucide'`**：在 iframe 内重新引入会破坏"与宿主共享一份"的
   初衷，徒增体积

### 完整示例

完整可运行示例参见 [lucide 图标库示例](https://drive.weixin.qq.com/s?k=AO0ABAelAD4ebdGNeY)。

---

## 🔍 调试技巧

### 1. 检查 SDK 状态

```javascript
console.log('SDK 已加载:', !!window.semApp?.cdpSdk);
console.log('初始化数据:', window.semApp?.cdpSdk?.getInitData());
```

### 2. 测试动作注册

```javascript
// 测试简单调用
window.semApp.cdpSdk.toast('测试消息')
    .then(() => console.log('✅ SDK 工作正常'))
    .catch(err => console.error('❌ SDK 异常:', err));
```

### 3. 查看主题配置

```javascript
window.semApp.cdpSdk.getThemeConfig()
    .then(config => console.log('主题配置:', config))
    .catch(err => console.error('获取主题失败:', err));
```

---

## 📞 技术支持

如遇到问题,请检查:

1. ✅ SDK 是否正确加载
2. ✅ 是否在 iframe 环境中运行
3. ✅ 浏览器控制台是否有错误信息
4. ✅ 指令参数是否正确
5. ✅ 动作定义格式是否符合规范

---

## 📖 相关文档

- [事件及指令使用指南](https://drive.weixin.qq.com/s?k=AO0ABAelAD4QAsm8Qt) - 完整的指令列表和参数说明
- [表单弹窗示例](https://drive.weixin.qq.com/s?k=AO0ABAelAD47LsX30J) - 表单提交与弹窗关闭示例
- [指令调用示例](https://drive.weixin.qq.com/s?k=AO0ABAelAD4h2cJB8G) - 数据展示与指令调用示例
- [主题订阅示例](https://drive.weixin.qq.com/s?k=AO0ABAelAD48wtLhl6) - 主题订阅与自动同步示例
- [动作注册示例](https://drive.weixin.qq.com/s?k=AO0ABAelAD400jolKn) - 完整的动作注册示例
- [自定义Shell示例](https://drive.weixin.qq.com/s?k=AO0ABAelAD4hAgVtvQ) - 完整的自定义Shell示例
- [自定义Shell示例（部分菜单节点tab显示）](https://drive.weixin.qq.com/s?k=AO0ABAelAD4ZHrJqTk) - 部分菜单节点tab显示的自定义Shell示例
- [动态Portal示例](https://drive.weixin.qq.com/s?k=AO0ABAelAD4yCjMOli) - 完整的动态Portal示例
- 全局事件跨页面示例：[全局事件订阅页](https://drive.weixin.qq.com/s?k=AO0ABAelAD4QyADMXK)、[全局事件发送页](https://drive.weixin.qq.com/s?k=AO0ABAelAD4lVunecA) - 两个页面共同演示打开编辑表单、发送全局事件、订阅并刷新表格数据
- [lucide 图标库示例](https://drive.weixin.qq.com/s?k=AO0ABAelAD4ebdGNeY) - 共享宿主 lucide 图标库的完整示例（需 CDP 1.11.4+）

----------------------------
