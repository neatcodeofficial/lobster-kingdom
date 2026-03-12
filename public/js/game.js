// game.js - Main game loop with adaptive sizing
// Base sizes for 1080p (1920x1080), will scale up for larger screens
// 3x larger than before
const BASE_LEVELS = [
  { name: '虾米', minTokens: 0, size: 90, color: '#888888' },
  { name: '小虾', minTokens: 5e5, size: 113, color: '#4CAF50' },
  { name: '中虾', minTokens: 2e6, size: 147, color: '#2196F3' },
  { name: '大虾', minTokens: 8e6, size: 180, color: '#9C27B0' },
  { name: '虾王', minTokens: 2.5e7, size: 225, color: '#F44336' },
  { name: '虾皇', minTokens: 6e7, size: 270, color: '#FFD700' }
];

const Game = {
  lobsters: [],
  allData: [],
  stats: null,
  zoneCounts: {},
  hoveredLobster: null,
  mouseX: 0,
  mouseY: 0,
  dots: [],
  sizeScale: 1,
  LEVELS: [],
  // FPS tracking
  fpsEnabled: false,
  fpsFrames: 0,
  fpsLastTime: 0,
  fpsValue: 0,
  // Token rate tracking
  tokenHistory: [],  // [{ts, total}]
  tokenRate: 0,      // tokens per minute

  getScreenScale() {
    // Scale based on screen area relative to 1080p baseline
    const baseArea = 1920 * 1080;
    const currentArea = window.innerWidth * window.innerHeight;
    const areaRatio = currentArea / baseArea;
    // Scale size by sqrt of area ratio (so 2x area = 1.41x size)
    return Math.sqrt(areaRatio);
  },

  updateLevels() {
    this.sizeScale = this.getScreenScale();
    this.LEVELS = BASE_LEVELS.map(lv => ({
      ...lv,
      size: Math.round(lv.size * this.sizeScale)
    }));
  },

  focusedLobster: null,
  focusTimer: 0,

  focusLobster(targetData) {
    // Find the lobster instance by id
    const found = this.lobsters.find(l => l.data.id === targetData.id);
    if (found) {
      this.focusedLobster = found;
      this.focusTimer = 180; // highlight for 3 seconds (60fps)
    }
  },

  async init() {
    const canvas = document.getElementById('game');
    Renderer.init(canvas);
    UI.init();
    ActivityLog.init();
    Leaderboard.clickCallback = (lobster) => this.focusLobster(lobster);
    await LobsterSprites.load();

    this.updateLevels();
    window.addEventListener('resize', () => {
      this.updateLevels();
      this.loadData();
    });

    // Fullscreen button
    const fsBtn = document.getElementById('fullscreen-btn');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => this.toggleFullscreen());
    }

    // FPS toggle
    const fpsBtn = document.getElementById('fps-toggle');
    if (fpsBtn) {
      fpsBtn.addEventListener('click', () => this.toggleFPS());
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (document.activeElement.tagName === 'INPUT') return;
      if (e.key === 'f' || e.key === 'F') this.toggleFullscreen();
      if (e.key === 'd' || e.key === 'D') this.toggleFPS();
    });

    canvas.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    
    // Touch support for mobile
    canvas.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      this.mouseX = touch.clientX;
      this.mouseY = touch.clientY;
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      this.mouseX = touch.clientX;
      this.mouseY = touch.clientY;
    }, { passive: true });
    canvas.addEventListener('touchend', (e) => {
      // Check for hovered lobster at touch position
      for (const l of this.lobsters) {
        if (l.hitTest(this.mouseX, this.mouseY)) {
          this.hoveredLobster = l;
          break;
        }
      }
      // Simulate click on touch end
      const lbIdx = Leaderboard.hitTest(this.mouseX, this.mouseY);
      if (lbIdx >= 0) {
        const target = Leaderboard.topList[lbIdx];
        if (target) this.focusLobster(target);
        return;
      }
      if (this.hoveredLobster) UI.showCard(this.hoveredLobster);
    });

    // Search functionality
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (q.length === 0) {
        searchResults.classList.add('hidden');
        return;
      }
      const matches = this.allData
        .filter(d => d.name.toLowerCase().includes(q))
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 8);
      
      if (matches.length === 0) {
        searchResults.innerHTML = '<div class="search-item" style="color:rgba(160,200,240,0.4)">没有找到</div>';
      } else {
        const levelColors = ['#888888', '#4CAF50', '#2196F3', '#9C27B0', '#F44336', '#FFD700'];
        searchResults.innerHTML = matches.map(m => 
          `<div class="search-item" data-id="${m.id}">` +
          `<span><span class="level-dot" style="background:${levelColors[m.level]}"></span>${m.name}</span>` +
          `<span class="tokens">${m.levelName} · ${this._formatTokens(m.tokens)}</span>` +
          `</div>`
        ).join('');
      }
      searchResults.classList.remove('hidden');
    });

    searchResults.addEventListener('click', (e) => {
      const item = e.target.closest('.search-item');
      if (!item || !item.dataset.id) return;
      const target = this.allData.find(d => d.id === item.dataset.id);
      if (target) {
        this.focusLobster(target);
        searchInput.value = '';
        searchResults.classList.add('hidden');
      }
    });

    searchInput.addEventListener('blur', () => {
      setTimeout(() => searchResults.classList.add('hidden'), 200);
    });
    canvas.addEventListener('click', () => {
      // Check leaderboard click first
      const lbIdx = Leaderboard.hitTest(this.mouseX, this.mouseY);
      if (lbIdx >= 0) {
        const target = Leaderboard.topList[lbIdx];
        if (target) this.focusLobster(target);
        return;
      }
      if (this.hoveredLobster) UI.showCard(this.hoveredLobster);
    });

    await this.loadData();
    
    // Hide loading screen
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.classList.add('fade-out');
      setTimeout(() => loadingEl.remove(), 600);
    }
    
    this.loop();
    setInterval(() => this.loadData(), 15000); // refresh every 15s
  },

  async loadData() {
    const data = await LobsterAPI.fetch();
    if (!data) return;
    this.stats = data.stats;
    this.allData = data.lobsters;

    // Detect changes for activity log
    ActivityLog.detectChanges(data.lobsters);
    
    // Track token rate
    if (data.stats && data.stats.totalTokens) {
      const now = Date.now();
      this.tokenHistory.push({ ts: now, total: data.stats.totalTokens });
      // Keep last 5 minutes of history
      while (this.tokenHistory.length > 0 && now - this.tokenHistory[0].ts > 300000) {
        this.tokenHistory.shift();
      }
      // Calculate rate (tokens per minute)
      if (this.tokenHistory.length >= 2) {
        const oldest = this.tokenHistory[0];
        const newest = this.tokenHistory[this.tokenHistory.length - 1];
        const elapsed = (newest.ts - oldest.ts) / 60000; // minutes
        if (elapsed > 0.1) {
          this.tokenRate = Math.round((newest.total - oldest.total) / elapsed);
        }
      }
    }
    
    // Update leaderboard
    Leaderboard.update(data.lobsters);

    this.zoneCounts = { working: 0, resting: 0, idle: 0 };
    for (const d of data.lobsters) this.zoneCounts[d.zone]++;

    const oldMap = {};
    for (const l of this.lobsters) oldMap[l.data.id] = l;

    const limits = Renderer.getMaxLobsters();
    const byZone = { working: [], resting: [], idle: [] };
    for (const d of data.lobsters) byZone[d.zone].push(d);

    for (const z of Object.keys(byZone)) {
      byZone[z].sort((a, b) => b.tokens - a.tokens);
    }

    this.lobsters = [];
    this.dots = [];

    for (const [zoneName, items] of Object.entries(byZone)) {
      const limit = limits[zoneName];
      const zone = Renderer.zones[zoneName];
      if (!zone) continue;

      const visible = items.slice(0, limit);
      for (const d of visible) {
        const lvInfo = this.LEVELS[d.level] || this.LEVELS[0];
        d.size = lvInfo.size;
        if (oldMap[d.id]) {
          const old = oldMap[d.id];
          old.data = d;
          old.size = d.size;
          if (old.zone !== zone) {
            old.zone = zone;
            const cx = zone.x + zone.w * 0.5;
            const cy = zone.y + zone.h * 0.5;
            const spreadX = zone.w * 0.35;
            const spreadY = zone.h * 0.35;
            old.x = cx + (Math.random() + Math.random() - 1) * spreadX;
            old.y = cy + (Math.random() + Math.random() - 1) * spreadY;
            old.x = Math.max(zone.x + 15, Math.min(zone.x + zone.w - 15, old.x));
            old.y = Math.max(zone.y + 24, Math.min(zone.y + zone.h - 10, old.y));
          }
          this.lobsters.push(old);
        } else {
          this.lobsters.push(new Lobster(d, zone));
        }
      }

      const hidden = items.slice(limit);
      for (const d of hidden) {
        this.dots.push({
          x: zone.x + Math.random() * zone.w,
          y: zone.y + Math.random() * zone.h,
          color: this.LEVELS[d.level]?.color || '#555',
          zone: zoneName
        });
      }
    }
  },

  resolveCollisions() {
    const byZone = {};
    for (const l of this.lobsters) {
      const z = l.data.zone;
      if (!byZone[z]) byZone[z] = [];
      byZone[z].push(l);
    }
    for (const group of Object.values(byZone)) {
      const n = group.length;
      for (let i = 0; i < n; i++) {
        const a = group[i];
        const sa = a.getDepthScale();
        const ra = a.size * sa * 0.45; // Increased collision radius (was 0.35)
        for (let j = i + 1; j < n; j++) {
          const b = group[j];
          const sb = b.getDepthScale();
          const rb = b.size * sb * 0.45; // Increased collision radius (was 0.35)
          const dy = Math.abs(b.y - a.y);
          const depthThreshold = (ra + rb) * 0.7; // Wider depth threshold (was 0.6)
          if (dy > depthThreshold) continue;
          const dx = b.x - a.x;
          const xDist = Math.abs(dx);
          const minXDist = ra + rb;
          if (xDist < minXDist && xDist > 0.1) {
            const overlap = (minXDist - xDist) * 0.4; // Stronger push (was 0.3)
            const dir = dx > 0 ? 1 : -1;
            a.x -= dir * overlap;
            b.x += dir * overlap;
            a.vx -= dir * 0.03;
            b.vx += dir * 0.03;
          }
        }
      }
    }
  },

  drawDots(ctx) {
    const t = Date.now() * 0.001;
    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];
      const scale = Renderer.getDepthScale(d.y);
      const alpha = (0.15 + Math.sin(t + i * 0.7) * 0.1) * scale;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = d.color;
      const sz = Math.max(1, 1.5 * scale * this.sizeScale);
      ctx.fillRect(d.x - sz / 2, d.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
  },

  drawZoneCounters(ctx) {
    for (const [zoneName, total] of Object.entries(this.zoneCounts)) {
      const limits = Renderer.getMaxLobsters();
      const limit = limits[zoneName];
      const hidden = total - Math.min(total, limit);
      if (hidden <= 0) continue;

      const zone = Renderer.zones[zoneName];
      if (!zone) continue;

      const depth = (zone.depthMin + zone.depthMax) / 2;
      const fontSize = (20 + depth * 6) * this.sizeScale;

      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#1a1a3a';
      const text = `+${hidden} 只在深处`;
      ctx.font = `${fontSize}px 'Rajdhani', sans-serif`;
      const tw = ctx.measureText(text).width;
      const bx = zone.x + zone.w - tw - 20;
      const by = zone.y + zone.h - 16;
      ctx.fillRect(bx - 6, by - fontSize, tw + 12, fontSize + 6);
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#8899bb';
      ctx.fillText(text, bx, by - 2);
      ctx.restore();
    }
  },

  _formatTokens(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toString();
  },

  loop() {
    Renderer.clear();
    Renderer.drawBackground();
    this.updateFPS();
    this.drawDots(Renderer.ctx);
    Renderer.drawZones(this.stats);
    Renderer.drawTitle(this.stats, this.tokenRate);

    for (const l of this.lobsters) l.update();
    this.resolveCollisions();
    Interactions.update(this.lobsters);
    // Sort by Y (depth) first, then by level (high-level lobsters drawn last = on top)
    this.lobsters.sort((a, b) => {
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) > 5) return yDiff; // Different depth layers
      return a.data.level - b.data.level; // Same depth: low level first, high level last
    });

    this.hoveredLobster = null;
    for (const l of this.lobsters) {
      l.hovered = l.hitTest(this.mouseX, this.mouseY);
      if (l.hovered) this.hoveredLobster = l;
      l.draw(Renderer.ctx);
    }

    this.drawZoneCounters(Renderer.ctx);
    Renderer.drawLegend(this.LEVELS);
    ActivityLog.draw(Renderer.ctx, Renderer.w, Renderer.h);
    Leaderboard.draw(Renderer.ctx, Renderer.w, Renderer.h, this.mouseX, this.mouseY);
    Interactions.draw(Renderer.ctx);

    // Focus highlight
    if (this.focusedLobster && this.focusTimer > 0) {
      this.focusTimer--;
      const fl = this.focusedLobster;
      const ctx = Renderer.ctx;
      const scale = fl.getDepthScale();
      const r = fl.size * scale * 0.6;
      const pulse = 0.5 + Math.sin(Date.now() * 0.008) * 0.5;
      
      ctx.save();
      ctx.globalAlpha = 0.3 + pulse * 0.3;
      ctx.strokeStyle = '#64d8ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Arrow pointing down to lobster
      ctx.globalAlpha = 0.6 + pulse * 0.3;
      ctx.fillStyle = '#64d8ff';
      const ay = fl.y - r - 10 - pulse * 5;
      ctx.beginPath();
      ctx.moveTo(fl.x, ay + 10);
      ctx.lineTo(fl.x - 6, ay);
      ctx.lineTo(fl.x + 6, ay);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (this.hoveredLobster) {
      UI.showTooltip(this.hoveredLobster, this.mouseX, this.mouseY);
      document.body.style.cursor = 'pointer';
    } else if (Leaderboard.hoverIndex >= 0) {
      UI.hideTooltip();
      document.body.style.cursor = 'pointer';
    } else {
      UI.hideTooltip();
      document.body.style.cursor = 'default';
    }

    requestAnimationFrame(() => this.loop());
  },

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => {
        console.warn('Fullscreen failed:', e);
      });
    } else {
      document.exitFullscreen();
    }
  },

  toggleFPS() {
    this.fpsEnabled = !this.fpsEnabled;
    const counter = document.getElementById('fps-counter');
    if (counter) {
      counter.classList.toggle('hidden', !this.fpsEnabled);
    }
  },

  updateFPS() {
    if (!this.fpsEnabled) return;
    this.fpsFrames++;
    const now = performance.now();
    if (now - this.fpsLastTime >= 1000) {
      this.fpsValue = Math.round(this.fpsFrames * 1000 / (now - this.fpsLastTime));
      this.fpsFrames = 0;
      this.fpsLastTime = now;
      const counter = document.getElementById('fps-counter');
      if (counter) {
        counter.textContent = `${this.fpsValue} FPS · ${this.lobsters.length} 🦞`;
      }
    }
  }
};

Game.init();
