# 指令系统配置指南 v2.0

> 版本: 2.0.0 | 更新日期: 2025-12-27

本文档为配置人员提供完整的事件和指令系统使用指南,包括所有可用的指令类型、组件动作和配置示例。

## 📚 目录

- [事件配置](#事件配置)
- [指令类型](#指令类型)
- [组件动作](#组件动作)
- [上下文变量](#上下文变量)
- [完整示例](#完整示例)
- [最佳实践](#最佳实践)

---

## 事件配置

### 事件配置结构

```json
{
  "type": "事件类型",
  "instructions": [指令列表],
  "condition": "执行条件(可选)",
  "debounce": 300,
  "throttle": 1000,
  "debug": false,
  "description": "事件说明"
}
```

### 支持的事件类型

基于 `EngineEventProtocol`,系统支持以下标准事件:

| 事件类型 | 说明 | $event 参数 | 适用组件 |
|---------|------|------------|---------|
| `mount` | 组件挂载时触发 | `void` | 所有组件 |
| `unmount` | 组件卸载时触发 | `void` | 所有组件 |
| `click` | 点击时触发 | `void` | Button, 可点击组件 |
| `focus` | 获得焦点时触发 | `void` | Input, Select 等 |
| `blur` | 失去焦点时触发 | `void` | Input, Select 等 |
| `valueChange` | 值变化时触发 | `{ newValue: any, oldValue: any }` | Input, Select 等 |
| `itemClick` | 项点击时触发 | `{ index: number, item: Record<string, any> }` | List, Table |
| `itemDoubleClick` | 项双击时触发 | `{ index: number, item: Record<string, any> }` | List, Table |
| `itemRightClick` | 项右键点击时触发 | `{ index: number, item: Record<string, any> }` | List, Table |
| `itemLongPress` | 项长按时触发 | `{ index: number, item: Record<string, any> }` | List, Table |

### 事件配置选项

#### condition (可选)
执行条件,只有条件为 true 时才执行指令

```json
{
  "type": "click",
  "condition": {
    "type": "JSExpression",
    "value": "$self.value !== ''"
  },
  "instructions": [...]
}
```

#### debounce (可选)
防抖延迟(毫秒),适用于高频事件

```json
{
  "type": "valueChange",
  "debounce": 300,
  "instructions": [...]
}
```

#### throttle (可选)
节流间隔(毫秒),适用于高频事件

```json
{
  "type": "valueChange",
  "throttle": 1000,
  "instructions": [...]
}
```

---

## 指令类型

### 1. component.invoke - 调用组件方法

**用途**: 调用组件的动作方法

**结构**:
```json
{
  "type": "component.invoke",
  "target": "组件ID",
  "action": "动作名称",
  "params": { 动作参数 },
  "resultKey": "结果存储键(可选)"
}
```

**示例**:
```json
{
  "type": "component.invoke",
  "target": "form_1",
  "action": "updateFields",
  "params": {
    "updates": [
      { "field": "name", "value": "张三" },
      { "field": "age", "value": 25 }
    ]
  }
}
```

**可用动作**: 参见 [组件动作](#组件动作) 章节

---

### 2. component.getValue - 获取组件值

**用途**: 获取组件的当前值

**结构**:
```json
{
  "type": "component.getValue",
  "target": "组件ID",
  "resultKey": "结果存储键(必须)"
}
```

**示例**:
```json
{
  "type": "component.getValue",
  "target": "input_name",
  "resultKey": "userName"
}
```

**注意**: 必须指定 `resultKey` 才能在后续指令中使用获取的值

---

### 3. component.setValue - 设置组件值

**用途**: 设置组件的值

**结构**:
```json
{
  "type": "component.setValue",
  "target": "组件ID",
  "params": 值
}
```

**示例**:
```json
// 设置静态值
{
  "type": "component.setValue",
  "target": "input_name",
  "params": "张三"
}

// 设置动态值
{
  "type": "component.setValue",
  "target": "input_age",
  "params": {
    "type": "JSExpression",
    "value": "$results.calculatedAge"
  }
}
```

---

### 4. flow.branch - 条件分支

**用途**: 根据条件执行不同的指令分支

**结构**:
```json
{
  "type": "flow.branch",
  "condition": { JSExpression },  // 可选:前置守卫
  "params": {
    "expression": { JSExpression },  // 必需:分支判断
    "trueFlow": [条件为真时执行的指令],
    "falseFlow": [条件为假时执行的指令(可选)]
  }
}
```

**示例**:
```json
{
  "type": "flow.branch",
  "params": {
    "expression": {
      "type": "JSExpression",
      "value": "$results.age >= 18"
    },
    "trueFlow": [
      {
        "type": "ui.toast",
        "params": { "type": "success", "message": "成年用户" }
      }
    ],
    "falseFlow": [
      {
        "type": "ui.toast",
        "params": { "type": "warning", "message": "未成年用户" }
      }
    ]
  }
}
```

**设计说明**:
- `params.expression`: 分支判断的核心业务逻辑
- 外层 `condition`: 可选的前置守卫,决定是否执行整个分支指令

---

### 5. flow.script - 自定义脚本

**用途**: 执行自定义 JavaScript 代码,支持内部编排指令

**结构**:
```json
{
  "type": "flow.script",
  "params": {
    "type": "JSFunction",
    "value": "async function(context) { ... }"
  },
  "resultKey": "结果存储键(可选)"
}
```

**上下文参数**:
- `context.$execute`: 指令执行器,可在脚本内部编排指令
  - `context.$execute.instruction(instruction)`: 执行单个指令
  - `context.$execute.instructionSet(instructionSet)`: 执行指令集
  - `context.$execute.batch(instructions)`: 批量执行指令
- `context.$event`: 事件参数
- `context.$results`: 之前指令的结果
- `context.$self`: 当前组件信息

**完整示例** (参考 calc-script.json):
```json
{
  "type": "flow.script",
  "description": "计算总价并更新",
  "params": {
    "type": "JSFunction",
    "value": "async function(context) {\n  const { $execute, $event } = context;\n  const unitPrice = $event.newValue;\n  \n  // 验证单价\n  if (!unitPrice || unitPrice === '') {\n    await $execute.instruction({\n      type: 'ui.toast',\n      params: {\n        type: 'warning',\n        message: '请输入单价'\n      }\n    });\n    \n    // 清空总价\n    await $execute.instruction({\n      type: 'component.setValue',\n      target: 'totalPrice',\n      params: ''\n    });\n    return { success: false, reason: '单价为空' };\n  }\n  \n  // 获取数量\n  const quantity = await $execute.instruction({\n    type: 'component.getValue',\n    target: 'quantity'\n  });\n  \n  // 验证数量\n  if (!quantity || quantity === '') {\n    await $execute.instruction({\n      type: 'ui.toast',\n      params: {\n        type: 'info',\n        message: '请输入数量以计算总价'\n      }\n    });\n    return { success: false, reason: '数量为空' };\n  }\n  \n  // 计算总价\n  const total = parseFloat(unitPrice) * parseFloat(quantity);\n  \n  // 更新总价\n  await $execute.instruction({\n    type: 'component.setValue',\n    target: 'totalPrice',\n    params: total.toFixed(2)\n  });\n  \n  // 显示成功提示\n  await $execute.instruction({\n    type: 'ui.toast',\n    params: {\n      type: 'success',\n      message: `总价已更新：¥${total.toFixed(2)}`\n    }\n  });\n  \n  return { success: true, total: total.toFixed(2) };\n}"
  },
  "resultKey": "calcResult"
}
```

**注意**: 
- 函数必须是 `async function(context) { ... }` 格式
- 可以使用 `await` 调用 `$execute.instruction()` 编排其他指令
- 函数应该返回一个对象,可通过 `resultKey` 在后续指令中引用

---

### 6. ui.toast - Toast 通知

**用途**: 显示 Toast 通知消息

**结构**:
```json
{
  "type": "ui.toast",
  "params": {
    "type": "通知类型",
    "message": "主要消息",
    "description": "详细描述(可选)",
    "duration": 3000
  }
}
```

**通知类型**: `success` | `error` | `info` | `warning` | `message` | `loading`

**示例**:
```json
{
  "type": "ui.toast",
  "params": {
    "type": "success",
    "message": "操作成功",
    "description": "数据已保存",
    "duration": 3000
  }
}
```

---

### 7. ui.modal.open - 打开模态框

**用途**: 打开模态框,支持两种模式:
1. 打开面板页面(表单)
2. 打开 iframe 网页

**结构**:
```json
{
  "type": "ui.modal.open",
  "params": {
    // 模式1: 打开面板页面
    "pageId": "页面ID或null",
    "mode": "create | edit",
    "data": { 传递的数据 },
    
    // 模式2: 打开 iframe 网页
    "url": "网页地址",
    
    // 通用配置
    "title": "模态框标题",
    "width": "80%",  // 或数字 800
    "height": "90%"  // 或数字 600
  }
}
```

**示例**:
```json
// 打开新增表单
{
  "type": "ui.modal.open",
  "params": {
    "pageId": null,
    "mode": "create"
  }
}

// 打开编辑表单
{
  "type": "ui.modal.open",
  "params": {
    "pageId": "form_edit",
    "mode": "edit",
    "data": { "id": "123" }
  }
}

// 打开外部网页
{
  "type": "ui.modal.open",
  "params": {
    "url": "https://example.com",
    "title": "外部页面",
    "width": "80%",
    "height": "90%"
  }
}
```

---

### 8. ui.modal.close - 关闭模态框

**用途**: 关闭当前模态框

**结构**:
```json
{
  "type": "ui.modal.close",
  "params": {
    "reason": "关闭原因(可选)"
  }
}
```

**示例**:
```json
{
  "type": "ui.modal.close"
}
```

---

### 9. sys.sdk.invoke - 调用 SDK 方法

**用途**: 调用 PanelX SDK 的方法

**结构**:
```json
{
  "type": "sys.sdk.invoke",
  "params": {
    "method": "SDK方法路径",
    "arguments": [参数数组]
  },
  "resultKey": "结果存储键(可选)"
}
```

**可用方法**: 

PanelX SDK 提供了丰富的 API 方法,包括:
- **用户认证**: `user.login`, `user.logout`, `user.getUserInfo` 等
- **数据查询**: `api.queryFormDataList`, `api.queryFormData`, `api.getRelateDataList` 等
- **权限查询**: `api.getPermMatrix`, `api.getFormPermMatrix` 等
- **操作调用**: `api.callEvent`, `api.callButton` 等
- **文件管理**: `file.uploadFile`, `file.getFileDownloadUrl` 等

> **📖 完整文档**: 查阅 [PanelX SDK 文档]() 获取所有可用方法及其详细参数说明

**示例**:
```json
// 调用面板按钮
{
  "type": "sys.sdk.invoke",
  "params": {
    "method": "api.callPanelButton",
    "arguments": [
      {
        "panelCode": "PANEL_001",
        "buttonName": "保存",
        "formData": { "name": "张三", "age": 25 }
      }
    ]
  },
  "resultKey": "saveResult"
}

// 查询表单数据
{
  "type": "sys.sdk.invoke",
  "params": {
    "method": "api.queryFormDataList",
    "arguments": [
      {
        "panelCode": "PANEL_001",
        "pageNo": 1,
        "pageSize": 20
      }
    ]
  },
  "resultKey": "queryResult"
}
```

---

## 组件动作

通过 `component.invoke` 指令可以调用以下组件动作:

### FormComponent (表单组件)

#### updateFields - 更新字段
批量更新表单字段值

**参数**:
```json
{
  "updates": [
    { "field": "字段名", "value": 字段值 }
  ]
}
```

**示例**:
```json
{
  "type": "component.invoke",
  "target": "form_1",
  "action": "updateFields",
  "params": {
    "updates": [
      { "field": "name", "value": "张三" },
      { "field": "age", "value": 25 },
      { "field": "leaveType", "value": "annual" }
    ]
  }
}
```

**重要提示**:
- ⚠️ 下拉框字段必须使用 **value**(如 `"annual"`),不能使用 label(如 `"年假"`)
- 多选字段必须使用数组格式: `["value1", "value2"]`
- 时间字段支持人类可读格式: `"2024-11-20 14:30"` 或时间戳(毫秒)
- 推荐一次性更新多个字段以提高效率

---

#### validate - 校验表单
校验表单数据有效性

**参数**: 无

**示例**:
```json
{
  "type": "component.invoke",
  "target": "form_1",
  "action": "validate"
}
```

---

#### clickButton_{buttonName} - 点击按钮
点击表单底部按钮

**参数**: 无(按钮名称在动作名中)

**示例**:
```json
{
  "type": "component.invoke",
  "target": "form_1",
  "action": "clickButton_保存"
}
```

**常见按钮**:
- `clickButton_保存`
- `clickButton_提交`
- `clickButton_取消`

**注意**: 按钮名称需要从 `get_context_info` 获取

---

### TableComponent / CardListComponent (表格/卡片列表组件)

#### refresh - 刷新
重新加载数据

**参数**: 无

**示例**:
```json
{
  "type": "component.invoke",
  "target": "table_1",
  "action": "refresh"
}
```

---

#### create - 新增
打开新增表单

**参数**: 无

**示例**:
```json
{
  "type": "component.invoke",
  "target": "table_1",
  "action": "create"
}
```

---

#### edit - 编辑
通过记录编号编辑指定行数据

**参数**:
```json
{
  "id": "记录编号"
}
```

**示例**:
```json
{
  "type": "component.invoke",
  "target": "table_1",
  "action": "edit",
  "params": { "id": "REC001" }
}
```

---

#### delete - 删除
批量删除指定行数据

**参数**:
```json
{
  "ids": ["id1", "id2", ...]
}
```

**示例**:
```json
{
  "type": "component.invoke",
  "target": "table_1",
  "action": "delete",
  "params": { "ids": ["123", "456", "789"] }
}
```

---

#### getSelectedItems - 获取勾选项
获取当前用户勾选的所有项数据

**参数**: 无

**返回**:
- `selectedCount`: 勾选的项数
- `selectedRows`: 勾选的项数据数组
- `selectedIds`: 勾选的项 id 列表

**示例**:
```json
{
  "type": "component.invoke",
  "target": "table_1",
  "action": "getSelectedItems",
  "resultKey": "selectedData"
}
```

---

#### setSelectedItems - 设置勾选项
程序化设置勾选状态

**参数**:
```json
{
  "ids": ["id1", "id2", ...]
}
```

**示例**:
```json
{
  "type": "component.invoke",
  "target": "table_1",
  "action": "setSelectedItems",
  "params": { "ids": ["123", "456"] }
}
```

**注意**: 会完全替换当前勾选状态,而不是追加

---

#### deleteSelectedItems - 删除勾选项
删除当前勾选的所有项

**参数**: 无

**示例**:
```json
{
  "type": "component.invoke",
  "target": "table_1",
  "action": "deleteSelectedItems"
}
```

**注意**: 
- 要求至少勾选一行,否则会抛出错误
- 删除成功后会自动清空勾选状态

---

## 上下文变量

在 `JSExpression` 和 `JSFunction` 中可以访问以下上下文变量:

### $self
当前组件信息

```javascript
$self.id        // 组件ID
$self.value     // 组件当前值
$self.props     // 组件属性
```

### $event
事件参数(根据事件类型不同)

```javascript
// valueChange 事件
$event.newValue
$event.oldValue

// itemClick 事件
$event.index
$event.item

// itemDoubleClick / itemRightClick / itemLongPress 事件
$event.index
$event.item
```

### $prev
上一个指令的执行结果

```javascript
$prev  // 上一个指令的返回值
```

### $results
所有指令的结果集合(通过 resultKey 访问)

```javascript
$results.userName    // 访问 resultKey 为 "userName" 的指令结果
$results.age
```

### $execute
指令执行器(仅在 flow.script 中可用)

```javascript
// 执行单个指令
await $execute.instruction({ 
  type: "ui.toast", 
  params: { type: "success", message: "成功" }
})

// 执行指令集
await $execute.instructionSet({ 
  instructions: [...]
})

// 批量执行指令
await $execute.batch([
  { type: "component.getValue", target: "input1" },
  { type: "component.getValue", target: "input2" }
])
```

### $panelMeta
Panel 元数据,包含当前面板的基本信息

```javascript
$panelMeta.panelCode      // 面板编码
$panelMeta.panelName      // 面板名称
$panelMeta.panelCategory  // 面板分类(可选)
$panelMeta.description    // 面板描述(可选)
$panelMeta.version        // 面板版本(可选)
```

**使用场景**:
- 根据面板类型执行不同逻辑
- 在日志或提示中显示面板名称
- 根据面板版本进行兼容性处理

**示例**:
```javascript
// 检查面板编码
$panelMeta.panelCode === 'EMPLOYEE_PANEL'

// 获取面板名称
$panelMeta.panelName

// 访问面板分类
$panelMeta.panelCategory
```

### $scope
作用域上下文,用于访问当前 DataScope 注入的数据(如表格行、列表项)

```javascript
$scope.record       // 数据实体(当前行或列表项的完整数据)
$scope.index        // 索引(可选)
```

**使用场景**:
- 在表格行内的事件中访问当前行数据
- 在列表项内的事件中访问当前项数据

**示例**:
```javascript
// 访问表格行的字段
$scope.record.name
$scope.record.age

// 访问列表项索引
$scope.index
```

### $user
全局用户信息,从 SDK getCurrentUser() 获取

```javascript
$user.id            // 用户ID
$user.fullName      // 用户全名(已归一化)
$user.role          // 用户角色
$user.phone         // 手机号
$user.raw           // 原始用户数据(保留以备不时之需)
```

**使用场景**:
- 根据用户角色显示/隐藏功能
- 在表单中自动填充当前用户信息
- 记录操作日志时获取用户信息

**示例**:
```javascript
// 检查用户角色
$user.role === 'admin'

// 获取用户名
$user.fullName

// 访问用户ID
$user.id
```

### $meta
元数据

```javascript
$meta.timestamp        // 时间戳
$meta.source          // 来源
$meta.traceId         // 追踪ID
$meta.executionDepth  // 执行深度
```

---

## 完整示例

### 示例 1: 表单提交前验证

```json
{
  "type": "click",
  "description": "提交按钮点击事件 - 验证后提交",
  "instructions": [
    {
      "type": "component.getValue",
      "target": "input_name",
      "resultKey": "userName"
    },
    {
      "type": "component.getValue",
      "target": "input_age",
      "resultKey": "userAge"
    },
    {
      "type": "flow.branch",
      "params": {
        "expression": {
          "type": "JSExpression",
          "value": "$results.userName === '' || $results.userAge === ''"
        },
        "trueFlow": [
          {
            "type": "ui.toast",
            "params": {
              "type": "error",
              "message": "请填写完整信息"
            }
          }
        ],
        "falseFlow": [
          {
            "type": "component.invoke",
            "target": "form_1",
            "action": "clickButton_保存"
          }
        ]
      }
    }
  ]
}
```

---

### 示例 2: 使用 flow.script 实现复杂计算

```json
{
  "type": "valueChange",
  "description": "单价变化时重新计算总价",
  "debounce": 300,
  "instructions": [
    {
      "type": "flow.script",
      "description": "计算总价并更新",
      "params": {
        "type": "JSFunction",
        "value": "async function(context) {\n  const { $execute, $event } = context;\n  const unitPrice = $event.newValue;\n  \n  if (!unitPrice) {\n    await $execute.instruction({\n      type: 'ui.toast',\n      params: { type: 'warning', message: '请输入单价' }\n    });\n    return { success: false };\n  }\n  \n  const quantity = await $execute.instruction({\n    type: 'component.getValue',\n    target: 'quantity'\n  });\n  \n  if (!quantity) {\n    return { success: false, reason: '数量为空' };\n  }\n  \n  const total = parseFloat(unitPrice) * parseFloat(quantity);\n  \n  await $execute.instruction({\n    type: 'component.setValue',\n    target: 'totalPrice',\n    params: total.toFixed(2)\n  });\n  \n  return { success: true, total: total.toFixed(2) };\n}"
      },
      "resultKey": "calcResult"
    }
  ]
}
```

---

### 示例 3: 批量操作勾选行

```json
{
  "type": "click",
  "description": "批量审批勾选的项",
  "instructions": [
    {
      "type": "component.invoke",
      "target": "table_1",
      "action": "getSelectedItems",
      "resultKey": "selectedData"
    },
    {
      "type": "flow.branch",
      "params": {
        "expression": {
          "type": "JSExpression",
          "value": "$results.selectedData.selectedCount === 0"
        },
        "trueFlow": [
          {
            "type": "ui.toast",
            "params": {
              "type": "warning",
              "message": "请先勾选要审批的行"
            }
          }
        ],
        "falseFlow": [
          {
            "type": "ui.toast",
            "params": {
              "type": "success",
              "message": {
                "type": "JSExpression",
                "value": "'已审批 ' + $results.selectedData.selectedCount + ' 条数据'"
              }
            }
          },
          {
            "type": "component.invoke",
            "target": "table_1",
            "action": "refresh"
          }
        ]
      }
    }
  ]
}
```

---

## 最佳实践

### 指令编写建议

1. **使用 resultKey 保存中间结果**
   ```json
   {
     "type": "component.getValue",
     "target": "input_name",
     "resultKey": "userName"  // 便于后续引用
   }
   ```

2. **批量更新优于多次单独更新**
   ```json
   // ✅ 推荐
   {
     "type": "component.invoke",
     "target": "form_1",
     "action": "updateFields",
     "params": {
       "updates": [
         { "field": "name", "value": "张三" },
         { "field": "age", "value": 25 }
       ]
     }
   }
   
   // ❌ 不推荐
   {
     "type": "component.setValue",
     "target": "input_name",
     "params": "张三"
   },
   {
     "type": "component.setValue",
     "target": "input_age",
     "params": 25
   }
   ```

3. **高频事件使用防抖/节流**
   ```json
   {
     "type": "valueChange",
     "debounce": 300,  // 300ms 防抖
     "instructions": [...]
   }
   ```

4. **复杂逻辑使用 flow.script**
   - 可以在脚本内部使用 `$execute.instruction()` 编排其他指令
   - 支持完整的 JavaScript 语法和异步操作
   - 适合需要复杂计算或多步骤编排的场景

---

### 性能优化建议

1. 避免在高频事件中执行耗时操作
2. 使用 debounce 减少不必要的执行
3. 批量操作优于多次单独操作
4. 合理设置 resultKey,避免重复计算

---

### 调试技巧

1. **启用调试模式**
   ```json
   {
     "type": "click",
     "debug": true,  // 输出详细日志
     "instructions": [...]
   }
   ```

2. **使用 Toast 显示中间结果**
   ```json
   {
     "type": "ui.toast",
     "params": {
       "type": "info",
       "message": {
         "type": "JSExpression",
         "value": "'调试: ' + JSON.stringify($results)"
       }
     }
   }
   ```

3. **在 flow.script 中使用 console.log**
   ```javascript
   async function(context) {
     console.log('调试信息:', context.$results);
     return { success: true };
   }
   ```

---

## 常见问题

### Q: 下拉框字段应该填写什么值?
A: 必须使用 **value**(如 `"annual"`),不能使用 label(如 `"年假"`)。可以通过 `get_context_info` 查看字段的选项配置。

### Q: flow.script 中如何调用其他指令?
A: 使用 `context.$execute.instruction()` 方法,例如:
```javascript
await $execute.instruction({
  type: 'component.getValue',
  target: 'input1'
})
```

### Q: 如何调试指令执行?
A: 设置 `debug: true`,或使用 `ui.toast` 显示中间结果,或在 `flow.script` 中使用 `console.log`。

---

**文档维护**: 如有疑问或建议,请联系开发团队
