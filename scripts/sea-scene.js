/* ============================================================
   回声之间 · 海边场景
   - Phase 1：静态背景图 + CSS hotspots
   - Phase 4：替换为 World Labs 3D 场景
   ============================================================ */

(function (root) {
  'use strict';
  root.Echo = root.Echo || {};

  root.Echo.SeaScene = {
    _initialized: false,
    _hotspotState: { bench: false, 'items-cup': false, 'items-ticket': false, note: false },
    _viewer: null,
    _splatHost: null,
    _splatAvailable: false,
    _splatReady: false,
    _splatFallback: null,
    _splatPending: null, // Promise that resolves when viewer is ready

    /**
     * 进入海边时激活
     */
    resume() {
      if (!this._initialized) {
        this._init();
        this._initialized = true;
      }
      // 重置热点状态（让用户重新探索）
      this._hotspotState = { bench: false, 'items-cup': false, 'items-ticket': false, note: false };
      this._resetHotspots();
      // 不再启动 splat viewer（Phase 4 取消，改用照片背景）
      // GLB 预加载已移到 main.js init() —— 页面加载就启动，不再等海边
    },

    /**
     * 离开海边时挂起
     */
    suspend() {
      // 关闭所有弹层
      const panels = document.querySelectorAll('.sea__panel');
      panels.forEach(p => p.hidden = true);
      // 关闭叠加层
      const overlay = document.querySelector('#seaOverlay');
      if (overlay) {
        overlay.hidden = true;
        const player = overlay.querySelector('video');
        if (player) { try { player.pause(); player.currentTime = 0; } catch (_) {}
        }
      }
      // 停止保活定时器（splat viewer 已禁用，定时器不再启动）
      if (this._splatEnforceTimer) {
        clearInterval(this._splatEnforceTimer);
        this._splatEnforceTimer = null;
      }
      if (this._splatRafId) {
        cancelAnimationFrame(this._splatRafId);
        this._splatRafId = null;
      }
    },

    /**
     * 检测 World Labs .ksplat 是否可用（异步，带进度回调）
     */
    async _detectSplat(onProgress) {
      try {
        const url = 'assets/worldlabs/海边场景搭建.ksplat';
        // 先 HEAD 一次获取文件大小（不下载内容）
        const head = await fetch(url, { method: 'HEAD' });
        if (!head.ok) return false;
        const totalSize = parseInt(head.headers.get('content-length') || '0', 10);

        // 用 fetch 流式 GET 拿真实下载进度（边下边扔，只保留 content-length 用于进度条）
        const res = await fetch(url);
        if (!res.ok) return false;
        const reader = res.body.getReader();
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (onProgress && totalSize > 0) {
            onProgress(received, totalSize);
          }
        }
        reader.cancel();
        return true;
      } catch (_) {
        return false;
      }
    },

    /**
     * 初始化 World Labs 3D 高斯泼溅场景
     * 已禁用（用户选择静态照片背景代替 3D splat）。
     * 保留方法签名以防调用方报错。
     */
    async _initSplat() {
      // 直接返回，确保照片背景（.sea__fallback）正常显示
      console.log('[SeaScene] 3D splat 已禁用，使用照片背景');
      return;
    },

    /**
     * 初始化热点和叠加层
     */
    _init() {
      // 异步启动 splat 加载（不阻塞热点初始化）
      this._initSplat();

      const hotspots = document.querySelectorAll('.sea__hotspot');
      hotspots.forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.hotspot;
          this._handleHotspot(key, btn);
        });
      });

      // 长椅叠加层关闭按钮
      const overlayClose = document.querySelector('#seaOverlay .sea-overlay__close');
      if (overlayClose) {
        overlayClose.addEventListener('click', () => this._closeOverlay());
      }

      // 弹层关闭按钮
      const panelCloses = document.querySelectorAll('.sea__panel-close');
      panelCloses.forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.close;
          const panel = document.querySelector(`#${id}`);
          if (panel) panel.hidden = true;
        });
      });

      // 纸条面板里的"看看后来"按钮 → 关闭面板 + 打开 sea-overlay（播 seaNote 视频）
      const seaNoteBtn = document.querySelector('#seaNoteBtn');
      if (seaNoteBtn) {
        seaNoteBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const panel = document.querySelector('#panelNote');
          if (panel) panel.hidden = true;
          this._openOverlay('seaNote');
        });
      }
    },

    /**
     * 处理热点点击
     */
    _handleHotspot(key, btn) {
      btn.classList.add('is-found');
      this._hotspotState[key] = true;

      switch (key) {
        case 'bench':
          this._openOverlay('bench');
          break;
        case 'items-cup':
          if (window.Echo && window.Echo.ItemDetail) {
            window.Echo.ItemDetail.open('cup');
          } else {
            this._openPanel('panelItems');
          }
          break;
        case 'items-ticket':
          if (window.Echo && window.Echo.ItemDetail) {
            window.Echo.ItemDetail.open('ticket');
          } else {
            this._openPanel('panelItems');
          }
          break;
        case 'note':
          this._openPanel('panelNote');
          break;
      }

      this._checkComplete();
    },

    /**
     * 打开海边叠加层（视频层）
     * @param {string} videoKey - 视频键名，默认 'bench'，纸条用 'seaNote'
     * 视频由 VideoStage 统一调度：CDN 优先，本地兜底，都不通才显示占位卡
     */
    _openOverlay(videoKey = 'bench') {
      const overlay = document.querySelector('#seaOverlay');
      if (!overlay) return;
      overlay.hidden = false;
      void overlay.offsetWidth;
      overlay.classList.add('is-active');

      const player = overlay.querySelector('#benchPlayer');
      const placeholder = overlay.querySelector('.sea-overlay__placeholder');
      const VS = window.Echo && window.Echo.VideoStage;
      if (!VS) return;

      // 动态填占位文案（按视频 key 取 placeholderTitle / placeholderBadge）
      const fillPlaceholder = (cfg) => {
        if (!placeholder || !cfg) return;
        const titleEl = placeholder.querySelector('.sea-overlay__placeholder-title');
        const badgeEl = placeholder.querySelector('.sea-overlay__placeholder-text .source-badge');
        if (titleEl && cfg.placeholderTitle) titleEl.textContent = cfg.placeholderTitle;
        if (badgeEl) {
          if (cfg.placeholderBadge) badgeEl.textContent = cfg.placeholderBadge;
          if (cfg.placeholderColor) {
            badgeEl.style.color = cfg.placeholderColor;
            badgeEl.style.borderColor = cfg.placeholderColor;
          }
        }
      };

      VS.checkAvailability(videoKey).then(() => {
        const ok = VS.isAvailable(videoKey);
        const chosenSrc = VS.getSrc(videoKey);
        const cfg = VS.config[videoKey];

        if (ok && player && chosenSrc) {
          fillPlaceholder(cfg);  // 先填文案，以防运行期兜底也失败
          if (placeholder) placeholder.hidden = true;
          player.hidden = false;
          // 切到确认可用的 src（CDN 命中或本地兜底）
          if (player.getAttribute('src') !== chosenSrc) {
            try { player.src = chosenSrc; } catch (_) {}
          }
          // 运行期兜底：HEAD 通过但 GET 失败时切本地
          const onLoadError = () => {
            const fallback = cfg && cfg.fallback;
            if (fallback && player.getAttribute('src') !== fallback) {
              console.warn(`[SeaScene] ${videoKey} src 加载失败，切本地兜底`);
              try { player.src = fallback; } catch (_) {}
              player.play().catch(() => {});
            }
          };
          player.addEventListener('error', onLoadError, { once: true });

          try {
            player.currentTime = 0;
            player.play();
          } catch (e) { console.warn('[SeaScene] overlay play failed:', e); }

          // 监听结束，显示"再看一次"按钮
          player.addEventListener('ended', () => {
            const replay = overlay.querySelector('.sea-overlay__replay');
            if (replay) replay.hidden = false;
          }, { once: true });
        } else {
          // 都不可用：填占位文案 + 显示
          fillPlaceholder(cfg);
          if (placeholder) placeholder.hidden = false;
          if (player) player.hidden = true;
        }
      });
    },

    /**
     * 关闭长椅叠加层
     */
    _closeOverlay() {
      const overlay = document.querySelector('#seaOverlay');
      if (!overlay) return;
      overlay.classList.remove('is-active');
      setTimeout(() => {
        overlay.hidden = true;
        const player = overlay.querySelector('#benchPlayer');
        if (player) { try { player.pause(); player.currentTime = 0; } catch (_) {} }
        const replay = overlay.querySelector('.sea-overlay__replay');
        if (replay) replay.hidden = true;
      }, 400);
    },

    /**
     * 打开文字弹层
     */
    _openPanel(id) {
      const panel = document.querySelector(`#${id}`);
      if (panel) panel.hidden = false;
    },

    /**
     * 检查是否所有热点都已找到
     */
    _checkComplete() {
      const allFound =
        this._hotspotState.bench &&
        this._hotspotState['items-cup'] &&
        this._hotspotState['items-ticket'] &&
        this._hotspotState.note;
      if (allFound) {
        const writeBtn = document.querySelector('#seaWriteBtn');
        if (writeBtn) writeBtn.hidden = false;
        const hint = document.querySelector('#seaHint');
        if (hint) hint.textContent = '四处回响都已浮现。';
      }
    },

    /**
     * 重置所有热点状态
     */
    _resetHotspots() {
      document.querySelectorAll('.sea__hotspot').forEach(c => c.classList.remove('is-found'));
      document.querySelectorAll('.sea__panel').forEach(p => p.hidden = true);
      const writeBtn = document.querySelector('#seaWriteBtn');
      if (writeBtn) writeBtn.hidden = true;
      const hint = document.querySelector('#seaHint');
      if (hint) hint.textContent = '在画面中寻找留下的位置。';
    },

    /**
     * 检测 Phase 4 特性（World Labs 场景）是否可用
     */
    hasFeature(feature) {
      if (feature === 'splat') return this._splatAvailable;
      return false;
    }
  };

})(window);
