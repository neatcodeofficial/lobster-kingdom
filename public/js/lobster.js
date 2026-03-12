// lobster.js - Lobster with perspective depth scaling
class Lobster {
  constructor(data, zoneRect) {
    this.data = data;
    this.zone = zoneRect;
    this.size = data.size;
    // Spawn clustered toward center (gaussian-like distribution)
    const cx = zoneRect.x + zoneRect.w * 0.5;
    const cy = zoneRect.y + zoneRect.h * 0.5;
    const spreadX = zoneRect.w * 0.35;
    const spreadY = zoneRect.h * 0.35;
    this.x = cx + (Math.random() + Math.random() - 1) * spreadX;
    this.y = cy + (Math.random() + Math.random() - 1) * spreadY;
    // Clamp
    this.x = Math.max(zoneRect.x + 15, Math.min(zoneRect.x + zoneRect.w - 15, this.x));
    this.y = Math.max(zoneRect.y + 24, Math.min(zoneRect.y + zoneRect.h - 10, this.y));
    this.vx = (Math.random() - 0.5) * 0.3;
    this.vy = (Math.random() - 0.5) * 0.2;
    this.facing = this.vx > 0 ? 1 : -1;
    this.frame = Math.random() * 100 | 0;
    this.bubbleTimer = Math.random() * 200 | 0;
    this.hovered = false;
    // Hover interaction state
    this.hoverScale = 1;
    this.hoverWiggle = 0;
    this.hoverBubbles = [];
    // Token drain particles (for working zone)
    this.tokenDrains = [];
    this.tokenDrainTimer = Math.random() * 60 | 0;
  }

  update() {
    this.frame++;
    const zone = this.data.zone;
    if (zone === 'idle') {
      if (this.frame % 300 === 0) {
        this.vx = (Math.random() - 0.5) * 0.08;
        this.vy = (Math.random() - 0.5) * 0.04;
      }
      if (this.frame % 100 === 0) { this.vx *= 0.5; this.vy *= 0.5; }
    } else if (zone === 'resting') {
      if (this.frame % 200 === 0) {
        this.vx = (Math.random() - 0.5) * 0.2;
        this.vy = (Math.random() - 0.5) * 0.12;
      }
    } else {
      if (this.frame % 120 === 0) {
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.25;
      }
    }

    this.x += this.vx;
    this.y += this.vy;
    if (this.vx > 0.03) this.facing = 1;
    else if (this.vx < -0.03) this.facing = -1;

    // Clamp to zone
    const pad = 10;
    if (this.x < this.zone.x + pad) { this.x = this.zone.x + pad; this.vx *= -1; this.facing = 1; }
    if (this.x > this.zone.x + this.zone.w - pad) { this.x = this.zone.x + this.zone.w - pad; this.vx *= -1; this.facing = -1; }
    if (this.y < this.zone.y + 24) { this.y = this.zone.y + 24; this.vy *= -1; }
    if (this.y > this.zone.y + this.zone.h - pad) { this.y = this.zone.y + this.zone.h - pad; this.vy *= -1; }

    this.bubbleTimer--;

    // Hover interaction animation
    if (this.hovered) {
      this.hoverScale = Math.min(1.25, this.hoverScale + 0.05); // Scale up smoothly
      this.hoverWiggle += 0.3; // Wiggle speed
      // Spawn interaction bubbles
      if (this.frame % 8 === 0) {
        this.hoverBubbles.push({
          x: (Math.random() - 0.5) * this.size * 0.5,
          y: 0,
          vy: -0.5 - Math.random() * 1,
          r: 2 + Math.random() * 4,
          life: 40
        });
      }
    } else {
      this.hoverScale = Math.max(1, this.hoverScale - 0.03); // Scale back down
      this.hoverWiggle *= 0.9;
    }
    // Update hover bubbles
    for (let i = this.hoverBubbles.length - 1; i >= 0; i--) {
      const b = this.hoverBubbles[i];
      b.y += b.vy;
      b.x += Math.sin(b.life * 0.2) * 0.3;
      b.life--;
      if (b.life <= 0) this.hoverBubbles.splice(i, 1);
    }

    // Token drain effect (working zone only)
    if (this.data.zone === 'working') {
      this.tokenDrainTimer--;
      if (this.tokenDrainTimer <= 0) {
        // Generate a random token chunk to display
        const tokens = this.data.tokens;
        let chunk;
        if (tokens >= 1e6) chunk = (Math.random() * 50 + 10).toFixed(0) + 'K';
        else if (tokens >= 1e3) chunk = (Math.random() * 5 + 1).toFixed(1) + 'K';
        else chunk = (Math.random() * 500 + 100 | 0).toString();
        
        this.tokenDrains.push({
          text: '-' + chunk,
          x: (Math.random() - 0.5) * 30,
          y: 0,
          vy: -0.3 - Math.random() * 0.2,
          vx: (Math.random() - 0.5) * 0.3,
          life: 110,
          maxLife: 110
        });
        this.tokenDrainTimer = 80 + Math.random() * 100 | 0; // less frequent, avoid overlap
      }
      // Update existing drains
      for (let i = this.tokenDrains.length - 1; i >= 0; i--) {
        const d = this.tokenDrains[i];
        d.y += d.vy;
        d.x += d.vx;
        d.vx *= 0.98; // slow drift
        d.life--;
        if (d.life <= 0) this.tokenDrains.splice(i, 1);
      }
    }
  }

  getDepthScale() {
    return Renderer.getDepthScale(this.y);
  }

  draw(ctx) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const lv = this.data.level;
    const sprite = LobsterSprites.get(lv);
    const scale = this.getDepthScale();

    // Actual draw size based on depth + hover scale
    const drawSize = this.size * scale * this.hoverScale;
    const drawHalf = drawSize / 2;

    ctx.save();

    // Bobbing + hover wiggle
    const bob = Math.sin(this.frame * 0.03) * (1 + scale);
    const wiggle = this.hovered ? Math.sin(this.hoverWiggle) * 3 : 0;

    // Depth-based opacity (far = dimmer)
    ctx.globalAlpha = 0.4 + scale * 0.5;

    // Canvas-drawn aura/glow effects for high-level lobsters (before sprite)
    if (lv >= 3) this._drawAura(ctx, x, y + bob, lv, scale, drawSize);

    if (sprite) {
      ctx.save();
      ctx.translate(x, y + bob);
      // Hover wiggle rotation
      if (this.hovered) ctx.rotate(Math.sin(this.hoverWiggle) * 0.08);
      if (this.facing === -1) ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, -drawHalf, -drawHalf + wiggle, drawSize, drawSize);
      ctx.restore();
    }

    ctx.globalAlpha = 1;

    // Draw hover interaction bubbles
    if (this.hoverBubbles.length > 0) {
      this._drawHoverBubbles(ctx, x, y + bob, scale);
    }

    // Zone effects (scaled)
    if (this.data.zone === 'working') this._drawWorkEffect(ctx, x, y + bob, scale);
    else if (this.data.zone === 'resting') this._drawSleepEffect(ctx, x, y + bob, scale);
    else this._drawIdleEffect(ctx, x, y + bob, scale);

    if (lv >= 4) this._drawParticles(ctx, x, y + bob, lv, scale);

    // Name label - show for hovered or high-level lobsters only (prevent overlap)
    if (this.hovered || lv >= 3) {
      this._drawNameLabel(ctx, x, y + bob, scale);
    }

    // Hover highlight - only bubbles and animation, no outline
    // (removed circular outline as per user request)

    ctx.restore();
  }

  _drawHoverBubbles(ctx, x, y, scale) {
    ctx.save();
    for (const b of this.hoverBubbles) {
      const alpha = b.life / 40;
      ctx.globalAlpha = alpha * 0.6;
      ctx.strokeStyle = '#88ddff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + b.x * scale, y + b.y * scale, b.r * scale, 0, Math.PI * 2);
      ctx.stroke();
      // Highlight on bubble
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + b.x * scale - b.r * 0.3 * scale, y + b.y * scale - b.r * 0.3 * scale, b.r * 0.3 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawAura(ctx, x, y, lv, scale, drawSize) {
    // Canvas-drawn aura/glow effects for different levels
    // lv 3 (medium): subtle blue glow
    // lv 4 (large): purple glow + pulse
    // lv 5 (king): red glow + rotating ring
    // lv 6 (emperor): golden glow + double ring + rays
    
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    
    const pulse = 0.8 + Math.sin(this.frame * 0.05) * 0.2;
    const radius = drawSize * 0.6;
    
    if (lv === 3) {
      // Blue glow
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * pulse);
      grad.addColorStop(0, 'rgba(33, 150, 243, 0.15)');
      grad.addColorStop(1, 'rgba(33, 150, 243, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
      ctx.fill();
    } else if (lv === 4) {
      // Purple glow + pulse ring
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * pulse);
      grad.addColorStop(0, 'rgba(156, 39, 176, 0.2)');
      grad.addColorStop(1, 'rgba(156, 39, 176, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      
      // Pulse ring
      ctx.strokeStyle = `rgba(156, 39, 176, ${0.3 * pulse})`;
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.arc(x, y, radius * pulse * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    } else if (lv === 5) {
      // Red glow + rotating ring
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * pulse);
      grad.addColorStop(0, 'rgba(244, 67, 54, 0.25)');
      grad.addColorStop(1, 'rgba(244, 67, 54, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      
      // Rotating ring
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.frame * 0.02);
      ctx.strokeStyle = `rgba(244, 67, 54, ${0.4 * pulse})`;
      ctx.lineWidth = 2 * scale;
      ctx.setLineDash([4 * scale, 4 * scale]);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    } else if (lv === 6) {
      // Golden glow + double ring + rays
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * pulse * 1.2);
      grad.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
      grad.addColorStop(0.5, 'rgba(255, 215, 0, 0.15)');
      grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius * pulse * 1.2, 0, Math.PI * 2);
      ctx.fill();
      
      // Double rotating rings
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.frame * 0.02);
      ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 * pulse})`;
      ctx.lineWidth = 2 * scale;
      ctx.setLineDash([6 * scale, 3 * scale]);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(Math.PI);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      
      // Rays
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.frame * 0.01);
      ctx.strokeStyle = `rgba(255, 215, 0, ${0.2 * pulse})`;
      ctx.lineWidth = 1 * scale;
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -radius * 1.3);
        ctx.stroke();
      }
      ctx.restore();
    }
    
    ctx.restore();
  }

  _drawNameLabel(ctx, x, y, scale) {
    const name = this.data.name;
    const drawSize = this.size * scale;
    const fontSize = Math.max(10, Math.round(drawSize * 0.12));
    const labelY = y - drawSize * 0.5 - 10;
    
    ctx.save();
    ctx.font = `600 ${fontSize}px 'Rajdhani', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    const textWidth = ctx.measureText(name).width;
    const padding = 6;
    
    // Glass background
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = 'rgba(8, 18, 40, 0.7)';
    const rx = x - textWidth / 2 - padding;
    const ry = labelY - fontSize - padding;
    const rw = textWidth + padding * 2;
    const rh = fontSize + padding * 2;
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, 6);
    ctx.fill();
    
    // Subtle border
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = this.data.color;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, 6);
    ctx.stroke();
    
    // Text
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#d0e8ff';
    ctx.fillText(name, x, labelY);
    
    ctx.restore();
  }

  _drawWorkEffect(ctx, x, y, scale) {
    const t = this.frame;
    const drawSize = this.size * scale;
    
    // 1. Speed trail (motion blur behind lobster)
    ctx.save();
    ctx.globalAlpha = 0.12;
    const trailDir = this.facing;
    for (let i = 1; i <= 4; i++) {
      ctx.globalAlpha = 0.12 - i * 0.025;
      ctx.fillStyle = '#64d8ff';
      ctx.beginPath();
      ctx.ellipse(
        x - trailDir * i * 6 * scale,
        y,
        drawSize * 0.15,
        drawSize * 0.08,
        0, 0, Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
    
    // 2. Energy sparks orbiting
    ctx.save();
    const sparkCount = 3;
    for (let i = 0; i < sparkCount; i++) {
      const angle = t * 0.08 + i * (Math.PI * 2 / sparkCount);
      const orbitR = drawSize * 0.4;
      const sx = x + Math.cos(angle) * orbitR;
      const sy = y + Math.sin(angle) * orbitR * 0.5;
      const sparkAlpha = 0.5 + Math.sin(t * 0.15 + i) * 0.3;
      
      // Spark glow
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 4 * scale);
      glow.addColorStop(0, `rgba(100, 216, 255, ${sparkAlpha})`);
      glow.addColorStop(1, 'rgba(100, 216, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, 4 * scale, 0, Math.PI * 2);
      ctx.fill();
      
      // Spark core
      ctx.fillStyle = `rgba(220, 240, 255, ${sparkAlpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    
    // 3. Subtle lightning bolt (occasional)
    if (t % 120 < 8) {
      ctx.save();
      ctx.globalAlpha = 0.4 * (1 - (t % 120) / 8);
      ctx.strokeStyle = '#64d8ff';
      ctx.lineWidth = 1.2 * scale;
      ctx.beginPath();
      const bx = x + (Math.random() - 0.5) * drawSize * 0.3;
      const by = y - drawSize * 0.45;
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + 3 * scale, by + 5 * scale);
      ctx.lineTo(bx - 2 * scale, by + 8 * scale);
      ctx.lineTo(bx + 4 * scale, by + 14 * scale);
      ctx.stroke();
      ctx.restore();
    }
    
    // 4. Token drain numbers floating up
    if (this.tokenDrains.length > 0) {
      ctx.save();
      const fontSize = Math.max(12, Math.round(drawSize * 0.16));
      ctx.font = `700 ${fontSize}px 'Rajdhani', sans-serif`;
      ctx.textAlign = 'center';
      
      for (const d of this.tokenDrains) {
        const progress = 1 - d.life / d.maxLife;
        let alpha;
        if (progress < 0.08) alpha = progress / 0.08;
        else alpha = (1 - progress) * 0.95;
        
        const dx = x + d.x * scale;
        const dy = y - drawSize * 0.55 + d.y * scale;
        
        // Glow behind text
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = '#ff3333';
        ctx.fillText(d.text, dx + 1, dy + 1);
        
        // Main text
        ctx.globalAlpha = alpha * 0.95;
        ctx.fillStyle = '#ff5555';
        ctx.fillText(d.text, dx, dy);
      }
      ctx.restore();
    }
  }

  _drawSleepEffect(ctx, x, y, scale) {
    const t = this.frame;
    const drawSize = this.size * scale;
    
    // 1. Breathing glow (soft pulsing aura)
    ctx.save();
    const breathe = 0.5 + Math.sin(t * 0.025) * 0.5; // slow breathing
    const glowR = drawSize * (0.45 + breathe * 0.15);
    const auraGrad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    auraGrad.addColorStop(0, `rgba(100, 150, 255, ${0.06 * breathe})`);
    auraGrad.addColorStop(1, 'rgba(100, 150, 255, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // 2. Floating Z's (multiple, staggered)
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const zCycle = (t + i * 80) % 240;
      const zProgress = zCycle / 240;
      if (zProgress > 0.8) continue;
      
      const zAlpha = zProgress < 0.1 ? zProgress / 0.1 : (0.8 - zProgress) / 0.7;
      const zSize = (8 + i * 3 + zProgress * 6) * scale;
      const zx = x + 10 * scale + zProgress * 15 * scale + Math.sin(zProgress * 4) * 3 * scale;
      const zy = y - 10 * scale - zProgress * 25 * scale;
      
      ctx.globalAlpha = zAlpha * 0.5;
      ctx.fillStyle = '#8ab4e8';
      ctx.font = `${zSize}px 'Rajdhani', sans-serif`;
      ctx.fillText('z', zx, zy);
    }
    ctx.restore();
    
    // 3. Gentle bubbles rising
    ctx.save();
    for (let i = 0; i < 2; i++) {
      const bCycle = (t + i * 100) % 180;
      const bProgress = bCycle / 180;
      if (bProgress > 0.9) continue;
      
      const bAlpha = bProgress < 0.1 ? bProgress / 0.1 : (0.9 - bProgress) / 0.8;
      const br = (1.5 + i) * scale;
      const bx = x + (i * 12 - 6) * scale + Math.sin(bProgress * 6) * 2 * scale;
      const by = y - drawSize * 0.3 - bProgress * 30 * scale;
      
      ctx.globalAlpha = bAlpha * 0.35;
      ctx.strokeStyle = '#8ab4e8';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.stroke();
      
      // Highlight
      ctx.fillStyle = 'rgba(200, 230, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawIdleEffect(ctx, x, y, scale) {
    const t = this.frame;
    const drawSize = this.size * scale;
    
    // 1. Slow pulsing ring (very subtle)
    ctx.save();
    const pulse = 0.5 + Math.sin(t * 0.015) * 0.5; // very slow
    const ringR = drawSize * (0.5 + pulse * 0.1);
    ctx.globalAlpha = 0.08 * pulse;
    ctx.strokeStyle = '#b090d0';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.arc(x, y, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    
    // 2. Stardust particles falling slowly
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const sCycle = (t * 0.5 + i * 60) % 200;
      const sProgress = sCycle / 200;
      
      const sAlpha = sProgress < 0.1 ? sProgress / 0.1 : sProgress > 0.8 ? (1 - sProgress) / 0.2 : 1;
      const sx = x + (Math.sin(i * 2.5 + t * 0.01) * drawSize * 0.4);
      const sy = y - drawSize * 0.4 + sProgress * drawSize * 0.8;
      const sr = (0.5 + Math.sin(t * 0.05 + i) * 0.3) * scale;
      
      ctx.globalAlpha = sAlpha * 0.3;
      
      // Stardust glow
      const dustGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 4);
      dustGlow.addColorStop(0, `rgba(180, 150, 220, 0.5)`);
      dustGlow.addColorStop(1, 'rgba(180, 150, 220, 0)');
      ctx.fillStyle = dustGlow;
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Core
      ctx.fillStyle = 'rgba(220, 200, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    
    // 3. Occasional "..." thought bubble (less frequent, softer)
    if (t % 500 < 40) {
      ctx.save();
      const dotAlpha = t % 500 < 10 ? (t % 500) / 10 : (40 - t % 500) / 30;
      ctx.globalAlpha = dotAlpha * 0.35;
      ctx.fillStyle = '#b090d0';
      const dotSize = 2 * scale;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x - 6 * scale + i * 5 * scale, y - drawSize * 0.45, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _drawParticles(ctx, x, y, lv, scale) {
    const count = lv >= 5 ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const angle = (this.frame * 0.02 + i * Math.PI * 2 / count);
      const r = this.size * scale * 0.4 + Math.sin(this.frame * 0.03 + i) * 3;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r * 0.6;
      ctx.globalAlpha = (0.3 + Math.sin(this.frame * 0.05 + i) * 0.2) * scale;
      ctx.fillStyle = lv >= 5 ? '#FFD700' : '#F44336';
      const ps = Math.max(1, 2 * scale);
      ctx.fillRect(px - ps / 2, py - ps / 2, ps, ps);
    }
    ctx.globalAlpha = 1;
  }

  hitTest(mx, my) {
    const scale = this.getDepthScale();
    const hs = this.size * scale * 0.45 + 8; // Match collision radius
    return mx >= this.x - hs && mx <= this.x + hs &&
           my >= this.y - hs && my <= this.y + hs;
  }
}

// Sprite loader
const LobsterSprites = {
  sprites: {},
  loaded: false,
  async load() {
    const promises = [];
    for (let lv = 0; lv < 6; lv++) {
      promises.push(new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { this.sprites[lv] = img; resolve(); };
        img.onerror = () => { console.warn(`Failed to load lv${lv + 1} sprite`); resolve(); };
        img.src = `assets/lobster_lv${lv + 1}.png?v=23`;
      }));
    }
    await Promise.all(promises);
    this.loaded = true;
    console.log('Sprites loaded:', Object.keys(this.sprites).length);
  },
  get(level) { return this.sprites[level] || null; }
};
