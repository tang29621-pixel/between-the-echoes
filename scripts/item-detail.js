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

  /**
   * 检查 GLB 模型文件是否存在
   */
  async function modelExists(name) {
    try {
      const res = await fetch(`https://ke1sfe0r0qdtrhdk.public.blob.vercel-storage.com/${name}.glb`, { method: 'HEAD' });
      return res.ok;
    } catch (_) {
      return false;
    }
  }

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

      // 加载模型（或占位）
      const modelContainer = detail.querySelector('.item-detail__model');
      if (modelContainer) {
        const hasGLB = await modelExists(itemKey);
        if (hasGLB) {
          // Phase 3 路径：model-viewer
          // 启用 auto-rotate 让模型在用户不操作时持续自转
          // （model-viewer 在用户拖动时会暂停旋转，松手后 300ms 自动恢复）
          modelContainer.innerHTML = `
            <model-viewer src="https://ke1sfe0r0qdtrhdk.public.blob.vercel-storage.com/${itemKey}.glb"
                          camera-controls
                          auto-rotate
                          auto-rotate-delay="300"
                          rotation-per-second="18deg"
                          shadow-intensity="0.5"
                          alt="${itemKey}"></model-viewer>
          `;
        } else {
          // Phase 1 占位：SVG + 旋转动画
          modelContainer.innerHTML = `
            <div class="model-placeholder">
              <img src="assets/images/item-${itemKey}.svg" alt="${itemKey}" class="model-placeholder__img">
              <p class="model-placeholder__hint">静态预览 · 视频待接入</p>
            </div>
          `;
        }
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
