/* ============================================================
   回声之间 · 物品 3D 详情浮层
   - 桌面：左侧可旋转模型 + 右侧回忆面板
   - 移动：上下排列
   - Phase 1：SVG 占位 + CSS 旋转动画
   - Phase 3：替换为 <model-viewer> GLB 模型
   ============================================================ */

(function (root) {
  'use strict';
  root.Echo = root.Echo || {};

  // 物品 key → CDN URL（_compressed.glb 是 Draco 压缩版，~2-5x 小，model-viewer 自带 decoder）
  const MODEL_BASE_URL = 'https://ke1sfe0r0qdtrhdk.public.blob.vercel-storage.com';
  const MODEL_PATH = (key) => `${MODEL_BASE_URL}/${key}_compressed.glb`;

  root.Echo.ItemDetail = {
    _currentItem: null,
    _scrollPosition: { x: 0, y: 0 },

    /**
     * 打开物品详情浮层
     * @param {string} itemKey - 物品 key（painting/ticket/cup/letter）
     */
    async open(itemKey) {
      const detail = document.querySelector('#itemDetail');
      const itemArticle = document.querySelector(`#chapter-4 [data-item="${itemKey}"]`);
      if (!detail || !itemArticle) return;

      // 记录打开前滚动位置（用于关闭时恢复）
      this._scrollPosition = {
        x: window.scrollX || window.pageXOffset,
        y: window.scrollY || window.pageYOffset
      };
      this._currentItem = itemKey;

      // 填充数据：从物品 article 复制标题、描述、来源类型
      const titleEl = detail.querySelector('.item-detail__title');
      const textEl = detail.querySelector('.item-detail__text');
      const itemTitle = itemArticle.querySelector('.item__title');
      const itemText = itemArticle.querySelector('.item__text');
      const sourceType = itemArticle.dataset.sourceType;

      if (titleEl) titleEl.textContent = itemTitle ? itemTitle.textContent : '';
      if (textEl) textEl.innerHTML = itemText ? itemText.innerHTML : '';

      // 来源标签
      if (window.Echo && window.Echo.SourceLabels && sourceType) {
        window.Echo.SourceLabels.renderBadge(detail, sourceType);
      }

      // 加载模型
      // 优化：去掉 modelExists HEAD 探测（preload 已保证模型会被请求，
      //       HEAD 探测反而会消耗一次 round-trip，且和 preload 抢 method），
      //       直接注入 model-viewer，靠它的 load/error 事件切状态。
      const modelContainer = detail.querySelector('.item-detail__model');
      if (modelContainer) {
        modelContainer.innerHTML = `
          <div class="model-loading" data-model-loading>
            <div class="model-loading__spinner" data-model-spinner></div>
            <p class="model-loading__text" data-model-text>正在加载 3D 模型…</p>
            <p class="model-loading__progress" data-model-progress style="display:none;">
              <span class="model-loading__progress-bar"><span class="model-loading__progress-fill" data-model-progress-fill></span></span>
              <span class="model-loading__progress-pct" data-model-progress-pct>0%</span>
            </p>
            <p class="model-loading__hint">${itemKey}.glb · 首次加载约 5-10 秒 · 之后秒出</p>
          </div>
        `;

        // 下一帧再注入 model-viewer，确保 loading 先渲染
        requestAnimationFrame(() => {
          const mv = document.createElement('model-viewer');
          mv.className = 'item-detail__model-viewer';
          mv.setAttribute('src', MODEL_PATH(itemKey));
          mv.setAttribute('camera-controls', '');
          mv.setAttribute('auto-rotate', '');
          mv.setAttribute('auto-rotate-delay', '300');
          mv.setAttribute('rotation-per-second', '18deg');
          mv.setAttribute('shadow-intensity', '0.5');
          mv.setAttribute('alt', itemKey);
          // loading=eager：进 DOM 立刻下载（不靠视口触发）
          // reveal=auto：默认即可（不要 manual，否则 model-viewer 会卡在 poster 状态不加载）
          mv.setAttribute('loading', 'eager');
          // 默认先透明，加载完再淡入（避免模型贴图闪一下）
          mv.style.opacity = '0';
          mv.style.transition = 'opacity 0.6s ease';

          // 实时进度：model-viewer 在下载过程中会触发 progress 事件
          // detail = { total, loaded }（字节数）
          const progressEl = modelContainer.querySelector('[data-model-progress]');
          const progressFill = modelContainer.querySelector('[data-model-progress-fill]');
          const progressPct = modelContainer.querySelector('[data-model-progress-pct]');
          const progressText = modelContainer.querySelector('[data-model-text]');
          const spinner = modelContainer.querySelector('[data-model-spinner]');
          const onProgress = (e) => {
            const total = e.detail && e.detail.total;
            const loaded = e.detail && e.detail.loaded;
            if (total && loaded != null && total > 0) {
              const pct = Math.min(100, Math.round((loaded / total) * 100));
              if (progressEl) progressEl.style.display = '';
              if (progressFill) progressFill.style.width = pct + '%';
              if (progressPct) progressPct.textContent = pct + '%';
              // 大于 50% 时文案变「即将完成…」
              if (progressText && pct >= 50 && pct < 100) {
                progressText.textContent = '即将完成…';
              }
            }
          };
          mv.addEventListener('progress', onProgress);

          mv.addEventListener('load', () => {
            mv.style.opacity = '1';
            const loading = modelContainer.querySelector('[data-model-loading]');
            if (loading) loading.style.display = 'none';
            mv.removeEventListener('progress', onProgress);
          }, { once: true });

          mv.addEventListener('error', () => {
            // 模型加载失败（CDN 不可达 / 404），回退到 SVG 占位
            modelContainer.innerHTML = `
              <div class="model-placeholder">
                <img src="assets/images/item-${itemKey}.svg" alt="${itemKey}" class="model-placeholder__img">
                <p class="model-placeholder__hint">模型暂不可用 · 静态预览</p>
              </div>
            `;
            mv.removeEventListener('progress', onProgress);
          }, { once: true });

          modelContainer.appendChild(mv);
        });
      }

      // 阻止 body 滚动
      document.body.style.overflow = 'hidden';

      // 显示浮层（带动画）
      detail.hidden = false;
      void detail.offsetWidth; // 强制 reflow
      detail.classList.add('is-active');
    },

    /**
     * 关闭物品详情浮层
     */
    close() {
      const detail = document.querySelector('#itemDetail');
      if (!detail || detail.hidden) return;

      detail.classList.remove('is-active');
      // 动画结束后隐藏
      setTimeout(() => {
        detail.hidden = true;
        // 清空 model-viewer 释放 GPU
        const modelContainer = detail.querySelector('.item-detail__model');
        if (modelContainer) modelContainer.innerHTML = '';
        // 恢复滚动
        document.body.style.overflow = '';
        window.scrollTo(this._scrollPosition.x, this._scrollPosition.y);
      }, 400);
    },

    /**
     * 检查是否打开
     */
    isOpen() {
      const detail = document.querySelector('#itemDetail');
      return detail && !detail.hidden;
    }
  };

})(window);
