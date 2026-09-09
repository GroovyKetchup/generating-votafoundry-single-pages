# Wave Loading Web Component 使用文档

一个轻量级、独立的三点波浪加载动画组件，基于 Web Components 标准实现。

## ✨ 特性

- 🚀 **零依赖**：无需 React、Vue 或任何框架
- 🎨 **主题适配**：支持 CSS 变量动态主题，自动回退到默认配色
- 📦 **体积小巧**：压缩后仅 ~2KB
- 🔧 **易于集成**：一行 `<script>` 标签即可使用
- 🎯 **TypeScript 友好**：提供完整的类型定义
- 🌈 **多种模式**：支持局部和全屏两种显示模式

## 📦 快速开始

### 1. 引入文件

```html
<!-- 在 HTML 中引入 -->
<script src="https://kwaidoo.com/cdn_general/libs/@generalui/wave-loading/1.0.0/wave-loading.js"></script>
```

### 2. 使用组件

```html
<!-- 基础使用 -->
<wave-loading text="加载中..."></wave-loading>

<!-- 自定义颜色 -->
<wave-loading text="处理中..." color="green"></wave-loading>

<!-- 全屏模式 -->
<wave-loading text="正在保存..." fullscreen="true"></wave-loading>
```

## 🎯 属性说明

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | string | `"加载中..."` | 显示的文本内容 |
| `color` | string | `"primary"` | 颜色主题，可选值见下方 |
| `fullscreen` | boolean | `false` | 是否全屏显示 |

### 颜色主题

| 值 | 说明 | 效果 |
|----|------|------|
| `primary` | 主题色（默认） | 使用 CSS 变量 `--primary`，回退到蓝色 |
| `blue` | 蓝色 | #3b82f6 |
| `green` | 绿色 | #10b981 |
| `red` | 红色 | #ef4444 |
| `purple` | 紫色 | #8b5cf6 |
| `orange` | 橙色 | #f97316 |

## 💡 使用示例

### 示例 1: 纯 HTML 页面

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Loading Demo</title>
    <script src="wave-loading.js"></script>
</head>
<body>
    <h1>我的页面</h1>
    
    <!-- 局部加载 -->
    <div style="height: 200px; display: flex; align-items: center; justify-content: center;">
        <wave-loading text="加载数据中..."></wave-loading>
    </div>
    
    <button onclick="showFullscreen()">显示全屏加载</button>
    
    <script>
        function showFullscreen() {
            const loading = document.createElement('wave-loading');
            loading.setAttribute('text', '正在处理...');
            loading.setAttribute('fullscreen', 'true');
            document.body.appendChild(loading);
            
            // 3秒后移除
            setTimeout(() => loading.remove(), 3000);
        }
    </script>
</body>
</html>
```

### 示例 2: JavaScript 动态创建

```javascript
// 创建加载组件
const loading = document.createElement('wave-loading');
loading.setAttribute('text', '正在加载数据...');
loading.setAttribute('color', 'blue');
document.body.appendChild(loading);

// 使用 API 方法
loading.setText('更新文本');
loading.setColor('green');
loading.showFullscreen();
loading.hideFullscreen();

// 移除组件
loading.destroy();
```

### 示例 3: 异步操作

```javascript
async function saveData() {
    // 显示全屏加载
    const loading = document.createElement('wave-loading');
    loading.setAttribute('fullscreen', 'true');
    loading.setAttribute('text', '正在保存...');
    document.body.appendChild(loading);
    
    try {
        await fetch('/api/save', { method: 'POST' });
        loading.setText('保存成功！');
        setTimeout(() => loading.remove(), 1000);
    } catch (error) {
        loading.remove();
        alert('保存失败');
    }
}
```

### 示例 4: React 中使用

```tsx
// 1. 在 index.html 中引入
<script src="/wave-loading.js"></script>

// 2. 添加类型声明（可选）
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'wave-loading': any;
    }
  }
}

// 3. 在组件中使用
function MyComponent() {
  const [loading, setLoading] = useState(true);
  
  return (
    <div>
      {loading && (
        <div className="h-full flex items-center justify-center">
          <wave-loading text="加载中..." />
        </div>
      )}
    </div>
  );
}
```

## 🎨 主题定制

组件支持通过 CSS 变量自定义主题色：

```html
<style>
  :root {
    --primary: 217 91% 60%;           /* 主题色（HSL 格式） */
    --muted-foreground: 215 16% 47%;  /* 文本颜色 */
    --background: 0 0% 100%;          /* 背景色 */
  }
</style>

<!-- 组件会自动使用上面定义的主题色 -->
<wave-loading text="加载中..." color="primary"></wave-loading>
```

**注意**：如果未定义 CSS 变量，组件会自动回退到默认颜色，确保始终可见。

## 📐 布局说明

### 局部使用（默认）

组件**不会**自动占满容器，只占用内容本身的大小（约 6rem × 5rem）。

```html
<!-- ✅ 推荐：使用 flex 布局居中 -->
<div style="height: 300px; display: flex; align-items: center; justify-content: center;">
    <wave-loading text="加载中..." />
</div>

<!-- ❌ 不推荐：没有布局，loading 会靠左上角 -->
<div style="height: 300px;">
    <wave-loading text="加载中..." />
</div>
```

### 全屏使用

全屏模式会自动覆盖整个视口，无需额外布局：

```html
<wave-loading text="加载中..." fullscreen="true"></wave-loading>
```

## 🔧 API 方法

组件实例提供以下方法：

```javascript
const loading = document.querySelector('wave-loading');

// 更新文本
loading.setText('新的文本');

// 更新颜色
loading.setColor('green');

// 显示全屏
loading.showFullscreen();

// 隐藏全屏
loading.hideFullscreen();

// 移除组件
loading.destroy();
```

## ⚠️ 注意事项

### 1. 全屏模式需要手动移除

```javascript
// ❌ 错误：忘记移除
const loading = document.createElement('wave-loading');
loading.setAttribute('fullscreen', 'true');
document.body.appendChild(loading);
// 组件会一直显示！

// ✅ 正确：确保移除
const loading = document.createElement('wave-loading');
loading.setAttribute('fullscreen', 'true');
document.body.appendChild(loading);

setTimeout(() => {
    loading.remove(); // 或 loading.destroy()
}, 2000);
```

### 2. 局部使用需要父容器有高度

```html
<!-- ❌ 父容器没有高度，loading 可能不可见 -->
<div>
    <wave-loading text="加载中..." />
</div>

<!-- ✅ 父容器有明确高度 -->
<div style="height: 200px; display: flex; align-items: center; justify-content: center;">
    <wave-loading text="加载中..." />
</div>
```

### 3. Shadow DOM 样式隔离

组件使用 Shadow DOM，外部 CSS 无法影响内部样式。如需自定义，请使用 CSS 变量或 `color` 属性。

## 🌐 浏览器兼容性

支持所有现代浏览器：

- ✅ Chrome 53+
- ✅ Firefox 63+
- ✅ Safari 10.1+
- ✅ Edge 79+

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
