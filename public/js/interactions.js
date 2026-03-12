// interactions.js - Lobster social interactions
const Interactions = {
  bubbles: [], // active interaction bubbles
  cooldowns: new Map(), // prevent spam: pairKey -> timestamp
  
  emojis: {
    working: ['💪', '🔥', '⚡', '📊', '🚀', '💻'],
    resting: ['😴', '💤', '☕', '🍵', '🌙', '😌'],
    idle:    ['🎮', '📱', '🎵', '🐟', '✨', '🌊']
  },

  update(lobsters) {
    const now = Date.now();
    
    // Check pairs of nearby lobsters in same zone
    for (let i = 0; i < lobsters.length; i++) {
      for (let j = i + 1; j < lobsters.length; j++) {
        const a = lobsters[i], b = lobsters[j];
        if (a.data.zone !== b.data.zone) continue;
        
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const threshold = (a.size + b.size) * 0.4;
        
        if (dist < threshold) {
          const pairKey = a.data.id < b.data.id 
            ? a.data.id + ':' + b.data.id 
            : b.data.id + ':' + a.data.id;
          
          const lastTime = this.cooldowns.get(pairKey) || 0;
          if (now - lastTime < 8000) continue; // 8s cooldown per pair
          
          this.cooldowns.set(pairKey, now);
          
          // Spawn emoji bubble between them
          const zone = a.data.zone;
          const pool = this.emojis[zone] || this.emojis.idle;
          const emoji = pool[Math.random() * pool.length | 0];
          
          this.bubbles.push({
            x: (a.x + b.x) / 2,
            y: Math.min(a.y, b.y) - 20,
            emoji,
            life: 90,
            maxLife: 90,
            vy: -0.3
          });
        }
      }
    }
    
    // Update existing bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.y += b.vy;
      b.life--;
      if (b.life <= 0) this.bubbles.splice(i, 1);
    }
    
    // Clean old cooldowns
    if (Math.random() < 0.01) {
      for (const [k, v] of this.cooldowns) {
        if (now - v > 15000) this.cooldowns.delete(k);
      }
    }
  },

  draw(ctx) {
    if (this.bubbles.length === 0) return;
    
    ctx.save();
    ctx.textAlign = 'center';
    
    for (const b of this.bubbles) {
      const progress = 1 - b.life / b.maxLife;
      let alpha;
      if (progress < 0.1) alpha = progress / 0.1;
      else if (progress > 0.7) alpha = (1 - progress) / 0.3;
      else alpha = 1;
      
      const scale = 0.8 + Math.sin(progress * Math.PI) * 0.3;
      const fontSize = Math.round(18 * scale);
      
      ctx.globalAlpha = alpha * 0.8;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillText(b.emoji, b.x, b.y);
    }
    
    ctx.globalAlpha = 1;
    ctx.restore();
  }
};
