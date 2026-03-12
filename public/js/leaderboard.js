// leaderboard.js - Top lobsters sidebar
const Leaderboard = {
  topList: [],
  visible: true,
  hoverIndex: -1,
  clickCallback: null, // set by game.js
  
  // Layout
  _x: 0, _y: 0, _w: 0, _h: 0, _itemH: 0,

  update(lobsters) {
    // Sort by tokens descending, take top 10
    this.topList = [...lobsters]
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10);
  },

  hitTest(mx, my) {
    if (!this.visible || this.topList.length === 0) return -1;
    if (mx < this._x || mx > this._x + this._w) return -1;
    if (my < this._y || my > this._y + this._h) return -1;
    const idx = Math.floor((my - this._y - 36) / this._itemH);
    if (idx >= 0 && idx < this.topList.length) return idx;
    return -1;
  },

  draw(ctx, w, h, mouseX, mouseY) {
    if (!this.visible || this.topList.length === 0) return;

    const scale = Math.min(1.5, Math.max(0.8, w / 1920));
    const panelW = Math.round(220 * scale);
    const itemH = Math.round(28 * scale);
    const headerH = Math.round(36 * scale);
    const padX = Math.round(12 * scale);
    const padY = Math.round(8 * scale);
    const panelH = headerH + this.topList.length * itemH + padY;
    const px = w - panelW - 16;
    const py = 100;

    // Store layout for hit testing
    this._x = px; this._y = py; this._w = panelW; this._h = panelH; this._itemH = itemH;

    // Check hover
    this.hoverIndex = this.hitTest(mouseX, mouseY);

    ctx.save();

    // Glass panel background
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = 'rgba(8, 18, 40, 0.75)';
    ctx.beginPath();
    ctx.roundRect(px, py, panelW, panelH, 12);
    ctx.fill();

    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px, py, panelW, panelH, 12);
    ctx.stroke();

    // Header
    ctx.globalAlpha = 0.8;
    ctx.font = `600 ${Math.round(15 * scale)}px 'Rajdhani', sans-serif`;
    ctx.fillStyle = '#64d8ff';
    ctx.textAlign = 'left';
    ctx.fillText('🏆 排行榜', px + padX, py + headerH - 10 * scale);

    // Divider
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#64d8ff';
    ctx.fillRect(px + padX, py + headerH - 2, panelW - padX * 2, 1);

    // Items
    const levelNames = ['虾米', '小虾', '中虾', '大虾', '虾王', '虾皇'];
    const levelColors = ['#888888', '#4CAF50', '#2196F3', '#9C27B0', '#F44336', '#FFD700'];
    const fontSize = Math.round(12 * scale);
    const numFontSize = Math.round(11 * scale);

    for (let i = 0; i < this.topList.length; i++) {
      const l = this.topList[i];
      const iy = py + headerH + i * itemH;
      const isHover = i === this.hoverIndex;

      // Hover highlight
      if (isHover) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#64d8ff';
        ctx.fillRect(px + 4, iy + 2, panelW - 8, itemH - 2);
      }

      // Rank number
      ctx.globalAlpha = isHover ? 0.95 : 0.7;
      ctx.font = `700 ${numFontSize}px 'Rajdhani', sans-serif`;
      
      if (i === 0) ctx.fillStyle = '#ffd700';
      else if (i === 1) ctx.fillStyle = '#c0c0c0';
      else if (i === 2) ctx.fillStyle = '#cd7f32';
      else ctx.fillStyle = 'rgba(160, 200, 240, 0.5)';
      
      ctx.fillText(`${i + 1}`, px + padX, iy + itemH - 8 * scale);

      // Level color dot
      ctx.fillStyle = levelColors[l.level] || '#888';
      ctx.beginPath();
      ctx.arc(px + padX + 18 * scale, iy + itemH - 12 * scale, 3 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Name (truncated)
      ctx.globalAlpha = isHover ? 0.95 : 0.75;
      ctx.font = `500 ${fontSize}px 'Rajdhani', sans-serif`;
      ctx.fillStyle = isHover ? '#e0f0ff' : '#b0d0f0';
      let name = l.name;
      const maxNameW = panelW * 0.45;
      while (ctx.measureText(name).width > maxNameW && name.length > 3) {
        name = name.slice(0, -2) + '…';
      }
      ctx.fillText(name, px + padX + 26 * scale, iy + itemH - 8 * scale);

      // Token count (right-aligned)
      ctx.globalAlpha = isHover ? 0.8 : 0.5;
      ctx.font = `400 ${numFontSize}px 'Rajdhani', sans-serif`;
      ctx.fillStyle = '#8ab4e8';
      ctx.textAlign = 'right';
      ctx.fillText(this._formatTokens(l.tokens), px + panelW - padX, iy + itemH - 8 * scale);
      ctx.textAlign = 'left';
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  },

  _formatTokens(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toString();
  }
};
