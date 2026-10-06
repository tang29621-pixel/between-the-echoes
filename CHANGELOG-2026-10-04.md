# 今日修改日志 · 2026-10-04

> 用途：记录本次会话的所有改动、修复与决策，便于下次会话快速恢复上下文。
> 衔接：`CHANGELOG.md`（2026-10-03）记录了 Phase 1 完成状态。

---

## 一、整体进度

**方案**：A 的页面结构 + D 的渐进交付
**当前阶段**：**Phase 2 完成**（视频接入 + Tripo 模型 + World Labs 集成）

| 阶段 | 触发 | 状态 |
|---|---|---|
| Phase 1 | 上次完成 | ✅ 完成（11 章节骨架） |
| Phase 2 | 用户交付 4 个 mp4 + 3 个叠加视频 | ✅ 完成（7 个视频全部接入） |
| Phase 3 | 用户交付 4 个 GLB | ✅ 完成（直接显示 3D 模型） |
| Phase 4 | 用户交付 World Labs 场景 | ✅ 完成（58MB ksplat 渲染中） |

---

## 二、今日完成的改动（按主题）

### 1. 视频接入（核心大改）

**新增章节**：钩子视频（`#chapter-hook`）插在 #1 后

**video-stage.js 改动**：
- config 8 项：hook / shortA / shortB / shortC / letterBg / bench / seaNote / easter
- 删除原 `key === 'shortA' ? 'assets/video.mp4' : cfg.src` 特殊判断
- 新增 `playLoop(key)` / `pauseLoop(key)` 方法（背景循环视频用）
- `_findEndBox` 章节映射扩展（hook/seaNote/easter）

**index.html 改动**：
- 视频 src 全部更新到新文件名（4 处 src bug 修复）
- 钩子章节插入（完整 video__wrap + caption + source-badge + end-frame）
- 首页按钮 `data-go="intro"` → `data-go="video-hook"`
- 写信章节 `#letterBgVideo` 背景视频
- 结束页 `#endEasterEgg` 区块 + `#easterOverlay` 浮层
- 海边 hotspot 拆 4 个：bench / items-cup / items-ticket / note
- 纸条面板加 `#seaNoteBtn` "看看后来"按钮

**main.js 改动**：
- CHAPTER_MAP 加 `video-hook: '#chapter-hook'`
- goChapter 增加 hook 视频调用 + letterBg 启停
- 新增 `bindEaster()` 函数
- init() 调用 bindEaster()

**sea-scene.js 改动**：
- `_hotspotState` 拆 4 个 key
- `_handleHotspot` switch 分 4 case
- `_openOverlay(videoKey='bench')` 接受可选视频 key
- `#seaNoteBtn` 绑定 → 关闭面板 + 打开 seaNote 视频

**main.css 新增**：
- `.write__bg-video`（写信背景视频样式）
- `.end__easter-egg*`（彩蛋区块完整样式）
- `.easter-overlay*`（彩蛋浮层样式）
- `.sea__sea-note-btn`（纸条"看看后来"按钮样式）

### 2. 字体统一

**HTML**：删除 Ma Shan Zheng、ZCOOL XiaoWei 字体引用
**CSS**：所有 `font-family` 统一改为 `'Noto Serif SC', 'Songti SC', 'STSong', serif`
- 例外：`.video__end-code`、`.video__end-decor`（档案编号）保留 `'Courier New', monospace`

### 3. 中英对照副标（11+4 = 15 处）

**CSS 新增** `.text__en` 通用样式：
```css
font-size: 11-12px; letter-spacing: 2.5px;
color: rgba(216, 200, 154, 0.6); font-style: italic;
```

**已加英文的位置**：
- 首页 intro、案例导览（标题 + 副标 + 故事描述 × 2 + 来源说明 × 2）
- 旧物档案 4 件物品（标题 + 描述）
- 海边纸条（引文 + 副标）
- 写信（标题 + 副标）
- 结束页（6 行结束语后 + 整段英文总结）
- 4 个视频结束卡标题

### 4. 案例导览章节重构（两栏填满布局）

**HTML**：拆 `.intro__col--left`（标题+故事+按钮）+ `.intro__divider` + `.intro__col--right`（来源说明+卡片）

**CSS**：
- `.intro__layout` grid `38fr 1px 62fr`（左 38% / 分隔 / 右 62%）
- 去掉 `.chapter--intro .chapter__inner` 的 `max-width: 1600px`，撑满整个屏幕

### 5. 视频结束卡排版

**CSS**：
- `.video__end-title` 字号 84 → 60px，加 `white-space: nowrap`
- `.video__end-frame` 宽度 720 → 960px

**HTML**：4 个结束卡标题去掉句号

### 6. Tripo GLB 模型接入

**assets/models/**：4 个 GLB（painting/ticket/cup/letter.glb）

**index.html**：
- 新增 `<script type="module" src="assets/vendor/model-viewer.min.js">`
- 4 个物品的 `<div class="item__media"><img>` 改为 `<model-viewer>` 元素

**CSS**：`.item__media` 调整为 `display: block; width: 100%; height: 70vh`

**main.js**：`bindArchive` 删除点击触发详情层逻辑

**main.css**：删除 `.archive__hint`

### 7. World Labs 高斯泼溅集成

**assets/worldlabs/**：
- `海边场景搭建.spz` 60MB（原始）
- `海边场景搭建.ply` 280MB（转换中转）
- `海边场景搭建.ksplat` **58MB**（最终使用）

**scripts/convert-ply-to-ksplat.cjs**：
- 用 `@mkkellogg/gaussian-splats-3d@0.4.7` + Three.js 0.150 桥接
- compressionLevel=2, splatAlphaRemovalThreshold=5
- 280MB → 58MB（79% 压缩）

**assets/vendor/**：
- `model-viewer.min.js`（913 KB）
- `gaussian-splats-3d.module.js`（602 KB）
- `gaussian-splats-3d.umd.cjs`（650 KB，转换脚本用）
- `three.module.js`（1243 KB，备用）

**node_modules/three/**：three.cjs（转换脚本桥接）

**index.html**：加 ES module 暴露脚本 `window.GaussianSplats3D` / `window.THREE`

**sea-scene.js**：`_detectSplat()` / `_initSplat()` 异步加载，DropInViewer 渲染
**main.css**：`.splat-host` 容器样式

### 8. 物品卡片排版细节

**CSS 调整**：
- `.item__text` 16 → **20px**（中文大、醒目）
- `.item__text .text__en` 12 → **11px**，opacity 0.65
- `.item__content` text-align: center（全部居中）
- `.item__title` text-align: center
- `.item__meta` justify-content: center

---

## 三、今日修复的 Bug

### Bug 1：服务器打不开 / 视频卡死

**症状**：所有视频无法播放
**根因**：`<video>` 标签的 src 属性还停留在旧文件名（`assets/video.mp4`、`short-B.mp4` 等）
**修复**：4 处 src 改为新文件名（开箱-29、ai验算、空椅子、陈默的回信-14）

### Bug 2：彩蛋视频无法播放

**症状**：结束页点"播放这一段"没反应
**根因 1**：`<video id="easterPlayer">` 没有 src 属性，video-stage.js play() 不动态设置 src
**根因 2**：`.easter-overlay` CSS 用 `display: flex` 覆盖了 HTML `hidden` 属性，浮层一直在 DOM 中
**修复**：HTML 加 src；CSS 改用 `visibility: hidden`（参考 `.sea-overlay` 模式）

### Bug 3：彩蛋视频太小没撑满屏幕

**症状**：用户截图显示视频只占屏幕中央一小块（2560x1080 超宽屏）
**根因**：`max-width: 90vw; max-height: 90vh; width: auto; height: auto; object-fit: contain;`
**修复**：`width: 100vw; height: 100vh; object-fit: cover;`（电影感，边缘裁剪）

### Bug 4：视频结束卡标题换行

**症状**："他一直等着你走近。" 显示成两行
**根因**：84px + 12px letter-spacing 太宽
**修复**：60px + 8px letter-spacing + `white-space: nowrap`

### Bug 5：视频结束卡 frame 太小

**症状**："陈默把父亲的故事讲给了她。" 溢出 frame 右边
**根因**：frame width 720px 不够
**修复**：frame width 960px

### Bug 6：Tripo 模型未显示

**症状**：GLB 文件到位，点击物品打开的是 SVG，不是 3D
**根因**：`assets/vendor/` 是空的，`<model-viewer>` Web Component 未加载
**修复**：下载 `@google/model-viewer@3.5.0` 913KB，引入 `<script type="module">`

---

## 四、关键技术决策

### 视频接入
- 每段自带独立 `<video>`，不切换 src
- 自动播放必须 muted（Chrome autoplay policy）
- 播放成功后自动隐藏 overlay（`is-hidden` class）
- 钩子章节结尾卡按钮跳到 intro（`data-go="intro"`）

### Tripo 模型
- Phase 1：之前是 SVG 占位 + 点击打开 3D 详情浮层
- Phase 2（新）：物品卡片直接显示 `<model-viewer>`，无需点击
- model-viewer 自动旋转、相机控制、阴影

### World Labs 集成
- 文件格式：`.spz`（World Labs 强制输出格式，UI 上的"splat"是泛指）
- 浏览器集成路径：spz → ply（在线工具）→ ksplat（mkkellogg 工具，58MB）
- 用 `@mkkellogg/gaussian-splats-3d` 的 `DropInViewer`
- 渲染优化：suspend 时 stop viewer（节省 GPU）

### 字体
- 中文：Noto Serif SC（古典刻本宋体）
- 装饰性英文：Courier New monospace（保留档案编号感）
- 中英对照：英文 11px 斜体淡米色，在中文下方

### 排版层级
- 物品卡片：中文 20px（主）+ 英文 11px（次）
- 视频结束卡：标题 60px + 英文 12px 居中
- 全部居中（title/text/meta）

---

## 五、文件状态速查

| 文件 | 行数 / 大小 | 状态 |
|---|---|---|
| `index.html` | 700+ | ✅ 12 章节 + 5 浮层 |
| `styles/main.css` | 2700+ | ✅ 全部新增样式 |
| `scripts/main.js` | 480+ | ✅ 视频路由 + 彩蛋 |
| `scripts/video-stage.js` | 250+ | ✅ 8 视频 + playLoop |
| `scripts/sea-scene.js` | 320+ | ✅ splat + 4 hotspots |
| `scripts/item-detail.js` | 124 | 未改 |
| `scripts/source-labels.js` | 92 | 未改 |
| `scripts/convert-ply-to-ksplat.cjs` | 60 | 🆕 转换工具 |
| `assets/models/*.glb` | 4 文件 | ✅ Tripo |
| `assets/worldlabs/海边场景搭建.ksplat` | 58 MB | ✅ World Labs |
| `assets/worldlabs/海边场景搭建.ply` | 280 MB | 中转产物（可删） |
| `assets/worldlabs/海边场景搭建.spz` | 60 MB | 原始备份（可保留） |
| `assets/vendor/*.js` | 4 文件 | ✅ 3D 渲染库 |
| `node_modules/three/three.cjs` | 1.2 MB | 🆕 转换桥接 |

---

## 六、本地开发命令

```bash
cd "E:\大三\9-视频加游戏-tripo\网站-回声之间"
python -m http.server 8000
```
浏览器打开 `http://127.0.0.1:8000/`，**Ctrl+Shift+R** 强制刷新

> **⚠️ 服务器自动停止问题**：Claude Code 的 run_in_background 启动的 python 进程会被自动停止（10-30 分钟）。建议**在自己 PowerShell 窗口跑**，那样不会自动停。

---

## 七、下次会话快速恢复

如果下次打开 Claude Code，可以说：

> "接着做「回声之间」网站，今天（2026-10-04）做了视频接入、字体统一、Tripo 接入、World Labs 集成。先看 `CHANGELOG-2026-10-04.md`。当前阶段：Phase 2/3/4 全部完成，只剩视频接入和 3D 渲染的细节调整。"

主要看：
1. `CHANGELOG-2026-10-04.md`（本文件）
2. `CHANGELOG.md`（2026-10-03 历史）
3. `README.md`（整体架构）

---

## 八、已知问题 / 后续可优化

| 优先级 | 项目 | 说明 |
|---|---|---|
| 中 | 海边 3D 场景相机角度 | ksplat 加载后可能需要调 camera 位置 |
| 低 | 视频加载慢 | 147MB video.mp4 占位文件可删（不再使用） |
| 低 | 280MB ply 文件 | 转换中转产物，可删除（保留 ksplat 即可） |
| 低 | 长椅视频从 14.55s 内容 end 改成 14 | 用户给的实际时长是 14.55s，目前 contentEnd=14 |
| 低 | Tripo 模型适配 | 物品的 GLB 模型需要按物品调整 camera-orbit 角度 |
| 中 | mobile 响应式 | 案例导览 38/62 比例在窄屏可能挤压，需要媒体查询 |