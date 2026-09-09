# CDP 集成骨架模板

> 用途: 用作 CDP 集成的基础骨架，粘贴到页面脚本中并按业务替换 TODO 区域，可按需扩展。

```javascript
// === 主题适配（必须）===
function applyTheme(themeConfig) {
  if (!themeConfig || !themeConfig.preset) {
    return;
  }
  document.documentElement.setAttribute('data-cdp-theme', themeConfig.mode);
  document.documentElement.classList.toggle('dark', themeConfig.mode === 'dark');
  const colors = themeConfig.mode === 'dark'
    ? themeConfig.preset.dark
    : themeConfig.preset.light;
  document.documentElement.style.setProperty('--primary', `hsl(${colors.primary})`);
  document.documentElement.style.setProperty('--success', `hsl(${colors.success})`);
  document.documentElement.style.setProperty('--warning', `hsl(${colors.warning})`);
  document.documentElement.style.setProperty('--danger', `hsl(${colors.danger})`);
  document.documentElement.style.setProperty('--info', `hsl(${colors.info})`);
}

async function setupTheme() {
  if (!window.semApp || !window.semApp.cdpSdk) {
    console.error('CDP-SDK 未加载');
    return;
  }
  try {
    const themeConfig = await window.semApp.cdpSdk.getTheme();
    applyTheme(themeConfig);
    window.semApp.cdpSdk.onThemeChange((newTheme) => {
      applyTheme(newTheme);
    });
  } catch (error) {
    console.error('主题适配失败:', error);
  }
}

// === 动作注册（必须）===
const actionDefinitions = [
  {
    actionName: 'getData',
    actionAlias: '获取数据',
    actionDescription: '获取当前页面的数据',
    actionParameterSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    actionName: 'refreshData',
    actionAlias: '刷新数据',
    actionDescription: '重新拉取并刷新页面数据',
    actionParameterSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
  // TODO: 根据业务新增动作定义
];

const actionHandlers = {
  getData: async () => {
    const data = await getCurrentData();
    return { status: 'ok', message: '已获取数据', data };
  },
  refreshData: async () => {
    await loadData();
    return { status: 'ok', message: '已刷新' };
  }
  // TODO: 根据业务新增动作处理器，注意参数校验与错误抛出
};

const actionGuidance = `
## 页面概览
一句话描述页面用途与主要数据来源。

## 可用操作
- 获取数据: \`getData()\` - 获取当前页面的数据
- 刷新数据: \`refreshData()\` - 重新拉取并刷新页面数据
<!-- TODO: 按实际动作补充 -->

## 典型示例
- "获取当前数据"
- "刷新当前数据"
<!-- TODO: 添加 2-3 条用户可能会说的指令示例 -->

## 可选章节（仅复杂对象时补充）
### 参数说明
说明复杂参数的字段结构与含义。
### 返回结果
说明复杂返回对象的关键字段。
`.trim();

async function registerActions() {
  if (!window.semApp || !window.semApp.cdpSdk) {
    console.error('CDP-SDK 未加载');
    return;
  }
  await window.semApp.cdpSdk.setActions({
    guidance: actionGuidance,
    definitions: actionDefinitions,
    handlers: actionHandlers,
    registrationDelay: 100
  });
}

// === 初始化入口 ===
window.addEventListener('DOMContentLoaded', async () => {
  await setupTheme();
  await registerActions();
});
```
