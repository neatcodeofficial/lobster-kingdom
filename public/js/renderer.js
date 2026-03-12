// renderer.js - Deep Ocean Aquarium + Soft Cyberpunk

// roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'number') r = [r, r, r, r];
    const [tl, tr, br, bl] = r;
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tr);
    this.lineTo(x + w, y + h - br);
    this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    this.lineTo(x + bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - bl);
    this.lineTo(x, y + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    this.closePath();
    return this;
  };
}

const Renderer = {
  canvas: null, ctx: null, zones: {}, t: 0,
  bubbles: [], stars: [], caustics: [], jellyfish: [], plankton: [],

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this._initDecor();
    window.addEventListener('resize', () => { this.resize(); this._initDecor(); });
  },

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this._calcZones();
  },

  _calcZones() {
    const w = this.w, h = this.h;
    const top = 90, bottom = 50;
    const usable = h - top - bottom;
    const idleH = usable * 0.32, restH = usable * 0.33, workH = usable * 0.35;
    const pad = 10;
    this.zones = {
      idle:    { x: pad, y: top, w: w - pad * 2, h: idleH, label: '躺平区', depthMin: 0, depthMax: 0.32 },
      resting: { x: pad, y: top + idleH, w: w - pad * 2, h: restH, label: '休息区', depthMin: 0.32, depthMax: 0.65 },
      working: { x: pad, y: top + idleH + restH, w: w - pad * 2, h: workH, label: '工作区', depthMin: 0.65, depthMax: 1 }
    };
  },

  getMaxLobsters() {
    const area = this.w * this.h;
    const base = area / 8000;
    return { working: 999, resting: Math.min(40, Math.round(base * 0.3)), idle: Math.min(25, Math.round(base * 0.15)) };
  },

  getDepthScale(y) {
    const top = 90, bottom = 50;
    const t = Math.max(0, Math.min(1, (y - top) / (this.h - top - bottom)));
    return 0.3 + t * 0.9;
  },

  _initDecor() {
    const w = this.w, h = this.h;
    
    // Floating bubbles (sparse, elegant)
    this.bubbles = [];
    for (let i = 0; i < 35; i++) {
      this.bubbles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1 + Math.random() * 4,
        speed: 0.15 + Math.random() * 0.4,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.01 + Math.random() * 0.02,
        alpha: 0.08 + Math.random() * 0.15
      });
    }

    // Background stars (very subtle, deep space feel)
    this.stars = [];
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.5,
        r: Math.random() * 1.2,
        twinkle: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.04
      });
    }

    // Caustic light patterns (underwater light refraction)
    this.caustics = [];
    for (let i = 0; i < 6; i++) {
      this.caustics.push({
        x: Math.random() * w,
        phase: Math.random() * Math.PI * 2,
        width: 80 + Math.random() * 200,
        speed: 0.003 + Math.random() * 0.005
      });
    }

    // Tiny plankton (bioluminescent dots)
    this.plankton = [];
    for (let i = 0; i < 50; i++) {
      this.plankton.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.1,
        r: 0.5 + Math.random() * 1.5,
        hue: 180 + Math.random() * 40, // cyan-blue range
        pulse: Math.random() * Math.PI * 2,
        alpha: 0.15 + Math.random() * 0.25
      });
    }
  },

  drawBackground() {
    const ctx = this.ctx, w = this.w, h = this.h;
    this.t += 0.012;
    const t = this.t;

    // Time-based color shift (real clock)
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    const timeColors = this._getTimeColors(hour);

    // Deep ocean gradient with time-based colors
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, timeColors.top);
    grad.addColorStop(0.15, timeColors.mid1);
    grad.addColorStop(0.4, timeColors.mid2);
    grad.addColorStop(0.65, timeColors.mid3);
    grad.addColorStop(0.85, timeColors.bottom1);
    grad.addColorStop(1, timeColors.bottom2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle radial light from top center (time-based color)
    const lightGrad = ctx.createRadialGradient(w * 0.5, -50, 0, w * 0.5, h * 0.4, h * 0.7);
    const lightColor = timeColors.light || '#2860a0';
    lightGrad.addColorStop(0, lightColor + '20');
    lightGrad.addColorStop(0.5, lightColor + '0d');
    lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = lightGrad;
    ctx.fillRect(0, 0, w, h);

    // Stars (very subtle)
    for (const s of this.stars) {
      s.twinkle += s.speed;
      const alpha = 0.15 + Math.sin(s.twinkle) * 0.12;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#8ab4e8';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Caustic light rays (soft, animated)
    this._drawCaustics(ctx, w, h, t);

    // Bioluminescent plankton
    this._drawPlankton(ctx, w, h, t);

    // Floating bubbles
    this._drawBubbles(ctx, w, h, t);

    // Soft depth fog layers
    this._drawDepthFog(ctx, w, h, t);

    // Subtle ocean floor
    this._drawOceanFloor(ctx, w, h, t);

    // Soft vignette
    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.35, w * 0.5, h * 0.5, h * 0.85);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(2, 5, 15, 0.35)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  },

  _drawCaustics(ctx, w, h, t) {
    ctx.save();
    for (const c of this.caustics) {
      c.phase += c.speed;
      const cx = c.x + Math.sin(c.phase) * 60;
      const alpha = 0.025 + Math.sin(c.phase * 1.5) * 0.015;
      
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#4a9eff';
      
      // Soft light column
      ctx.beginPath();
      ctx.moveTo(cx - c.width * 0.1, 0);
      ctx.lineTo(cx + c.width * 0.1, 0);
      ctx.lineTo(cx + c.width * 0.5, h * 0.7);
      ctx.lineTo(cx - c.width * 0.5, h * 0.7);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  _drawPlankton(ctx, w, h, t) {
    ctx.save();
    for (const p of this.plankton) {
      p.x += p.vx;
      p.y += p.vy;
      p.pulse += 0.03;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      const alpha = p.alpha * (0.6 + Math.sin(p.pulse) * 0.4);
      ctx.globalAlpha = alpha;
      
      // Soft glow
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      glow.addColorStop(0, `hsla(${p.hue}, 80%, 70%, 0.6)`);
      glow.addColorStop(1, `hsla(${p.hue}, 80%, 70%, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Core dot
      ctx.fillStyle = `hsla(${p.hue}, 80%, 85%, 0.9)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  _drawBubbles(ctx, w, h, t) {
    ctx.save();
    for (const b of this.bubbles) {
      b.y -= b.speed;
      b.wobble += b.wobbleSpeed;
      b.x += Math.sin(b.wobble) * 0.3;
      
      if (b.y < -20) {
        b.y = h + 20;
        b.x = Math.random() * w;
      }

      ctx.globalAlpha = b.alpha;
      
      // Bubble body
      ctx.strokeStyle = 'rgba(150, 210, 255, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      
      // Highlight
      ctx.fillStyle = 'rgba(200, 230, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  _drawDepthFog(ctx, w, h, t) {
    // Subtle horizontal fog layers for depth
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const fogY = h * (0.3 + i * 0.2) + Math.sin(t * 0.5 + i) * 10;
      const fogGrad = ctx.createLinearGradient(0, fogY - 30, 0, fogY + 30);
      fogGrad.addColorStop(0, 'rgba(15, 30, 60, 0)');
      fogGrad.addColorStop(0.5, `rgba(15, 30, 60, ${0.06 + i * 0.02})`);
      fogGrad.addColorStop(1, 'rgba(15, 30, 60, 0)');
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, fogY - 30, w, 60);
    }
    ctx.restore();
  },

  _drawOceanFloor(ctx, w, h, t) {
    const floorY = h - 45;
    
    // Soft gradient floor
    const floorGrad = ctx.createLinearGradient(0, floorY - 20, 0, h);
    floorGrad.addColorStop(0, 'rgba(15, 10, 30, 0)');
    floorGrad.addColorStop(0.3, 'rgba(15, 10, 30, 0.3)');
    floorGrad.addColorStop(1, 'rgba(10, 5, 25, 0.6)');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY - 20, w, h - floorY + 20);

    // Subtle bioluminescent spots on floor
    ctx.save();
    for (let i = 0; i < 8; i++) {
      const fx = (w / 9) * (i + 0.5) + Math.sin(t * 0.3 + i * 2) * 15;
      const fy = floorY + 5 + Math.sin(t * 0.5 + i) * 3;
      const pulse = 0.4 + Math.sin(t * 0.8 + i * 1.5) * 0.2;
      
      const spotGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, 25);
      const hue = 180 + (i % 3) * 30; // cyan, blue, purple
      spotGrad.addColorStop(0, `hsla(${hue}, 70%, 50%, ${0.12 * pulse})`);
      spotGrad.addColorStop(1, `hsla(${hue}, 70%, 50%, 0)`);
      ctx.fillStyle = spotGrad;
      ctx.beginPath();
      ctx.arc(fx, fy, 25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  drawZones(stats) {
    const ctx = this.ctx, t = this.t;
    
    // Responsive scaling based on screen width
    const scale = Math.min(1.5, Math.max(0.8, this.w / 1920));
    
    for (const [key, z] of Object.entries(this.zones)) {
      const hue = key === 'working' ? 160 : key === 'resting' ? 210 : 260;
      const count = stats ? stats[key] || 0 : 0;
      const icons = { working: '⚡', resting: '💤', idle: '🌙' };

      ctx.save();
      
      // Soft zone divider line
      const lineAlpha = 0.12 + Math.sin(t * 2) * 0.03;
      const lineGrad = ctx.createLinearGradient(z.x + 40, z.y, z.x + z.w - 40, z.y);
      lineGrad.addColorStop(0, `hsla(${hue}, 60%, 60%, 0)`);
      lineGrad.addColorStop(0.2, `hsla(${hue}, 60%, 60%, ${lineAlpha})`);
      lineGrad.addColorStop(0.8, `hsla(${hue}, 60%, 60%, ${lineAlpha})`);
      lineGrad.addColorStop(1, `hsla(${hue}, 60%, 60%, 0)`);
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(z.x + 40, z.y + 2);
      ctx.lineTo(z.x + z.w - 40, z.y + 2);
      ctx.stroke();

      // Zone label + count in one line
      const depth = (z.depthMin + z.depthMax) / 2;
      const fontSize = Math.round((22 + depth * 6) * scale);
      const label = count > 0
        ? `${icons[key]}  ${z.label}  ·  ${count}`
        : `${icons[key]}  ${z.label}`;
      
      ctx.font = `600 ${fontSize}px 'Rajdhani', sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillStyle = `hsla(${hue}, 50%, 75%, ${0.5 + depth * 0.35})`;
      ctx.fillText(label, z.x + 20, z.y + 24);

      ctx.restore();
    }
  },

  drawTitle(stats, tokenRate) {
    const ctx = this.ctx, t = this.t;
    const cx = this.w / 2;
    
    // Responsive scaling based on screen width
    const scale = Math.min(1.5, Math.max(0.8, this.w / 1920));

    ctx.save();

    // Title background (glass panel) - scaled
    const panelW = 480 * scale, panelH = 90 * scale;
    const px = cx - panelW / 2, py = 10;
    
    ctx.fillStyle = 'rgba(8, 18, 40, 0.5)';
    ctx.beginPath();
    ctx.roundRect(px, py, panelW, panelH, 16 * scale);
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(80, 160, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px, py, panelW, panelH, 16 * scale);
    ctx.stroke();

    // Title text - much larger and scaled
    ctx.font = `bold ${Math.round(42 * scale)}px 'Orbitron', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e0f0ff';
    ctx.fillText('🦞 龙虾王国', cx, py + 44 * scale);

    // Stats line - larger and scaled
    if (stats) {
      ctx.font = `500 ${Math.round(18 * scale)}px 'Rajdhani', sans-serif`;
      ctx.fillStyle = 'rgba(160, 210, 255, 0.7)';
      ctx.fillText(
        `总计 ${stats.total}  ·  ⚡ ${stats.working}  ·  💤 ${stats.resting}  ·  🌙 ${stats.idle}`,
        cx, py + 72 * scale
      );
    }

    // Connection status indicator
    if (typeof LobsterAPI !== 'undefined' && LobsterAPI.failCount > 2) {
      ctx.textAlign = 'center';
      ctx.font = `500 ${Math.round(12 * scale)}px 'Rajdhani', sans-serif`;
      ctx.fillStyle = 'rgba(255, 100, 100, 0.7)';
      ctx.fillText('⚠ 连接中断，使用缓存数据', cx, py + panelH + 16);
    }

    // Total token consumption
    if (stats && stats.totalTokens) {
      ctx.textAlign = 'center';
      ctx.font = `400 ${Math.round(13 * scale)}px 'Rajdhani', sans-serif`;
      ctx.fillStyle = 'rgba(140, 190, 240, 0.45)';
      const totalTokens = stats.totalTokens >= 1e9 
        ? (stats.totalTokens / 1e9).toFixed(1) + 'B' 
        : stats.totalTokens >= 1e6 
          ? (stats.totalTokens / 1e6).toFixed(1) + 'M' 
          : (stats.totalTokens / 1e3).toFixed(0) + 'K';
      ctx.fillText(`总消耗 ${totalTokens} tokens`, cx, py + panelH + 14);
      
      // Token rate indicator
      if (tokenRate && tokenRate > 0) {
        const rateStr = tokenRate >= 1e6 ? (tokenRate / 1e6).toFixed(1) + 'M'
          : tokenRate >= 1e3 ? (tokenRate / 1e3).toFixed(1) + 'K'
          : tokenRate.toString();
        ctx.fillStyle = 'rgba(255, 180, 100, 0.5)';
        ctx.fillText(`⚡ ${rateStr}/min`, cx, py + panelH + 30);
      }
    }

    ctx.textAlign = 'left';
    ctx.restore();
  },

  drawLegend(levels) {
    const ctx = this.ctx;
    const scale = Math.min(1.5, Math.max(0.8, this.w / 1920));
    const y = this.h - 20;
    const itemW = Math.round(100 * scale);
    const totalW = levels.length * itemW;
    const startX = (this.w - totalW) / 2;

    ctx.save();
    
    // Legend background
    const bgW = totalW + 24;
    ctx.fillStyle = 'rgba(8, 18, 40, 0.5)';
    ctx.beginPath();
    ctx.roundRect(startX - 12, y - 22, bgW, 36, 10);
    ctx.fill();

    const fontSize = Math.round(15 * scale);
    ctx.font = `500 ${fontSize}px 'Rajdhani', sans-serif`;
    for (let i = 0; i < levels.length; i++) {
      const lx = startX + i * itemW;
      
      // Color dot
      ctx.fillStyle = levels[i].color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(lx + 8, y - 4, 6 * scale, 0, Math.PI * 2);
      ctx.fill();
      
      // Label
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#c0d8f0';
      ctx.fillText(levels[i].name, lx + 18 * scale, y + 2);
    }
    
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  _getTimeColors(hour) {
    // Smooth interpolation between time periods
    // Night: 22-5, Dawn: 5-7, Day: 7-17, Sunset: 17-19, Dusk: 19-22
    const lerp = (a, b, t) => {
      const ra = parseInt(a.slice(1,3),16), ga = parseInt(a.slice(3,5),16), ba = parseInt(a.slice(5,7),16);
      const rb = parseInt(b.slice(1,3),16), gb = parseInt(b.slice(3,5),16), bb = parseInt(b.slice(5,7),16);
      const r = Math.round(ra + (rb - ra) * t);
      const g = Math.round(ga + (gb - ga) * t);
      const b2 = Math.round(ba + (bb - ba) * t);
      return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b2.toString(16).padStart(2,'0')}`;
    };
    const lerpSet = (a, b, t) => ({
      top: lerp(a.top, b.top, t), mid1: lerp(a.mid1, b.mid1, t),
      mid2: lerp(a.mid2, b.mid2, t), mid3: lerp(a.mid3, b.mid3, t),
      bottom1: lerp(a.bottom1, b.bottom1, t), bottom2: lerp(a.bottom2, b.bottom2, t),
      light: lerp(a.light, b.light, t)
    });

    const night  = { top:'#060e1a', mid1:'#081428', mid2:'#0a1a30', mid3:'#0c1628', bottom1:'#140e28', bottom2:'#100820', light:'#1a3060' };
    const dawn   = { top:'#1a1830', mid1:'#2a1838', mid2:'#1a2040', mid3:'#152038', bottom1:'#1a1530', bottom2:'#150d28', light:'#4a3060' };
    const day    = { top:'#0a1628', mid1:'#0d1f3c', mid2:'#0f2847', mid3:'#122040', bottom1:'#1a1535', bottom2:'#150d2e', light:'#2860a0' };
    const sunset = { top:'#1a1020', mid1:'#281830', mid2:'#1a1838', mid3:'#141530', bottom1:'#180e28', bottom2:'#120a22', light:'#603040' };

    if (hour >= 22 || hour < 5) return night;
    if (hour >= 5 && hour < 7) { const t = (hour - 5) / 2; return lerpSet(night, dawn, t); }
    if (hour >= 7 && hour < 9) { const t = (hour - 7) / 2; return lerpSet(dawn, day, t); }
    if (hour >= 9 && hour < 17) return day;
    if (hour >= 17 && hour < 19) { const t = (hour - 17) / 2; return lerpSet(day, sunset, t); }
    if (hour >= 19 && hour < 22) { const t = (hour - 19) / 3; return lerpSet(sunset, night, t); }
    return day;
  },

  clear() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
};
