/* Mise - procedural illustration: ingredients, tools, vessels, dishes, hands, people. */
(function () {
  "use strict";
  const M = window.Mise;
  const Art = (M.art = {});

  // ---------- helpers ----------
  Art.rr = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  Art.ellipse = function (ctx, x, y, rx, ry, fill, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  };
  Art.shadow = function (ctx, x, y, rx, ry, a) {
    Art.ellipse(ctx, x, y, rx, ry, "rgba(40,28,18," + (a == null ? 0.16 : a) + ")");
  };
  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  Art.mix = function (a, b, t) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    t = M.clamp(t, 0, 1);
    const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
    return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
  };
  // doneness colour ramp: raw -> cooked (0.75) -> burnt (1.2)
  Art.doneColor = function (raw, cooked, burnt, d) {
    if (d <= 0.75) return Art.mix(raw, cooked, d / 0.75);
    return Art.mix(cooked, burnt, (d - 0.75) / 0.45);
  };

  // ---------- backdrop: kitchen counter seen from the cook's eyes ----------
  Art.windowScene = function (ctx, x, y, w, h, tod, t) {
    const skies = {
      morning: ["#CFE0E6", "#F3E7CF"],
      evening: ["#E9B98A", "#F4DDB8"],
      night: ["#1F2B33", "#33434A"],
    };
    const sky = skies[tod] || skies.evening;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, sky[0]);
    g.addColorStop(1, sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // distant rooftops
    ctx.fillStyle = tod === "night" ? "#18211F" : "rgba(80,70,60,0.28)";
    for (let i = 0; i < 6; i++) {
      const bw = w / 5;
      const bh = h * (0.25 + ((i * 37) % 30) / 100);
      ctx.fillRect(x + i * bw * 0.9 - 8, y + h - bh, bw * 0.8, bh);
    }
    if (tod === "night") {
      ctx.fillStyle = "#F0C878";
      for (let i = 0; i < 9; i++) ctx.fillRect(x + ((i * 53) % w), y + h - 10 - ((i * 29) % (h * 0.3)), 4, 5);
    }
    // rain
    if (M.profile.settings.ambienceKind === "rain") {
      ctx.strokeStyle = tod === "night" ? "rgba(200,220,230,0.25)" : "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 26; i++) {
        const rx = x + ((i * 47 + t * 30) % w);
        const ry = y + ((i * 83 + t * 420) % h);
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 3, ry + 12);
      }
      ctx.stroke();
    }
  };

  Art.backdrop = function (ctx, w, h, t, opts) {
    opts = opts || {};
    const tod = M.profile.settings.timeOfDay;
    const wallH = Math.round(h * (opts.wall || 0.3));
    // wall tiles
    ctx.fillStyle = tod === "night" ? "#D9D2C4" : "#EAE4D8";
    ctx.fillRect(0, 0, w, wallH);
    ctx.strokeStyle = "rgba(120,105,85,0.12)";
    ctx.lineWidth = 1;
    const tw = 46;
    const th = 23;
    for (let r = 0; r * th < wallH; r++) {
      const off = r % 2 ? tw / 2 : 0;
      for (let c = -1; c * tw < w + tw; c++) ctx.strokeRect(c * tw + off + 0.5, r * th + 0.5, tw, th);
    }
    // window
    const ww = Math.min(w * 0.34, 420);
    const wh = wallH * 0.72;
    const wx = w * 0.62 - ww / 2;
    const wy = wallH * 0.12;
    Art.windowScene(ctx, wx, wy, ww, wh, tod, t);
    ctx.strokeStyle = "#F7F3EA";
    ctx.lineWidth = 8;
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy);
    ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.stroke();
    // shelf with jars
    const sy = wallH * 0.5;
    ctx.fillStyle = "#B88752";
    ctx.fillRect(w * 0.06, sy, Math.min(w * 0.3, 360), 8);
    const jars = ["#C8553D", "#E0B36A", "#6E8F5A", "#D9CBB0"];
    for (let i = 0; i < 4; i++) {
      const jx = w * 0.07 + i * 44;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      Art.rr(ctx, jx, sy - 40, 30, 40, 6);
      ctx.fill();
      ctx.fillStyle = jars[i];
      Art.rr(ctx, jx + 3, sy - 26, 24, 24, 4);
      ctx.fill();
      ctx.fillStyle = "#4A3A2E";
      ctx.fillRect(jx + 4, sy - 46, 22, 7);
    }
    // plant
    const px = w * 0.9;
    ctx.fillStyle = "#C27A4A";
    Art.rr(ctx, px - 20, wallH - 44, 40, 44, 6);
    ctx.fill();
    ctx.fillStyle = "#4F7A4A";
    for (let i = 0; i < 6; i++) Art.ellipse(ctx, px - 22 + i * 9, wallH - 56 - (i % 2) * 14, 9, 20, "#4F7A4A", -0.6 + i * 0.25);
    // counter
    const g = ctx.createLinearGradient(0, wallH, 0, h);
    g.addColorStop(0, "#E2D6C3");
    g.addColorStop(1, "#D5C6AE");
    ctx.fillStyle = g;
    ctx.fillRect(0, wallH, w, h - wallH);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(0, wallH, w, 5);
    // subtle stone speckle
    ctx.fillStyle = "rgba(120,100,80,0.07)";
    for (let i = 0; i < 160; i++) {
      const sx = (i * 97.3) % w;
      const sy2 = wallH + ((i * 61.7) % (h - wallH));
      ctx.fillRect(sx, sy2, 2, 2);
    }
    // warm light wash (time of day)
    if (tod === "evening") {
      ctx.fillStyle = "rgba(240,170,90,0.07)";
      ctx.fillRect(0, 0, w, h);
    } else if (tod === "night") {
      const lg = ctx.createRadialGradient(w * 0.5, h * 0.55, 50, w * 0.5, h * 0.55, Math.max(w, h) * 0.8);
      lg.addColorStop(0, "rgba(255,220,160,0)");
      lg.addColorStop(1, "rgba(20,24,22,0.35)");
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, w, h);
    }
  };

  // ---------- cutting board ----------
  Art.board = function (ctx, x, y, w, h) {
    Art.shadow(ctx, x + w / 2, y + h + 6, w * 0.52, 16, 0.14);
    ctx.fillStyle = "#C2925B";
    Art.rr(ctx, x, y + 8, w, h, 22);
    ctx.fill();
    ctx.fillStyle = "#D9AC72";
    Art.rr(ctx, x, y, w, h, 22);
    ctx.fill();
    ctx.strokeStyle = "rgba(160,110,60,0.35)";
    ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      const yy = y + (h / 6) * i;
      ctx.moveTo(x + 24, yy);
      ctx.bezierCurveTo(x + w * 0.3, yy - 6, x + w * 0.6, yy + 7, x + w - 24, yy - 2);
      ctx.stroke();
    }
    Art.ellipse(ctx, x + w - 30, y + 28, 9, 9, "#B88752");
    // knife marks
    ctx.strokeStyle = "rgba(140,95,50,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const mx = x + 60 + ((i * 71) % (w - 120));
      const my = y + 30 + ((i * 43) % (h - 60));
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + 3, my + 18);
      ctx.stroke();
    }
  };

  // ---------- ingredients for slicing ----------
  function capsule(t, e) {
    e = e || 0.1;
    if (t < e) return Math.sqrt(Math.max(0, 1 - Math.pow((e - t) / e, 2)));
    if (t > 1 - e) return Math.sqrt(Math.max(0, 1 - Math.pow((t - (1 - e)) / e, 2)));
    return 1;
  }
  function roundish(t) {
    return Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2)));
  }

  Art.ING = {
    cucumber: { len: 420, half: (t) => 30 * capsule(t, 0.09), skin: "#3E7A47", hi: "#6FA05E", face: "#CFE3B0", core: "#E8F0D0", pattern: "seeds" },
    tomato: { len: 210, half: (t) => 88 * Math.pow(roundish(t), 0.8), skin: "#D8432F", hi: "#EE7A5E", face: "#EE7A5E", core: "#F6D7A0", pattern: "tomato" },
    scallion: { len: 440, half: (t) => (t < 0.2 ? 13 + 5 * capsule(t / 0.4, 0.3) : 11) * capsule(t, 0.03), skin: "#5E9A4A", hi: "#86BC6A", face: "#CFE7B5", core: "#EDF6E0", pattern: "rings", white: 0.26 },
    garlic: { len: 150, half: (t) => 34 * Math.pow(roundish(t), 0.7) * (0.75 + 0.25 * t), skin: "#F1E7D2", hi: "#FFFDF6", face: "#F7F0DC", core: "#FFFBEF", pattern: "plain" },
    onion: { len: 220, half: (t) => 86 * Math.pow(roundish(t), 0.75), skin: "#D9A86A", hi: "#EDC995", face: "#F4EEDC", core: "#FBF7EC", pattern: "onion" },
    lettuce: { len: 300, half: (t) => (60 + 8 * Math.sin(t * 30)) * Math.pow(roundish(t), 0.5), skin: "#7DB05A", hi: "#A8D07E", face: "#CFE6AE", core: "#EEF6DC", pattern: "plain" },
    tofu: { len: 260, half: (t) => 56 * capsule(t, 0.04), skin: "#F7F3E8", hi: "#FFFFFF", face: "#F2EEE2", core: "#FAF8F1", pattern: "plain", block: true },
    steak: { len: 340, half: (t) => (52 + 6 * Math.sin(t * 6)) * capsule(t, 0.14), skin: "#7A4128", hi: "#9A5A3A", face: "#C9605A", core: "#E39088", pattern: "steak" },
    tamago: { len: 300, half: (t) => 46 * capsule(t, 0.06), skin: "#EDBB45", hi: "#F6D77A", face: "#F2C14E", core: "#F8DD8A", pattern: "spiral", block: true },
  };

  function ingPath(ctx, ing, x0, cy, from, to) {
    const steps = 48;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = from + ((to - from) * i) / steps;
      const px = x0 + t * ing.len;
      const py = cy - ing.half(t);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let i = steps; i >= 0; i--) {
      const t = from + ((to - from) * i) / steps;
      ctx.lineTo(x0 + t * ing.len, cy + ing.half(t) * 0.82);
    }
    ctx.closePath();
  }

  function drawWhole(ctx, ing, key, x0, cy) {
    // body
    ingPath(ctx, ing, x0, cy, 0, 1);
    const g = ctx.createLinearGradient(0, cy - 90, 0, cy + 80);
    g.addColorStop(0, ing.hi);
    g.addColorStop(0.45, ing.skin);
    g.addColorStop(1, Art.mix(ing.skin.length === 7 ? ing.skin : "#888888", "#2A1E14", 0.25));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ingPath(ctx, ing, x0, cy, 0, 1);
    ctx.clip();
    if (key === "cucumber") {
      ctx.strokeStyle = "rgba(160,200,120,0.35)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x0, cy - 14 + i * 12);
        ctx.lineTo(x0 + ing.len, cy - 16 + i * 12);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(30,60,30,0.35)";
      for (let i = 0; i < 30; i++) Art.ellipse(ctx, x0 + 20 + ((i * 37) % (ing.len - 40)), cy - 20 + ((i * 17) % 34), 1.6, 1.2);
      ctx.fill();
    } else if (key === "scallion") {
      ctx.fillStyle = "#F4F1E4";
      ctx.fillRect(x0, cy - 40, ing.len * ing.white, 80);
      ctx.fillStyle = "rgba(170,210,140,0.6)";
      ctx.fillRect(x0 + ing.len * ing.white - 18, cy - 40, 18, 80);
    } else if (key === "steak") {
      ctx.strokeStyle = "rgba(40,20,10,0.45)";
      ctx.lineWidth = 7;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(x0 + 30 + i * 55, cy - 60);
        ctx.lineTo(x0 + 70 + i * 55, cy + 60);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,240,220,0.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0, cy + 30);
      ctx.bezierCurveTo(x0 + 100, cy + 10, x0 + 220, cy + 50, x0 + ing.len, cy + 26);
      ctx.stroke();
    } else if (key === "onion") {
      ctx.strokeStyle = "rgba(150,100,50,0.35)";
      ctx.lineWidth = 2;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.ellipse(x0 + ing.len / 2, cy, (ing.len / 2) * (i / 6), 90, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (key === "tamago") {
      ctx.strokeStyle = "rgba(200,140,40,0.35)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x0, cy - 30 + i * 18);
        ctx.lineTo(x0 + ing.len, cy - 30 + i * 18);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(170,110,30,0.18)";
      for (let i = 0; i < 18; i++) Art.ellipse(ctx, x0 + 20 + ((i * 53) % (ing.len - 40)), cy - 30 + ((i * 23) % 50), 6, 3);
      ctx.fill();
    } else if (key === "lettuce") {
      ctx.strokeStyle = "rgba(240,250,220,0.6)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0, cy);
      ctx.lineTo(x0 + ing.len, cy - 4);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      for (let i = 1; i < 9; i++) {
        ctx.beginPath();
        ctx.moveTo(x0 + i * 33, cy - 2);
        ctx.lineTo(x0 + i * 33 + 18, cy - 40);
        ctx.moveTo(x0 + i * 33, cy - 2);
        ctx.lineTo(x0 + i * 33 + 18, cy + 36);
        ctx.stroke();
      }
    }
    // highlight
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    Art.ellipse(ctx, x0 + ing.len * 0.35, cy - ing.half(0.35) * 0.55, ing.len * 0.25, Math.max(3, ing.half(0.35) * 0.16));
    ctx.fill();
    ctx.restore();
    if (key === "tomato") {
      ctx.fillStyle = "#3E7A47";
      const sx = x0 + ing.len * 0.5;
      const sy = cy - ing.half(0.5) + 6;
      for (let i = 0; i < 5; i++) Art.ellipse(ctx, sx + Math.cos(i * 1.25) * 12, sy + Math.sin(i * 1.25) * 5, 12, 4, "#3E7A47", i * 1.25);
      ctx.fillRect(sx - 2, sy - 12, 4, 12);
    }
  }

  function drawFace(ctx, ing, key, x, cy, t, w) {
    const hh = ing.half(t);
    if (hh < 2) return;
    const ry = hh * 0.91;
    const yc = cy - hh * 0.09;
    Art.ellipse(ctx, x, yc, w, ry, ing.face);
    if (ing.pattern === "seeds") {
      // pale rind band, translucent core, and a ring of teardrop seeds in three chambers
      ctx.strokeStyle = "rgba(120,160,90,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, yc, w * 0.9, ry * 0.9, 0, 0, Math.PI * 2);
      ctx.stroke();
      Art.ellipse(ctx, x, yc, w * 0.6, ry * 0.58, ing.core);
      ctx.strokeStyle = "rgba(160,190,120,0.6)";
      for (let k = 0; k < 3; k++) {
        const a = k * (Math.PI * 2 / 3) - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(x, yc);
        ctx.lineTo(x + Math.cos(a) * w * 0.55, yc + Math.sin(a) * ry * 0.55);
        ctx.stroke();
      }
      for (let i = 0; i < 9; i++) {
        const a = i * (Math.PI * 2 / 9) + 0.35;
        const sx = x + Math.cos(a) * w * 0.34;
        const sy = yc + Math.sin(a) * ry * 0.34;
        Art.ellipse(ctx, sx, sy, Math.max(1.4, w * 0.07), Math.max(0.9, ry * 0.035), "rgba(236,242,214,0.95)", a);
        ctx.strokeStyle = "rgba(150,170,110,0.7)";
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    } else if (ing.pattern === "tomato") {
      Art.ellipse(ctx, x, yc, w * 0.8, ry * 0.82, "#E75E46");
      ctx.fillStyle = ing.core;
      for (let i = 0; i < 3; i++) Art.ellipse(ctx, x, yc - ry * 0.45 + i * ry * 0.45, w * 0.45, ry * 0.15);
      ctx.fill();
    } else if (ing.pattern === "rings") {
      ctx.strokeStyle = t < ing.white ? "rgba(200,220,180,0.9)" : "rgba(120,170,90,0.9)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(x, yc, w * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (ing.pattern === "onion") {
      ctx.strokeStyle = "rgba(210,190,150,0.9)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(x, yc, w * (i / 5), ry * (i / 5), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (ing.pattern === "steak") {
      Art.ellipse(ctx, x, yc, w * 0.75, ry * 0.78, ing.core);
      // muscle grain running across the cut face
      ctx.strokeStyle = "rgba(150,50,45,0.28)";
      ctx.lineWidth = 0.8;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x - w * 0.6, yc + i * ry * 0.18);
        ctx.quadraticCurveTo(x, yc + i * ry * 0.18 - ry * 0.08, x + w * 0.6, yc + i * ry * 0.18);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(120,50,40,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, yc, w, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (ing.pattern === "spiral") {
      ctx.strokeStyle = "rgba(200,140,40,0.7)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 6; a += 0.2) {
        const r = a / (Math.PI * 6);
        const px = x + Math.cos(a) * w * r;
        const py = yc + Math.sin(a) * ry * r;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  // A cut round lying flat on the board: skin edge underneath, cut face on top.
  function drawDisk(ctx, ing, key, x, y, t, thick, alpha) {
    const hh = Math.max(8, ing.half(t));
    ctx.save();
    ctx.globalAlpha = alpha;
    Art.shadow(ctx, x + 3, y + thick + 6, hh * 1.05, hh * 0.3, 0.16);
    Art.ellipse(ctx, x, y + thick, hh, hh * 0.55, ing.skin);
    ctx.fillStyle = ing.skin;
    ctx.fillRect(x - hh, y, hh * 2, thick);
    ctx.translate(x, y);
    ctx.scale(1, 0.58);
    Art.ellipse(ctx, 0, 0, hh, hh * 0.95, ing.hi || ing.skin);
    drawFace(ctx, ing, key, 0, hh * 0.09, t, hh * 0.86);
    // wet sheen on the fresh cut
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    Art.ellipse(ctx, -hh * 0.3, -hh * 0.35, hh * 0.35, hh * 0.16, null, -0.3);
    ctx.fill();
    ctx.restore();
  }

  // Draws an ingredient with cuts (absolute x positions) and how far apart the pieces have drifted (0..1).
  // falls(i) returns 0..1 for pieces cut free on both sides: they tip over and lie flat in front.
  Art.sliced = function (ctx, key, x0, cy, cuts, spread, falls) {
    const ing = Art.ING[key];
    const sorted = cuts.slice().sort((a, b) => a - b);
    const bounds = [x0].concat(sorted, [x0 + ing.len]);
    const n = bounds.length - 1;
    const lieY = cy + ing.half(0.5) + 70;
    Art.shadow(ctx, x0 + ing.len / 2 + (n - 1) * spread * 4, cy + ing.half(0.5) * 0.8 + 8, ing.len * 0.52, 12, 0.16);
    const lying = [];
    for (let i = 0; i < n; i++) {
      const a = bounds[i];
      const b = bounds[i + 1];
      const dx = i * spread * 9;
      const p = falls && i > 0 && i < n - 1 ? M.clamp(falls(i, a, b), 0, 1) : 0;
      if (p >= 0.4) {
        lying.push({ i, a, b, dx, p });
        continue;
      }
      ctx.save();
      if (p > 0) {
        // tip over the right-hand bottom corner
        const px = b + dx;
        const py = cy + ing.half((b - x0) / ing.len);
        ctx.translate(px, py);
        ctx.rotate((p / 0.4) * 0.9);
        ctx.translate(-px, -py);
      }
      ctx.translate(dx, 0);
      ctx.beginPath();
      ctx.rect(a, cy - 200, b - a, 400);
      ctx.clip();
      drawWhole(ctx, ing, key, x0, cy);
      ctx.restore();
      if (i < n - 1 && spread > 0.02 && p === 0) {
        const tc = (b - x0) / ing.len;
        drawFace(ctx, ing, key, b + dx + 1, cy, tc, Math.min(9, 3 + spread * 9));
      }
    }
    // freed slices slide to a neat row at the front of the board, clear of the knife arm
    lying.sort((p, q) => q.a - p.a);
    lying.forEach((s, j) => {
      const k = M.ease((s.p - 0.4) / 0.6);
      const mid = (s.a + s.b) / 2;
      const t = (mid - x0) / ing.len;
      const slotX = x0 + 40 + j * Math.max(44, ing.half(0.5) * 1.7);
      const x = mid + s.dx + (slotX - mid - s.dx) * k;
      const y = cy + (lieY - cy) * k;
      drawDisk(ctx, ing, key, x, y, t, Math.min(9, Math.max(4, (s.b - s.a) * 0.18)), 0.55 + 0.45 * k);
    });
  };

  // ---------- vessels ----------
  Art.bowl = function (ctx, cx, cy, r, fill, level, opts) {
    opts = opts || {};
    Art.shadow(ctx, cx, cy + r * 0.62, r * 1.02, r * 0.22, 0.16);
    // outer body
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.36, 0, 0, Math.PI);
    ctx.bezierCurveTo(cx - r * 0.95, cy + r * 0.75, cx + r * 0.95, cy + r * 0.75, cx + r, cy);
    ctx.closePath();
    ctx.fillStyle = opts.color || "#F3EFE6";
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.2, cy + r * 0.3, r * 0.7, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    if (opts.band) {
      ctx.strokeStyle = opts.band;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.22, r * 0.9, r * 0.3, 0, 0.15, Math.PI - 0.15);
      ctx.stroke();
    }
    // rim + inside
    Art.ellipse(ctx, cx, cy, r, r * 0.36, "#FBF9F4");
    Art.ellipse(ctx, cx, cy + 2, r * 0.9, r * 0.3, "#E7E1D4");
    if (fill && level > 0) {
      const lr = r * (0.55 + 0.33 * M.clamp(level, 0, 1));
      Art.ellipse(ctx, cx, cy + 2 + (1 - level) * r * 0.12, lr, lr * 0.33, fill);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      Art.ellipse(ctx, cx - lr * 0.3, cy - lr * 0.06 + (1 - level) * r * 0.12, lr * 0.35, lr * 0.07);
      ctx.fill();
    }
  };

  Art.pan = function (ctx, cx, cy, r, heat) {
    // handle
    ctx.save();
    ctx.translate(cx + r * 0.9, cy + r * 0.12);
    ctx.rotate(0.12);
    ctx.fillStyle = "#2B2826";
    Art.rr(ctx, 0, -12, r * 1.05, 24, 12);
    ctx.fill();
    ctx.fillStyle = "#4A4440";
    Art.rr(ctx, r * 0.7, -7, r * 0.25, 14, 7);
    ctx.fill();
    ctx.restore();
    Art.shadow(ctx, cx, cy + r * 0.5, r * 1.05, r * 0.3, 0.18);
    Art.ellipse(ctx, cx, cy + 10, r, r * 0.62, "#262321");
    Art.ellipse(ctx, cx, cy, r, r * 0.62, "#3A3633");
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.2, 10, cx, cy, r * 0.9);
    g.addColorStop(0, "#4B4642");
    g.addColorStop(1, "#24211F");
    Art.ellipse(ctx, cx, cy + 3, r * 0.88, r * 0.53, g);
    if (heat > 0) {
      // shimmering oil
      ctx.fillStyle = "rgba(240,190,90," + 0.08 * heat + ")";
      Art.ellipse(ctx, cx, cy + 3, r * 0.86, r * 0.51);
      ctx.fill();
    }
  };

  Art.burner = function (ctx, cx, cy, r, heat, t) {
    Art.ellipse(ctx, cx, cy, r * 1.25, r * 0.78, "#2F2C2A");
    Art.ellipse(ctx, cx, cy, r * 1.1, r * 0.68, "#3B3734");
    if (heat > 0) {
      const flames = 18;
      for (let i = 0; i < flames; i++) {
        const a = (i / flames) * Math.PI * 2;
        const fl = 10 + heat * 14 + Math.sin(t * 20 + i * 2.1) * 3;
        const fx = cx + Math.cos(a) * r * 0.85;
        const fy = cy + Math.sin(a) * r * 0.52;
        ctx.fillStyle = "rgba(90,150,230,0.85)";
        Art.ellipse(ctx, fx, fy - fl * 0.3, 4, fl * 0.5);
        ctx.fill();
        ctx.fillStyle = "rgba(255,210,120,0.6)";
        Art.ellipse(ctx, fx, fy - fl * 0.55, 2, fl * 0.25);
        ctx.fill();
      }
    }
  };

  Art.pot = function (ctx, cx, cy, r, level, liquid, boil, t) {
    Art.shadow(ctx, cx, cy + r * 1.05, r * 1.1, r * 0.25, 0.18);
    // handles
    ctx.fillStyle = "#2B2826";
    Art.rr(ctx, cx - r - 30, cy + 6, 36, 16, 8);
    ctx.fill();
    Art.rr(ctx, cx + r - 6, cy + 6, 36, 16, 8);
    ctx.fill();
    // body
    const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
    g.addColorStop(0, "#9DA3A1");
    g.addColorStop(0.35, "#E1E5E3");
    g.addColorStop(0.6, "#C3C8C6");
    g.addColorStop(1, "#8C9290");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx - r, cy + r * 0.85);
    ctx.ellipse(cx, cy + r * 0.85, r, r * 0.3, 0, Math.PI, 0, true);
    ctx.lineTo(cx + r, cy);
    ctx.closePath();
    ctx.fill();
    Art.ellipse(ctx, cx, cy, r, r * 0.32, "#D6DAD8");
    Art.ellipse(ctx, cx, cy + 2, r * 0.93, r * 0.28, "#5C6361");
    if (level > 0) {
      const col = liquid || "#C9DCE0";
      Art.ellipse(ctx, cx, cy + 4 + (1 - level) * 8, r * 0.9, r * 0.26, col);
      if (boil > 0.05) {
        for (let i = 0; i < 14; i++) {
          const ph = (t * (1.5 + boil * 2) + i * 0.37) % 1;
          const bx = cx + Math.cos(i * 2.4) * r * 0.75 * ((i * 0.37) % 1);
          const by = cy + 4 + Math.sin(i * 2.4) * r * 0.2 * ((i * 0.53) % 1);
          const br = (2 + boil * 6) * Math.sin(ph * Math.PI);
          if (br > 0.5) {
            ctx.strokeStyle = "rgba(255,255,255,0.75)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(bx, by, br, br * 0.5, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }
  };

  Art.steam = function (ctx, cx, cy, amount, t, width) {
    if (amount <= 0.02 || M.profile.settings.reduceMotion) return;
    width = width || 80;
    for (let i = 0; i < 5; i++) {
      const ph = (t * 0.35 + i / 5) % 1;
      const x = cx + Math.sin(ph * 6 + i * 2) * width * 0.3 + (i - 2) * width * 0.18;
      const y = cy - ph * 140;
      ctx.fillStyle = "rgba(255,255,255," + 0.22 * amount * (1 - ph) + ")";
      Art.ellipse(ctx, x, y, 16 + ph * 22, 10 + ph * 14);
      ctx.fill();
    }
  };

  // ---------- small props ----------
  Art.egg = function (ctx, x, y, s, rot, crack) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(s, s);
    Art.shadow(ctx, 4, 34, 22, 6, 0.12);
    ctx.beginPath();
    ctx.moveTo(0, -36);
    ctx.bezierCurveTo(24, -36, 30, 4, 28, 14);
    ctx.bezierCurveTo(26, 32, 12, 38, 0, 38);
    ctx.bezierCurveTo(-12, 38, -26, 32, -28, 14);
    ctx.bezierCurveTo(-30, 4, -24, -36, 0, -36);
    ctx.fillStyle = "#F6E9D6";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    Art.ellipse(ctx, -9, -12, 7, 12);
    ctx.fill();
    if (crack > 0) {
      ctx.strokeStyle = "#8A6E52";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-26, 8);
      const zig = [-18, 2, -10, 12, -3, 4, 5, 14, 12, 3, 20, 11, 27, 6];
      for (let i = 0; i < zig.length; i += 2) {
        if (i / zig.length > crack) break;
        ctx.lineTo(zig[i], zig[i + 1]);
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  Art.yolk = function (ctx, x, y, s) {
    Art.ellipse(ctx, x, y, 34 * s, 22 * s, "rgba(255,255,248,0.85)");
    Art.ellipse(ctx, x + 2 * s, y - 2 * s, 14 * s, 11 * s, "#F2B632");
    Art.ellipse(ctx, x - 2 * s, y - 6 * s, 4 * s, 3 * s, "rgba(255,255,255,0.6)");
  };

  Art.shaker = function (ctx, x, y, kind, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    if (kind === "pepper") {
      ctx.fillStyle = "#3A2C24";
      Art.rr(ctx, -20, -70, 40, 110, 14);
      ctx.fill();
      ctx.fillStyle = "#5A463A";
      Art.rr(ctx, -16, -90, 32, 26, 8);
      ctx.fill();
      ctx.fillStyle = "#C9B79F";
      ctx.fillRect(-20, -30, 40, 6);
    } else {
      ctx.fillStyle = "rgba(250,250,247,0.95)";
      Art.rr(ctx, -22, -60, 44, 100, 12);
      ctx.fill();
      ctx.fillStyle = "#EDEAE2";
      Art.rr(ctx, -18, -20, 36, 56, 8);
      ctx.fill();
      ctx.fillStyle = "#AEB4B2";
      Art.rr(ctx, -22, -78, 44, 22, 8);
      ctx.fill();
      ctx.fillStyle = "#6B706E";
      for (let i = -1; i <= 1; i++) Art.ellipse(ctx, i * 9, -70, 2, 2, "#6B706E");
    }
    ctx.restore();
  };

  Art.pourer = function (ctx, x, y, liquid, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-tilt);
    const col = M.LIQUIDS[liquid] || "#EEE";
    if (liquid === "soy") {
      ctx.fillStyle = "#2A1B12";
      Art.rr(ctx, -22, -60, 44, 110, 10);
      ctx.fill();
      ctx.fillStyle = "#C8442F";
      ctx.fillRect(-22, -20, 44, 30);
      ctx.fillStyle = "#F4EFE6";
      ctx.fillRect(-14, -12, 28, 4);
      ctx.fillStyle = "#C8442F";
      Art.rr(ctx, -9, -86, 18, 28, 4);
      ctx.fill();
    } else if (liquid === "egg" || liquid === "batter") {
      Art.bowl(ctx, 0, 0, 60, col, 0.8, { color: "#EDE7DA" });
    } else if (liquid === "broth" || liquid === "stock" || liquid === "dashi") {
      // ladle
      ctx.strokeStyle = "#9DA3A1";
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(30, -10);
      ctx.lineTo(140, -120);
      ctx.stroke();
      Art.ellipse(ctx, 0, 0, 44, 22, "#C3C8C6");
      Art.ellipse(ctx, 0, -3, 38, 16, col);
    } else {
      // milk jug
      ctx.fillStyle = "#F5F6F3";
      Art.rr(ctx, -40, -70, 80, 120, 14);
      ctx.fill();
      ctx.fillStyle = "#3F6B8A";
      ctx.fillRect(-40, -10, 80, 26);
      ctx.fillStyle = "#F5F6F3";
      ctx.font = "600 13px Segoe UI, sans-serif";
      ctx.fillText("MILK", -16, 8);
      ctx.beginPath();
      ctx.moveTo(-40, -70);
      ctx.lineTo(-58, -82);
      ctx.lineTo(-30, -82);
      ctx.fill();
      ctx.strokeStyle = "#E1E3DE";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(46, -10, 22, -1.2, 1.2);
      ctx.stroke();
    }
    ctx.restore();
  };

  M.LIQUIDS = {
    milk: "#F7F4EC",
    egg: "#F2C14E",
    soy: "#3A2116",
    broth: "#C98A3E",
    batter: "#EBD3A0",
    stock: "#D9B47A",
    dashi: "#E3CF9A",
  };

  // ---------- tools held in hand ----------
  Art.tool = function (ctx, tool, x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.lineCap = "round";
    if (tool === "knife") {
      // blade points down from the grip
      ctx.fillStyle = "#2C2A27";
      Art.rr(ctx, -9, -70, 18, 70, 6);
      ctx.fill();
      ctx.fillStyle = "#C9C2B6";
      Art.ellipse(ctx, 0, -50, 2.5, 2.5, "#C9C2B6");
      Art.ellipse(ctx, 0, -22, 2.5, 2.5, "#C9C2B6");
      const g = ctx.createLinearGradient(-30, 0, 20, 0);
      g.addColorStop(0, "#F1F3F2");
      g.addColorStop(1, "#B9BFBC");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.lineTo(8, 120);
      ctx.quadraticCurveTo(-20, 132, -34, 112);
      ctx.lineTo(-12, 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-32, 110);
      ctx.quadraticCurveTo(-20, 128, 6, 120);
      ctx.stroke();
    } else if (tool === "chopsticks") {
      ctx.strokeStyle = "#B07A45";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-6, -60);
      ctx.lineTo(-2, 120);
      ctx.moveTo(8, -60);
      ctx.lineTo(4, 120);
      ctx.stroke();
    } else if (tool === "whisk") {
      ctx.fillStyle = "#2C2A27";
      Art.rr(ctx, -8, -70, 16, 60, 8);
      ctx.fill();
      ctx.strokeStyle = "#C3C8C6";
      ctx.lineWidth = 2.5;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.bezierCurveTo(i * 22, 40, i * 18, 110, 0, 118);
        ctx.stroke();
      }
    } else if (tool === "spatula") {
      ctx.strokeStyle = "#7A5638";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(0, -70);
      ctx.lineTo(0, 50);
      ctx.stroke();
      ctx.fillStyle = "#3A3633";
      Art.rr(ctx, -26, 50, 52, 70, 8);
      ctx.fill();
    } else if (tool === "tongs") {
      ctx.strokeStyle = "#C3C8C6";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(0, -60);
      ctx.lineTo(-14, 120);
      ctx.moveTo(0, -60);
      ctx.lineTo(14, 120);
      ctx.stroke();
    } else if (tool === "ladle" || tool === "spoon") {
      ctx.strokeStyle = "#9DA3A1";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, -70);
      ctx.lineTo(0, 90);
      ctx.stroke();
      Art.ellipse(ctx, 0, 106, 24, 18, "#C3C8C6");
    }
    ctx.restore();
  };

  // First-person hand + forearm entering from the bottom of the frame.
  Art.hand = function (ctx, x, y, opts) {
    opts = opts || {};
    const skin = M.SKINS[M.profile.settings.skin] || M.SKINS[1];
    const side = opts.side || 1; // 1 = right hand, -1 = left hand
    const ax = x + side * 180;
    const ay = y + 520;
    // forearm
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = skin;
    ctx.lineWidth = 58;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(x + side * 20, y + 36);
    ctx.stroke();
    // sleeve
    ctx.strokeStyle = opts.sleeve || "#E9E4DA";
    ctx.lineWidth = 76;
    ctx.beginPath();
    ctx.moveTo(ax + side * 40, ay + 120);
    ctx.lineTo(x + side * 100, y + 300);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + side * 76, y + 286);
    ctx.lineTo(x + side * 130, y + 300);
    ctx.stroke();
    ctx.restore();
    if (opts.tool) Art.tool(ctx, opts.tool, x, y + (opts.toolDy || 0), opts.toolRot || 0);
    // fist
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(side * 0.25);
    ctx.fillStyle = skin;
    Art.rr(ctx, -30, -24, 60, 56, 24);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    for (let i = 0; i < 3; i++) {
      Art.rr(ctx, -26 + i * 18, -22, 2, 20, 1);
      ctx.fill();
    }
    // thumb
    ctx.fillStyle = skin;
    Art.ellipse(ctx, -side * 26, -2, 13, 22, skin, side * 0.5);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    Art.ellipse(ctx, 6, -10, 16, 8);
    ctx.fill();
    ctx.restore();
  };

  // Open helper hand that steadies food on the board.
  Art.helperHand = function (ctx, x, y) {
    const skin = M.SKINS[M.profile.settings.skin] || M.SKINS[1];
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = skin;
    ctx.lineWidth = 54;
    ctx.beginPath();
    ctx.moveTo(x - 200, y + 420);
    ctx.lineTo(x - 30, y + 30);
    ctx.stroke();
    ctx.strokeStyle = "#E9E4DA";
    ctx.lineWidth = 72;
    ctx.beginPath();
    ctx.moveTo(x - 260, y + 520);
    ctx.lineTo(x - 150, y + 290);
    ctx.stroke();
    ctx.fillStyle = skin;
    Art.rr(ctx, x - 50, y - 22, 66, 54, 22);
    ctx.fill();
    // curled fingertips (claw grip)
    for (let i = 0; i < 4; i++) Art.ellipse(ctx, x + 14, y - 14 + i * 13, 11, 7, skin);
    ctx.fillStyle = "rgba(0,0,0,0.07)";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + 6, y - 8 + i * 13, 12, 1.5);
    }
    ctx.restore();
  };

  // ---------- plated dishes ----------
  const C = {};
  C.shiso = (ctx, x, y, s) => {
    Art.ellipse(ctx, x, y, 34 * s, 20 * s, "#4F8A45", -0.3);
    ctx.strokeStyle = "#7DB05A";
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(x - 30 * s, y + 8 * s);
    ctx.lineTo(x + 30 * s, y - 8 * s);
    ctx.stroke();
  };
  C.tamago_slices = (ctx, x, y, s) => {
    for (let i = 0; i < 5; i++) {
      const sx = x - 56 * s + i * 26 * s;
      Art.rr(ctx, sx, y - 22 * s, 24 * s, 44 * s, 6 * s);
      ctx.fillStyle = "#EDBB45";
      ctx.fill();
      Art.rr(ctx, sx + 3 * s, y - 18 * s, 18 * s, 36 * s, 5 * s);
      ctx.fillStyle = "#F6D77A";
      ctx.fill();
    }
  };
  C.daikon = (ctx, x, y, s) => {
    Art.ellipse(ctx, x, y, 18 * s, 12 * s, "#F4F1E8");
    Art.ellipse(ctx, x - 4 * s, y - 4 * s, 6 * s, 4 * s, "#FFFFFF");
  };
  C.rice_mound = (ctx, x, y, s) => {
    Art.ellipse(ctx, x, y, 92 * s, 60 * s, "#E0B36A");
    ctx.fillStyle = "#F0D8A4";
    for (let i = 0; i < 70; i++) {
      const a = i * 2.39;
      const r = Math.sqrt(i / 70) * 80 * s;
      Art.ellipse(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.62, 4 * s, 2.4 * s, null, a);
      ctx.fill();
    }
  };
  C.garlic_chips = (ctx, x, y, s) => {
    for (let i = 0; i < 9; i++) {
      Art.ellipse(ctx, x + Math.cos(i * 1.9) * 40 * s, y + Math.sin(i * 1.9) * 22 * s, 7 * s, 5 * s, "#C98A3E");
    }
  };
  C.scallion_bits = (ctx, x, y, s) => {
    for (let i = 0; i < 14; i++) {
      const bx = x + Math.cos(i * 2.3) * 44 * s * ((i % 4) / 4 + 0.3);
      const by = y + Math.sin(i * 2.3) * 26 * s * ((i % 3) / 3 + 0.3);
      Art.ellipse(ctx, bx, by, 5 * s, 4 * s, "#5E9A4A");
      Art.ellipse(ctx, bx, by, 2.4 * s, 1.8 * s, "#CFE7B5");
    }
  };
  C.lettuce = (ctx, x, y, s) => {
    for (let i = 0; i < 7; i++) Art.ellipse(ctx, x + Math.cos(i) * 50 * s, y + Math.sin(i) * 30 * s, 38 * s, 22 * s, i % 2 ? "#7DB05A" : "#A8D07E", i);
  };
  C.cucumber_slices = (ctx, x, y, s) => {
    for (let i = 0; i < 6; i++) {
      const cx = x - 50 * s + i * 20 * s;
      const cy = y + (i % 2) * 10 * s;
      Art.ellipse(ctx, cx, cy, 16 * s, 14 * s, "#3E7A47");
      Art.ellipse(ctx, cx, cy, 13 * s, 11 * s, "#CFE3B0");
      Art.ellipse(ctx, cx, cy, 6 * s, 5 * s, "#E8F0D0");
    }
  };
  C.tomato_wedges = (ctx, x, y, s) => {
    for (let i = 0; i < 4; i++) {
      const cx = x - 36 * s + i * 24 * s;
      Art.ellipse(ctx, cx, y, 16 * s, 12 * s, "#D8432F", i * 0.6);
      Art.ellipse(ctx, cx, y, 9 * s, 6 * s, "#F6D7A0", i * 0.6);
    }
  };
  C.noodles = (ctx, x, y, s) => {
    ctx.strokeStyle = "#F0D79A";
    ctx.lineWidth = 4 * s;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      for (let k = 0; k <= 20; k++) {
        const px = x - 70 * s + k * 7 * s;
        const py = y - 20 * s + i * 5 * s + Math.sin(k * 0.9 + i) * 6 * s;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  };
  C.egg_half = (ctx, x, y, s) => {
    Art.ellipse(ctx, x, y, 24 * s, 18 * s, "#FBF7EE");
    Art.ellipse(ctx, x, y + 1 * s, 13 * s, 10 * s, "#F2A62E");
    Art.ellipse(ctx, x, y + 1 * s, 8 * s, 6 * s, "#F6C15A");
    Art.ellipse(ctx, x + 50 * s, y + 6 * s, 24 * s, 18 * s, "#FBF7EE");
    Art.ellipse(ctx, x + 50 * s, y + 7 * s, 13 * s, 10 * s, "#F2A62E");
  };
  C.nori = (ctx, x, y, s) => {
    ctx.fillStyle = "#1F2A22";
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.2);
    ctx.fillRect(-14 * s, -40 * s, 28 * s, 60 * s);
    ctx.restore();
  };
  C.pancake_stack = (ctx, x, y, s) => {
    for (let i = 0; i < 3; i++) {
      Art.ellipse(ctx, x, y + 14 * s - i * 12 * s, 76 * s, 30 * s, "#B9773A");
      Art.ellipse(ctx, x, y + 10 * s - i * 12 * s, 74 * s, 27 * s, "#D9A05B");
    }
  };
  C.butter = (ctx, x, y, s) => {
    Art.rr(ctx, x - 14 * s, y - 10 * s, 28 * s, 18 * s, 4 * s);
    ctx.fillStyle = "#F6E39A";
    ctx.fill();
  };
  C.syrup = (ctx, x, y, s) => {
    ctx.fillStyle = "rgba(150,80,30,0.75)";
    ctx.beginPath();
    ctx.ellipse(x, y, 50 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) Art.ellipse(ctx, x - 40 * s + i * 26 * s, y + 18 * s, 4 * s, 10 * s, "rgba(150,80,30,0.75)");
  };
  C.greens = (ctx, x, y, s) => {
    for (let i = 0; i < 6; i++) Art.ellipse(ctx, x + Math.cos(i * 1.1) * 22 * s, y + Math.sin(i * 1.1) * 14 * s, 18 * s, 9 * s, i % 2 ? "#4F8A45" : "#6FA05E", i * 1.1);
  };
  C.steak_slices = (ctx, x, y, s) => {
    for (let i = 0; i < 6; i++) {
      const sx = x - 60 * s + i * 22 * s;
      Art.rr(ctx, sx, y - 26 * s, 20 * s, 52 * s, 5 * s);
      ctx.fillStyle = "#6A3622";
      ctx.fill();
      Art.rr(ctx, sx + 3 * s, y - 21 * s, 14 * s, 42 * s, 4 * s);
      ctx.fillStyle = "#D47B70";
      ctx.fill();
    }
  };
  C.cream = (ctx, x, y, s) => {
    ctx.strokeStyle = "rgba(255,250,240,0.9)";
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.2) {
      const r = (a / (Math.PI * 4)) * 34 * s;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r * 0.5;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  };
  C.basil = (ctx, x, y, s) => {
    Art.ellipse(ctx, x, y, 14 * s, 8 * s, "#3F7A3A", 0.5);
    Art.ellipse(ctx, x + 14 * s, y + 4 * s, 12 * s, 7 * s, "#4F8A45", -0.4);
  };
  C.tofu_cubes = (ctx, x, y, s) => {
    for (let i = 0; i < 6; i++) {
      Art.rr(ctx, x - 40 * s + (i % 3) * 28 * s, y - 16 * s + Math.floor(i / 3) * 24 * s, 18 * s, 16 * s, 3 * s);
      ctx.fillStyle = "#FAF8F1";
      ctx.fill();
    }
  };
  C.wakame = (ctx, x, y, s) => {
    for (let i = 0; i < 5; i++) Art.ellipse(ctx, x + Math.cos(i * 1.3) * 24 * s, y + Math.sin(i * 1.3) * 14 * s, 12 * s, 6 * s, "#2F5A3A", i);
  };
  Art.COMPONENTS = C;

  M.DISHES = {
    tamagoyaki: { vessel: "plate", items: [["shiso", -64, -18], ["tamago_slices", 6, 4], ["daikon", 84, 34]] },
    fried_rice: { vessel: "plate", items: [["rice_mound", 0, 6], ["garlic_chips", 6, -4], ["scallion_bits", -4, 2]] },
    salad: { vessel: "wide", items: [["lettuce", 0, 0], ["cucumber_slices", -6, -10], ["tomato_wedges", 16, 20]] },
    ramen: { vessel: "ramen", base: "#C98A3E", items: [["noodles", 0, 6], ["egg_half", -30, -10], ["scallion_bits", 30, 16], ["nori", 70, -10]] },
    pancakes: { vessel: "plate", items: [["pancake_stack", 0, 4], ["butter", 0, -26], ["syrup", 0, -8]] },
    steak: { vessel: "plate", items: [["greens", -70, -10], ["steak_slices", 20, 6]] },
    tomato_soup: { vessel: "soup", base: "#C8442F", items: [["cream", 0, 0], ["basil", 30, -14]] },
    miso: { vessel: "soup", base: "#C9A46A", items: [["tofu_cubes", -6, 0], ["wakame", 30, 10], ["scallion_bits", -20, -8]] },
  };

  Art.vessel = function (ctx, kind, x, y, s, base) {
    if (kind === "plate") {
      Art.shadow(ctx, x, y + 26 * s, 150 * s, 30 * s, 0.14);
      Art.ellipse(ctx, x, y, 150 * s, 92 * s, "#FBF9F4");
      Art.ellipse(ctx, x, y + 3 * s, 112 * s, 66 * s, "#F1ECE2");
      Art.ellipse(ctx, x, y, 110 * s, 64 * s, "#FAF7F0");
      // glaze: a hairline rim and a soft highlight where the window light lands
      ctx.strokeStyle = "rgba(31,36,32,0.10)";
      ctx.lineWidth = Math.max(1, 1.5 * s);
      ctx.beginPath();
      ctx.ellipse(x, y, 150 * s, 92 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(1.5, 5 * s);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.ellipse(x, y, 132 * s, 80 * s, 0, Math.PI * 1.08, Math.PI * 1.42);
      ctx.stroke();
    } else if (kind === "wide") {
      Art.bowl(ctx, x, y, 150 * s, "#EEF3E4", 0.6, { color: "#E6EEE6" });
    } else if (kind === "ramen") {
      Art.bowl(ctx, x, y, 150 * s, base, 0.85, { color: "#2F2A28", band: "#B4472B" });
    } else if (kind === "soup") {
      Art.bowl(ctx, x, y, 130 * s, base, 0.8, { color: "#F3EFE6", band: "#3F6B8A" });
    }
  };

  // placed = array of booleans/offsets per item ({dx,dy}) or "all"
  Art.dish = function (ctx, id, x, y, s, placed) {
    const d = M.DISHES[id];
    if (!d) return;
    Art.vessel(ctx, d.vessel, x, y, s, d.base);
    d.items.forEach((it, i) => {
      const p = placed === "all" ? { dx: 0, dy: 0 } : placed && placed[i];
      if (!p) return;
      C[it[0]](ctx, x + (it[1] + p.dx) * s, y + (it[2] + p.dy) * s, s);
    });
  };

  // ---------- people ----------
  // Top-down 3/4 figure for room views.
  Art.personTop = function (ctx, x, y, o) {
    o = o || {};
    const s = o.scale || 1;
    const skin = o.skin || "#D9A77E";
    const walk = o.walk || 0;
    const bob = Math.sin(walk * 10) * 2 * s;
    Art.shadow(ctx, x, y + 22 * s, 24 * s, 9 * s, 0.18);
    // legs
    if (!o.seated) {
      ctx.fillStyle = "#3A3532";
      Art.rr(ctx, x - 12 * s, y + 6 * s + Math.sin(walk * 10) * 3 * s, 9 * s, 18 * s, 4 * s);
      ctx.fill();
      Art.rr(ctx, x + 3 * s, y + 6 * s - Math.sin(walk * 10) * 3 * s, 9 * s, 18 * s, 4 * s);
      ctx.fill();
    }
    // body
    ctx.fillStyle = o.coat || "#3F6B8A";
    Art.rr(ctx, x - 20 * s, y - 22 * s + bob, 40 * s, 36 * s, 14 * s);
    ctx.fill();
    if (o.apron) {
      ctx.fillStyle = o.apron;
      Art.rr(ctx, x - 13 * s, y - 12 * s + bob, 26 * s, 28 * s, 6 * s);
      ctx.fill();
    }
    // arms
    ctx.fillStyle = o.coat || "#3F6B8A";
    Art.ellipse(ctx, x - 22 * s, y - 6 * s + bob + Math.sin(walk * 10) * 2 * s, 7 * s, 12 * s);
    ctx.fill();
    Art.ellipse(ctx, x + 22 * s, y - 6 * s + bob - Math.sin(walk * 10) * 2 * s, 7 * s, 12 * s);
    ctx.fill();
    // head
    Art.ellipse(ctx, x, y - 34 * s + bob, 15 * s, 15 * s, skin);
    ctx.fillStyle = o.hair || "#3B2A20";
    ctx.beginPath();
    ctx.ellipse(x, y - 38 * s + bob, 15.5 * s, 12 * s, 0, Math.PI, 0);
    ctx.fill();
    if (o.hat) {
      ctx.fillStyle = "#FFFFFF";
      Art.rr(ctx, x - 13 * s, y - 56 * s + bob, 26 * s, 14 * s, 4 * s);
      ctx.fill();
      Art.ellipse(ctx, x - 7 * s, y - 58 * s + bob, 9 * s, 8 * s, "#FFFFFF");
      Art.ellipse(ctx, x + 7 * s, y - 58 * s + bob, 9 * s, 8 * s, "#FFFFFF");
      Art.ellipse(ctx, x, y - 63 * s + bob, 9 * s, 8 * s, "#FFFFFF");
    }
    if (o.carry && o.carry.length) {
      o.carry.forEach((dishId, i) => {
        const hx = x + (i === 0 ? 26 : -26) * s;
        const hy = y - 18 * s + bob;
        Art.ellipse(ctx, hx, hy, 16 * s, 10 * s, "#FBF9F4");
        Art.ellipse(ctx, hx, hy, 9 * s, 6 * s, (M.recipeById(dishId) || {}).color || "#E0B36A");
      });
    }
  };

  // Front-facing bust for the first-person counter view.
  Art.personFront = function (ctx, x, y, s, o) {
    o = o || {};
    const skin = o.skin || "#D9A77E";
    // shoulders
    ctx.fillStyle = o.coat || "#3F6B8A";
    ctx.beginPath();
    ctx.moveTo(x - 62 * s, y + 70 * s);
    ctx.quadraticCurveTo(x - 60 * s, y + 8 * s, x, y + 4 * s);
    ctx.quadraticCurveTo(x + 60 * s, y + 8 * s, x + 62 * s, y + 70 * s);
    ctx.closePath();
    ctx.fill();
    // neck
    ctx.fillStyle = Art.mix(skin.length === 7 ? skin : "#D9A77E", "#000000", 0.12);
    ctx.fillRect(x - 9 * s, y - 8 * s, 18 * s, 16 * s);
    // head
    Art.ellipse(ctx, x, y - 30 * s, 26 * s, 30 * s, skin);
    // hair
    ctx.fillStyle = o.hair || "#3B2A20";
    ctx.beginPath();
    ctx.ellipse(x, y - 40 * s, 27 * s, 22 * s, 0, Math.PI, 0);
    ctx.fill();
    // face: calm eyes, small mouth reflecting mood
    ctx.fillStyle = "#2A2420";
    const blink = o.blink ? 0.3 : 1;
    Art.ellipse(ctx, x - 9 * s, y - 28 * s, 2.6 * s, 3 * s * blink);
    ctx.fill();
    Art.ellipse(ctx, x + 9 * s, y - 28 * s, 2.6 * s, 3 * s * blink);
    ctx.fill();
    ctx.strokeStyle = "#7A4A3A";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    const mood = o.mood == null ? 0.5 : o.mood;
    const curve = (mood - 0.45) * 10 * s;
    ctx.moveTo(x - 7 * s, y - 14 * s);
    ctx.quadraticCurveTo(x, y - 14 * s + curve, x + 7 * s, y - 14 * s);
    ctx.stroke();
    if (o.label) {
      // nothing: labels are drawn by the UI layer
    }
  };

  // Rounded patience meter: 5 segments.
  Art.patience = function (ctx, x, y, w, value, dark) {
    const seg = 5;
    const gap = 2;
    const sw = (w - gap * (seg - 1)) / seg;
    for (let i = 0; i < seg; i++) {
      const fillAmt = M.clamp(value * seg - i, 0, 1);
      ctx.fillStyle = dark ? "rgba(255,255,255,0.25)" : "rgba(31,36,32,0.14)";
      Art.rr(ctx, x + i * (sw + gap), y, sw, 6, 3);
      ctx.fill();
      if (fillAmt > 0) {
        ctx.fillStyle = value > 0.5 ? "#3F6B4E" : value > 0.25 ? "#C08A2A" : "#B4472B";
        Art.rr(ctx, x + i * (sw + gap), y, sw * fillAmt, 6, 3);
        ctx.fill();
      }
    }
  };

  Art.label = function (ctx, text, x, y, opts) {
    opts = opts || {};
    ctx.font = (opts.weight || 600) + " " + (opts.size || 13) + "px Segoe UI, system-ui, sans-serif";
    const tw = ctx.measureText(text).width;
    const pw = tw + 16;
    const ph = (opts.size || 13) + 10;
    ctx.fillStyle = opts.bg || "rgba(29,33,31,0.86)";
    Art.rr(ctx, x - pw / 2, y - ph / 2, pw, ph, 6);
    ctx.fill();
    ctx.fillStyle = opts.color || "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y + 0.5);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
    return pw;
  };
})();
