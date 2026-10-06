/* ============================================================
   回声之间 · 来源标签系统
   4 类标签：原始档案 / 家人补充 / AI 推演 / 本次书写
   ============================================================ */

(function (root) {
  'use strict';
  root.Echo = root.Echo || {};

  root.Echo.SourceLabels = {
    // 4 类标签的配置
    types: {
      original: {
        cn: '原始档案',
        cnShort: '档案',
        color: '#8aaa9a',
        icon: '◇',
        desc: '案例设定中的原始档案——故事发生所需的虚构物件，与逝者本人无直接关系。'
      },
      family: {
        cn: '家人补充',
        cnShort: '家人',
        color: '#d8b07a',
        icon: '○',
        desc: '由陈默后期加入，标注了谁添加、添加的具体记忆。'
      },
      ai: {
        cn: 'AI 推演',
        cnShort: 'AI',
        color: '#8a9ac8',
        icon: '◈',
        desc: '基于原始档案 + 家人描述，由模型想象出的画面，并非历史事实。'
      },
      user: {
        cn: '本次书写',
        cnShort: '你的',
        color: '#c8a8e0',
        icon: '◐',
        desc: '来自当下访客的书写，独立于陈默家族档案，仅在本机保留。'
      }
    },

    /**
     * 获取指定类型的中文说明
     * @param {string} type - 类型 key (original/family/ai/user)
     * @returns {object|null}
     */
    describe(type) {
      return this.types[type] || null;
    },

    /**
     * 渲染一个标签徽章到目标元素
     * 目标元素需要有 .source-badge 子元素
     * @param {HTMLElement} targetEl - 包含 .source-badge 的容器
     * @param {string} type - 类型
     * @param {string} [variant] - 'short' 显示简短版
     */
    renderBadge(targetEl, type, variant) {
      const t = this.describe(type);
      if (!t || !targetEl) return;

      const badge = targetEl.querySelector('.source-badge');
      if (badge) {
        badge.dataset.sourceType = type;
        badge.textContent = variant === 'short' ? t.cnShort : t.cn;
        badge.style.color = t.color;
        badge.style.borderColor = t.color;
      }

      const note = targetEl.querySelector('.source-note');
      if (note) note.textContent = t.desc;
    },

    /**
     * 渲染 4 类标签的可视化卡片网格（用于案例导览）
     * @param {HTMLElement} containerEl - 容器元素
     */
    renderIntroCards(containerEl) {
      if (!containerEl) return;
      const html = Object.entries(this.types).map(([key, t]) => `
        <div class="source-card source-card--${key}" data-source-type="${key}">
          <span class="source-card__icon" style="color: ${t.color};">${t.icon}</span>
          <h3 class="source-card__title" style="color: ${t.color};">${t.cn}</h3>
          <p class="source-card__desc">${t.desc}</p>
        </div>
      `).join('');
      containerEl.innerHTML = html;
    }
  };

})(window);
