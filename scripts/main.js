/* ============================================================
   回声之间 · 主控制逻辑
   11 章节路由 + 视频调度 + 物品 3D + 海边探索 + 写信
   ============================================================ */

(function () {
  'use strict';

  // ---------- 工具 ----------
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  /** 检测音频文件是否能加载（HEAD 请求） */
  async function audioExists(url) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  /** 在多个 URL 中取第一个 HEAD 可达的；都失败返回 null */
  async function pickWorkingAudio(urls) {
    for (const url of urls) {
      if (!url) continue;
      if (await audioExists(url)) return url;
    }
    return null;
  }

  // ---------- 章节映射（12 段：首页 → 钩子 → 案例导览 → ...） ----------
  const CHAPTER_MAP = {
    home:        '#chapter-1',
    'video-hook':'#chapter-hook',
    intro:       '#chapter-2',
    'video-a':   '#chapter-3',
    archive:     '#chapter-4',
    'ai-prompt': '#chapter-5',
    'video-b':   '#chapter-6',
    sea:         '#chapter-7',
    'video-c':   '#chapter-8',
    write:       '#chapter-9',
    confirm:     '#chapter-10',
    end:         '#chapter-11'
  };

  // 全局状态
  const writeState = { text: '' };
  const archiveState = { index: 0, total: 4 };

  /** 章节切换 */
  function goChapter(name) {
    const target = $(CHAPTER_MAP[name]);
    if (!target) {
      console.warn(`[goChapter] unknown chapter: ${name}`);
      return;
    }

    // 1. 离开所有视频时统一停止
    if (window.Echo && window.Echo.VideoStage) {
      window.Echo.VideoStage.stopAll();
      // 重置所有结束卡（除了将要进入的视频章节）
      ['shortA', 'shortB', 'shortC'].forEach(k => {
        if (name !== CHAPTER_MAP_KEY_FOR_VIDEO(k)) {
          window.Echo.VideoStage.hideEnd(k);
        }
      });
    }

    // 2. 离开 archive 时关闭物品详情浮层
    if (window.Echo && window.Echo.ItemDetail && name !== 'archive') {
      if (window.Echo.ItemDetail.isOpen && window.Echo.ItemDetail.isOpen()) {
        window.Echo.ItemDetail.close();
      }
    }

    // 3. 离开 sea 时挂起
    if (window.Echo && window.Echo.SeaScene) {
      if (name === 'sea') {
        window.Echo.SeaScene.resume();
      } else {
        window.Echo.SeaScene.suspend();
      }
    }

    // 4. 切换所有章节的 is-active
    const prevActiveChapter = document.querySelector('.chapter.is-active');
    $$('.chapter').forEach(c => c.classList.remove('is-active'));

    // 4b. 离开旧物档案时销毁所有 model-viewer，释放 GPU 显存（避免后续章节卡顿）
    if (prevActiveChapter && prevActiveChapter.id === 'chapter-4' && name !== 'archive') {
      if (typeof unmountAllArchive === 'function') {
        try { unmountAllArchive(); } catch (_) {}
      }
    }

    // 5. 关闭弹层（item-detail / sea-overlay）
    const itemDetail = $('#itemDetail');
    if (itemDetail && name !== 'archive') {
      itemDetail.classList.remove('is-active');
      itemDetail.hidden = true;
    }
    const seaOverlay = $('#seaOverlay');
    if (seaOverlay && name !== 'sea') {
      seaOverlay.classList.remove('is-active');
      seaOverlay.hidden = true;
    }

    // 6. 显示目标章节
    target.hidden = false;
    void target.offsetWidth; // 强制 reflow 触发动画
    target.classList.add('is-active');

    // 6b. 进入旧物档案时，挂载当前可见的 model-viewer
    if (name === 'archive') {
      if (typeof mountAllVisibleArchive === 'function') {
        // 等 DOM 更新后再挂载（避免初始化时序问题）
        setTimeout(() => mountAllVisibleArchive(), 0);
      }
    }

    // 7. 进入特定章节时的钩子
    if (window.Echo && window.Echo.VideoStage) {
      if (name === 'video-hook') window.Echo.VideoStage.play('hook');
      if (name === 'video-a')     window.Echo.VideoStage.play('shortA');
      if (name === 'video-b')     window.Echo.VideoStage.play('shortB');
      if (name === 'video-c')     window.Echo.VideoStage.play('shortC');

      // 写信章节：进入时循环播放空椅子背景，离开时暂停
      if (name === 'write') {
        window.Echo.VideoStage.playLoop('letterBg');
      } else {
        window.Echo.VideoStage.pauseLoop('letterBg');
      }
    }

    // 8. 进入 confirm 章节时，渲染用户信件
    if (name === 'confirm') {
      renderConfirmContent();
    }

    // 9. 进入 end 章节时，渲染用户信件
    if (name === 'end') {
      renderEndContent();
    }

    // 10. 进入 write 章节时自动聚焦
    if (name === 'write') {
      setTimeout(() => {
        const ta = $('#writeDisplay');
        if (ta) ta.focus();
      }, 600);
    }
  }

  // 辅助：video key → chapter name
  function CHAPTER_MAP_KEY_FOR_VIDEO(videoKey) {
    const map = { shortA: 'video-a', shortB: 'video-b', shortC: 'video-c' };
    return map[videoKey];
  }

  /** 给所有 data-go 按钮挂上跳转 */
  function bindNav() {
    $$('[data-go]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const to = btn.getAttribute('data-go');
        if (to) goChapter(to);
      });
    });

    // data-close 按钮
    $$('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-close');
        if (id === 'itemDetail' && window.Echo && window.Echo.ItemDetail) {
          window.Echo.ItemDetail.close();
        } else if (id === 'seaOverlay' && window.Echo && window.Echo.SeaScene) {
          window.Echo.SeaScene._closeOverlay();
        } else {
          const el = $('#' + id);
          if (el) el.hidden = true;
        }
      });
    });
  }

  // ============================================================
  // 章节 2：案例导览
  // ============================================================
  function bindIntro() {
    const container = $('#introCards');
    if (container && window.Echo && window.Echo.SourceLabels) {
      window.Echo.SourceLabels.renderIntroCards(container);
    }
  }

  // ============================================================
  // 章节 4：旧物档案 - 全局模型挂载/销毁（goChapter 调用）
  // ============================================================
  let unmountAllArchive = () => {};
  let mountAllVisibleArchive = () => {};

  // 暴露到 window 方便调试 + 让外部也能清理
  window.__archiveControls = {
    unmountAll: () => unmountAllArchive(),
    mountVisible: () => mountAllVisibleArchive()
  };

  // ============================================================
  // 章节 3/6/8：视频（统一由 Echo.VideoStage 处理）
  // ============================================================
  function bindVideo(key, playerSelector, endSelector) {
    const player = $(playerSelector);
    const overlay = $(playerSelector + 'Overlay');
    const playBtn = $(playerSelector + 'Play');
    const endBox = $(endSelector);

    if (!player || !endBox) return;

    // 用户点击播放按钮
    if (playBtn) {
      playBtn.addEventListener('click', async () => {
        if (overlay) overlay.classList.add('is-hidden');
        try {
          player.muted = false;
          await player.play();
        } catch (err) {
          console.warn(`[${key}] play failed:`, err);
          try {
            player.muted = true;
            await player.play();
          } catch (e) {
            console.warn(`[${key}] muted play also failed:`, e);
          }
        }
      });
    }
  }

  // ============================================================
  // 音频解锁：用户首次点击后，把所有视频解除静音
  // Chrome autoplay 政策要求 unmute 必须有用户手势；
  // 用户点击章节按钮虽是手势，但 goChapter() 是异步流程，
  // 等到 video.play() 调用时手势已断。
  // 这里监听任意用户点击，第一次触发时：
  //   1) 设置 VideoStage._audioUnlocked = true（让后续 play() 保持有声）
  //   2) 把所有当前视频设为有声
  //   3) 200ms 后再检查一次（防 goChapter 异步 play() 又把 muted 设回 true）
  // ============================================================
  function installAudioUnlock() {
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      if (window.Echo && window.Echo.VideoStage) {
        window.Echo.VideoStage._audioUnlocked = true;
      }
      const unmuteAll = () => {
        document.querySelectorAll('video').forEach((v) => {
          if (v.muted) {
            v.muted = false;
            if (v.paused && v.currentTime > 0 && v.src) {
              const p = v.play();
              if (p && p.catch) p.catch(() => {});
            }
          }
        });
        // 同时解除 BGM 静音并启动播放（音量 0.75 让用户听到）
        const bgm = getBGM();
        if (bgm && bgm.muted) {
          bgm.muted = false;
          startBGM();
        }
        // 显式设置 BGM 当前音量（处理被自动播暂停在 0 的情况）
        const bgmEl = getBGM();
        if (bgmEl) {
          _bgmCurrentVolume = bgmEl.volume;  // 保持当前值（可能是 0）
          // 如果还是 0，说明刚刚 unmute，需要立刻升到 0.75
          if (bgmEl.volume < 0.5) {
            _bgmTargetVolume = 0.75;
            _bgmCurrentVolume = 0.75;
            bgmEl.volume = 0.75;
          }
        }
      };
      unmuteAll();
      // 200ms 后再 unmute 一次（覆盖 goChapter 异步触发的 play() 重置 muted=true）
      setTimeout(unmuteAll, 200);
      // 1s 后再 unmute 一次（兜底）
      setTimeout(unmuteAll, 1000);
      // 移出所有监听器
      ['click', 'keydown', 'touchstart', 'pointermove', 'mousemove', 'pointerdown'].forEach(ev => {
        document.removeEventListener(ev, unlock, true);
      });
    };
    // 监听多种用户手势事件（让音乐在用户最自然的动作下立刻响起）
    ['click', 'keydown', 'touchstart', 'pointermove', 'mousemove', 'pointerdown'].forEach(ev => {
      document.addEventListener(ev, unlock, true);
    });
  }

  // ============================================================
  // 全局音频增益：把所有 <video> 通过 WebAudio GainNode 路由输出
  // 解决视频本身音频电平偏低问题（环境音视频平均电平仅 10-20/255）
  // 用 GainNode 把音量提升 ~3 倍（不失真为限）
  // ============================================================
  function installAudioBoost() {
    if (window.__audioBoostInstalled) return;
    window.__audioBoostInstalled = true;
    let ctx = null;
    let masterGain = null;
    let compressor = null;
    let makeUpGain = null;
    // 视频已经 ffmpeg loudnorm 处理到 -14 LUFS（标准对白音量），所以 BOOST 1.5 倍即可
    // （再大会削波；1 倍也可以，但 1.5 让人声更清晰一点）
    const BOOST = 1.5;

    const ensureCtx = () => {
      if (!ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        ctx = new Ctx();
        // 强压缩：threshold -30dB（任何输入都触发），ratio 8:1
        // 视频原始电平 7-13%（-23dB ~ -18dB），全部超过 -30dB 阈值
        // 8:1 压缩后动态范围被极大压缩 → 听感更响
        compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 10;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.1;
        // makeup gain 补偿压缩损失
        makeUpGain = ctx.createGain();
        makeUpGain.gain.value = 1.0;
        masterGain = ctx.createGain();
        masterGain.gain.value = BOOST;
        // signal → masterGain (×10) → compressor (8:1) → makeUp (×3) → destination
        // 净增益：10 × 3 = 30 倍（但压缩后实际听感约 6-10 倍）
        masterGain.connect(compressor);
        compressor.connect(makeUpGain);
        makeUpGain.connect(ctx.destination);
        // 暴露 ctx 给调试/外部监控用
        window.__audioBoostCtx = ctx;
        window.__audioBoostMasterGain = masterGain;
        window.__audioBoostCompressor = compressor;
        window.__audioBoostMakeUpGain = makeUpGain;
      } else if (ctx.state === 'suspended') {
        ctx.resume();
      }
      return ctx;
    };

    // 已连接的 video 列表（避免重复创建 MediaElementSource）
    const connectedVideos = new WeakSet();

    // 主动连接 video 到 BOOST 链（不等 play 事件，确保 init 时就生效）
    // 注意：MediaElementAudioSourceNode 没有 start() 方法！
    // 音频通过 HTMLMediaElement.play() 自动流入 source。
    const connectVideo = (v) => {
      if (!v) return;
      try {
        ensureCtx();
        const src = ctx.createMediaElementSource(v);
        src.connect(masterGain);
        connectedVideos.add(v);
        if (v.id) window['__videoSource_' + v.id] = src;
        return true;
      } catch (e) {
        return false;
      }
    };
    // play 事件触发时再尝试一次 connect（重试）
    const retryOnPlay = (v) => {
      v.addEventListener('play', () => {
        if (connectedVideos.has(v)) return;
        connectVideo(v);
      }, { once: false });
    };

    // 处理已有 video（主动连接，不等 play 事件）
    document.querySelectorAll('video').forEach(v => {
      connectVideo(v);
      retryOnPlay(v);
    });

    // 立即创建 audio context 并预热
    try {
      ensureCtx();
    } catch (_) {}

  // 处理已有 video（主动连接，不等 play 事件）
    document.querySelectorAll('video').forEach(v => {
      connectVideo(v);
      retryOnPlay(v);
    });

  // 处理动态加进来的 video
    const obs = new MutationObserver((muts) => {
      muts.forEach(m => {
        m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (n.tagName === 'VIDEO') {
            connectVideo(n);
            retryOnPlay(n);
          } else if (n.querySelectorAll) {
            n.querySelectorAll('video').forEach(v => {
              connectVideo(v);
              retryOnPlay(v);
            });
          }
        });
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // ============================================================
  // 启动 splash：Chrome autoplay 政策要求用户首次手势后才能有声音
  // 全屏覆盖层，用户点击后：解锁 BGM → 立刻 0.75 音量播放 → 淡出 splash
  // 用户后续操作由 installAudioUnlock 接管
  // ============================================================
  function installStartSplash() {
    const splash = document.getElementById('startSplash');
    const btn = document.getElementById('startSplashBtn');
    if (!splash || !btn) return;

    const dismiss = () => {
      // 解锁音频并启动 BGM
      const bgm = getBGM();
      if (bgm) {
        bgm.muted = false;
        const p = bgm.play();
        if (p && p.catch) p.catch(() => {});
        _bgmCurrentVolume = 0.75;
        bgm.volume = 0.75;
      }
      // 淡出 splash（CSS transition 0.8s）
      splash.classList.add('is-dismissed');
      // 动画结束后移除元素
      setTimeout(() => {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      }, 1000);
    };

    // 整个 splash 是大按钮，点击任何位置都触发
    splash.addEventListener('click', dismiss);
    // 同时给按钮加 ESC 键支持（可选，键盘用户友好）
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (splash.parentNode) dismiss();
      }
    }, { once: true });
  }

  // ============================================================
  // 模型持续自转
  // model-viewer 自带的 auto-rotate 在鼠标悬停时会暂停。
  // 这里用 RAF 直接修改 mv.model.rotation.y（绕 Y 轴旋转），
  // 用户按下/拖动时暂停，松手/离开时恢复。
  // 注意：这种方式与 camera-controls 兼容（用户仍可拖动相机环绕）
  // @param {HTMLElement} mv model-viewer 元素
  // @param {number} speedDegPerSec 旋转速度（默认 10°/s）
  // ============================================================
  function enableContinuousRotation(mv, speedDegPerSec) {
    if (!mv) return;
    speedDegPerSec = speedDegPerSec || 10;
    let rotating = true;
    let lastTime = performance.now();
    let rafId = null;

    const tick = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      if (rotating && mv.model) {
        try {
          mv.model.rotation.y += dt * speedDegPerSec * Math.PI / 180;
        } catch (_) {}
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const stop = () => { rotating = false; lastTime = performance.now(); };
    const start = () => { rotating = true; lastTime = performance.now(); };

    mv.addEventListener('pointerdown', stop);
    mv.addEventListener('pointermove', (e) => {
      if (e.buttons > 0) stop(); else start();
    });
    mv.addEventListener('pointerup', start);
    mv.addEventListener('pointerleave', start);

    // 元素移除时清理 RAF
    const observer = new MutationObserver(() => {
      if (!document.body.contains(mv)) {
        if (rafId) cancelAnimationFrame(rafId);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ============================================================
  // 章节 4：旧物档案
  // ============================================================
  function bindArchive() {
    const items = $$('#chapter-4 .item');
    const prevBtn = $('#archivePrev');
    const nextBtn = $('#archiveNext');
    const indexEl = $('#archiveIndex');
    const totalEl = $('#archiveTotal');

    archiveState.total = items.length;
    if (totalEl) totalEl.textContent = archiveState.total;

    // 缓存每个物品的 model-viewer 实例和初始化状态
    // 当 chapter-4 可见时才初始化，进入后立刻挂载；
    // 离开 chapter-4 时销毁（dispose）以释放 GPU 显存，避免拖慢后续章节
    items.forEach((item, idx) => {
      const mediaSlot = item.querySelector('.item__media');
      const src = mediaSlot && mediaSlot.getAttribute('src');
      if (!mediaSlot || !src) return;
      // 把现有 <model-viewer> 替换为占位 div，等进入章节再挂载
      const placeholder = document.createElement('div');
      placeholder.className = 'item__media item__media--placeholder';
      placeholder.dataset.modelSrc = src;
      placeholder.dataset.modelIdx = idx;
      mediaSlot.replaceWith(placeholder);
    });

    function mountItemModel(item) {
      const ph = item.querySelector('.item__media--placeholder');
      if (!ph || !ph.dataset.modelSrc) return;
      const mv = document.createElement('model-viewer');
      mv.className = 'item__media';
      // ★ src 已是 HTML 里的 _compressed.glb（Draco 压缩版，2-5x 小），
      //   模型查看器自带 Draco decoder，不用额外配置
      mv.setAttribute('src', ph.dataset.modelSrc);
      const itemKey = item.dataset.item || '';
      mv.setAttribute('alt', item.dataset.item || '');
      mv.setAttribute('camera-controls', '');
      // loading=eager：元素一进 DOM 就开始下载（不靠视口触发）
      // 不设 reveal=manual（否则 model-viewer 会卡在 poster 不加载模型）
      mv.setAttribute('loading', 'eager');
      // 移除 model-viewer 自带的 auto-rotate（它在鼠标悬停时会暂停）
      // 改用我们自己的 RAF 持续旋转
      mv.setAttribute('shadow-intensity', '0.6');
      mv.setAttribute('exposure', '1.1');
      mv.setAttribute('camera-orbit', '45deg 75deg 1.4m');
      // 默认先隐藏，加载完再淡入（避免贴图闪烁）
      mv.style.opacity = '0';
      mv.style.transition = 'opacity 0.5s ease';

      // 进度提示：把当前 item 替换成「加载中」overlay，下载完再替换回 model-viewer
      // 这样用户在 archive 也能看到下载进度
      const loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'archive-model-loading';
      loadingOverlay.innerHTML = `
        <div class="archive-model-loading__spinner"></div>
        <p class="archive-model-loading__text">正在加载「${itemKey}」</p>
        <p class="archive-model-loading__hint">Draco 压缩 · 首次约 2-5s</p>
        <div class="archive-model-loading__progress">
          <div class="archive-model-loading__bar"><span class="archive-model-loading__fill"></span></div>
          <span class="archive-model-loading__pct">0%</span>
        </div>
      `;
      const fill = loadingOverlay.querySelector('.archive-model-loading__fill');
      const pctEl = loadingOverlay.querySelector('.archive-model-loading__pct');
      const textEl = loadingOverlay.querySelector('.archive-model-loading__text');
      mv.addEventListener('progress', (e) => {
        const total = e.detail && e.detail.total;
        const loaded = e.detail && e.detail.loaded;
        if (total && loaded != null && total > 0) {
          const p = Math.min(100, Math.round((loaded / total) * 100));
          if (fill) fill.style.width = p + '%';
          if (pctEl) pctEl.textContent = p + '%';
          if (textEl && p >= 50 && p < 100) textEl.textContent = '即将完成…';
        }
      });

      mv.addEventListener('load', () => {
        mv.style.opacity = '1';
        // ★ 不要 loadingOverlay.remove()——mv 是它的子元素，
        //   remove() 会把 mv 一起删掉。改成只 display:none
        loadingOverlay.style.display = 'none';
        mv.removeEventListener('progress', () => {});
      }, { once: true });

      mv.addEventListener('error', () => {
        loadingOverlay.classList.add('archive-model-loading--error');
        if (textEl) textEl.textContent = '加载失败，请检查网络';
      }, { once: true });

      // 把 ph 替换成一个 slot div，里面包含 [loadingOverlay, mv]
      // 这样 grid 里仍然是一个 column 1 item（不破坏布局），
      // 加载完只隐藏 overlay，mv 继续渲染
      const slot = document.createElement('div');
      slot.className = 'item__media item__media--slot';
      slot.style.cssText = 'position:relative;width:100%;height:100%;min-height:480px;';
      loadingOverlay.style.cssText += 'position:absolute;inset:0;z-index:2;';
      mv.style.position = 'absolute';
      mv.style.inset = '0';
      mv.style.width = '100%';
      mv.style.height = '100%';
      slot.appendChild(loadingOverlay);
      slot.appendChild(mv);
      ph.replaceWith(slot);
      // 启用 model-viewer 自带的 auto-rotate：每秒 16°，延迟 300ms 立即开始
      mv.setAttribute('auto-rotate', '');
      mv.setAttribute('auto-rotate-delay', '300');
      mv.setAttribute('rotation-per-second', '16deg');
    }

    function unmountItemModel(item) {
      const mv = item.querySelector('model-viewer');
      if (!mv) return;
      try { mv.dispose && mv.dispose(); } catch (_) {}
      // 用占位 div 替换，保留 src/idx 供下次挂载
      const ph = document.createElement('div');
      ph.className = 'item__media item__media--placeholder';
      ph.dataset.modelSrc = mv.getAttribute('src');
      ph.dataset.modelIdx = item.dataset.item || '';
      mv.replaceWith(ph);
    }

    // 章节进入/离开时的全量挂载/销毁
    // 优化：进入 archive 时并行挂载所有 4 个 item，让 4 个 GLB 同时下载
    // （之前只挂载可见的那一个，要 4 次串行下载）
    function mountAllVisible() {
      items.forEach((it) => {
        mountItemModel(it);
      });
    }
    function unmountAll() {
      items.forEach((it) => unmountItemModel(it));
    }

    // 暴露给 goChapter 调用
    unmountAllArchive = unmountAll;
    mountAllVisibleArchive = mountAllVisible;

    function show(i) {
      archiveState.index = Math.max(0, Math.min(i, archiveState.total - 1));
      items.forEach((it, idx) => {
        const wasVisible = !it.hidden;
        const willBeVisible = idx === archiveState.index;
        it.hidden = !willBeVisible;
        // 进入可见时才挂载 model-viewer（懒加载、懒渲染）
        if (willBeVisible && !wasVisible) {
          mountItemModel(it);
        } else if (!willBeVisible && wasVisible) {
          unmountItemModel(it);
        }
      });

      const isFirst = archiveState.index === 0;
      // 最后一幕：next 跳到 AI 提示（短片二前）
      const isLast = archiveState.index === archiveState.total - 1;

      if (prevBtn) prevBtn.classList.toggle('is-hidden', isFirst);

      if (indexEl) indexEl.textContent = archiveState.index + 1;

      if (nextBtn) {
        if (isLast) {
          nextBtn.innerHTML = '<span>前往那片海</span><span class="archive__next-icon">→</span>';
        } else {
          nextBtn.innerHTML = '<span>下一件</span><span class="archive__next-icon">→</span>';
        }
        nextBtn.onclick = isLast
          ? () => goChapter('ai-prompt')
          : () => show(archiveState.index + 1);
      }
    }

    if (prevBtn) prevBtn.addEventListener('click', () => show(archiveState.index - 1));

    // 物品卡片直接显示 3D 模型，不再需要点击进入浮层
    // 保留接口以便未来扩展（点模型打开音频等）
    items.forEach(item => {
      const itemKey = item.dataset.item;
      if (!itemKey) return;
      // 不再绑定 media 点击事件
    });

    // 旧物录音探测（旧物录音尚未交付，统一隐藏 audio 按钮）
    items.forEach(item => {
      const btn = item.querySelector('.audio-btn');
      if (!btn) return;
      btn.hidden = true;
    });

    show(0);
  }

  // ============================================================
  // 章节 7：海边（由 Echo.SeaScene 接管热点逻辑）
  // ============================================================
  function bindSea() {
    // BGM 音频元素（sea-ambient.mp3）作为全站背景音乐
    // CDN 优先，本地兜底；都不通则移除元素
    // 视频播放时由 video-stage.js 调 duckBGM() 淡出；视频结束后恢复
    const bgm = $('#bgmAudio');
    if (bgm) {
      const candidates = [
        'https://ke1sfe0r0qdtrhdk.public.blob.vercel-storage.com/sea-ambient.mp3',
        'assets/audio/sea-ambient.mp3'
      ];
      pickWorkingAudio(candidates).then(working => {
        if (working) {
          try { bgm.src = working; } catch (_) {}
          bgm.load();
        } else {
          bgm.remove();
        }
      });
    }
  }

  // ============================================================
  // BGM 控制：全站背景音乐
  // - 页面加载后 muted 循环播放（Chrome autoplay 要求）
  // - 用户首次点击后解除静音
  // - 视频播放时由 video-stage.js 调 duckBGM() 淡出到 0
  // - 视频结束调 resumeBGM() 淡入回 0.5
  // ============================================================
  let _bgm = null;
  let _bgmRafId = null;
  let _bgmTargetVolume = 0;  // 0=静默, 1=正常
  let _bgmCurrentVolume = 0;

  function getBGM() {
    if (!_bgm) _bgm = document.getElementById('bgmAudio');
    return _bgm;
  }

  function startBGM() {
    const bgm = getBGM();
    if (!bgm) return;
    if (!bgm.paused) return;
    const p = bgm.play();
    if (p && p.catch) p.catch(() => {});
  }

  function pauseBGM() {
    const bgm = getBGM();
    if (!bgm) return;
    bgm.pause();
  }

  function setBGMVolumeSmooth(target, durationMs = 600) {
    const bgm = getBGM();
    if (!bgm) return;
    _bgmTargetVolume = target;
    if (_bgmRafId) cancelAnimationFrame(_bgmRafId);
    const startVol = _bgmCurrentVolume;
    const startT = performance.now();
    const tick = () => {
      const now = performance.now();
      const t = Math.min(1, (now - startT) / durationMs);
      _bgmCurrentVolume = startVol + (target - startVol) * t;
      try { bgm.volume = _bgmCurrentVolume; } catch (_) {}
      if (t < 1 && _bgmTargetVolume === target) {
        _bgmRafId = requestAnimationFrame(tick);
      } else {
        _bgmRafId = null;
      }
    };
    _bgmRafId = requestAnimationFrame(tick);
  }

  // 视频开始播放时调用：淡出到 0
  function duckBGM() {
    const bgm = getBGM();
    if (!bgm) return;
    bgm.muted = false;
    setBGMVolumeSmooth(0, 400);
  }

  // 视频结束 / 跳过时调用：淡入回 0.75
  function resumeBGM() {
    const bgm = getBGM();
    if (!bgm) return;
    bgm.muted = false;
    setBGMVolumeSmooth(0.75, 800);
  }

  // ============================================================
  // 章节 9：写一封信（纯输入页）
  // ============================================================
  function bindWrite() {
    const display = $('#writeDisplay');
    const clearBtn = $('#writeClear');
    const previewBtn = $('#writePreview');

    if (!display) return;

    // 实时保存到 writeState
    display.addEventListener('input', () => {
      writeState.text = display.value;
    });

    // 进入 write 时如果有历史文本（从 confirm 返回修改），恢复
    function restoreIfNeeded() {
      if (writeState.text && display.value !== writeState.text) {
        display.value = writeState.text;
      }
    }
    restoreIfNeeded();

    // 清空
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        display.value = '';
        display.focus();
        writeState.text = '';
      });
    }

    // 预览（跳到 confirm）
    if (previewBtn) {
      previewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = (display.value || '').trim();
        writeState.text = text || '（未留下文字）';
        goChapter('confirm');
      });
    }
  }

  // ============================================================
  // 章节 10：确认内容
  // ============================================================
  function renderConfirmContent() {
    const textEl = $('#confirmText');
    const dateEl = $('#confirmDate');
    if (textEl) textEl.textContent = writeState.text || '（未留下文字）';
    if (dateEl) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      dateEl.textContent = `${y} 年 ${m} 月 ${d} 日`;
    }
  }

  function bindConfirm() {
    const submitBtn = $('#confirmSubmit');
    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // 显示"已封存"反馈
        const original = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span>已封存</span>';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.6';
        // 1 秒后跳到结束页（让"已封存"被看到）
        setTimeout(() => {
          goChapter('end');
          // 回来时还能用
          setTimeout(() => {
            submitBtn.innerHTML = original;
            submitBtn.disabled = false;
            submitBtn.style.opacity = '';
          }, 1200);
        }, 600);
      });
    }
  }

  // ============================================================
  // 结束页：彩蛋视频入口
  // ============================================================
  function bindEaster() {
    const btn = $('#endEasterEggBtn');
    const overlay = $('#easterOverlay');
    const player = $('#easterPlayer');
    if (!btn || !overlay || !player) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 用 VideoStage 接管播放（自动检测可用性、兜底）
      if (window.Echo && window.Echo.VideoStage) {
        overlay.hidden = false;
        void overlay.offsetWidth;
        overlay.classList.add('is-active');
        window.Echo.VideoStage.play('easter');
      }
    });

    // 关闭浮层时暂停并复位
    const closeHandler = () => {
      if (window.Echo && window.Echo.VideoStage) {
        window.Echo.VideoStage.reset('easter');
      } else if (player) {
        try { player.pause(); player.currentTime = 0; } catch (_) {}
      }
    };
    overlay.querySelectorAll('[data-close="easterOverlay"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        overlay.classList.remove('is-active');
        setTimeout(() => {
          overlay.hidden = true;
          closeHandler();
        }, 400);
      });
    });
  }

  // ============================================================
  // 章节 11：结束页
  // ============================================================
  function renderEndContent() {
    const yourLetter = $('#endYourLetter');
    const yourText = $('#endYourLetterText');
    if (yourLetter && yourText) {
      if (writeState.text && writeState.text !== '（未留下文字）') {
        yourText.textContent = writeState.text;
        yourLetter.hidden = false;
      } else {
        yourLetter.hidden = true;
      }
    }
  }

  // ============================================================
  // 跳过视频按钮
  // ============================================================
  function bindSkipButtons() {
    $$('[data-skip]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const key = btn.getAttribute('data-skip');
        if (!key || !window.Echo || !window.Echo.VideoStage) return;
        // 暂停视频并直接显示结束卡
        const cfg = window.Echo.VideoStage.config[key];
        if (cfg) {
          const player = document.querySelector(cfg.selector);
          if (player) {
            try {
              player.pause();
              // 跳到接近结尾位置，触发正常结束流程
              if (player.duration && !isNaN(player.duration)) {
                player.currentTime = Math.min(cfg.contentEnd, player.duration - 0.5);
              } else {
                player.currentTime = cfg.contentEnd;
              }
            } catch (_) {}
          }
        }
        window.Echo.VideoStage.showEnd(key);
        // 跳过：视频结束，恢复 BGM
        if (window.Echo.resumeBGM) window.Echo.resumeBGM();
      });
    });
  }

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 页面加载阶段就预连接 + 预加载 4 个 GLB 模型
   * - preconnect：提前握手 DNS + TCP + TLS
   * - preload：浏览器一进 idle 就开始下载（用户读首页/钩子/案例/海边的几秒钟里，模型就在后台下）
   * - fetchpriority：第一件物品 highest（用户大概率先看它），其他 auto
   * 之前是进入海边才预加载，太晚 —— 用户已经走到旧物档案还在等下载
   */
  function preload3DAssets() {
    const CDN_HOST = 'ke1sfe0r0qdtrhdk.public.blob.vercel-storage.com';
    const HREF = `https://${CDN_HOST}`;

    // preconnect（暖连接，没有 crossorigin 时也成立）
    if (!document.querySelector(`link[rel="preconnect"][href="${HREF}"]`)) {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = HREF;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }

    // preload 4 个 GLB（并行下载，CDN 已开启 Accept-Ranges + 30 天缓存）
    // 用 _compressed.glb（Draco 压缩版，~2-5x 小），model-viewer 自带 Draco decoder
    const models = [
      { name: 'painting', priority: 'high' }, // 第一件物品最高优先级
      { name: 'ticket',   priority: 'auto' },
      { name: 'cup',      priority: 'auto' },
      { name: 'letter',   priority: 'low' }
    ];
    models.forEach(({ name, priority }) => {
      // ★ 用 _compressed.glb（Draco 压缩版，2-5x 小），model-viewer 自带 Draco decoder
      const url = `${HREF}/${name}_compressed.glb`;
      if (document.querySelector(`link[href="${url}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'fetch';
      link.href = url;
      link.crossOrigin = 'anonymous';
      link.setAttribute('fetchpriority', priority);
      document.head.appendChild(link);
    });
  }

  function init() {
    // 首页作为默认入口
    $('#chapter-1').classList.add('is-active');

    // 页面加载阶段就开始暖连接 + 预加载 4 个 GLB
    preload3DAssets();

    // 页面加载后尝试 muted 自动播放 BGM（Chrome 真实环境允许）
    // 在真实浏览器中会成功；headless playwright 等环境下会被拒绝，
    // 但用户首次点击时 installAudioUnlock 会启动 BGM。
    const startBGMAutoplay = () => {
      try {
        const bgm = document.getElementById('bgmAudio');
        if (!bgm) return;
        bgm.volume = 0;
        bgm.muted = true;
        bgm.loop = true;
        const p = bgm.play();
        if (p && p.catch) p.catch(() => {});
      } catch (_) {}
    };
    // 等 DOM ready + audio 数据可用
    if (document.readyState === 'complete') {
      startBGMAutoplay();
    } else {
      window.addEventListener('load', startBGMAutoplay);
    }
    // 也可以在 canplay 后再次尝试（某些情况下 audio 元素还没准备好）
    const bgmEl = document.getElementById('bgmAudio');
    if (bgmEl && bgmEl.readyState < 3) {
      bgmEl.addEventListener('canplay', startBGMAutoplay, { once: true });
    }

    bindNav();
    bindIntro();
    bindArchive();
    bindSea();
    bindWrite();
    bindConfirm();
    bindEaster();
    bindSkipButtons();
    installAudioUnlock();
    installAudioBoost();
    installStartSplash();

    // 视频章节绑定（点击播放按钮）
    bindVideo('shortA', '#videoA', '#videoAEnd');
    bindVideo('shortB', '#videoB', '#videoBEnd');
    bindVideo('shortC', '#videoC', '#videoCEnd');

    // 预检查所有视频可用性（避免运行时 HEAD 延迟导致视频被重置）
    if (window.Echo && window.Echo.VideoStage) {
      window.Echo.VideoStage.preflight();
    }

    // 全局键盘快捷键
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input') return;

      // ESC 回到首页
      if (e.key === 'Escape') {
        // 如果详情浮层打开，先关闭
        if (window.Echo && window.Echo.ItemDetail && window.Echo.ItemDetail.isOpen && window.Echo.ItemDetail.isOpen()) {
          window.Echo.ItemDetail.close();
          return;
        }
        // 如果 sea overlay 打开，先关闭
        const seaOverlay = $('#seaOverlay');
        if (seaOverlay && !seaOverlay.hidden) {
          if (window.Echo && window.Echo.SeaScene) {
            window.Echo.SeaScene._closeOverlay();
          }
          return;
        }
        // 否则回首页
        goChapter('home');
      }
    });

    console.log('回声之间 · initialized · 11 章节');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露 BGM 控制 + 持续旋转到 window.Echo
  window.Echo = window.Echo || {};
  window.Echo.duckBGM = duckBGM;
  window.Echo.resumeBGM = resumeBGM;
  window.Echo.startBGM = startBGM;
  window.Echo.enableContinuousRotation = enableContinuousRotation;
})();
