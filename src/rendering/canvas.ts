import { CEILING_Y, GROUND_Y, H, THEMES, W, WALL_L, WALL_R, type ThemeName } from '../constants';

// ============================ RENDER HELPERS ========================
export function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  if (r > Math.min(w, h) / 2) r = Math.min(w, h) / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

/** Ambient atmosphere layer — drifting flecks per world. Procedural and
 *  allocation-free: particle positions are derived from `i` and `t`, so
 *  there's no array to manage or GC pressure. Drawn after the silhouettes
 *  but before the floor so they sit "in front of" the parallax. */
function drawAmbience(ctx: CanvasRenderingContext2D, theme: ThemeName, t: number) {
  if (theme === 'arctic') {
    // Drifting snowflakes
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 32; i++) {
      const seedX = (i * 113) % W;
      const wobble = Math.sin(t * 0.6 + i * 1.3) * 18;
      const x = (seedX + wobble + W) % W;
      const y = ((t * (18 + (i % 5) * 3) + i * 47) % (GROUND_Y - CEILING_Y)) + CEILING_Y;
      const r = 1 + (i % 3) * 0.6;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (theme === 'volcano') {
    // Rising embers — orange dots that drift upward and fade
    for (let i = 0; i < 24; i++) {
      const px = (i * 167 + Math.sin(t * 1.2 + i) * 22) % W;
      const rise = (t * (50 + (i % 4) * 10) + i * 73) % (GROUND_Y - CEILING_Y);
      const y = GROUND_Y - 6 - rise;
      const life = 1 - rise / (GROUND_Y - CEILING_Y);
      ctx.fillStyle = `rgba(255,${100 + Math.floor(life * 90)},0,${(life * 0.7).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(px, y, 1.6 + life * 1.4, 0, Math.PI * 2); ctx.fill();
    }
  } else if (theme === 'desert') {
    // Dust motes drifting right
    for (let i = 0; i < 28; i++) {
      const px = (i * 89 + t * (12 + (i % 4) * 4)) % W;
      const py = CEILING_Y + 30 + ((i * 53) % (GROUND_Y - CEILING_Y - 60));
      const wob = Math.sin(t * 0.8 + i) * 6;
      ctx.fillStyle = `rgba(255,220,150,${0.18 + (i % 3) * 0.06})`;
      ctx.beginPath(); ctx.arc(px, py + wob, 1.5 + (i % 2), 0, Math.PI * 2); ctx.fill();
    }
  } else if (theme === 'city') {
    // Slow neon flecks rising
    for (let i = 0; i < 20; i++) {
      const px = (i * 137) % W;
      const rise = (t * (30 + (i % 3) * 8) + i * 91) % (GROUND_Y - CEILING_Y - 40);
      const y = GROUND_Y - 20 - rise;
      const hue = (i * 47) % 360;
      ctx.fillStyle = `hsla(${hue}, 90%, 65%, 0.35)`;
      ctx.beginPath(); ctx.arc(px, y, 1.2 + (i % 2) * 0.8, 0, Math.PI * 2); ctx.fill();
    }
  } else if (theme === 'beach') {
    // Sparkling water reflections on the sea band
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 14; i++) {
      const px = (i * 73 + (t * 25) % 73) % W;
      const py = GROUND_Y - 75 + Math.sin(t * 2 + i) * 3;
      const flicker = 0.4 + Math.abs(Math.sin(t * 4 + i)) * 0.6;
      ctx.globalAlpha = flicker * 0.7;
      ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (theme === 'airship') {
    // Wind streaks — short thin diagonal dashes drifting left
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
      const x = (i * 71 + W - (t * 60) % W) % W;
      const y = CEILING_Y + 20 + ((i * 41) % (GROUND_Y - CEILING_Y - 40));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 10, y + 2);
      ctx.stroke();
    }
  } else if (theme === 'boss') {
    // Cosmic twinkles + slow drift toward center
    for (let i = 0; i < 40; i++) {
      const baseX = (i * 53) % W;
      const baseY = CEILING_Y + ((i * 71) % (GROUND_Y - CEILING_Y));
      const pull = Math.sin(t * 0.4 + i) * 6;
      const flicker = 0.3 + Math.abs(Math.sin(t * 2 + i * 0.7)) * 0.7;
      ctx.fillStyle = `rgba(255,255,255,${flicker * 0.55})`;
      ctx.beginPath(); ctx.arc(baseX + pull, baseY, 1 + (i % 2) * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export function drawBackground(ctx, theme, t) {
  const T = THEMES[theme];
  // Sky gradient
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, T.sky1);
  g.addColorStop(1, T.sky2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // Sun / moon
  if (theme === 'beach') {
    ctx.fillStyle = '#fff5b1';
    ctx.beginPath(); ctx.arc(770, 110, 38, 0, Math.PI * 2); ctx.fill();
  } else if (theme === 'desert') {
    ctx.fillStyle = '#ff6b35';
    ctx.beginPath(); ctx.arc(200, 130, 50, 0, Math.PI * 2); ctx.fill();
  } else if (theme === 'arctic') {
    ctx.fillStyle = '#dfeefd';
    ctx.beginPath(); ctx.arc(750, 110, 32, 0, Math.PI * 2); ctx.fill();
    // Stars
    for (let i = 0; i < 30; i++) {
      const sx = (i * 73 + 17) % W, sy = ((i * 37) % 200);
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(t * 2 + i) * 0.3})`;
      ctx.fillRect(sx, sy + 50, 2, 2);
    }
  } else if (theme === 'city') {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(810, 115, 24, 0, Math.PI * 2); ctx.fill();
  } else if (theme === 'volcano') {
    ctx.fillStyle = '#ffb703';
    ctx.beginPath(); ctx.arc(740, 120, 34 + Math.sin(t * 4) * 4, 0, Math.PI * 2); ctx.fill();
  } else if (theme === 'airship') {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 6; i++) {
      const cx = (i * 190 + (t * 18) % 190) - 40;
      ctx.beginPath(); ctx.ellipse(cx, 120 + (i % 3) * 38, 42, 12, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (theme === 'boss') {
    // Energy rings
    for (let i = 0; i < 4; i++) {
      const r = (t * 60 + i * 80) % 400;
      ctx.strokeStyle = `rgba(255,43,136,${0.4 - r / 800})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(W / 2, 200, r, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // Distant scenery silhouettes
  if (theme === 'beach') {
    // Sea band
    ctx.fillStyle = '#4a90e2';
    ctx.fillRect(0, GROUND_Y - 90, W, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 8; i++) {
      const wx = (i * 130 + (t * 30) % 130);
      ctx.fillRect(wx, GROUND_Y - 80, 30, 2);
    }
    // Palm silhouettes
    ctx.fillStyle = '#2d4a1a';
    for (let i = 0; i < 3; i++) {
      const px = 100 + i * 350;
      ctx.fillRect(px, GROUND_Y - 70, 6, 60);
      ctx.beginPath();
      ctx.arc(px + 3, GROUND_Y - 70, 18, Math.PI, 0);
      ctx.fill();
    }
  } else if (theme === 'desert') {
    // Dune silhouettes
    ctx.fillStyle = '#a8602a';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y - 30);
    for (let x = 0; x <= W; x += 20) {
      ctx.lineTo(x, GROUND_Y - 30 - Math.sin(x * 0.01) * 20);
    }
    ctx.lineTo(W, GROUND_Y); ctx.lineTo(0, GROUND_Y); ctx.closePath(); ctx.fill();
  } else if (theme === 'arctic') {
    // Mountain triangles
    ctx.fillStyle = '#6a90b8';
    for (let i = 0; i < 6; i++) {
      const mx = i * 180 + 60;
      ctx.beginPath();
      ctx.moveTo(mx, GROUND_Y - 30);
      ctx.lineTo(mx + 100, GROUND_Y - 150);
      ctx.lineTo(mx + 200, GROUND_Y - 30);
      ctx.closePath(); ctx.fill();
    }
    // Snow caps
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) {
      const mx = i * 180 + 60;
      ctx.beginPath();
      ctx.moveTo(mx + 70, GROUND_Y - 105);
      ctx.lineTo(mx + 100, GROUND_Y - 150);
      ctx.lineTo(mx + 130, GROUND_Y - 105);
      ctx.closePath(); ctx.fill();
    }
  } else if (theme === 'city') {
    ctx.fillStyle = '#1d2534';
    for (let i = 0; i < 11; i++) {
      const bw = 55 + (i % 3) * 18;
      const bh = 90 + ((i * 37) % 110);
      const bx = i * 92 - 16;
      ctx.fillRect(bx, GROUND_Y - bh, bw, bh);
      ctx.fillStyle = 'rgba(255,230,109,0.35)';
      for (let y = GROUND_Y - bh + 18; y < GROUND_Y - 20; y += 24) {
        ctx.fillRect(bx + 10, y, 8, 10);
        ctx.fillRect(bx + 32, y, 8, 10);
      }
      ctx.fillStyle = '#1d2534';
    }
  } else if (theme === 'volcano') {
    ctx.fillStyle = '#2b1110';
    ctx.beginPath();
    ctx.moveTo(40, GROUND_Y - 20);
    ctx.lineTo(260, GROUND_Y - 230);
    ctx.lineTo(470, GROUND_Y - 20);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff5400';
    ctx.beginPath();
    ctx.moveTo(238, GROUND_Y - 210);
    ctx.lineTo(260, GROUND_Y - 230);
    ctx.lineTo(285, GROUND_Y - 205);
    ctx.lineTo(272, GROUND_Y - 155);
    ctx.lineTo(248, GROUND_Y - 178);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,84,0,0.5)';
    for (let i = 0; i < 5; i++) ctx.fillRect((i * 173 + 80) % W, GROUND_Y - 24, 80, 4);
  } else if (theme === 'airship') {
    ctx.fillStyle = '#6c5a45';
    ctx.beginPath();
    ctx.ellipse(W / 2, GROUND_Y - 120, 260, 52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2f241a';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#b08968';
    ctx.fillRect(W / 2 - 90, GROUND_Y - 88, 180, 34);
  }

  // Ambient atmosphere layer (theme-specific drift particles)
  drawAmbience(ctx, theme, t);

  // Floor
  const fg = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  fg.addColorStop(0, T.g1); fg.addColorStop(1, T.g2);
  ctx.fillStyle = fg;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  // Floor top stripe
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, GROUND_Y, W, 2);

  // Walls
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, WALL_L, GROUND_Y);
  ctx.fillRect(WALL_R, 0, W - WALL_R, GROUND_Y);
  // Ceiling decorative band
  ctx.fillRect(0, 0, W, CEILING_Y);
  ctx.fillStyle = T.acc;
  ctx.fillRect(0, CEILING_Y - 4, W, 4);
}

/** Decorative bouncing ball for the menu background. */
export function drawDemoBall(ctx, x, y, r, colors) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, GROUND_Y + 2, r * 0.7, 4, 0, 0, Math.PI * 2); ctx.fill();
  const grad = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.25, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1c0010'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.18, -0.4, 0, Math.PI * 2);
  ctx.fill();
}
