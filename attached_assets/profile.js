const fs    = require('fs');
const path  = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

try {
  registerFont(path.join(__dirname, 'fonts', 'NotoSansArabic.ttf'), { family: 'NotoArabic' });
} catch(e) { console.error('[profile] registerFont error:', e.message); }

const STATS_FILE = path.join(__dirname, 'data', 'stats.json');

const LEVELS = [
  { level: 1, name: 'نكرة',   xp: 0    },
  { level: 2, name: 'مشبوه',  xp: 300  },
  { level: 3, name: 'بلطجي',  xp: 700  },
  { level: 4, name: 'محقق',   xp: 1300 },
  { level: 5, name: 'قاتل',   xp: 2200 },
  { level: 6, name: 'مافيا',  xp: 3500 },
  { level: 7, name: 'دون',    xp: 5500 },
  { level: 8, name: 'زعيم',   xp: 8500 },
];

// Each level: [primary, secondary, accent] colors
const LEVEL_THEMES = [
  { primary: '#78909c', secondary: '#455a64', accent: '#b0bec5', bg1: '#0d0d0d', bg2: '#111418', tier: 1 }, // نكرة
  { primary: '#00e676', secondary: '#00c853', accent: '#69f0ae', bg1: '#001a0a', bg2: '#0a1a0f', tier: 1 }, // مشبوه
  { primary: '#2979ff', secondary: '#0d47a1', accent: '#82b1ff', bg1: '#000d1a', bg2: '#091020', tier: 2 }, // بلطجي
  { primary: '#d500f9', secondary: '#7b1fa2', accent: '#ea80fc', bg1: '#0f0014', bg2: '#160a1e', tier: 2 }, // محقق
  { primary: '#ff6d00', secondary: '#e65100', accent: '#ffab40', bg1: '#1a0800', bg2: '#1e0d00', tier: 3 }, // قاتل
  { primary: '#f44336', secondary: '#b71c1c', accent: '#ff8a80', bg1: '#1a0000', bg2: '#1e0505', tier: 3 }, // مافيا
  { primary: '#f06292', secondary: '#c2185b', accent: '#ff94c2', bg1: '#1a0010', bg2: '#1e0518', tier: 4 }, // دون
  { primary: '#ffd700', secondary: '#ff8f00', accent: '#fff176', bg1: '#1a1200', bg2: '#1e1500', tier: 4 }, // زعيم
];

function getLevelInfo(xp) {
  let current = LEVELS[0], next = LEVELS[1];
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xp) { current = LEVELS[i]; next = LEVELS[i + 1] || null; }
  }
  const xpInLevel = next ? xp - current.xp : 0;
  const xpForNext = next ? next.xp - current.xp : 1;
  const progress  = next ? Math.min(xpInLevel / xpForNext, 1) : 1;
  return { current, next, xpInLevel, xpForNext, progress };
}

function loadStats() {
  try {
    if (!fs.existsSync(STATS_FILE)) return {};
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
  } catch { return {}; }
}

function saveStats(stats) {
  try { fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2)); }
  catch (e) { console.error('[profile] save error:', e); }
}

function getPlayer(stats, userID, name) {
  if (!stats[userID]) {
    stats[userID] = { name, xp: 0, games: 0, wins: 0, losses: 0, kills: 0, survived: 0, roleCounts: {} };
  }
  if (name) stats[userID].name = name;
  return stats[userID];
}

function awardXP(userID, name, xpData) {
  const stats  = loadStats();
  const player = getPlayer(stats, userID, name);
  let earned = 0;
  if (xpData.won) earned += 150; else earned += 40;
  if (xpData.survived) earned += 50;
  earned += (xpData.kills || 0) * 30;
  player.xp      += earned;
  player.games   += 1;
  if (xpData.won) player.wins += 1; else player.losses += 1;
  if (xpData.survived) player.survived += 1;
  player.kills   += (xpData.kills || 0);
  if (xpData.role) player.roleCounts[xpData.role] = (player.roleCounts[xpData.role] || 0) + 1;
  saveStats(stats);
  return earned;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Draw diamond shape
function diamond(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
}

// Draw hexagon
function hexagon(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Tier-specific background patterns
function drawBackground(ctx, W, H, theme, lvl) {
  // Base gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, theme.bg1);
  bg.addColorStop(1, theme.bg2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();

  if (theme.tier === 1) {
    // Simple horizontal lines — rough/basic
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 22) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  } else if (theme.tier === 2) {
    // Circuit/grid pattern
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 1;
    const gs = 40;
    for (let x = 0; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // Circuit dots at intersections
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = theme.primary;
    for (let x = 0; x < W; x += gs) {
      for (let y = 0; y < H; y += gs) {
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (theme.tier === 3) {
    // Diagonal flame-like streaks
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 2;
    for (let i = -H; i < W + H; i += 45) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H * 0.6, H); ctx.stroke();
    }
    // Diamond shapes scattered
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1;
    for (let x = 60; x < W; x += 90) {
      for (let y = 40; y < H; y += 70) {
        diamond(ctx, x, y, 12); ctx.stroke();
      }
    }
  } else if (theme.tier === 4) {
    // Ornate hexagon pattern + gold shimmer
    ctx.globalAlpha = 0.055;
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 1.5;
    const hr = 35;
    const hh = hr * Math.sqrt(3);
    for (let row = -1; row < H / hh + 1; row++) {
      for (let col = -1; col < W / (hr * 3) + 1; col++) {
        const cx = col * hr * 3 + (row % 2 === 0 ? 0 : hr * 1.5);
        const cy = row * hh;
        hexagon(ctx, cx, cy, hr); ctx.stroke();
      }
    }
    // Sparkle dots
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = theme.accent;
    const sparkles = [[120,80],[450,150],[700,60],[850,200],[200,350],[550,400],[900,320],[350,250]];
    for (const [sx, sy] of sparkles) {
      ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx, sy, 1, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();

  // Big radial glow behind avatar (left side)
  const glow = ctx.createRadialGradient(130, 130, 0, 130, 130, 220);
  glow.addColorStop(0, theme.primary + '30');
  glow.addColorStop(0.5, theme.primary + '10');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Right side subtle glow
  const glowR = ctx.createRadialGradient(W - 80, H / 2, 0, W - 80, H / 2, 180);
  glowR.addColorStop(0, theme.secondary + '18');
  glowR.addColorStop(1, 'transparent');
  ctx.fillStyle = glowR;
  ctx.fillRect(0, 0, W, H);
}

// Top header bar — style varies by tier
function drawHeaderBar(ctx, W, theme) {
  if (theme.tier <= 2) {
    // Simple gradient line
    const bar = ctx.createLinearGradient(0, 0, W, 0);
    bar.addColorStop(0, theme.primary);
    bar.addColorStop(0.6, theme.primary + '88');
    bar.addColorStop(1, 'transparent');
    ctx.fillStyle = bar;
    ctx.fillRect(0, 0, W, 4);
  } else if (theme.tier === 3) {
    // Double line
    const bar = ctx.createLinearGradient(0, 0, W, 0);
    bar.addColorStop(0, 'transparent');
    bar.addColorStop(0.1, theme.primary);
    bar.addColorStop(0.9, theme.accent);
    bar.addColorStop(1, 'transparent');
    ctx.fillStyle = bar;
    ctx.fillRect(0, 0, W, 5);
    ctx.fillStyle = theme.accent + '44';
    ctx.fillRect(0, 6, W, 2);
  } else {
    // Ornate triple bar with center diamond
    const bar = ctx.createLinearGradient(0, 0, W, 0);
    bar.addColorStop(0, 'transparent');
    bar.addColorStop(0.15, theme.secondary);
    bar.addColorStop(0.5, theme.primary);
    bar.addColorStop(0.85, theme.secondary);
    bar.addColorStop(1, 'transparent');
    ctx.fillStyle = bar;
    ctx.fillRect(0, 0, W, 6);
    ctx.fillStyle = theme.accent + '55';
    ctx.fillRect(0, 7, W, 2);
    ctx.fillStyle = theme.primary + '22';
    ctx.fillRect(0, 10, W, 1);
    // Center diamond on bar
    ctx.save();
    ctx.fillStyle = theme.primary;
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 10;
    diamond(ctx, W / 2, 4, 8);
    ctx.fill();
    ctx.restore();
  }
}

// Bottom bar mirror of top
function drawBottomBar(ctx, W, H, theme) {
  if (theme.tier <= 2) {
    const bar = ctx.createLinearGradient(0, 0, W, 0);
    bar.addColorStop(0, 'transparent');
    bar.addColorStop(0.5, theme.primary + '55');
    bar.addColorStop(1, 'transparent');
    ctx.fillStyle = bar;
    ctx.fillRect(0, H - 4, W, 4);
  } else if (theme.tier === 3) {
    const bar = ctx.createLinearGradient(0, 0, W, 0);
    bar.addColorStop(0, 'transparent');
    bar.addColorStop(0.1, theme.accent + '88');
    bar.addColorStop(0.9, theme.primary + '88');
    bar.addColorStop(1, 'transparent');
    ctx.fillStyle = bar;
    ctx.fillRect(0, H - 5, W, 5);
  } else {
    const bar = ctx.createLinearGradient(0, 0, W, 0);
    bar.addColorStop(0, 'transparent');
    bar.addColorStop(0.15, theme.secondary + 'aa');
    bar.addColorStop(0.5, theme.primary + 'dd');
    bar.addColorStop(0.85, theme.secondary + 'aa');
    bar.addColorStop(1, 'transparent');
    ctx.fillStyle = bar;
    ctx.fillRect(0, H - 6, W, 6);
    ctx.fillStyle = theme.accent + '33';
    ctx.fillRect(0, H - 9, W, 2);
    // Center diamond on bottom bar
    ctx.save();
    ctx.fillStyle = theme.primary;
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 10;
    diamond(ctx, W / 2, H - 4, 7);
    ctx.fill();
    ctx.restore();
  }
}

// Corner ornaments — more complex at higher tiers
function drawCorners(ctx, W, H, theme) {
  ctx.save();
  ctx.strokeStyle = theme.primary;

  if (theme.tier === 1) {
    // Simple L-brackets
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.5;
    const s = 20;
    [[0,0,1,1],[W,0,-1,1],[0,H,1,-1],[W,H,-1,-1]].forEach(([x,y,dx,dy]) => {
      ctx.beginPath(); ctx.moveTo(x+dx*s, y); ctx.lineTo(x, y); ctx.lineTo(x, y+dy*s); ctx.stroke();
    });
  } else if (theme.tier === 2) {
    // Double L-brackets
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.5;
    const s = 28;
    [[0,0,1,1],[W,0,-1,1],[0,H,1,-1],[W,H,-1,-1]].forEach(([x,y,dx,dy]) => {
      ctx.beginPath(); ctx.moveTo(x+dx*s, y); ctx.lineTo(x, y); ctx.lineTo(x, y+dy*s); ctx.stroke();
      ctx.globalAlpha = 0.2;
      ctx.beginPath(); ctx.moveTo(x+dx*(s+8), y+dy*4); ctx.lineTo(x+dx*4, y+dy*4); ctx.lineTo(x+dx*4, y+dy*(s+8)); ctx.stroke();
      ctx.globalAlpha = 0.55;
    });
  } else if (theme.tier === 3) {
    // Diamond-tipped corners
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2;
    const s = 34;
    [[0,0,1,1],[W,0,-1,1],[0,H,1,-1],[W,H,-1,-1]].forEach(([x,y,dx,dy]) => {
      ctx.beginPath(); ctx.moveTo(x+dx*s, y+dy*3); ctx.lineTo(x+dx*3, y+dy*3); ctx.lineTo(x+dx*3, y+dy*s); ctx.stroke();
      ctx.save();
      ctx.fillStyle = theme.accent;
      ctx.shadowColor = theme.primary; ctx.shadowBlur = 8;
      diamond(ctx, x+dx*3, y+dy*3, 5);
      ctx.fill();
      ctx.restore();
    });
    // Outer thin line
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1;
    [[0,0,1,1],[W,0,-1,1],[0,H,1,-1],[W,H,-1,-1]].forEach(([x,y,dx,dy]) => {
      ctx.beginPath(); ctx.moveTo(x+dx*44, y); ctx.lineTo(x, y); ctx.lineTo(x, y+dy*44); ctx.stroke();
    });
  } else {
    // Ornate gold corners with multiple layers
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2.5;
    const s = 42;
    ctx.strokeStyle = theme.primary;
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 12;
    [[0,0,1,1],[W,0,-1,1],[0,H,1,-1],[W,H,-1,-1]].forEach(([x,y,dx,dy]) => {
      ctx.beginPath(); ctx.moveTo(x+dx*s, y+dy*4); ctx.lineTo(x+dx*4, y+dy*4); ctx.lineTo(x+dx*4, y+dy*s); ctx.stroke();
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1;
    [[0,0,1,1],[W,0,-1,1],[0,H,1,-1],[W,H,-1,-1]].forEach(([x,y,dx,dy]) => {
      ctx.beginPath(); ctx.moveTo(x+dx*(s+10), y+dy*10); ctx.lineTo(x+dx*10, y+dy*10); ctx.lineTo(x+dx*10, y+dy*(s+10)); ctx.stroke();
    });
    // Gold diamond at each corner tip
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.primary;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1;
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 15;
    [[4,4],[W-4,4],[4,H-4],[W-4,H-4]].forEach(([cx,cy]) => {
      diamond(ctx, cx, cy, 7); ctx.fill(); ctx.stroke();
    });
  }
  ctx.restore();
}

// Avatar ring — escalates with tier & level
function drawAvatarRings(ctx, AX, AY, AR, theme, lvl) {
  ctx.save();

  if (theme.tier === 1) {
    // Single faint ring
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = theme.primary + 'aa';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(AX, AY, AR + 5, 0, Math.PI * 2); ctx.stroke();
  } else if (theme.tier === 2) {
    // Double ring
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(AX, AY, AR + 6, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = theme.accent + '55';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(AX, AY, AR + 12, 0, Math.PI * 2); ctx.stroke();
    // 4 corner accents on outer ring
    ctx.fillStyle = theme.accent;
    ctx.shadowColor = theme.primary; ctx.shadowBlur = 6;
    [0, Math.PI/2, Math.PI, Math.PI*3/2].forEach(a => {
      ctx.beginPath();
      ctx.arc(AX + Math.cos(a)*(AR+12), AY + Math.sin(a)*(AR+12), 3, 0, Math.PI*2);
      ctx.fill();
    });
  } else if (theme.tier === 3) {
    // Triple ring with rotating dashes
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(AX, AY, AR + 6, 0, Math.PI * 2); ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = theme.accent + '77';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.arc(AX, AY, AR + 14, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = theme.secondary + '44';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(AX, AY, AR + 20, 0, Math.PI * 2); ctx.stroke();

    // 8 diamond spikes around middle ring
    ctx.fillStyle = theme.accent;
    ctx.shadowColor = theme.primary; ctx.shadowBlur = 8;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      diamond(ctx, AX + Math.cos(a)*(AR+14), AY + Math.sin(a)*(AR+14), 4);
      ctx.fill();
    }
  } else {
    // Ornate 4-ring with golden crown spikes
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 30;
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(AX, AY, AR + 7, 0, Math.PI * 2); ctx.stroke();

    ctx.shadowBlur = 12;
    const grad = ctx.createConicalGradient ? null : null;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(AX, AY, AR + 13, 0, Math.PI * 2); ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = theme.secondary + '66';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(AX, AY, AR + 20, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = theme.primary + '22';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(AX, AY, AR + 27, 0, Math.PI * 2); ctx.stroke();

    // 12 gold diamond spikes at ring 2
    ctx.fillStyle = theme.primary;
    ctx.shadowColor = theme.primary; ctx.shadowBlur = 12;
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI / 6) * i;
      diamond(ctx, AX + Math.cos(a)*(AR+13), AY + Math.sin(a)*(AR+13), i%3===0 ? 5 : 3);
      ctx.fill();
    }

    // Crown triangles at top (lvl 8 زعيم only)
    if (lvl === 8) {
      ctx.fillStyle = theme.primary;
      ctx.shadowColor = theme.primary; ctx.shadowBlur = 18;
      const crownPts = [-28,-22,0,-36,22,-22];
      ctx.beginPath();
      ctx.moveTo(AX + crownPts[0], AY - AR - 20 + crownPts[1]);
      ctx.lineTo(AX + crownPts[2], AY - AR - 20 + crownPts[3]);
      ctx.lineTo(AX + crownPts[4], AY - AR - 20 + crownPts[5]);
      ctx.closePath(); ctx.fill();
      // Crown base
      ctx.fillRect(AX - 30, AY - AR - 8, 60, 8);
    }
  }

  ctx.restore();
}

// Level badge under avatar — gets more elaborate
function drawLevelBadge(ctx, AX, AY, AR, theme, current) {
  ctx.save();
  const bY = AY + AR + 10;

  if (theme.tier === 1) {
    const bW = 85, bH = 24;
    roundRect(ctx, AX - bW/2, bY, bW, bH, 5);
    ctx.fillStyle = theme.primary + 'cc';
    ctx.fill();
    ctx.strokeStyle = theme.primary + '66';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#000000bb';
    ctx.font = 'bold 13px NotoArabic, DejaVu Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${current.level} • ${current.name}`, AX, bY + 17);
  } else if (theme.tier === 2) {
    const bW = 96, bH = 26;
    roundRect(ctx, AX - bW/2, bY, bW, bH, 13);
    const badgeGrad = ctx.createLinearGradient(AX - bW/2, bY, AX + bW/2, bY + bH);
    badgeGrad.addColorStop(0, theme.secondary);
    badgeGrad.addColorStop(1, theme.primary);
    ctx.fillStyle = badgeGrad;
    ctx.fill();
    ctx.shadowColor = theme.primary; ctx.shadowBlur = 8;
    ctx.strokeStyle = theme.accent + '88';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px NotoArabic, DejaVu Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv.${current.level} ${current.name}`, AX, bY + 18);
  } else if (theme.tier === 3) {
    const bW = 108, bH = 30;
    roundRect(ctx, AX - bW/2, bY, bW, bH, 6);
    const badgeGrad = ctx.createLinearGradient(AX - bW/2, bY, AX + bW/2, bY + bH);
    badgeGrad.addColorStop(0, theme.bg1);
    badgeGrad.addColorStop(0.5, theme.secondary + 'dd');
    badgeGrad.addColorStop(1, theme.bg1);
    ctx.fillStyle = badgeGrad;
    ctx.fill();
    ctx.shadowColor = theme.primary; ctx.shadowBlur = 14;
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = theme.accent;
    ctx.font = 'bold 14px NotoArabic, DejaVu Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`⚡ ${current.name} • ${current.level}`, AX, bY + 21);
  } else {
    // Ornate hexagonal badge for tier 4
    const bW = 120, bH = 32;
    roundRect(ctx, AX - bW/2, bY, bW, bH, 8);
    const badgeGrad = ctx.createLinearGradient(AX - bW/2, bY, AX + bW/2, bY + bH);
    badgeGrad.addColorStop(0, theme.secondary + 'ee');
    badgeGrad.addColorStop(0.5, theme.primary);
    badgeGrad.addColorStop(1, theme.secondary + 'ee');
    ctx.fillStyle = badgeGrad;
    ctx.fill();
    ctx.shadowColor = theme.primary; ctx.shadowBlur = 20;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Inner thin line
    roundRect(ctx, AX - bW/2 + 4, bY + 4, bW - 8, bH - 8, 5);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = theme.primary + '44';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#000000cc';
    ctx.font = `bold 15px NotoArabic, DejaVu Sans, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`★ ${current.name} ★`, AX, bY + 22);
  }

  ctx.restore();
}

// ── Bar ornament (left icon per level) ──────────────────────────────────────
function drawBarOrnament(ctx, cx, cy, theme, lvl) {
  const p = theme.primary, s = theme.secondary, a = theme.accent;
  ctx.save();
  if (lvl === 1) {
    ctx.shadowColor = p; ctx.shadowBlur = 12;
    ctx.strokeStyle = p; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = p + '55'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = p; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const ang = (Math.PI / 2) * i + Math.PI / 4;
      ctx.strokeStyle = a; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * 18, cy + Math.sin(ang) * 18);
      ctx.lineTo(cx + Math.cos(ang) * 23, cy + Math.sin(ang) * 23);
      ctx.stroke();
    }
  } else if (lvl === 2) {
    ctx.shadowColor = p; ctx.shadowBlur = 10;
    ctx.strokeStyle = p; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy + 10);
    ctx.bezierCurveTo(cx - 8, cy - 14, cx + 2, cy + 8, cx + 10, cy - 4);
    ctx.bezierCurveTo(cx + 16, cy - 14, cx + 20, cy + 2, cx + 16, cy + 10);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = a;
    ctx.beginPath(); ctx.arc(cx - 12, cy + 8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 8, cy - 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p; ctx.beginPath(); ctx.arc(cx + 16, cy + 8, 4, 0, Math.PI * 2); ctx.fill();
  } else if (lvl === 3) {
    ctx.shadowColor = p; ctx.shadowBlur = 14;
    ctx.fillStyle = p;
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + 4); ctx.lineTo(cx - 6, cy - 14);
    ctx.lineTo(cx + 2, cy - 4); ctx.lineTo(cx + 10, cy - 16);
    ctx.lineTo(cx + 18, cy + 4); ctx.lineTo(cx + 10, cy + 12);
    ctx.lineTo(cx, cy + 4); ctx.lineTo(cx - 8, cy + 12);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = a + 'cc';
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 2); ctx.lineTo(cx - 2, cy - 8);
    ctx.lineTo(cx + 4, cy - 2); ctx.lineTo(cx + 10, cy - 10);
    ctx.lineTo(cx + 14, cy + 2); ctx.closePath(); ctx.fill();
  } else if (lvl === 4) {
    ctx.shadowColor = p; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18); ctx.lineTo(cx + 14, cy - 10);
    ctx.lineTo(cx + 14, cy + 4);
    ctx.quadraticCurveTo(cx + 14, cy + 14, cx, cy + 20);
    ctx.quadraticCurveTo(cx - 14, cy + 14, cx - 14, cy + 4);
    ctx.lineTo(cx - 14, cy - 10); ctx.closePath();
    const sg = ctx.createLinearGradient(cx - 14, cy - 18, cx + 14, cy + 20);
    sg.addColorStop(0, p + '66'); sg.addColorStop(1, s + '44');
    ctx.fillStyle = sg; ctx.fill();
    ctx.strokeStyle = p; ctx.lineWidth = 2; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = a + 'aa'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 8, cy - 2); ctx.lineTo(cx + 8, cy - 2); ctx.stroke();
  } else if (lvl === 5) {
    ctx.shadowColor = p; ctx.shadowBlur = 16;
    ctx.fillStyle = p;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 14);
    ctx.bezierCurveTo(cx - 14, cy + 4, cx - 16, cy - 8, cx - 4, cy - 18);
    ctx.bezierCurveTo(cx - 6, cy - 8, cx - 2, cy - 4, cx, cy - 14);
    ctx.bezierCurveTo(cx + 2, cy - 4, cx + 6, cy - 8, cx + 4, cy - 18);
    ctx.bezierCurveTo(cx + 16, cy - 8, cx + 14, cy + 4, cx, cy + 14);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = a;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 8);
    ctx.bezierCurveTo(cx - 8, cy + 2, cx - 8, cy - 6, cx, cy - 10);
    ctx.bezierCurveTo(cx + 8, cy - 6, cx + 8, cy + 2, cx, cy + 8);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
  } else if (lvl === 6) {
    ctx.shadowColor = p; ctx.shadowBlur = 16;
    ctx.strokeStyle = p; ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI / 4) * i;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * 12, cy + Math.sin(ang) * 12);
      ctx.lineTo(cx + Math.cos(ang) * 20, cy + Math.sin(ang) * 20);
      ctx.stroke();
    }
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
    cg.addColorStop(0, a); cg.addColorStop(0.6, p); cg.addColorStop(1, s);
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = a; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.stroke();
  } else if (lvl === 7) {
    ctx.shadowColor = p; ctx.shadowBlur = 14;
    ctx.fillStyle = p + 'cc';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(cx - 6, cy - 18, cx - 22, cy - 14, cx - 20, cy - 2);
    ctx.bezierCurveTo(cx - 16, cy + 6, cx - 8, cy + 4, cx, cy);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = a + 'cc';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(cx + 6, cy - 18, cx + 22, cy - 14, cx + 20, cy - 2);
    ctx.bezierCurveTo(cx + 16, cy + 6, cx + 8, cy + 4, cx, cy);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = s + '99';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.bezierCurveTo(cx - 5, cy + 10, cx - 14, cy + 14, cx - 12, cy + 5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.bezierCurveTo(cx + 5, cy + 10, cx + 14, cy + 14, cx + 12, cy + 5); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.shadowColor = p; ctx.shadowBlur = 18;
    ctx.fillStyle = p; diamond(ctx, cx, cy, 16); ctx.fill();
    ctx.strokeStyle = a; ctx.lineWidth = 2; diamond(ctx, cx, cy, 16); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fffde7'; diamond(ctx, cx, cy, 8); ctx.fill();
    ctx.fillStyle = s + 'cc';
    ctx.beginPath(); ctx.moveTo(cx - 16, cy); ctx.lineTo(cx - 28, cy - 4); ctx.lineTo(cx - 28, cy + 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 16, cy); ctx.lineTo(cx + 28, cy - 4); ctx.lineTo(cx + 28, cy + 4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ── Bar body path — unique shape per level ───────────────────────────────────
function barBodyPath(ctx, tx, y, tw, h, lvl) {
  const cy = y + h / 2;
  ctx.beginPath();
  if (lvl === 1) {
    // نكرة — simple pill (mechanical)
    const r = h / 2;
    ctx.moveTo(tx + r, y);
    ctx.lineTo(tx + tw - r, y); ctx.arc(tx + tw - r, cy, r, -Math.PI/2, Math.PI/2);
    ctx.lineTo(tx + r, y + h); ctx.arc(tx + r, cy, r, Math.PI/2, -Math.PI/2);
    ctx.closePath();
  } else if (lvl === 2) {
    // مشبوه — serpent/dragon: wavy top edge, flat bottom
    const seg = tw / 5;
    ctx.moveTo(tx, y + h); ctx.lineTo(tx, cy);
    for (let i = 0; i < 5; i++) {
      const wx = tx + i * seg;
      const topY = i % 2 === 0 ? y : y + h * 0.22;
      ctx.bezierCurveTo(wx + seg * 0.3, topY, wx + seg * 0.7, topY, wx + seg, i % 2 === 0 ? y + h * 0.22 : y);
    }
    ctx.lineTo(tx + tw, y + h); ctx.closePath();
  } else if (lvl === 3) {
    // بلطجي — jagged: arrow pointing right, notched left
    const tip = h * 0.55;
    ctx.moveTo(tx, y); ctx.lineTo(tx + tw - tip, y);
    ctx.lineTo(tx + tw, cy); ctx.lineTo(tx + tw - tip, y + h);
    ctx.lineTo(tx, y + h); ctx.lineTo(tx + tip, cy);
    ctx.closePath();
  } else if (lvl === 4) {
    // محقق — parallelogram (authority/official)
    const slant = h * 0.55;
    ctx.moveTo(tx + slant, y); ctx.lineTo(tx + tw, y);
    ctx.lineTo(tx + tw - slant, y + h); ctx.lineTo(tx, y + h);
    ctx.closePath();
  } else if (lvl === 5) {
    // قاتل — flame: rounded left, pointed right tip
    const r = h / 2, tip = h * 0.65;
    ctx.moveTo(tx + r, y); ctx.lineTo(tx + tw - tip, y);
    ctx.bezierCurveTo(tx + tw - tip * 0.25, y, tx + tw, cy - 1, tx + tw, cy);
    ctx.bezierCurveTo(tx + tw, cy + 1, tx + tw - tip * 0.25, y + h, tx + tw - tip, y + h);
    ctx.lineTo(tx + r, y + h); ctx.arc(tx + r, cy, r, Math.PI/2, -Math.PI/2);
    ctx.closePath();
  } else if (lvl === 6) {
    // مافيا — sword/diamond blade: hexagon
    const e = h * 0.48;
    ctx.moveTo(tx + e, y); ctx.lineTo(tx + tw - e, y);
    ctx.lineTo(tx + tw, cy); ctx.lineTo(tx + tw - e, y + h);
    ctx.lineTo(tx + e, y + h); ctx.lineTo(tx, cy);
    ctx.closePath();
  } else if (lvl === 7) {
    // دون — butterfly body: pinched center, rounded ends
    const r = h * 0.42, pinch = h * 0.22;
    ctx.moveTo(tx, cy);
    ctx.quadraticCurveTo(tx, y, tx + r, y);
    ctx.bezierCurveTo(tx + tw * 0.38, y, tx + tw * 0.46, y + pinch, tx + tw / 2, y + pinch);
    ctx.bezierCurveTo(tx + tw * 0.54, y + pinch, tx + tw * 0.62, y, tx + tw - r, y);
    ctx.quadraticCurveTo(tx + tw, y, tx + tw, cy);
    ctx.quadraticCurveTo(tx + tw, y + h, tx + tw - r, y + h);
    ctx.bezierCurveTo(tx + tw * 0.62, y + h, tx + tw * 0.54, y + h - pinch, tx + tw / 2, y + h - pinch);
    ctx.bezierCurveTo(tx + tw * 0.46, y + h - pinch, tx + tw * 0.38, y + h, tx + r, y + h);
    ctx.quadraticCurveTo(tx, y + h, tx, cy);
    ctx.closePath();
  } else {
    // زعيم — royal double-edge blade (ornate)
    const e = h * 0.42, flare = h * 0.28;
    ctx.moveTo(tx + e, y - flare);
    ctx.lineTo(tx + tw * 0.18, y - flare); ctx.lineTo(tx + tw * 0.23, y);
    ctx.lineTo(tx + tw - e, y); ctx.lineTo(tx + tw, cy);
    ctx.lineTo(tx + tw - e, y + h); ctx.lineTo(tx + tw * 0.23, y + h);
    ctx.lineTo(tx + tw * 0.18, y + h + flare); ctx.lineTo(tx + e, y + h + flare);
    ctx.lineTo(tx, cy); ctx.closePath();
  }
}

// ── Styled XP bar — game bar look with ornament + fill ───────────────────────
function drawStyledXPBar(ctx, x, y, w, h, progress, theme, current) {
  const p = theme.primary, s = theme.secondary, a = theme.accent;
  const OW = 50;
  const tx = x + OW, tw = w - OW;
  const cy = y + h / 2;
  const lvl = current.level;
  ctx.save();

  // Outer glow shadow behind bar
  ctx.save();
  barBodyPath(ctx, tx - 3, y - 3, tw + 6, h + 6, lvl);
  ctx.fillStyle = p + '18'; ctx.fill();
  ctx.restore();

  // Dark background track (shaped)
  barBodyPath(ctx, tx, y, tw, h, lvl);
  ctx.fillStyle = '#050508ee'; ctx.fill();
  ctx.strokeStyle = p + '44'; ctx.lineWidth = 1.5; ctx.stroke();

  // Filled progress (clipped to bar shape)
  if (progress > 0) {
    const filled = Math.max(tw * progress, 16);
    ctx.save();
    barBodyPath(ctx, tx, y, tw, h, lvl);
    ctx.clip();
    const fg = ctx.createLinearGradient(tx, 0, tx + tw, 0);
    fg.addColorStop(0, s); fg.addColorStop(0.5, p); fg.addColorStop(1, a);
    ctx.fillStyle = fg;
    ctx.shadowColor = p; ctx.shadowBlur = 16;
    ctx.fillRect(tx, y - 4, filled, h + 8);
    // Shine
    const shine = ctx.createLinearGradient(0, y, 0, y + h);
    shine.addColorStop(0, 'rgba(255,255,255,0.38)');
    shine.addColorStop(0.45, 'rgba(255,255,255,0.08)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.shadowBlur = 0; ctx.fillStyle = shine;
    ctx.fillRect(tx, y - 4, filled, h + 8);
    // Bottom darker edge inside fill
    ctx.fillStyle = s + '55'; ctx.fillRect(tx, y + h - 3, filled, 3);
    // Sparkle at tip
    if (progress < 0.99) {
      ctx.fillStyle = '#ffffffaa';
      ctx.shadowColor = a; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(tx + filled - 5, cy, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Bar outline on top of fill
  barBodyPath(ctx, tx, y, tw, h, lvl);
  ctx.strokeStyle = p + '66'; ctx.lineWidth = 1.5; ctx.stroke();

  // % text
  ctx.fillStyle = progress > 0.15 ? '#ffffffcc' : p + 'bb';
  ctx.font = 'bold 11px NotoArabic, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.round(progress * 100)}%`, tx + 12, cy + 4);

  // Ornament on left
  drawBarOrnament(ctx, x + OW / 2, cy, theme, current.level);
  ctx.restore();
}

// Level title bar — styled divider below player name, unique per level
function drawLevelTitleBar(ctx, x, y, w, theme, current) {
  const p = theme.primary, s = theme.secondary, a = theme.accent;
  const lvl = current.level;
  ctx.save();

  // Helper: glow line from lx to rx at ly
  const glowLine = (lx, rx, ly, col, thick = 2, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = col; ctx.shadowBlur = 8;
    ctx.strokeStyle = col; ctx.lineWidth = thick;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ly); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  // Gradient line left→right fading
  const gradLine = (lx, rx, ly, col1, col2, thick = 2) => {
    const g = ctx.createLinearGradient(lx, ly, rx, ly);
    g.addColorStop(0, col1); g.addColorStop(1, col2);
    ctx.strokeStyle = g; ctx.lineWidth = thick;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ly); ctx.stroke();
  };

  if (lvl === 1) {
    // ── نكرة: Cyan mechanical — ring + thin line ──────────────────────────────
    const cx = x + 14, cy = y;
    // Ring
    ctx.shadowColor = p; ctx.shadowBlur = 10;
    ctx.strokeStyle = p; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = p + '55'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    // Center dot
    ctx.fillStyle = p;
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    // 4 tick marks around ring
    for (let i = 0; i < 4; i++) {
      const ang = (Math.PI / 2) * i;
      ctx.strokeStyle = a; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * 13, cy + Math.sin(ang) * 13);
      ctx.lineTo(cx + Math.cos(ang) * 17, cy + Math.sin(ang) * 17);
      ctx.stroke();
    }
    // Thin line
    gradLine(x + 28, x + w, y, p, 'transparent', 1.5);

  } else if (lvl === 2) {
    // ── مشبوه: Green serpent — wavy organic left, flowing line ───────────────
    ctx.strokeStyle = p; ctx.lineWidth = 2; ctx.shadowColor = p; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.bezierCurveTo(x + 6, y - 6, x + 14, y + 6, x + 22, y);
    ctx.bezierCurveTo(x + 28, y - 5, x + 32, y + 3, x + 36, y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Small leaf dots
    [x + 10, x + 24, x + 4].forEach((px, i) => {
      ctx.fillStyle = [p, a, s][i];
      ctx.beginPath(); ctx.arc(px, y + (i % 2 === 0 ? -4 : 4), 2.5, 0, Math.PI * 2); ctx.fill();
    });
    // Wavy-to-straight line
    const g2 = ctx.createLinearGradient(x + 36, y, x + w, y);
    g2.addColorStop(0, p); g2.addColorStop(0.5, p + '88'); g2.addColorStop(1, 'transparent');
    ctx.strokeStyle = g2; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + 36, y); ctx.lineTo(x + w, y); ctx.stroke();
    // Thin second line
    gradLine(x + 36, x + w * 0.6, y + 4, a + '55', 'transparent', 1);

  } else if (lvl === 3) {
    // ── بلطجي: Blue — sharp angular jagged element ───────────────────────────
    ctx.shadowColor = p; ctx.shadowBlur = 12;
    ctx.fillStyle = p;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + 10, y - 9);
    ctx.lineTo(x + 18, y - 2);
    ctx.lineTo(x + 26, y - 11);
    ctx.lineTo(x + 34, y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // Secondary outline
    ctx.strokeStyle = a + 'aa'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + 10, y - 9);
    ctx.lineTo(x + 18, y - 2);
    ctx.lineTo(x + 26, y - 11);
    ctx.lineTo(x + 34, y + 2);
    ctx.stroke();
    // Bold main line
    ctx.shadowColor = p; ctx.shadowBlur = 10;
    gradLine(x + 36, x + w, y, p, 'transparent', 3);
    // Thin top line
    ctx.shadowBlur = 0;
    gradLine(x + 36, x + w * 0.55, y - 4, a + '66', 'transparent', 1);

  } else if (lvl === 4) {
    // ── محقق: Purple — shield + double line ──────────────────────────────────
    const shX = x + 14, shY = y;
    ctx.shadowColor = p; ctx.shadowBlur = 12;
    ctx.strokeStyle = p; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(shX, shY - 12);
    ctx.lineTo(shX + 11, shY - 7);
    ctx.lineTo(shX + 11, shY + 3);
    ctx.quadraticCurveTo(shX + 11, shY + 11, shX, shY + 14);
    ctx.quadraticCurveTo(shX - 11, shY + 11, shX - 11, shY + 3);
    ctx.lineTo(shX - 11, shY - 7);
    ctx.closePath();
    const shG = ctx.createLinearGradient(shX - 11, shY - 12, shX + 11, shY + 14);
    shG.addColorStop(0, p + '44'); shG.addColorStop(1, s + '66');
    ctx.fillStyle = shG; ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Inner shield line
    ctx.strokeStyle = a + 'aa'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(shX, shY - 6); ctx.lineTo(shX, shY + 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(shX - 6, shY - 2); ctx.lineTo(shX + 6, shY - 2); ctx.stroke();
    // Double line
    gradLine(x + 28, x + w, y - 3, p, 'transparent', 2);
    gradLine(x + 28, x + w * 0.7, y + 3, a + '55', 'transparent', 1);

  } else if (lvl === 5) {
    // ── قاتل: Orange/fire — wing-like flames + dark bar ──────────────────────
    // Left flame wing
    ctx.shadowColor = p; ctx.shadowBlur = 14;
    ctx.fillStyle = p;
    ctx.beginPath();
    ctx.moveTo(x + 18, y);
    ctx.bezierCurveTo(x + 10, y - 14, x - 2, y - 8, x, y + 2);
    ctx.bezierCurveTo(x + 8, y - 2, x + 14, y + 2, x + 18, y);
    ctx.closePath(); ctx.fill();
    // Second inner flame
    ctx.fillStyle = a;
    ctx.beginPath();
    ctx.moveTo(x + 18, y);
    ctx.bezierCurveTo(x + 12, y - 9, x + 4, y - 5, x + 6, y + 1);
    ctx.bezierCurveTo(x + 11, y - 1, x + 15, y + 1, x + 18, y);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    // Fire circle center
    ctx.strokeStyle = a; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x + 18, y, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = p + 'aa';
    ctx.beginPath(); ctx.arc(x + 18, y, 3, 0, Math.PI * 2); ctx.fill();
    // Bar with glow
    ctx.shadowColor = p; ctx.shadowBlur = 8;
    gradLine(x + 26, x + w, y, p, 'transparent', 2.5);
    ctx.shadowBlur = 0;
    gradLine(x + 26, x + w * 0.5, y + 4, a + '44', 'transparent', 1);

  } else if (lvl === 6) {
    // ── مافيا: Red — dark orb / sun circle + crimson bar ─────────────────────
    const cx = x + 16, cy = y;
    // Outer sun rays
    ctx.shadowColor = p; ctx.shadowBlur = 14;
    ctx.strokeStyle = p; ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI / 4) * i;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * 10, cy + Math.sin(ang) * 10);
      ctx.lineTo(cx + Math.cos(ang) * 15, cy + Math.sin(ang) * 15);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // Main circle
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
    cg.addColorStop(0, a); cg.addColorStop(0.6, p); cg.addColorStop(1, s);
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
    // Outer ring
    ctx.shadowColor = p; ctx.shadowBlur = 10;
    ctx.strokeStyle = p; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    // Bold crimson bar
    ctx.shadowColor = p; ctx.shadowBlur = 8;
    gradLine(x + 30, x + w, y, p, 'transparent', 3);
    ctx.shadowBlur = 0;
    gradLine(x + 30, x + w * 0.6, y + 5, p + '33', 'transparent', 1);

  } else if (lvl === 7) {
    // ── دون: Pink/rose — butterfly wings ─────────────────────────────────────
    const cx = x + 20, cy = y;
    ctx.shadowColor = p; ctx.shadowBlur = 14;
    // Upper wings
    ctx.fillStyle = p + 'cc';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(cx - 6, cy - 14, cx - 20, cy - 12, cx - 18, cy - 2);
    ctx.bezierCurveTo(cx - 14, cy + 4, cx - 6, cy + 2, cx, cy);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = a + 'cc';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(cx + 6, cy - 14, cx + 20, cy - 12, cx + 18, cy - 2);
    ctx.bezierCurveTo(cx + 14, cy + 4, cx + 6, cy + 2, cx, cy);
    ctx.closePath(); ctx.fill();
    // Lower wings (smaller)
    ctx.fillStyle = s + 'aa';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(cx - 5, cy + 8, cx - 14, cy + 10, cx - 12, cy + 3);
    ctx.bezierCurveTo(cx - 8, cy, cx - 4, cy + 1, cx, cy);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(cx + 5, cy + 8, cx + 14, cy + 10, cx + 12, cy + 3);
    ctx.bezierCurveTo(cx + 8, cy, cx + 4, cy + 1, cx, cy);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    // Center body dot
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();
    // Elegant line
    ctx.shadowColor = p; ctx.shadowBlur = 8;
    gradLine(x + 42, x + w, y, p, 'transparent', 2);
    ctx.shadowBlur = 0;
    gradLine(x + 42, x + w * 0.65, y + 5, a + '44', 'transparent', 1);

  } else {
    // ── زعيم: Gold — ornate sword / triple crown bar ─────────────────────────
    const mx = x + 20, my = y;
    ctx.shadowColor = p; ctx.shadowBlur = 18;
    // Diamond center
    ctx.fillStyle = p;
    diamond(ctx, mx, my, 10); ctx.fill();
    ctx.strokeStyle = a; ctx.lineWidth = 1.5;
    diamond(ctx, mx, my, 10); ctx.stroke();
    ctx.shadowBlur = 0;
    // Inner smaller diamond
    ctx.fillStyle = '#fffde7';
    diamond(ctx, mx, my, 5); ctx.fill();
    // Horizontal sword blade extending both sides from diamond
    ctx.shadowColor = p; ctx.shadowBlur = 12;
    const bladG = ctx.createLinearGradient(mx - 20, my, mx + 30, my);
    bladG.addColorStop(0, 'transparent'); bladG.addColorStop(0.3, s);
    bladG.addColorStop(0.7, p); bladG.addColorStop(1, a);
    ctx.strokeStyle = bladG; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(mx - 18, my); ctx.lineTo(mx - 11, my); ctx.stroke();
    ctx.shadowBlur = 0;
    // Main ornate bar — triple lines
    ctx.shadowColor = p; ctx.shadowBlur = 10;
    gradLine(x + 34, x + w, y, p, 'transparent', 3);
    ctx.shadowBlur = 0;
    gradLine(x + 34, x + w * 0.8, y - 4, a + '88', 'transparent', 1);
    gradLine(x + 34, x + w * 0.8, y + 4, a + '88', 'transparent', 1);
    // Small diamond accents along bar
    [x + 80, x + 160, x + 260].forEach(dx => {
      ctx.fillStyle = a + 'cc';
      diamond(ctx, dx, y, 3); ctx.fill();
    });
  }

  ctx.restore();
}

async function generateProfileCard(userID, avatarData) {
  const stats = loadStats();
  const data  = stats[userID];
  if (!data) return null;

  const W = 950, H = 620;
  const SCALE = 2;
  const canvas = createCanvas(W * SCALE, H * SCALE);
  const ctx    = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  const { current, next, xpInLevel, xpForNext, progress } = getLevelInfo(data.xp || 0);
  const theme = LEVEL_THEMES[current.level - 1] || LEVEL_THEMES[0];
  const lvlColor = theme.primary;

  // ── Background & Pattern ────────────────────────────────────────────────────
  drawBackground(ctx, W, H, theme, current.level);

  // ── Frame Bars ──────────────────────────────────────────────────────────────
  drawHeaderBar(ctx, W, theme);
  drawBottomBar(ctx, W, H, theme);

  // ── Corner Ornaments ────────────────────────────────────────────────────────
  drawCorners(ctx, W, H, theme);

  // ── Vertical divider line ────────────────────────────────────────────────────
  const divX = 235;
  const divGrad = ctx.createLinearGradient(divX, 20, divX, H - 20);
  divGrad.addColorStop(0, 'transparent');
  divGrad.addColorStop(0.25, lvlColor + '55');
  divGrad.addColorStop(0.75, lvlColor + '55');
  divGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(divX, 20); ctx.lineTo(divX, H - 20); ctx.stroke();

  // ── Avatar ──────────────────────────────────────────────────────────────────
  const AX = 117, AY = 148, AR = 82;

  // Rings (behind avatar)
  drawAvatarRings(ctx, AX, AY, AR, theme, current.level);

  // Clip & draw avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(AX, AY, AR, 0, Math.PI * 2);
  ctx.clip();

  let avatarLoaded = false;
  if (avatarData) {
    try {
      const img = await loadImage(avatarData);
      if (img) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, AX - AR, AY - AR, AR * 2, AR * 2);
        avatarLoaded = true;
      }
    } catch(e) { console.error('[profile] loadImage fail:', e.message); }
  }

  if (!avatarLoaded) {
    const avatarGrad = ctx.createRadialGradient(AX, AY - 20, 0, AX, AY, AR);
    avatarGrad.addColorStop(0, lvlColor + 'dd');
    avatarGrad.addColorStop(0.6, lvlColor + '77');
    avatarGrad.addColorStop(1, theme.bg1);
    ctx.fillStyle = avatarGrad;
    ctx.fillRect(AX - AR, AY - AR, AR * 2, AR * 2);
    const nameStr = (data.name || '').trim();
    const initial = nameStr.length > 0 ? nameStr[0] : '★';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 12;
    ctx.font = `bold ${Math.round(AR * 1.05)}px NotoArabic, DejaVu Sans, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, AX, AY + 4);
    ctx.shadowBlur = 0;
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  // Front ring on top of avatar
  ctx.save();
  ctx.shadowColor = lvlColor;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = lvlColor + 'cc';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(AX, AY, AR + 1, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // ── Level Badge ──────────────────────────────────────────────────────────────
  drawLevelBadge(ctx, AX, AY, AR, theme, current);

  // ── Tier indicator (stars + tier name) below badge ────────────────────────────
  {
    const tierY = AY + AR + 52;
    const tierLabels = ['', 'مبتدئ', 'متوسط', 'متقدم', 'أسطوري'];
    const tierColors = ['', '#78909c', '#2979ff', '#ff6d00', '#ffd700'];
    const tc = tierColors[theme.tier] || '#aaa';
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = tc; ctx.shadowBlur = 8;
    ctx.fillStyle = tc;
    ctx.font = '13px DejaVu Sans, sans-serif';
    const stars = '★'.repeat(theme.tier) + '☆'.repeat(4 - theme.tier);
    ctx.fillText(stars, AX, tierY);
    ctx.shadowBlur = 0;
    ctx.fillStyle = tc + 'bb';
    ctx.font = '11px NotoArabic, DejaVu Sans, sans-serif';
    ctx.fillText(tierLabels[theme.tier] || '', AX, tierY + 18);
    ctx.restore();
  }

  // ── Left panel mini-stats ─────────────────────────────────────────────────────
  {
    const lsY = AY + AR + 90;
    const lsItems = [
      { label: 'انتصار', value: data.wins || 0, color: '#00e676' },
      { label: 'هزيمة',  value: data.losses || 0, color: '#f44336' },
      { label: 'ألعاب',  value: data.games || 0, color: lvlColor },
    ];
    ctx.save();
    ctx.textAlign = 'center';
    // Background panel
    roundRect(ctx, AX - 82, lsY, 164, 68, 10);
    ctx.fillStyle = '#0c0c14cc';
    ctx.fill();
    ctx.strokeStyle = lvlColor + '22';
    ctx.lineWidth = 1;
    roundRect(ctx, AX - 82, lsY, 164, 68, 10);
    ctx.stroke();
    // Top accent
    ctx.save();
    roundRect(ctx, AX - 82, lsY, 164, 3, 10);
    ctx.clip();
    const lsTopG = ctx.createLinearGradient(AX - 82, 0, AX + 82, 0);
    lsTopG.addColorStop(0, 'transparent');
    lsTopG.addColorStop(0.5, lvlColor + 'aa');
    lsTopG.addColorStop(1, 'transparent');
    ctx.fillStyle = lsTopG;
    ctx.fillRect(AX - 82, lsY, 164, 3);
    ctx.restore();
    // Stat values
    lsItems.forEach((it, i) => {
      const ix = AX - 82 + 27 + i * 55;
      ctx.fillStyle = it.color;
      ctx.shadowColor = it.color; ctx.shadowBlur = 5;
      ctx.font = 'bold 16px NotoArabic, DejaVu Sans, sans-serif';
      ctx.fillText(String(it.value), ix, lsY + 28);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#555';
      ctx.font = '9px NotoArabic, DejaVu Sans, sans-serif';
      ctx.fillText(it.label, ix, lsY + 48);
    });
    ctx.restore();
  }

  // ── User ID watermark (left panel bottom) ─────────────────────────────────────
  {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '10px DejaVu Sans, sans-serif';
    ctx.fillStyle = lvlColor + '33';
    ctx.fillText(`#${String(userID).slice(-8)}`, AX, AY + AR + 176);
    ctx.restore();
  }

  // ── Name ─────────────────────────────────────────────────────────────────────
  const nameX = W - 38;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px NotoArabic, DejaVu Sans, sans-serif';
  ctx.textAlign = 'right';
  ctx.direction = 'rtl';
  ctx.shadowColor = lvlColor + 'aa';
  ctx.shadowBlur = 8;
  ctx.fillText(data.name || 'لاعب', nameX, 82);
  ctx.restore();

  // ── XP label ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = theme.accent;
  ctx.font = '15px NotoArabic, DejaVu Sans, sans-serif';
  ctx.textAlign = 'right';
  if (next) {
    ctx.fillText(`${(data.xp||0).toLocaleString()} / ${next.xp.toLocaleString()} XP  ←  ${next.name}`, nameX, 118);
  } else {
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`${(data.xp||0).toLocaleString()} XP  🏆 المستوى الأعلى`, nameX, 118);
  }

  // Underline below name
  const nameW = ctx.measureText(data.name || 'لاعب').width;
  const ulX = nameX - Math.min(nameW, 350);
  const ulGrad = ctx.createLinearGradient(ulX, 0, nameX, 0);
  ulGrad.addColorStop(0, 'transparent');
  ulGrad.addColorStop(1, lvlColor + 'bb');
  ctx.strokeStyle = ulGrad; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(ulX, 90); ctx.lineTo(nameX, 90); ctx.stroke();

  // ── XP Bar ───────────────────────────────────────────────────────────────────
  const barX = 252, barY = 130, barW = W - 288, barH = 28;
  drawStyledXPBar(ctx, barX, barY, barW, barH, progress, theme, current);

  // ── Level title bar ───────────────────────────────────────────────────────────
  const ltbX = divX + 14, ltbY = 174;
  drawLevelTitleBar(ctx, ltbX, ltbY, W - ltbX - 38, theme, current);

  // ── Horizontal divider ───────────────────────────────────────────────────────
  const hDivY = 192;
  const hGrad = ctx.createLinearGradient(divX + 10, 0, W - 30, 0);
  hGrad.addColorStop(0, lvlColor + '66');
  hGrad.addColorStop(0.5, lvlColor + '33');
  hGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = hGrad;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(divX + 10, hDivY); ctx.lineTo(W - 30, hDivY); ctx.stroke();
  if (theme.tier >= 3) {
    ctx.save();
    ctx.fillStyle = lvlColor + '99';
    diamond(ctx, divX + 10, hDivY, 4);
    ctx.fill();
    ctx.restore();
  }

  // ── Stats Grid (Row 1) ───────────────────────────────────────────────────────
  const statItems = [
    { label: 'ألعاب',  value: data.games    || 0, icon: '🎮' },
    { label: 'انتصار', value: data.wins     || 0, icon: '🏆' },
    { label: 'هزيمة',  value: data.losses   || 0, icon: '💀' },
    { label: 'قتل',    value: data.kills    || 0, icon: '🔫' },
    { label: 'نجاة',   value: data.survived || 0, icon: '🛡️' },
  ];

  const cols = statItems.length;
  const startX = divX + 14;
  const rightMargin = 38;
  const gap = 10;
  const boxW = Math.floor((W - startX - rightMargin - gap * (cols - 1)) / cols);
  const boxH = 90;
  const totalW = cols * boxW + (cols - 1) * gap;
  const startY = 208;

  statItems.forEach((s, i) => {
    const bx = startX + i * (boxW + gap);
    const by = startY;

    roundRect(ctx, bx, by, boxW, boxH, 10);
    const boxBg = ctx.createLinearGradient(bx, by, bx + boxW, by + boxH);
    boxBg.addColorStop(0, '#16161e');
    boxBg.addColorStop(1, '#0e0e16');
    ctx.fillStyle = boxBg;
    ctx.fill();

    ctx.save();
    roundRect(ctx, bx, by, boxW, 3, 10);
    ctx.clip();
    const topAccent = ctx.createLinearGradient(bx, 0, bx + boxW, 0);
    topAccent.addColorStop(0, lvlColor + '00');
    topAccent.addColorStop(0.4, lvlColor + 'cc');
    topAccent.addColorStop(1, lvlColor + '00');
    ctx.fillStyle = topAccent;
    ctx.fillRect(bx, by, boxW, 3);
    ctx.restore();

    ctx.strokeStyle = lvlColor + (theme.tier >= 3 ? '44' : '22');
    ctx.lineWidth = 1;
    roundRect(ctx, bx, by, boxW, boxH, 10);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px NotoArabic, DejaVu Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = lvlColor + '88';
    ctx.shadowBlur = theme.tier >= 3 ? 8 : 0;
    ctx.fillText(String(s.value), bx + boxW/2, by + 48);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#777777';
    ctx.font = '13px NotoArabic, DejaVu Sans, sans-serif';
    ctx.fillText(`${s.icon} ${s.label}`, bx + boxW/2, by + 73);
  });

  // ── Win Rate bar ──────────────────────────────────────────────────────────────
  const games = data.games || 0;
  const wr = games > 0 ? (data.wins || 0) / games : 0;
  const wrPct = Math.round(wr * 100);
  const wrBarX = startX, wrBarY = startY + boxH + 18, wrBarW = totalW, wrBarH = 14;

  ctx.fillStyle = '#888';
  ctx.font = '12px NotoArabic, DejaVu Sans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`نسبة الفوز  ${wrPct}%`, wrBarX, wrBarY - 4);

  // Favorite role on right of win rate label
  const roleEntries = Object.entries(data.roleCounts || {});
  if (roleEntries.length > 0) {
    const favRole = roleEntries.sort((a, b) => b[1] - a[1])[0][0];
    ctx.fillStyle = theme.accent + 'aa';
    ctx.font = '12px NotoArabic, DejaVu Sans, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`الدور المفضل: ${favRole}`, W - 38, wrBarY - 4);
  }

  roundRect(ctx, wrBarX, wrBarY, wrBarW, wrBarH, 7);
  ctx.fillStyle = '#0d0d1a'; ctx.fill();
  ctx.strokeStyle = '#ffffff11'; ctx.lineWidth = 1; ctx.stroke();

  if (wr > 0) {
    roundRect(ctx, wrBarX, wrBarY, Math.max(wrBarW * wr, 14), wrBarH, 7);
    const wrGrad = ctx.createLinearGradient(wrBarX, 0, wrBarX + wrBarW, 0);
    wrGrad.addColorStop(0, '#00c85388');
    wrGrad.addColorStop(1, '#00e676');
    ctx.fillStyle = wrGrad; ctx.fill();
  }

  // ── Section divider 2 ────────────────────────────────────────────────────────
  const div2Y = wrBarY + 38;
  {
    const g2 = ctx.createLinearGradient(startX, 0, W - 30, 0);
    g2.addColorStop(0, lvlColor + '22');
    g2.addColorStop(0.4, lvlColor + '11');
    g2.addColorStop(1, 'transparent');
    ctx.strokeStyle = g2; ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(startX, div2Y); ctx.lineTo(W - 30, div2Y); ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Derived Stats Row 2 ───────────────────────────────────────────────────────
  const d2startY = div2Y + 14;
  const derivedItems = [
    {
      label: 'نسبة الفوز',
      value: games > 0 ? `${Math.round((data.wins||0)/games*100)}%` : '—',
      color: '#00e676',
    },
    {
      label: 'قتل/مباراة',
      value: games > 0 ? ((data.kills||0)/games).toFixed(1) : '—',
      color: lvlColor,
    },
    {
      label: 'معدل النجاة',
      value: games > 0 ? `${Math.round((data.survived||0)/games*100)}%` : '—',
      color: '#82b1ff',
    },
    {
      label: 'إجمالي XP',
      value: (data.xp||0) >= 1000 ? `${((data.xp||0)/1000).toFixed(1)}K` : String(data.xp||0),
      color: theme.accent,
    },
  ];

  const d2cols = derivedItems.length;
  const d2gap = 10;
  const d2boxW = Math.floor((totalW - d2gap * (d2cols - 1)) / d2cols);
  const d2boxH = 74;

  derivedItems.forEach((d, i) => {
    const bx = startX + i * (d2boxW + d2gap);
    const by = d2startY;

    roundRect(ctx, bx, by, d2boxW, d2boxH, 9);
    ctx.fillStyle = '#0c0c16';
    ctx.fill();

    // Left accent bar
    ctx.save();
    roundRect(ctx, bx, by, 3, d2boxH, 9);
    ctx.clip();
    ctx.fillStyle = d.color + 'dd';
    ctx.fillRect(bx, by, 3, d2boxH);
    ctx.restore();

    ctx.strokeStyle = d.color + '25';
    ctx.lineWidth = 1;
    roundRect(ctx, bx, by, d2boxW, d2boxH, 9);
    ctx.stroke();

    // Value
    ctx.fillStyle = d.color;
    ctx.font = 'bold 24px NotoArabic, DejaVu Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = d.color + '99';
    ctx.shadowBlur = 8;
    ctx.fillText(d.value, bx + d2boxW / 2, by + 36);
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = '#555';
    ctx.font = '11px NotoArabic, DejaVu Sans, sans-serif';
    ctx.fillText(d.label, bx + d2boxW / 2, by + 58);
  });

  // ── Section divider 3 (before level journey) ──────────────────────────────────
  const div3Y = d2startY + d2boxH + 20;
  {
    const g3 = ctx.createLinearGradient(startX, 0, W - 30, 0);
    g3.addColorStop(0, lvlColor + '44');
    g3.addColorStop(0.5, lvlColor + '22');
    g3.addColorStop(1, 'transparent');
    ctx.strokeStyle = g3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(startX, div3Y); ctx.lineTo(W - 30, div3Y); ctx.stroke();
  }

  // ── Level Journey ─────────────────────────────────────────────────────────────
  const ljY = div3Y + 14;
  {
    ctx.save();
    ctx.fillStyle = lvlColor + '66';
    ctx.font = '11px NotoArabic, DejaVu Sans, sans-serif';
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    ctx.fillText('مسيرة المستوى', W - 38, ljY - 4);
    ctx.direction = 'ltr';

    const ljW = totalW;
    const dotR = 8;
    const spacing = Math.floor((ljW - dotR * 2) / (LEVELS.length - 1));

    for (let i = 0; i < LEVELS.length; i++) {
      const lv    = LEVELS[i];
      const dotX  = startX + dotR + i * spacing;
      const dotY  = ljY + 18;
      const isReached = current.level >= lv.level;
      const isCurrent = current.level === lv.level;
      const lvTheme   = LEVEL_THEMES[i] || LEVEL_THEMES[0];

      // Connector line between dots
      if (i < LEVELS.length - 1) {
        const nextX = startX + dotR + (i + 1) * spacing;
        if (isReached && current.level > lv.level) {
          const lineG = ctx.createLinearGradient(dotX + dotR, dotY, nextX - dotR, dotY);
          lineG.addColorStop(0, lvlColor + '88');
          lineG.addColorStop(1, lvlColor + '44');
          ctx.strokeStyle = lineG;
        } else {
          ctx.strokeStyle = '#1e1e2a';
        }
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(dotX + dotR, dotY); ctx.lineTo(nextX - dotR, dotY); ctx.stroke();
      }

      // Dot
      if (isCurrent) {
        ctx.shadowColor = lvlColor; ctx.shadowBlur = 20;
        const pulse = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, dotR + 5);
        pulse.addColorStop(0, '#ffffff');
        pulse.addColorStop(0.4, lvlColor);
        pulse.addColorStop(1, lvlColor + '00');
        ctx.fillStyle = pulse;
        ctx.beginPath(); ctx.arc(dotX, dotY, dotR + 5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = lvlColor;
        ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2); ctx.stroke();
      } else if (isReached) {
        ctx.fillStyle = lvTheme.primary + 'cc';
        ctx.shadowColor = lvTheme.primary; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(dotX, dotY, dotR - 2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff55';
        ctx.beginPath(); ctx.arc(dotX - 2, dotY - 2, 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#121220';
        ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }

      // Level name (alternating above/below)
      ctx.fillStyle = isCurrent ? lvlColor : (isReached ? '#4a4a6a' : '#2a2a3a');
      ctx.font = `${isCurrent ? 'bold ' : ''}9px NotoArabic, DejaVu Sans, sans-serif`;
      ctx.textAlign = 'center';
      const nameOffY = i % 2 === 0 ? dotY + 22 : dotY - 14;
      ctx.fillText(lv.name, dotX, nameOffY);

      // Level number for current
      if (isCurrent) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 7px DejaVu Sans, sans-serif';
        ctx.fillText(String(lv.level), dotX, dotY + 3);
      }
    }

    ctx.restore();
  }

  // ── Watermark ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = lvlColor + '20';
  ctx.font = 'bold 11px DejaVu Sans, sans-serif';
  ctx.textAlign = 'left';
  ctx.direction = 'ltr';
  ctx.fillText('MAFIA BOT', 30, H - 12);

  return canvas.toBuffer('image/png');
}

module.exports = { loadStats, saveStats, getPlayer, awardXP, generateProfileCard, getLevelInfo };
