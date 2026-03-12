// ui.js - Tooltip and detail card (cyberpunk style)
const UI = {
  tooltip: null,
  card: null,
  cardName: null,
  cardInfo: null,
  cardCanvas: null,

  init() {
    this.tooltip = document.getElementById('tooltip');
    this.card = document.getElementById('detail-card');
    this.cardName = document.getElementById('card-name');
    this.cardInfo = document.getElementById('card-info');
    this.cardCanvas = document.getElementById('card-lobster');
    document.querySelector('.card-close').addEventListener('click', () => this.hideCard());
    this.card.addEventListener('click', (e) => {
      if (e.target === this.card) this.hideCard();
    });
    
    // Keyboard: Escape to close card, / to focus search
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideCard();
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.focus();
      }
    });
  },

  showTooltip(lobster, mx, my) {
    const d = lobster.data;
    const tokens = this._formatTokens(d.tokens);
    this.tooltip.innerHTML = `<b>${d.levelName} Lv${d.level + 1}</b>  ${d.name}<br>` +
      `Token: ${tokens}  ·  消息: ${d.messages}`;
    this.tooltip.classList.remove('hidden');
    // Position with screen boundary check
    const tx = Math.min(mx + 15, window.innerWidth - 400);
    const ty = Math.max(my - 10, 10);
    this.tooltip.style.left = tx + 'px';
    this.tooltip.style.top = ty + 'px';
  },

  hideTooltip() {
    this.tooltip.classList.add('hidden');
  },

  showCard(lobster) {
    const d = lobster.data;
    this.cardName.textContent = `${d.levelName} — ${d.name}`;
    const zoneNames = { working: '⚡ 工作中', resting: '💤 休息中', idle: '🌙 躺平中' };
    
    // Find rank
    const rank = Leaderboard.topList.findIndex(l => l.id === d.id);
    const rankText = rank >= 0 ? `#${rank + 1}` : '-';
    
    // Calculate upgrade progress
    const levels = typeof BASE_LEVELS !== 'undefined' ? BASE_LEVELS : [];
    const curLevel = d.level;
    const curMin = levels[curLevel] ? levels[curLevel].minTokens : 0;
    const nextLevel = levels[curLevel + 1];
    let progressHTML = '';
    
    if (nextLevel) {
      const needed = nextLevel.minTokens - curMin;
      const current = d.tokens - curMin;
      const pct = Math.min(100, Math.max(0, (current / needed) * 100));
      const nextName = nextLevel.name;
      progressHTML = 
        `<div class="progress-section">` +
        `<div class="progress-label">` +
        `<span>升级进度</span>` +
        `<span class="progress-text">${this._formatTokens(d.tokens)} / ${this._formatTokens(nextLevel.minTokens)}</span>` +
        `</div>` +
        `<div class="progress-bar">` +
        `<div class="progress-fill" style="width:${pct.toFixed(1)}%"></div>` +
        `</div>` +
        `<div class="progress-next">距离 <b>${nextName}</b> 还需 ${this._formatTokens(nextLevel.minTokens - d.tokens)}</div>` +
        `</div>`;
    } else {
      progressHTML = 
        `<div class="progress-section">` +
        `<div class="progress-label"><span>🏆 已满级</span></div>` +
        `<div class="progress-bar"><div class="progress-fill max" style="width:100%"></div></div>` +
        `</div>`;
    }

    this.cardInfo.innerHTML =
      `<span>排名:</span> ${rankText}<br>` +
      `<span>等级:</span> Lv${d.level + 1} ${d.levelName}<br>` +
      `<span>状态:</span> ${zoneNames[d.zone]}<br>` +
      `<span>Token消耗:</span> ${this._formatTokens(d.tokens)}<br>` +
      `<span>消息数:</span> ${d.messages}<br>` +
      `<span>最后活跃:</span> ${d.lastActive ? this._formatRelativeTime(d.lastActive) : '未知'}` +
      progressHTML;

    // Draw lobster preview on card canvas (200x200)
    const cardCtx = this.cardCanvas.getContext('2d');
    cardCtx.clearRect(0, 0, 200, 200);
    const preview = new Lobster(d, { x: 0, y: 0, w: 200, h: 200 });
    preview.x = 100;
    preview.y = 110;
    preview.facing = 1;
    // Override getDepthScale for preview (always full size)
    preview.getDepthScale = () => 0.8;
    preview.draw(cardCtx);

    this.card.classList.remove('hidden');
  },

  hideCard() {
    this.card.classList.add('hidden');
  },

  _formatTokens(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toString();
  },

  _formatRelativeTime(isoString) {
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diff = now - then;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    return new Date(isoString).toLocaleDateString('zh-CN');
  }
};
