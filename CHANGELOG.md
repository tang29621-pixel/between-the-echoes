# 今日修改日志 · 2026-10-03

> 用途：记录本次会话的所有改动、修复与决策，便于下次会话快速恢复上下文。

---

## 一、整体进度

**方案**：A 的页面结构 + D 的渐进交付
**当前阶段**：Phase 1 完成（11 章节骨架跑通）

| 阶段 | 触发 | 状态 |
|---|---|---|
| Phase 1 | 当前 | ✅ 完成 |
| Phase 2 | 用户交付 4 个 mp4 | ⏳ 等资源 |
| Phase 3 | 用户交付 4 个 GLB | ⏳ 等资源 |
| Phase 4 | 用户交付 World Labs 场景 | ⏳ 等资源 |

---

## 二、今日完成的改动

### 1. 从 6 章节重构为 11 章节

新流程：
```
1 首页 → 2 案例导览 → 3 短片一 → 4 旧物档案 → 5 AI 推演提示
→ 6 短片二 → 7 海边 → 8 短片三 → 9 写信 → 10 确认内容 → 11 结束页
```

| # | 阶段 | 类型 |
|---|---|---|
| 1 | 首页 | 静态海面 + 入口 |
| 2 | 案例导览 | 4 类来源卡片可视化 |
| 3 | 短片一 | 视频（停在开盒） |
| 4 | 旧物档案 | 4 件物品 + 3D 详情浮层 |
| 5 | AI 推演提示 | 简短浮层 |
| 6 | 短片二 | 视频（停在父亲消失）|
| 7 | 海边探索 | 静态 + 3 hotspots + 长椅叠加视频 |
| 8 | 短片三 | 视频 + 两按钮并存 |
| 9 | 写一封信 | 纯输入页 |
| 10 | 确认内容 | 海面 + 信件卡片 + 来源说明 |
| 11 | 结束页 | 用户信 + 项目愿景 + 三按钮 |

### 2. 文件改动清单

**新建 4 个模块脚本**：
- `scripts/source-labels.js` — 4 类来源标签系统（original/family/ai/user）
- `scripts/video-stage.js` — 4 段视频统一调度 + 预检查 + 跳过
- `scripts/item-detail.js` — 物品 3D 详情浮层（Phase 1 SVG 占位 / Phase 3 model-viewer）
- `scripts/sea-scene.js` — 海边场景 + 3 hotspots + 长椅叠加

**新建参考图目录**：
- `assets/images/reference/` — 8 张参考图（从临时目录复制）

**修改**：
- `index.html` (302 → 588 行) — 11 章节 + 2 个非章节浮层 + 跳过按钮
- `styles/main.css` (1494 → 2450+ 行) — 6 大新样式块 + 移动端适配
- `scripts/main.js` (498 → 460 行) — goChapter 扩展为 11 段 + 7 个 init 钩子
- `README.md` — 更新章节表为 11 段

---

## 三、今日修复的 Bug

### Bug 1：CSS `.enter-btn { opacity: 0 }` 全局生效 ⚠️

**症状**：AI 提示章节的「知道了」、确认页的「把信留在这片海」按钮看不见。

**根因**：原 CSS 把 `opacity: 0` 写在基础 `.enter-btn` 选择器里（用于首页淡入动画），但这个属性全局生效，遮盖了其他章节的按钮。

**修复**（`styles/main.css`）：
```css
/* 旧：全局 opacity: 0 */
.enter-btn { opacity: 0; transform: translateY(20px); }

/* 新：移到需要淡入的章节 */
.chapter--home.is-active .enter-btn {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeUp 1.6s ease 4s forwards;
}
```

### Bug 2：AI 提示章节缺少 `chapter__inner` 包装

**症状**：面板定位到左上角而不是居中。

**修复**（`index.html`）：在 `.ai-prompt__panel` 外面包一层 `<div class="chapter__inner">`，让 CSS 的 flex 居中生效。

### Bug 3：视频播完后不显示结束卡 ⚠️ 严重

**症状**：用户看完短片一（视频自然结束），结束卡没出现。

**根因 1（直接）**：只监听了 `timeupdate`（`currentTime >= contentEnd`），没监听 `ended` 事件。如果视频被其他方式提前结束（用户跳着看），可能漏触发。

**根因 2（根本）**：**Python 自带的 `http.server` 对 147MB 大视频的 HEAD 请求要 13 秒**。这导致：
- `checkAvailability()` 异步延迟
- `play()` 在 HEAD 返回前不会挂监听器
- HEAD 返回后 `play()` 执行 `player.currentTime = 0`，**重置正在播放的视频**
- 监听器挂上时，视频已被重置，但用户没察觉

**修复**（`scripts/video-stage.js`）：
1. 添加 `preflight()` 方法，页面加载时就预检查所有视频可用性
2. `main.js` init() 中调用 `VideoStage.preflight()`
3. `play()` 改为同步读取缓存的可用性，避免运行时 HEAD
4. `play()` 只在视频不在播放时才重置 `currentTime`
5. 同时监听 `timeupdate` 和 `ended` 事件

### Bug 4：语法错误导致整个 init() 失败

**症状**：用户点击「把信留在这片海」没反应；浏览器 console 没看到 "回声之间 · initialized" 日志。

**根因**：添加 `bindConfirm()` 函数时，Edit 操作在文件中意外多了一个 `}`，让 IIFE 提前关闭。

**位置**：`scripts/main.js` 第 367 行多了一个 `}`

**修复**：删掉多余的 `}`。

### Bug 5：确认页「把信留在这片海」按钮没挂 click handler

**症状**：按钮存在但点击没反应。

**根因**：之前的代码只渲染内容（`renderConfirmContent()`），忘了绑定点击事件。

**修复**（`scripts/main.js`）：新增 `bindConfirm()` 函数，挂 click handler，显示「已封存」反馈后 0.6 秒跳到结束页。

---

## 四、新增功能：跳过视频按钮

**用户需求**：右上角或左上角加个小按钮跳过视频。

**实现**：
- **HTML**：每个视频章节加 `<button class="video__skip" data-skip="shortA">跳过 →</button>`
- **CSS**：右上角 24px×24px 偏移，11px 字号，圆角胶囊，半透明背景 + backdrop blur，hover 高亮
- **JS**：`bindSkipButtons()` 监听点击 → 暂停视频 + 跳到接近 contentEnd 位置 + 立即显示结束卡

**位置**：`top: 24px; right: 24px;`（在 `.video__wrap` 内）

---

## 五、关键技术决策（避免下次重复讨论）

### 视频播放器
- 每个章节自带独立 `<video>` 元素，不切换 src（避免重新解码）
- 4 段视频（A/B/C + 长椅短片）+ 长椅短片叠加在海边的浮层
- `preflight()` 必须在 init() 中调用，否则视频章节的 play() 会卡 13 秒

### 3D 模型
- Phase 1：SVG + CSS 旋转动画（modelFloat 6s 浮动）
- Phase 3：`<model-viewer>` web component，桌面左 / 右，移动上 / 下
- 物品点击触发独立浮层，关闭后回到原位置

### 海边场景
- Phase 1：静态背景图 `assets/images/frames/processed/sea-bench-bg.jpg`
- 3 个 hotspots（长椅 / 物品 / 纸条），位置硬编码
- 长椅点击 → 触发叠加视频层（带占位）
- Phase 4：替换为 World Labs 3D 场景（格式未定）

### 来源标签系统
- 4 类：原始档案（绿）/ 家人补充（米）/ AI 推演（蓝）/ 本次书写（紫）
- 配置在 `Echo.SourceLabels.types`，文案改一处全处生效
- 显示位置：物品卡片 / 详情浮层 / 视频下方 / 确认页 / 结束页

---

## 六、Phase 2/3/4 触发条件

| 资源 | 命名规范 | 放入目录 |
|---|---|---|
| 4 段视频 | `short-A.mp4` / `short-B.mp4` / `short-C.mp4` / `bench-clip.mp4` | `assets/video/` |
| 4 个 GLB | `painting.glb` / `ticket.glb` / `cup.glb` / `letter.glb` | `assets/models/` |
| 海边 3D 场景 | 格式未定（`.ply` / `.splat` / `.ksplat`） | `assets/worldlabs/` |
| 家人录音 | `painting.mp3` / `ticket.mp3` / `cup.mp3` / `letter.mp3` | `assets/audio/` |
| 海边环境音 | `sea-ambient.mp3` | `assets/audio/` |

---

## 七、本地开发命令

```bash
cd "E:\大三\9-视频加游戏-tripo\网站-回声之间"
python -m http.server 8000
```

浏览器打开 `http://localhost:8000`

**重要**：必须用 HTTP 服务器，**不能直接双击 index.html**——视频和 fetch 都受 file:// 协议限制。

---

## 八、下次会话快速恢复

如果下次打开 Claude Code，可以直接说：

> "接着做「回声之间」网站，我昨天修了几个 bug，加了跳过按钮，整体架构是 11 章节。可以先看 `CHANGELOG.md` 和 `README.md`。当前在 Phase 1 完成阶段，等我给你视频 / 3D 模型 / World Labs 场景。"

让我知道：
- 你想测试什么
- 你想改什么
- 你准备提供什么素材

---

## 九、文件状态速查

| 文件 | 行数 | 状态 |
|---|---|---|
| `index.html` | 588 | ✅ 11 章节 + 2 浮层 + 跳过按钮 |
| `styles/main.css` | 2450+ | ✅ 6 大新样式块 + 移动端 |
| `scripts/main.js` | 460 | ✅ 7 个 init 钩子 |
| `scripts/source-labels.js` | 92 | ✅ |
| `scripts/video-stage.js` | 200 | ✅ preflight + 跳过 |
| `scripts/item-detail.js` | 124 | ✅ |
| `scripts/sea-scene.js` | 192 | ✅ |
| `README.md` | - | ✅ 更新章节表 |
| `CHANGELOG.md` | (本文件) | 🆕 新建 |
