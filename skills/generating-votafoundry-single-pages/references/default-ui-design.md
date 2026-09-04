UI 设计规范 (V3.1)
设计目标：解决“灰度太重”与“空间浪费”问题，打造明亮、紧凑、无干扰的专业数据工作台。
执行级别：P0（强制执行）
 
CDP 主题适配（必须）
- 若页面运行在 CDP 宿主环境中，必须以 CDP 主题为主：根据 `themeConfig.mode` 切换亮/暗风格，并使用 `themeConfig.preset` 的主色、成功、告警、错误等颜色作为视觉强调色。
- 当 `mode` 为 `light` 时，优先使用本规范的明亮底色与排版；当 `mode` 为 `dark` 时，背景/文字需反转并保持对比度，避免强行套用亮色规范。

💎 零、基石：字体与排版 (Typography)
现状问题：宋体回退、数字对齐混乱。
强制修正：
1. 全局字体栈 (Global Font Stack)
必须在 App.vue 或 global.css 第一行强制写入：
CSS
:root, body, #app {
  /* 优先使用苹果和微软的现代无衬线字体 */
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", 
               "Segoe UI", Roboto, "Helvetica Neue", sans-serif !important;
  /* 开启 macOS 字体抗锯齿，防止字体发虚 */
  -webkit-font-smoothing: antialiased; 
  -moz-osx-font-smoothing: grayscale;
}
2. 数据表格专用排版
CSS
/* 让表格里的数字（金额/日期）像代码一样等宽对齐 */
table, .num-font {
  font-variant-numeric: tabular-nums; 
}
 
☀️ 一、色彩系统：去灰提亮 (Bright & Clean)
现状问题：界面看起来“脏”、“阴沉”。
修正策略：全面白化。除了必要的分割线，能用白的地方全用白。
区域	旧版颜色 (V3.0)	新版规范 (V3.1)	视觉目的
页面大背景	#F2F3F5 (深灰)	#F7F8FA (极浅灰/亮白)	提升通透感
容器背景	#FFFFFF	#FFFFFF	保持纯净
表头背景	#FAFAFB (灰底)	#FFFFFF (白底)	去除条纹感
一级文字	#1D2129	#1D2129 (深黑)	保持阅读对比度
二级文字	#86909C	#4E5969 (中灰)	加深，防止看不清
边框线条	#E5E6EB	#F2F3F5 (极淡)	似有若无
 
📊 二、数据表格：紧凑与去线 (Compact Data Table)
现状问题：竖线（红框问题）干扰视线，行高太大浪费空间。
修正策略：彻底移除竖线，压缩行高。
1. 结构去线 (Remove Lines)
•	列分割线：严禁出现。表头 (th) 和 单元格 (td) 的 border-right 必须设为 none。
•	外边框：移除表格容器的 border。
•	仅保留：行底线 (border-bottom: 1px solid #F2F3F5)。
2. 空间压缩 (Compact Density)
•	行高：由 56px 压缩至 48px (标准紧凑高度)。
•	内边距 (Padding)：由 24px 压缩至 12px (左右)。
•	字号：保持 14px，但文字更紧凑。
3. 表头规范 (Header)
•	背景：纯白 (#FFFFFF)，不要灰底。
•	文字：#1D2129 (加深)，font-weight: 600。
•	对齐：
o	文本（名称）：左对齐
o	金额/数字：右对齐 (必须)
o	状态/操作：左对齐或居中
4. 关键 CSS 代码 (发给前端)
CSS
/* 现代紧凑表格样式 */
.aurora-table th {
  background: #FFFFFF !important; /* 白底 */
  border-right: none !important;  /* 去掉竖线 */
  border-bottom: 1px solid #E5E6EB;
  color: #1D2129;
  font-weight: 600;
  padding: 10px 12px;
}

.aurora-table td {
  padding: 10px 12px; /* 紧凑 Padding */
  height: 48px;       /* 紧凑行高 */
  border-bottom: 1px solid #F2F3F5; /* 极淡底线 */
  border-right: none !important;    /* 去掉竖线 */
}

/* 鼠标悬浮整行变色 */
.aurora-table tr:hover td {
  background-color: #F2F7FF !important; /* 极淡的品牌蓝 */
}
 
📦 三、容器与卡片 (Container)
现状问题：边框太多，显得琐碎。
修正策略：用柔和阴影代替边框。
•	卡片样式：
o	border: none (去除物理黑边)
o	border-radius: 8px (商务圆角，不要太大)
o	background: #FFFFFF
o	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06) (极淡阴影，仅仅为了把白纸和白背景区分开)
•	内边距：24px。
 
🔘 四、操作与按钮 (Actions)
现状问题：满屏灰框按钮，视觉噪音大。
修正策略：次级按钮去边框。
•	主按钮 (Primary)：
o	蓝色背景 #1664FF + 白字 + 阴影 0 2px 0 rgba(0,0,0,0.04)。
•	次按钮 (Secondary)：
o	样式变更：取消灰色描边。
o	常规态：背景 #F2F3F5 (浅灰块) + 文字 #4E5969。
o	Hover态：背景 #E5E6EB (加深灰)。
o	视觉效果：界面上没有线条框，只有色块，非常干净。
•	文字按钮 (Link)：
o	用于表格内的“编辑/删除”。颜色 #1664FF。
 
🧩 五、空状态与特殊元素 (Details)
•	空数据 (Empty Data)
o	表格单元格无数据时，严禁留白。
o	显示：--
o	样式：color: #C9CDD4 (浅灰)，居中对齐。
o	CSS: .empty-cell { text-align: center; color: #C9CDD4; }
•	状态标签 (Tag)
o	不要用深色实心标签。
o	使用 “浅底深字”：
	进行中：bg: #E8F3FF, text: #1664FF
	已结束：bg: #F2F3F5, text: #4E5969
