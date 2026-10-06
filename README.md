# 回声之间 · Between the Echoes

> 在走远的人与你之间，有一个可以回顾的空间。
> 首个概念案例：《没有到达的海》。

电影沉浸式概念网站。单页结构，全屏章节切换，深色情绪化视觉。

---

## 11 个阶段

| # | 阶段 | 类型 | 体验 |
|---|---|---|---|
| 1 | 首页 | 静态海面 + 入口 | 看到一句话 + 「体验《没有到达的海》」入口 |
| 2 | 案例导览 | 4 类来源说明 | 了解故事背景 + 4 类来源标签（原始档案 / 家人补充 / AI 推演 / 本次书写）|
| 3 | 短片一 | 视频 | 播放《没有出发的星期日》停在开箱 |
| 4 | 旧物档案 | 4 件物品 + 3D 详情 | 点击物品打开 3D 浮层（左模型右文字），自由探索 |
| 5 | AI 推演提示 | 简短浮层 | 说明短片二为 AI 推演内容 |
| 6 | 短片二 | 视频 | 播放《想象中的抵达》停在父亲消失 |
| 7 | 海边探索 | 静态背景 + 3 hotspots | 点击长椅看叠加视频 / 物品 / 纸条 |
| 8 | 短片三 | 视频 | 播放《带你认识他》，结束后两按钮并存 |
| 9 | 写一封信 | textarea | 纯输入页，按"预览这封信"去确认 |
| 10 | 确认内容 | 海面 + 信件卡片 | 预览 + "返回修改" / "把信留在这片海" |
| 11 | 结束页 | 项目愿景 + 用户信 + 三按钮 | 「回到旧物」/「回到海边」/「返回首页」 |

---

## 文件结构

```
网站-回声之间/
├── index.html              主页（包含全部 11 个章节 + 2 个浮层）
├── styles/
│   └── main.css            全局样式（6 大样式块 + 响应式）
├── scripts/
│   ├── main.js             章节路由、视频、翻页、写信、键盘导航
│   ├── source-labels.js    4 类来源标签系统
│   ├── video-stage.js      4 段视频统一调度 + 占位降级
│   ├── item-detail.js      物品 3D 详情浮层（Phase 1 SVG / Phase 3 model-viewer）
│   └── sea-scene.js        海边场景（Phase 1 静态 / Phase 4 World Labs）
├── assets/
│   ├── video.mp4           短片 A（Phase 1 占位）
│   ├── video/              [Phase 2] 4 段视频 + 长椅短片
│   ├── audio/              家人录音 + 海边环境音（按需补充）
│   ├── images/
│   │   ├── favicon.svg
│   │   ├── item-*.svg      旧物占位图（Phase 3 替换为 GLB）
│   │   ├── frames/processed/   冷调背景图（继续复用）
│   │   └── reference/      用户提供的参考图
│   ├── models/             [Phase 3] Tripo GLB ×4
│   ├── worldlabs/          [Phase 4] 海边 3D 场景
│   └── vendor/             [Phase 3/4] model-viewer / three.js 本地化
└── 视频-.mp4               原始视频（修改完后覆盖 assets/video.mp4 即可）
```

---

## 4 个交付阶段（渐进式）

### Phase 1：当前可交付
- ✅ 11 章节完整 HTML 结构
- ✅ 案例导览（4 类来源可视化）
- ✅ 物品 3D 详情浮层（SVG 占位 + CSS 旋转）
- ✅ 海边 3 hotspots + 长椅叠加视频层
- ✅ 写信 → 预览 → 确认 → 放下 完整流程
- ✅ 结束页三按钮并存
- ✅ 缺失资源自动降级（占位卡 / 按钮隐藏）

### Phase 2：用户交付 4 个 mp4 后
- 把视频文件放入 `assets/video/`
- 修改 `<video src>` 路径
- 调整 `Echo.VideoStage.config.contentEnd` 时间
- 移除对应占位卡

### Phase 3：用户交付 4 个 Tripo GLB 后
- 把 GLB 放入 `assets/models/`
- 下载 `model-viewer` 到 `vendor/`
- `item-detail.js` 自动检测 GLB 存在并切换

### Phase 4：用户交付 World Labs 场景后
- 把 splat 文件放入 `assets/worldlabs/`
- 下载 `three.js` + splat loader 到 `vendor/`
- `sea-scene.js` 启用 Three.js 渲染

---

## 如何运行

### 方法一：本地服务器（推荐）
```bash
# Python 3
python -m http.server 8000

# 或 Node.js
npx http-server -p 8000

# 然后浏览器打开 http://localhost:8000
```

### 方法二：直接双击 `index.html`
- 部分浏览器对本地视频/音频有限制
- 推荐用方法一

---

## 来源标签系统（4 类）

| 标签 | 颜色 | 用途 |
|---|---|---|
| **原始档案** | 绿 `#8aaa9a` | 故事中留下的画、票、信件等虚构物件 |
| **家人补充** | 米 `#d8b07a` | 陈默后期添加的纸条、补充记忆 |
| **AI 推演** | 蓝 `#8a9ac8` | 基于档案想象的画面（海边同行、生成对白等）|
| **本次书写** | 紫 `#c8a8e0` | 访客自己的信，独立保存 |

---

## 设计决策

| 项 | 选择 | 理由 |
|---|---|---|
| 技术栈 | 纯 HTML/CSS/JS（无框架）| 维护和替换素材最方便 |
| 视觉风格 | 黑底 + 暖米黄 + 手写体 | 电影沉浸感，符合"纪念"主题 |
| 物品素材 | SVG 占位 + model-viewer | Phase 1 立刻能跑；Phase 3 用 Tripo GLB 替换 |
| 写信交互 | textarea + 独立确认页 | 让"放下"动作更郑重 |
| 视频处理 | 每段自带 `<video>`，不切换 src | 避免重新解码 |
| 3D 模型 | `<model-viewer>` | 自动旋转、触摸支持、AR 兼容 |
| 海边 | 静态图 + CSS hotspots（Phase 1）| 不迷路；Phase 4 接 World Labs |
| 资源降级 | fetch HEAD 检测 + 自动隐藏/占位 | 资源缺失不报错 |
