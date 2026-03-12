// activity-log.js - Real-time activity feed
const ActivityLog = {
  entries: [],
  maxEntries: 100,
  displayEntries: 8,
  prevData: null, // previous lobster data for diff
  scrollOffset: 0,
  
  init() {
    this.entries = [];
    this.prevData = new Map();
  },

  // Compare new data with previous to detect changes
  detectChanges(lobsters) {
    if (this.prevData.size === 0) {
      // First load - just store data, generate a welcome message
      for (const l of lobsters) {
        this.prevData.set(l.id, { tokens: l.tokens, level: l.level, zone: l.zone, name: l.name, messages: l.messages });
      }
      this._add('🦞 龙虾王国上线！共 ' + lobsters.length + ' 只龙虾', 'system');
      return;
    }

    const levelNames = ['虾米', '小虾', '中虾', '大虾', '虾王', '虾皇'];

    for (const l of lobsters) {
      const prev = this.prevData.get(l.id);
      if (!prev) {
        // New lobster appeared
        this._add(`🆕 ${l.name} 加入了龙虾王国！`, 'join');
        this.prevData.set(l.id, { tokens: l.tokens, level: l.level, zone: l.zone, name: l.name, messages: l.messages });
        continue;
      }

      // Level up detection
      if (l.level > prev.level) {
        this._add(`🎉 ${l.name} 升级为 ${levelNames[l.level]}！`, 'levelup');
      }

      // Zone change detection
      if (l.zone !== prev.zone) {
        const zoneLabels = { working: '⚡工作区', resting: '💤休息区', idle: '🌙躺平区' };
        this._add(`${l.name} 移动到了 ${zoneLabels[l.zone]}`, 'move');
      }

      // Significant token consumption (>10K since last check)
      const tokenDiff = l.tokens - prev.tokens;
      if (tokenDiff > 10000) {
        this._add(`${l.name} 消耗了 ${this._formatTokens(tokenDiff)} token`, 'token');
      }

      // Update stored data
      this.prevData.set(l.id, { tokens: l.tokens, level: l.level, zone: l.zone, name: l.name, messages: l.messages });
    }
  },

  _add(text, type) {
    this.entries.unshift({
      text,
      type,
      time: Date.now(),
      alpha: 1
    });
    if (this.entries.length > this.maxEntries) {
      this.entries.pop();
    }
  },

  _formatTokens(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toString();
  },

  draw(ctx, w, h) {
    if (this.entries.length === 0) return;

    const scale = Math.min(1.5, Math.max(0.8, w / 1920));
    const fontSize = Math.round(13 * scale);
    const lineH = Math.round(20 * scale);
    const padX = 16 * scale;
    const padY = 8 * scale;
    const headerH = Math.round(24 * scale);
    const maxShow = this.displayEntries;
    const show = this.entries.slice(0, maxShow);

    // Position: bottom-left, above legend
    const boxH = headerH + show.length * lineH + padY * 2;
    const boxW = 360 * scale;
    const bx = 16;
    const by = h - 52 - boxH;

    ctx.save();

    // Glass background
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(8, 18, 40, 0.7)';
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 10);
    ctx.fill();
    
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 10);
    ctx.stroke();

    // Header
    ctx.globalAlpha = 0.8;
    ctx.font = `600 ${Math.round(14 * scale)}px 'Rajdhani', sans-serif`;
    ctx.fillStyle = '#64d8ff';
    ctx.fillText('📜 活动日志', bx + padX, by + headerH - 6);
    
    // Entry count
    ctx.font = `500 ${Math.round(12 * scale)}px 'Rajdhani', sans-serif`;
    ctx.fillStyle = 'rgba(160, 200, 240, 0.5)';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.entries.length}/${this.maxEntries}`, bx + boxW - padX, by + headerH - 6);
    ctx.textAlign = 'left';
    
    // Divider
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#64d8ff';
    ctx.fillRect(bx + padX, by + headerH, boxW - padX * 2, 1);

    // Entries
    ctx.font = `500 ${fontSize}px 'Rajdhani', sans-serif`;
    ctx.textAlign = 'left';

    for (let i = 0; i < show.length; i++) {
      const e = show[i];
      const age = (Date.now() - e.time) / 1000;
      // Fade out after 20 seconds
      const fadeAlpha = age < 20 ? 1 : Math.max(0.3, 1 - (age - 20) / 30);
      
      ctx.globalAlpha = fadeAlpha * (1 - i * 0.1);
      
      // Color by type
      switch (e.type) {
        case 'levelup': ctx.fillStyle = '#ffd700'; break;
        case 'join':    ctx.fillStyle = '#64ff64'; break;
        case 'move':    ctx.fillStyle = '#64d8ff'; break;
        case 'token':   ctx.fillStyle = '#ff8866'; break;
        case 'system':  ctx.fillStyle = '#b0b0d0'; break;
        default:        ctx.fillStyle = '#a0c0e0'; break;
      }

      const ey = by + headerH + padY + i * lineH + fontSize;
      
      // Truncate text if too long
      let text = e.text;
      while (ctx.measureText(text).width > boxW - padX * 2 && text.length > 10) {
        text = text.slice(0, -4) + '…';
      }
      
      ctx.fillText(text, bx + padX, ey);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
};
