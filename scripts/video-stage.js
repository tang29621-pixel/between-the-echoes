/* ============================================================
   回声之间 · 视频调度器
   统一管理 4 段视频（A/B/C + 长椅短片）
   ============================================================ */

(function (root) {
  'use strict';
  root.Echo = root.Echo || {};

  /**
   * 检查视频文件是否能加载（HEAD 请求）
   * 接受单个 URL 或 URL 列表（按顺序尝试，返回第一个可用的）
   * 返回可用 URL；都失败返回 null
   */
  async function videoExists(urlOrList) {
    const list = Array.isArray(urlOrList) ? urlOrList : [urlOrList];
    for (const url of list) {
      if (!url) continue;
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) return url;
      } catch (_) {}
    }
    return null;
  }

  root.Echo.VideoStage = {
    // 8 个视频源配置（含钩子、3 段短片、写信背景、长椅、海边纸条、彩蛋）
    // CDN 被暂停了（403），暂时全部走本地文件；本地已在 git 里，部署自带
    // src = 当前用；fallback = 备用（其实都是同一个本地路径）
    config: {
      hook:      { selector: '#videoHook',     src: 'assets/video/开头-27秒.mp4',     fallback: 'assets/video/开头-27秒.mp4',     contentEnd: 26.5, label: '前情' },
      shortA:    { selector: '#videoA',        src: 'assets/video/开箱-29.mp4',       fallback: 'assets/video/开箱-29.mp4',       contentEnd: 28.5, label: '《没有出发的星期日》' },
      shortB:    { selector: '#videoB',        src: 'assets/video/ai验算.mp4',        fallback: 'assets/video/ai验算.mp4',        contentEnd: 19.5, label: '《想象中的抵达》' },
      shortC:    { selector: '#videoC',        src: 'assets/video/空椅子.mp4',        fallback: 'assets/video/空椅子.mp4',        contentEnd: 2.5,  label: '《带你认识他》' },
      letterBg:  { selector: '#letterBgVideo', src: 'assets/video/空椅子.mp4',        fallback: 'assets/video/空椅子.mp4',        /* 写信背景循环，无结束卡 */ },
      bench:     { selector: '#benchPlayer',   src: 'assets/video/陈默的回信-14.mp4',  fallback: 'assets/video/陈默的回信-14.mp4',  contentEnd: 14,   label: '陈默的回信',
                   placeholderTitle: '长椅 · 爸，我到了', placeholderBadge: 'AI 推演', placeholderColor: '#8a9ac8' },
      seaNote:   { selector: '#benchPlayer',   src: 'assets/video/陈默与女儿.mp4',     fallback: 'assets/video/陈默与女儿.mp4',     contentEnd: 23,   label: '陈默与女儿',
                   placeholderTitle: '陈默与女儿',     placeholderBadge: '本地兜底', placeholderColor: '#c8a8e0' },
      easter:    { selector: '#easterPlayer',  src: 'assets/video/彩蛋.mp4',          fallback: 'assets/video/彩蛋.mp4',          contentEnd: 19.5, label: '彩蛋',
                   placeholderTitle: '彩蛋 · 父亲留下的另一段记录', placeholderBadge: '本地兜底', placeholderColor: '#c8a8e0' }
    },

    // 每个 key 实际可用的 src：CDN 命中 → CDN URL；CDN 不通 → fallback URL；都不通 → null
    _chosenSrc: {},

    // 音频是否已被用户解锁（任意点击触发，由 installAudioUnlock 设置）
    _audioUnlocked: false,

    /**
     * 预检查所有视频可用性（在页面加载时调用，避免运行时 HEAD 延迟）
     */
    async preflight() {
      const checks = Object.keys(this.config).map(async (key) => {
        await this.checkAvailability(key);
      });
      await Promise.all(checks);
      // 简化输出：只显示 boolean + 命中 CDN / 本地
      const summary = {};
      Object.keys(this._chosenSrc).forEach(k => {
        const url = this._chosenSrc[k];
        summary[k] = url ? (url.startsWith('http') ? 'cdn' : 'local') : false;
      });
      console.log('[VideoStage] preflight complete:', summary);
    },

    /**
     * 异步检查某段视频是否可用（CDN 优先，不通则本地）
     * 已检查过的直接返回缓存
     */
    async checkAvailability(key) {
      if (this._chosenSrc[key] !== undefined) {
        return this._chosenSrc[key] !== null;
      }
      const cfg = this.config[key];
      if (!cfg) return false;
      const candidates = [cfg.src, cfg.fallback].filter(Boolean);
      const workingUrl = await videoExists(candidates);
      this._chosenSrc[key] = workingUrl;
      return workingUrl !== null;
    },

    /**
     * 同步获取某段视频的可用性（仅在 checkAvailability 之后）
     */
    isAvailable(key) {
      return this._chosenSrc[key] != null;
    },

    /**
     * 获取某段视频实际可用的 src（CDN 命中或本地兜底）
     * 没有可用 src 时返回 null
     */
    getSrc(key) {
      if (this._chosenSrc[key]) return this._chosenSrc[key];
      const cfg = this.config[key];
      return (cfg && cfg.src) || null;
    },

    /**
     * 播放某段视频
     * - 如果视频文件存在（CDN 或本地）：正常播放
     * - 如果都不存在：显示占位卡 + 跳过按钮
     * - 运行期：HEAD 通过但 GET 失败时自动切到本地兜底
     */
    async play(key) {
      const cfg = this.config[key];
      if (!cfg) return;

      // preflight 已经跑过则同步拿到，否则 await 一次
      if (this._chosenSrc[key] === undefined) {
        await this.checkAvailability(key);
      }
      const src = this.getSrc(key);
      const available = !!src;
      const player = document.querySelector(cfg.selector);
      const endBox = this._findEndBox(key);

      if (!available) {
        // 显示占位卡
        this._showPlaceholder(key, endBox);
        return;
      }

      // 视频可用，正常播放
      this._hidePlaceholder(key, endBox);
      if (player) {
        // 切到确认可用的 src（CDN 命中或本地兜底）
        if (player.getAttribute('src') !== src) {
          try { player.src = src; } catch (_) {}
        }

        // 运行期兜底：HEAD 通过但 GET 失败（CDN 突然 404 / 网络抖动）时切本地
        const onLoadError = () => {
          const fallback = cfg.fallback;
          if (fallback && player.getAttribute('src') !== fallback) {
            console.warn(`[VideoStage] ${key} src 加载失败，切本地兜底：${fallback}`);
            try { player.src = fallback; } catch (_) {}
            player.play().catch(() => {});
          }
        };
        player.addEventListener('error', onLoadError, { once: true });

        // 只有在视频不在播放时（end 已显示或暂停）才重置 currentTime
        // 避免 HEAD 延迟回包后把用户正在看的视频重置回 0
        const endBoxActive = endBox && endBox.classList.contains('is-active');
        const wasPlaying = !player.paused && player.currentTime > 0;
        if (!wasPlaying && !endBoxActive) {
          try { player.currentTime = 0; } catch (_) {}
        }

        // 视频开始播放：延迟 1.2s 再 duckBGM（让用户先听到 BGM）
        // 这样用户点击章节进入按钮后，会先听到 1.2 秒的背景音乐，再淡出
        if (window.Echo && typeof window.Echo.duckBGM === 'function') {
          setTimeout(() => {
            // 再次检查：如果视频已经结束/跳过了，不要再 duck
            if (!player.ended && !player.paused) {
              window.Echo.duckBGM();
            }
          }, 1200);
        }

        try {
          // 音频解锁后再尝试有声（installAudioUnlock 会设置 _audioUnlocked）
          player.muted = !!this._audioUnlocked ? false : true;
          await player.play();
          // 播放成功：自动隐藏播放层（caption + badge 也一起淡出）
          const wrap = player.closest('.video__wrap');
          const overlay = wrap ? wrap.querySelector('.video__overlay') : null;
          if (overlay) overlay.classList.add('is-hidden');
        } catch (err) {
          // 浏览器拒绝 unmute autoplay 时降级为静音播放
          console.warn(`[VideoStage] ${key} unmute play failed, fallback to muted:`, err && err.name);
          try {
            player.muted = true;
            await player.play();
            const wrap = player.closest('.video__wrap');
            const overlay = wrap ? wrap.querySelector('.video__overlay') : null;
            if (overlay) overlay.classList.add('is-hidden');
          } catch (e) {
            console.warn(`[VideoStage] ${key} muted play also failed:`, e);
          }
        }

        // 兜底：如果内容时长比 contentEnd 还短（比如视频不到 122s），
        // 就靠 ended 事件显示结束卡
        let endShown = endBoxActive; // 如果已经显示过了就不重复触发
        const showEndOnce = () => {
          if (endShown) return;
          endShown = true;
          try { player.pause(); } catch (_) {}
          this.showEnd(key);
          player.removeEventListener('timeupdate', onTimeUpdate);
          // 视频结束：BGM 恢复
          if (window.Echo && typeof window.Echo.resumeBGM === 'function') {
            window.Echo.resumeBGM();
          }
        };

        // 监听 timeupdate，跳过片尾黑场
        const onTimeUpdate = () => {
          if (player.currentTime >= cfg.contentEnd) {
            showEndOnce();
          }
        };
        player.addEventListener('timeupdate', onTimeUpdate);

        // 监听 ended（视频自然结束时）
        player.addEventListener('ended', showEndOnce, { once: true });
      }
    },

    /**
     * 循环播放某段视频（用于背景视频，不挂结束监听器）
     * - 调用前请确保 video 元素已设置了 muted loop 属性
     * - 失败时降级为 muted 重试
     */
    async playLoop(key) {
      const cfg = this.config[key];
      if (!cfg) return;
      if (this._chosenSrc[key] === undefined) {
        await this.checkAvailability(key);
      }
      const src = this.getSrc(key);
      if (!src) {
        console.log(`[VideoStage] ${key}: video unavailable, loop skipped`);
        return;
      }
      const player = document.querySelector(cfg.selector);
      if (!player) return;
      // 切到确认可用的 src
      if (player.getAttribute('src') !== src) {
        try { player.src = src; } catch (_) {}
      }
      // 运行期兜底
      const onLoadError = () => {
        const fallback = cfg.fallback;
        if (fallback && player.getAttribute('src') !== fallback) {
          console.warn(`[VideoStage] ${key} loop src 失败，切本地兜底`);
          try { player.src = fallback; } catch (_) {}
          player.play().catch(() => {});
        }
      };
      player.addEventListener('error', onLoadError, { once: true });
      try {
        player.currentTime = 0;
        await player.play();
      } catch (err) {
        console.warn(`[VideoStage] ${key} loop play failed:`, err);
        try { await player.play(); } catch (_) {}
      }
    },

    /**
     * 暂停某段视频（用于离开背景视频章节时）
     */
    pauseLoop(key) {
      const cfg = this.config[key];
      if (!cfg) return;
      const player = document.querySelector(cfg.selector);
      if (player) {
        try { player.pause(); } catch (_) {}
      }
    },

    /**
     * 查找视频章节对应的结束卡 DOM
     */
    _findEndBox(key) {
      const chapterMap = {
        hook:    '#chapter-hook',
        shortA:  '#chapter-3',
        shortB:  '#chapter-6',
        shortC:  '#chapter-8',
        bench:   '#seaOverlay',
        seaNote: '#seaOverlay',
        easter:  '#easterOverlay'
      };
      const scope = document.querySelector(chapterMap[key]);
      return scope ? scope.querySelector('.video__end, .sea-overlay__end, .easter-overlay__end') : null;
    },

    /**
     * 显示占位卡（视频不可用时）
     */
    _showPlaceholder(key, endBox) {
      if (!endBox) return;
      endBox.classList.add('is-active');
      endBox.dataset.videoKey = key;
      console.log(`[VideoStage] ${key}: video unavailable, showing placeholder`);
    },

    /**
     * 隐藏占位卡
     */
    _hidePlaceholder(key, endBox) {
      if (!endBox) return;
      endBox.classList.remove('is-active');
    },

    /**
     * 显示结束卡
     */
    showEnd(key) {
      const endBox = this._findEndBox(key);
      if (endBox) endBox.classList.add('is-active');
    },

    /**
     * 隐藏结束卡
     */
    hideEnd(key) {
      const endBox = this._findEndBox(key);
      if (endBox) endBox.classList.remove('is-active');
    },

    /**
     * 停止所有视频并重置
     */
    stopAll() {
      Object.values(this.config).forEach(cfg => {
        const player = document.querySelector(cfg.selector);
        if (player) {
          try {
            player.pause();
            player.currentTime = 0;
          } catch (_) {}
        }
      });
    },

    /**
     * 重置某段视频并隐藏其结束卡
     */
    reset(key) {
      const cfg = this.config[key];
      if (!cfg) return;
      const player = document.querySelector(cfg.selector);
      if (player) {
        try { player.pause(); player.currentTime = 0; } catch (_) {}
      }
      this.hideEnd(key);
    }
  };

})(window);
