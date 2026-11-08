/* Mise - the eight cooking actions. Each runs in a 720 x 720 virtual square. */
(function () {
  "use strict";
  const M = window.Mise;
  const Art = M.art;
  const S = 720;

  function gradeNote(q, good, ok, poor) {
    if (q >= 0.85) return good;
    if (q >= 0.6) return ok;
    return poor;
  }

  class Base {
    constructor(step, env) {
      this.step = step;
      this.env = env || {};
      this.pov = this.env.pov !== false;
      this.done = false;
      this.finishing = 0;
      this.quality = 0;
      this.note = "";
      this.hint = "";
      this.status = "";
      this.buttons = [];
      this.px = S / 2;
      this.py = S / 2;
      this.down = false;
      this.t = 0;
      this.pan = this.env.pan || 0;
    }
    finish(q, note) {
      if (this.finishing) return;
      this.quality = M.clamp(q, 0, 1);
      this.note = note;
      this.finishing = 0.0001;
    }
    // Small physical particles: juice, oil spatter, crumbs, steam puffs, placement rings.
    emit(n, x, y, o) {
      if (M.profile.settings.reduceMotion) return;
      o = o || {};
      if (!this.fx) this.fx = [];
      for (let i = 0; i < n; i++) {
        const a = (o.angle != null ? o.angle : -Math.PI / 2) + (Math.random() - 0.5) * (o.spread != null ? o.spread : Math.PI);
        const sp = (o.speed || 160) * (0.45 + Math.random() * 0.75);
        this.fx.push({
          x: x + (Math.random() - 0.5) * (o.jitter || 0),
          y: y + (Math.random() - 0.5) * (o.jitter || 0) * 0.4,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          g: o.gravity != null ? o.gravity : 520,
          life: 0,
          max: (o.life || 0.6) * (0.7 + Math.random() * 0.6),
          size: (o.size || 3) * (0.6 + Math.random() * 0.8),
          color: o.color || "rgba(255,255,255,0.9)",
          kind: o.kind || "drop",
          floor: o.floor,
        });
      }
      if (this.fx.length > 160) this.fx.splice(0, this.fx.length - 160);
    }
    tickFx(dt) {
      if (!this.fx || !this.fx.length) return;
      this.fx.forEach((p) => {
        p.life += dt;
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.floor != null && p.y > p.floor) {
          p.y = p.floor;
          p.vy *= -0.25;
          p.vx *= 0.5;
        }
      });
      this.fx = this.fx.filter((p) => p.life < p.max);
    }
    drawFx(ctx) {
      if (!this.fx || !this.fx.length) return;
      ctx.save();
      this.fx.forEach((p) => {
        const k = 1 - p.life / p.max;
        if (p.kind === "ring") {
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = k * 0.8;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * (1 + (1 - k) * 2.2), p.size * 0.55 * (1 + (1 - k) * 2.2), 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.kind === "puff") {
          ctx.globalAlpha = k * 0.35;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.2 + (1 - k) * 2), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = Math.min(1, k * 1.6);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size, p.size * 0.8, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.restore();
    }
    render(ctx, t) {
      this.draw(ctx, t);
      this.drawFx(ctx);
    }
    tick(dt) {
      this.t += dt;
      this.tickFx(dt);
      if (this.finishing) {
        this.finishing += dt;
        if (this.finishing > (this.finishDelay || 0.8)) this.done = true;
      }
      this.update(dt);
    }
    update() {}
    draw() {}
    hitButton(x, y) {
      return this.buttons.find((b) => !b.hidden && M.inRect(x, y, b));
    }
    pointer(type, x, y) {
      this.px = x;
      this.py = y;
      if (type === "down") {
        const b = this.hitButton(x, y);
        if (b) {
          M.audio.play("tick");
          this.onButton(b.id);
          return;
        }
        this.down = true;
        this.onDown(x, y);
      } else if (type === "move") {
        this.onMove(x, y);
      } else if (type === "up") {
        if (this.down) this.onUp(x, y);
        this.down = false;
      }
    }
    key(code, isDown) {
      this.onKey(code, isDown);
    }
    onButton() {}
    onDown() {}
    onMove() {}
    onUp() {}
    onKey() {}
    auto() {}
    destroy() {
      M.audio.stopAllLoops();
    }
    drawButtons(ctx) {
      this.buttons.forEach((b) => {
        if (b.hidden) return;
        ctx.fillStyle = b.active ? "#1F2420" : "rgba(255,255,255,0.94)";
        Art.rr(ctx, b.x, b.y, b.w, b.h, 10);
        ctx.fill();
        ctx.strokeStyle = b.active ? "#1F2420" : "rgba(31,36,32,0.18)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = b.active ? "#FFFFFF" : b.primary ? "#B4472B" : "#1F2420";
        ctx.font = "600 20px Segoe UI, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
      });
    }
    // Horizontal gauge with a target band and needle.
    gauge(ctx, x, y, w, value, band, label) {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      Art.rr(ctx, x - 14, y - 34, w + 28, 70, 12);
      ctx.fill();
      ctx.strokeStyle = "rgba(31,36,32,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#EAE4D8";
      Art.rr(ctx, x, y, w, 14, 7);
      ctx.fill();
      ctx.fillStyle = "rgba(63,107,78,0.35)";
      Art.rr(ctx, x + band[0] * w, y, (band[1] - band[0]) * w, 14, 4);
      ctx.fill();
      ctx.strokeStyle = "#3F6B4E";
      ctx.lineWidth = 2;
      Art.rr(ctx, x + band[0] * w, y, (band[1] - band[0]) * w, 14, 4);
      ctx.stroke();
      const v = M.clamp(value, 0, 1);
      ctx.fillStyle = "#1F2420";
      Art.rr(ctx, x + v * w - 3, y - 7, 6, 28, 3);
      ctx.fill();
      if (label) {
        ctx.fillStyle = "#1F2420";
        ctx.font = "600 15px Segoe UI, system-ui, sans-serif";
        ctx.fillText(label, x, y - 12);
      }
    }
  }

  // ------------------------------------------------------------------ CHOP
  class Chop extends Base {
    constructor(step, env) {
      super(step, env);
      this.ing = Art.ING[step.ing];
      this.x0 = S / 2 - this.ing.len / 2;
      this.cy = 390;
      this.n = step.cuts;
      this.cuts = [];
      this.cutAt = [];
      this.spread = 0;
      this.knifeX = this.x0 + this.ing.len - 10;
      this.drop = 0;
      this.ideal = [];
      for (let i = 1; i <= this.n; i++) this.ideal.push(this.x0 + (this.ing.len * i) / (this.n + 1));
      this.hint = "Move to aim, click or tap to slice. Arrow keys jump between guides, Space slices.";
      this.keyDir = 0;
      this.keyHold = 0;
      this.autoTimer = 0;
    }
    get statusText() {
      return this.cuts.length + " of " + this.n + " slices";
    }
    aim(x) {
      this.knifeX = M.clamp(x, this.x0 + 8, this.x0 + this.ing.len - 8);
    }
    cut() {
      if (this.finishing || this.cuts.length >= this.n) return;
      let x = this.knifeX;
      const assist = M.upgradeLevel("knife");
      if (assist > 0) {
        const near = this.ideal.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
        if (Math.abs(near - x) < 14 + assist * 10) x = near;
      }
      if (this.cuts.some((c) => Math.abs(c - x) < 12)) {
        M.audio.play("soft-fail");
        return;
      }
      this.cuts.push(x);
      this.cutAt.push(this.t);
      this.drop = 1;
      const juice = this.ing.face || this.ing.color || "rgba(220,235,200,0.9)";
      this.emit(7, x, this.cy - 6, { speed: 170, spread: 2.2, life: 0.5, size: 3.2, color: juice, floor: this.cy + 40 });
      this.emit(3, x, this.cy - 4, { speed: 90, spread: 2.6, life: 0.7, size: 2, color: "rgba(255,255,255,0.85)", floor: this.cy + 40 });
      M.audio.play("chop", this.pan + (x - S / 2) / 900, 0.8 + Math.random() * 0.3, this.step.ing);
      if (this.cuts.length >= this.n) {
        const b = [this.x0].concat(this.cuts.slice().sort((a, c) => a - c), [this.x0 + this.ing.len]);
        const ideal = this.ing.len / (this.n + 1);
        let err = 0;
        for (let i = 0; i < b.length - 1; i++) err += Math.abs(b[i + 1] - b[i] - ideal) / ideal;
        err /= b.length - 1;
        const q = M.clamp(1 - err * 1.5, 0.25, 1);
        this.finishDelay = 1.1;
        setTimeout(() => M.audio.play("scrape", this.pan), 450);
        this.finish(q, gradeNote(q, "Even slices", "Mostly even", "Uneven slices"));
      }
    }
    update(dt) {
      this.drop = Math.max(0, this.drop - dt * 7);
      // each cut loosens the slices a little; the last one fans them out
      const loose = this.cuts.length >= this.n ? 1 : this.cuts.length ? 0.22 : 0;
      this.spread += (loose - this.spread) * Math.min(1, dt * 6);
      if (this.keyDir) {
        // a tap snaps to the next guide; holding the key glides freely
        this.keyHold += dt;
        if (this.keyHold > 0.28) this.aim(this.knifeX + this.keyDir * dt * 260);
      }
      this.status = this.statusText;
    }
    onDown(x) {
      this.aim(x);
      this.cut();
    }
    onMove(x) {
      this.aim(x);
    }
    // Jump to the nearest guide in direction dir, preferring guides that are not cut yet.
    snap(dir) {
      const ahead = (g) => (dir < 0 ? g < this.knifeX - 3 : g > this.knifeX + 3);
      const free = this.ideal.filter((g) => ahead(g) && !this.cuts.some((c) => Math.abs(c - g) < 12));
      const pool = free.length ? free : this.ideal.filter(ahead);
      if (!pool.length) return;
      const target = pool.reduce((a, b) => (Math.abs(b - this.knifeX) < Math.abs(a - this.knifeX) ? b : a));
      this.aim(target);
      M.audio.play("tick", this.pan, 0.6);
    }
    onKey(code, down) {
      const dir = code === "ArrowLeft" ? -1 : code === "ArrowRight" ? 1 : 0;
      if (dir) {
        if (down && this.keyDir !== dir) {
          this.keyDir = dir;
          this.keyHold = 0;
          this.snap(dir);
        } else if (!down && this.keyDir === dir) {
          this.keyDir = 0;
        }
      } else if ((code === "Space" || code === "Enter") && down) this.cut();
    }
    auto(dt) {
      this.autoTimer += dt;
      if (this.autoTimer > 0.18 && this.cuts.length < this.n) {
        this.autoTimer = 0;
        const target = this.ideal[this.n - 1 - this.cuts.length];
        this.aim(target + (Math.random() - 0.5) * 4);
        this.cut();
      }
    }
    draw(ctx) {
      Art.board(ctx, 50, 230, 620, 330);
      // guides
      if (M.profile.settings.hints && this.cuts.length < this.n) {
        ctx.strokeStyle = "rgba(31,36,32,0.22)";
        ctx.setLineDash([6, 8]);
        ctx.lineWidth = 2;
        this.ideal.forEach((gx) => {
          if (this.cuts.some((c) => Math.abs(c - gx) < 10)) return;
          ctx.beginPath();
          ctx.moveTo(gx, this.cy - this.ing.half((gx - this.x0) / this.ing.len) - 26);
          ctx.lineTo(gx, this.cy + this.ing.half((gx - this.x0) / this.ing.len) + 18);
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }
      // a slice cut free on both sides tips over and lies flat, face up
      const freedAt = (a, b) => {
        const ia = this.cuts.findIndex((c) => Math.abs(c - a) < 0.5);
        const ib = this.cuts.findIndex((c) => Math.abs(c - b) < 0.5);
        if (ia < 0 || ib < 0) return 0;
        return (this.t - Math.max(this.cutAt[ia], this.cutAt[ib])) * 3.2;
      };
      Art.sliced(ctx, this.step.ing, this.x0, this.cy, this.cuts, M.ease(this.spread), (i, a, b) => freedAt(a, b));
      const blade = this.cy - this.ing.half(M.clamp((this.knifeX - this.x0) / this.ing.len, 0, 1)) - 150 + this.drop * 70;
      if (this.pov) {
        Art.helperHand(ctx, this.x0 - 6, this.cy - 8);
        Art.hand(ctx, this.knifeX + 6, blade - 20, { tool: "knife", toolDy: 0, toolRot: 0, side: 1 });
      } else {
        Art.tool(ctx, "knife", this.knifeX + 6, blade - 20, 0);
      }
    }
  }

  // ------------------------------------------------------------------ CRACK
  class Crack extends Base {
    constructor(step, env) {
      super(step, env);
      this.count = step.count;
      this.cracked = 0;
      this.phase = "tap"; // tap -> open -> drop
      this.anim = 0;
      this.qs = [];
      this.zone = [0.42, 0.68];
      this.force = 0;
      this.crackAmt = 0;
      this.shells = [];
      this.yolks = [];
      this.hint = "Tap when the needle is in the green band to crack, then tap again to open.";
    }
    get forceNow() {
      return (Math.sin(this.t * 2.6) + 1) / 2;
    }
    act() {
      if (this.finishing) return;
      if (this.phase === "tap") {
        const f = this.forceNow;
        let q = 1;
        if (f < this.zone[0]) q = 0.75;
        else if (f > this.zone[1]) {
          q = 0.55;
          for (let i = 0; i < 3; i++) this.shells.push({ x: 360 + M.rand(-60, 60), y: 470 + M.rand(-20, 20), r: M.rand(0, 6) });
        } else q = 1 - Math.abs(f - (this.zone[0] + this.zone[1]) / 2) * 0.6;
        this.curQ = q;
        this.crackAmt = 1;
        this.phase = "open";
        this.anim = 0;
        M.audio.play("crack", this.pan);
        this.emit(q < 0.7 ? 6 : 3, 360, 400, { speed: 150, spread: 2.4, life: 0.55, size: 2.6, color: "#F3EBDD", floor: 480 });
      } else if (this.phase === "open") {
        this.phase = "drop";
        this.anim = 0;
        M.audio.play("drip", this.pan);
      }
    }
    update(dt) {
      this.anim += dt;
      if (this.phase === "drop" && this.anim > 0.45) {
        this.yolks.push({ x: 360 + M.rand(-40, 40), y: 470 + M.rand(-14, 10) });
        const y = this.yolks[this.yolks.length - 1];
        this.emit(1, y.x, y.y, { speed: 0, gravity: 0, life: 0.5, size: 22, kind: "ring", color: "rgba(255,255,255,0.9)" });
        this.qs.push(this.curQ);
        this.cracked += 1;
        this.crackAmt = 0;
        if (this.cracked >= this.count) {
          const q = this.qs.reduce((a, b) => a + b, 0) / this.qs.length;
          this.finish(q, gradeNote(q, "Clean cracks, no shell", "A little shell", "Shell in the bowl"));
          this.phase = "done";
        } else {
          this.phase = "tap";
        }
      }
      this.status = this.cracked + " of " + this.count + " eggs";
    }
    onDown() {
      this.act();
    }
    onKey(code, down) {
      if ((code === "Space" || code === "Enter") && down) this.act();
    }
    auto() {
      if (this.phase === "tap") {
        const f = this.forceNow;
        if (f > 0.5 && f < 0.6) this.act();
      } else if (this.phase === "open" && this.anim > 0.25) this.act();
    }
    draw(ctx) {
      Art.bowl(ctx, 360, 470, 170, null, 0);
      this.yolks.forEach((y) => Art.yolk(ctx, y.x, y.y, 1));
      this.shells.forEach((s) => {
        ctx.fillStyle = "#F6E9D6";
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + 8, s.y + 3);
        ctx.lineTo(s.x + 2, s.y + 8);
        ctx.fill();
      });
      if (this.phase === "tap" || this.phase === "open" || this.phase === "drop") {
        let ex = 250;
        let ey = 300;
        let rot = -0.3;
        if (this.phase === "open") {
          ex = 330;
          ey = 380;
          rot = 0.2;
        }
        if (this.phase === "drop") {
          const k = M.ease(this.anim / 0.45);
          ex = 350;
          ey = 385;
          // two halves pulling apart
          Art.egg(ctx, ex - 22 * k, ey - 6 * k, 0.9, -0.4 - k * 0.6, 1);
          Art.egg(ctx, ex + 26 * k, ey - 6 * k, 0.9, 0.4 + k * 0.6, 1);
          Art.yolk(ctx, 360, ey + 20 + k * 70, 0.7 + k * 0.3);
        } else {
          Art.egg(ctx, ex, ey, 1.2, rot, this.crackAmt);
        }
        if (this.pov && this.phase !== "drop") Art.hand(ctx, ex + 10, ey + 34, { side: 1 });
      }
      if (this.phase === "tap") this.gauge(ctx, 180, 120, 360, this.forceNow, this.zone, "Tap strength");
      if (this.phase === "open") {
        Art.label(ctx, "Tap again to open the shell", 360, 130, { size: 16 });
      }
    }
  }

  // ------------------------------------------------------------------ POUR
  function drawVessel(ctx, kind, color, level, t, heat) {
    if (kind === "pan") {
      Art.burner(ctx, 360, 470, 150, heat || 0, t);
      Art.pan(ctx, 330, 450, 190, heat || 0);
      if (level > 0) {
        Art.ellipse(ctx, 330, 453, 168 * Math.sqrt(level) * 0.95 + 20, (100 * Math.sqrt(level)) * 0.95 + 12, color);
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        Art.ellipse(ctx, 300, 435, 50 * Math.sqrt(level), 12 * Math.sqrt(level));
        ctx.fill();
      }
    } else if (kind === "pot") {
      Art.pot(ctx, 360, 400, 170, Math.max(level, 0.001), color, heat ? 0.3 : 0, t);
    } else {
      Art.bowl(ctx, 360, 470, 170, color, level);
    }
  }

  class Pour extends Base {
    constructor(step, env) {
      super(step, env);
      this.level = 0;
      this.tilt = 0;
      this.holding = false;
      this.band = step.target;
      this.color = M.LIQUIDS[step.liquid] || "#EEE";
      this.vessel = step.vessel;
      this.released = 0;
      this.hint = "Hold to pour, let go inside the green band. Space works too.";
    }
    update(dt) {
      if (this.finishing) {
        this.tilt = Math.max(0, this.tilt - dt * 4);
        M.audio.loop("pour", "pour", 0, this.level, this.pan);
        return;
      }
      if (this.holding) this.tilt = Math.min(1, this.tilt + dt * 3);
      else this.tilt = Math.max(0, this.tilt - dt * 5);
      const rate = this.step.liquid === "soy" ? 0.16 : 0.24;
      if (this.tilt > 0.15) this.level += dt * rate * this.tilt;
      M.audio.loop("pour", "pour", this.tilt > 0.15 ? Math.min(1, this.tilt) : 0, this.level, this.pan);
      if (!this.holding && this.tilt === 0 && this.level >= this.band[0]) this.evaluate();
      if (this.level > 1) {
        this.level = 1;
        this.holding = false;
        this.evaluate();
      }
      this.status = Math.round(this.level * 100) + "% full";
    }
    evaluate() {
      const [a, b] = this.band;
      const c = (a + b) / 2;
      let q;
      if (this.level <= b) q = 1 - (Math.abs(this.level - c) / ((b - a) / 2)) * 0.2;
      else q = Math.max(0.2, 0.8 - (this.level - b) * 3);
      M.audio.stopLoop("pour");
      this.finish(q, gradeNote(q, "Right on the line", "Close enough", "Too much"));
    }
    onDown() {
      this.holding = true;
    }
    onUp() {
      this.holding = false;
    }
    onKey(code, down) {
      if (code === "Space" || code === "Enter") this.holding = down;
    }
    auto() {
      const c = (this.band[0] + this.band[1]) / 2;
      this.holding = this.level < c - 0.06;
    }
    draw(ctx, t) {
      drawVessel(ctx, this.vessel, this.color, this.level, t, this.vessel === "pan" ? 0.5 : 0);
      // pourer above, tilting
      const px = 470;
      const py = 170 + (1 - this.tilt) * 20;
      const tilt = 0.2 + this.tilt * 0.9;
      if (this.tilt > 0.15) {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 5 + this.tilt * 8;
        ctx.lineCap = "round";
        ctx.beginPath();
        const sx = px - 60;
        const sy = py + 10;
        ctx.moveTo(sx, sy);
        const wob = Math.sin(t * 30) * 3;
        ctx.quadraticCurveTo(sx - 20 + wob, sy + 120, 350 + wob, this.vessel === "pot" ? 400 : 460);
        ctx.stroke();
      }
      Art.pourer(ctx, px, py, this.step.liquid, tilt);
      if (this.pov) Art.hand(ctx, px + 40, py + 30, { side: 1 });
      this.gauge(ctx, 180, 650, 360, this.level, this.band, "Fill level");
    }
  }

  // ------------------------------------------------------------------ STIR
  class Stir extends Base {
    constructor(step, env) {
      super(step, env);
      this.need = Math.max(2, step.turns - M.upgradeLevel("mixer"));
      this.acc = 0;
      this.lastA = null;
      this.omega = 0;
      this.goodT = 0;
      this.totalT = 0;
      this.vessel = step.vessel;
      this.center = this.vessel === "pot" ? { x: 360, y: 404, r: 150 } : this.vessel === "pan" ? { x: 330, y: 452, r: 160 } : { x: 360, y: 474, r: 150 };
      this.keyHold = false;
      this.toolA = 0;
      this.hint = "Drag in slow circles around the bowl. Hold Space to stir with the keyboard.";
      this.stirKind = "stir-" + (step.tool || "spoon");
    }
    angleAt(x, y) {
      return Math.atan2((y - this.center.y) / 0.36, x - this.center.x);
    }
    addAngle(d, dt) {
      this.acc += Math.abs(d);
      this.toolA += d;
      const w = Math.abs(d) / Math.max(dt, 0.001);
      this.omega = M.lerp(this.omega, w, 0.2);
    }
    update(dt) {
      if (this.finishing) {
        this.omega *= 0.9;
        M.audio.loop("stir", this.stirKind, 0, 0, this.pan);
        return;
      }
      if (this.keyHold) this.addAngle(7 * dt, dt);
      else if (!this.down) this.omega *= Math.pow(0.05, dt);
      if (this.omega > 0.5) {
        this.totalT += dt;
        if (this.omega >= 2.5 && this.omega <= 14) this.goodT += dt;
      }
      M.audio.loop("stir", this.stirKind, M.clamp(this.omega / 8, 0, 1), M.clamp(this.omega / 14, 0, 1), this.pan);
      if (this.vessel === "pan") M.audio.loop("sizzle", "sizzle", 0.4, 0.4, this.pan);
      const turns = this.acc / (Math.PI * 2);
      this.status = Math.min(this.need, Math.floor(turns)) + " of " + this.need + " turns";
      if (turns >= this.need) {
        const q = this.totalT > 0 ? M.clamp(0.55 + 0.45 * (this.goodT / this.totalT), 0, 1) : 0.8;
        M.audio.stopLoop("stir");
        M.audio.stopLoop("sizzle");
        this.finish(q, gradeNote(q, "Smooth and even", "A bit rushed", "Splashy"));
      }
    }
    onDown(x, y) {
      this.lastA = this.angleAt(x, y);
      this.lastT = this.t;
    }
    onMove(x, y) {
      if (!this.down || this.finishing) return;
      const a = this.angleAt(x, y);
      if (this.lastA != null) {
        let d = a - this.lastA;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        const dt = Math.max(0.008, this.t - (this.lastT || this.t));
        if (Math.abs(d) < 1.2) this.addAngle(d, dt);
      }
      this.lastA = a;
      this.lastT = this.t;
    }
    onKey(code, down) {
      if (code === "Space" || code === "Enter") this.keyHold = down;
    }
    auto(dt) {
      this.addAngle(7 * dt, dt);
    }
    draw(ctx, t) {
      const prog = M.clamp(this.acc / (Math.PI * 2 * this.need), 0, 1);
      const col = Art.mix(this.step.from, this.step.to, prog);
      const c = this.center;
      if (this.vessel === "pan") {
        Art.burner(ctx, 360, 470, 150, 0.5, t);
        Art.pan(ctx, 330, 450, 190, 0.5);
        // rice grains / contents
        Art.ellipse(ctx, c.x, c.y, 150, 88, col);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        for (let i = 0; i < 90; i++) {
          const a = i * 2.39 + this.toolA * 0.6;
          const r = Math.sqrt(i / 90) * 140;
          Art.ellipse(ctx, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.58, 4, 2, null, a);
          ctx.fill();
        }
        if (this.step.tool === "spatula") {
          ctx.fillStyle = "#5E9A4A";
          for (let i = 0; i < 16; i++) {
            const a = i * 1.7 + this.toolA * 0.6;
            Art.ellipse(ctx, c.x + Math.cos(a) * 90 * ((i % 5) / 5 + 0.2), c.y + Math.sin(a) * 50 * ((i % 3) / 3 + 0.2), 4, 3, "#5E9A4A");
          }
        }
      } else if (this.vessel === "pot") {
        Art.pot(ctx, 360, 400, 170, 0.8, col, 0.15, t);
      } else {
        Art.bowl(ctx, 360, 474, 170, col, 0.7);
        if (this.step.tool === "tongs") {
          for (let i = 0; i < 12; i++) {
            const a = i * 1.3 + this.toolA * 0.5;
            Art.ellipse(ctx, c.x + Math.cos(a) * 80, c.y + Math.sin(a) * 26, 22, 11, i % 3 === 0 ? "#D8432F" : i % 3 === 1 ? "#CFE3B0" : "#7DB05A", a);
          }
        }
      }
      // batter surface: unmixed flour and milk streaks fade as you whisk, swirl lines and
      // air bubbles build up, so progress is visible in both camera views
      if (this.vessel === "bowl" && this.step.tool === "whisk") {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(c.x, c.y + 2, c.r * 0.86, c.r * 0.86 * 0.3, 0, 0, Math.PI * 2);
        ctx.clip();
        const lumps = 1 - prog;
        for (let i = 0; i < 9; i++) {
          const a = i * 2.1 + this.toolA * 0.35;
          const rr = (0.18 + (i % 4) * 0.16) * c.r;
          Art.ellipse(ctx, c.x + Math.cos(a) * rr, c.y + 2 + Math.sin(a) * rr * 0.3, 16 + (i % 3) * 6, 6 + (i % 2) * 3, "rgba(250,246,236," + (0.85 * lumps) + ")", a * 0.2);
        }
        ctx.strokeStyle = "rgba(255,252,244," + (0.5 * lumps) + ")";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(c.x - 20, c.y + 6, c.r * 0.42, c.r * 0.08, 0.15, this.toolA * 0.5, this.toolA * 0.5 + 2.2);
        ctx.stroke();
        const swirls = 3 + Math.round(prog * 4);
        for (let i = 0; i < swirls; i++) {
          const rad = c.r * (0.14 + i * 0.1);
          ctx.strokeStyle = i % 2 ? "rgba(255,255,255,0.4)" : "rgba(150,105,50,0.22)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(c.x, c.y + 2, rad, rad * 0.3, 0, this.toolA * (1 - i * 0.08) + i, this.toolA * (1 - i * 0.08) + i + 1.4 + prog);
          ctx.stroke();
        }
        const bubbles = Math.round(4 + prog * 18);
        for (let i = 0; i < bubbles; i++) {
          const a = i * 2.39 + this.toolA * 0.25;
          const rr = Math.sqrt((i + 0.5) / bubbles) * c.r * 0.78;
          const bx = c.x + Math.cos(a) * rr;
          const by = c.y + 2 + Math.sin(a) * rr * 0.3;
          const br = 1.5 + (i % 3);
          ctx.strokeStyle = "rgba(255,255,255,0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        // drips on the rim once the batter is moving
        if (this.omega > 1) {
          Art.ellipse(ctx, c.x + Math.cos(this.toolA) * c.r * 0.86, c.y + 2 + Math.sin(this.toolA) * c.r * 0.26, 5, 3, col);
        }
      } else if (this.vessel !== "pan") {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(c.x, c.y + 2, c.r * (0.3 + i * 0.18), c.r * (0.3 + i * 0.18) * 0.3, 0, this.toolA + i, this.toolA + i + 1.6);
          ctx.stroke();
        }
      }
      // tool position on the circle
      const tx = c.x + Math.cos(this.toolA) * c.r * 0.45;
      const ty = c.y + Math.sin(this.toolA) * c.r * 0.45 * 0.36 - 110;
      if (this.pov) Art.hand(ctx, tx, ty - 10, { tool: this.step.tool, side: 1, toolRot: Math.cos(this.toolA) * 0.15 });
      else Art.tool(ctx, this.step.tool, tx, ty - 10, Math.cos(this.toolA) * 0.15);
      // direction hint
      if (M.profile.settings.hints && this.acc < 0.4) {
        ctx.strokeStyle = "rgba(180,71,43,0.8)";
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.r * 1.15, c.r * 0.45, 0, 0, Math.PI * 1.7);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // ------------------------------------------------------------------ FRY
  const FRY = {
    tamago: { raw: "#F7E3A8", cooked: "#EDBB45", burnt: "#8A5A22", rate: 0.17, flipLabel: "Roll" },
    pancake: { raw: "#F1E2BF", cooked: "#D9A05B", burnt: "#5A3A22", rate: 0.15, flipLabel: "Flip" },
    steak: { raw: "#B5524A", cooked: "#6E3A22", burnt: "#2E1C14", rate: 0.13, flipLabel: "Flip" },
    garlic: { raw: "#F4EDD8", cooked: "#D9A85A", burnt: "#5A3A1E", rate: 0.2, flipLabel: "Toss" },
    onion: { raw: "#F2EEDF", cooked: "#D9B068", burnt: "#6A4626", rate: 0.17, flipLabel: "Toss" },
  };

  class Fry extends Base {
    constructor(step, env) {
      super(step, env);
      this.def = FRY[step.item];
      this.sides = step.sides;
      this.side = 0;
      this.d = new Array(this.sides).fill(0);
      this.heat = 2;
      const w = M.upgradeLevel("pan") * 0.04;
      this.zone = [0.62 - w, 0.88 + w];
      this.flipAnim = 0;
      this.qs = [];
      this.buttons = [
        { id: "h1", label: "Low", x: 40, y: 640, w: 96, h: 48 },
        { id: "h2", label: "Medium", x: 144, y: 640, w: 116, h: 48 },
        { id: "h3", label: "High", x: 268, y: 640, w: 96, h: 48 },
        { id: "act", label: "", x: 480, y: 640, w: 200, h: 48, primary: true },
      ];
      this.hint = "Wait for the needle to reach green, then tap the pan. Keys 1 2 3 set the heat.";
    }
    act() {
      if (this.finishing || this.flipAnim > 0) return;
      const dv = this.d[this.side];
      const c = (this.zone[0] + this.zone[1]) / 2;
      let q;
      if (dv >= this.zone[0] && dv <= this.zone[1]) q = 1 - Math.abs(dv - c) * 0.8;
      else q = Math.max(0.1, 1 - (dv < this.zone[0] ? this.zone[0] - dv : dv - this.zone[1]) * 2.6);
      this.qs.push(q);
      if (this.side < this.sides - 1) {
        this.side++;
        this.flipAnim = 0.45;
        M.audio.play("flip", this.pan);
        this.emit(10, 330, 450, { speed: 220, spread: 2.6, life: 0.5, size: 2.4, color: "rgba(255,226,160,0.95)", floor: 520 });
      } else {
        const avg = this.qs.reduce((a, b) => a + b, 0) / this.qs.length;
        M.audio.stopLoop("sizzle");
        M.audio.play("steam", this.pan);
        this.emit(9, 330, 400, { speed: 60, spread: 1.2, life: 1.4, size: 14, gravity: -40, kind: "puff", color: "#FFFFFF" });
        const done = this.d.reduce((a, b) => a + b, 0) / this.d.length;
        let note = gradeNote(avg, "Golden all over", "Nearly there", done > 0.9 ? "A little burnt" : "Underdone");
        if (avg >= 0.85 && this.step.item === "steak") note = "Perfect sear";
        this.finish(avg, note);
      }
    }
    onButton(id) {
      if (id === "act") this.act();
      else this.heat = Number(id.slice(1));
    }
    onDown(x, y) {
      if (M.dist(x, y, 330, 450) < 230) this.act();
    }
    onKey(code, down) {
      if (!down) return;
      if (code === "Space" || code === "Enter") this.act();
      if (code === "Digit1") this.heat = 1;
      if (code === "Digit2") this.heat = 2;
      if (code === "Digit3") this.heat = 3;
      if (code === "ArrowUp") this.heat = Math.min(3, this.heat + 1);
      if (code === "ArrowDown") this.heat = Math.max(1, this.heat - 1);
    }
    auto() {
      const c = (this.zone[0] + this.zone[1]) / 2;
      if (this.flipAnim <= 0 && this.d[this.side] >= c) this.act();
    }
    update(dt) {
      this.flipAnim = Math.max(0, this.flipAnim - dt);
      this.buttons.forEach((b) => {
        if (b.id[0] === "h") b.active = Number(b.id.slice(1)) === this.heat;
      });
      const actB = this.buttons[3];
      actB.label = this.side < this.sides - 1 ? this.def.flipLabel : "Take off heat";
      actB.hidden = !!this.finishing;
      if (this.finishing) return;
      const mult = [0, 0.55, 1, 1.6][this.heat];
      this.d[this.side] += dt * this.def.rate * mult * 1.25;
      // hot oil pops more often on high heat
      this.spat = (this.spat || 0) + dt * this.heat * 2.2;
      while (this.spat > 1) {
        this.spat -= 1;
        const a = Math.random() * Math.PI * 2;
        this.emit(2, 330 + Math.cos(a) * 130, 450 + Math.sin(a) * 70, { speed: 140 + this.heat * 40, spread: 1.4, life: 0.45, size: 1.8, color: "rgba(255,236,190,0.95)" });
      }
      if (this.d[this.side] > 1.35) this.act();
      M.audio.loop("sizzle", "sizzle", 0.35 + this.heat * 0.2, M.clamp(this.d[this.side], 0, 1), this.pan);
      const v = this.d[this.side];
      this.status = v < this.zone[0] ? "Cooking" : v <= this.zone[1] ? "Golden now" : "Getting dark";
    }
    drawItem(ctx, x, y, topDone, bottomDone, squash) {
      const it = this.step.item;
      const def = this.def;
      const top = Art.doneColor(def.raw, def.cooked, def.burnt, topDone);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, squash);
      if (it === "pancake") {
        Art.ellipse(ctx, 0, 6, 120, 70, Art.doneColor(def.raw, def.cooked, def.burnt, bottomDone));
        Art.ellipse(ctx, 0, 0, 118, 66, top);
        if (topDone < 0.2 && bottomDone > 0.4) {
          ctx.fillStyle = "rgba(200,170,120,0.8)";
          for (let i = 0; i < 12; i++) Art.ellipse(ctx, Math.cos(i * 2.2) * 70 * ((i % 4) / 4 + 0.2), Math.sin(i * 2.2) * 40 * ((i % 3) / 3 + 0.2), 4, 3);
          ctx.fill();
        }
      } else if (it === "tamago") {
        if (this.side === 0 && this.flipAnim === 0) {
          Art.ellipse(ctx, 0, 0, 140, 82, top);
        } else {
          Art.rr(ctx, -110, -40, 220, 80, 36);
          ctx.fillStyle = Art.doneColor(def.raw, def.cooked, def.burnt, (topDone + bottomDone) / 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(180,120,30,0.4)";
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(-100, -24 + i * 22);
            ctx.lineTo(100, -24 + i * 22);
            ctx.stroke();
          }
        }
      } else if (it === "steak") {
        // seared edge (the side touching the pan) shows under the top
        Art.rr(ctx, -120, -56, 240, 120, 50);
        ctx.fillStyle = Art.doneColor(def.raw, def.cooked, def.burnt, bottomDone);
        ctx.fill();
        // fat cap along the back edge
        Art.rr(ctx, -112, -66, 224, 30, 15);
        ctx.fillStyle = Art.mix("#F2E6D6", "#C9A36B", M.clamp(topDone, 0, 1));
        ctx.fill();
        Art.rr(ctx, -118, -56, 236, 106, 46);
        const g = ctx.createRadialGradient(-20, -10, 10, 0, 0, 140);
        g.addColorStop(0, top);
        g.addColorStop(1, Art.mix(top, "#2A140C", 0.35));
        ctx.fillStyle = g;
        ctx.fill();
        // marbling: thin wandering fat lines that brown with the meat
        ctx.strokeStyle = topDone > 0.5 ? "rgba(235,200,150,0.35)" : "rgba(255,238,228,0.55)";
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        [[-90, 20, -40, -4, 10, 26, 70, 6], [-70, -26, -20, -10, 30, -34, 90, -18], [-30, 34, 0, 18, 40, 38, 96, 30]].forEach((m) => {
          ctx.beginPath();
          ctx.moveTo(m[0], m[1]);
          ctx.bezierCurveTo(m[2], m[3], m[4], m[5], m[6], m[7]);
          ctx.stroke();
        });
        // light catches the juices on top
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        Art.ellipse(ctx, -40, -22, 54, 14, null, -0.15);
        ctx.fill();
        if (topDone > 0.5) {
          ctx.strokeStyle = "rgba(30,15,8,0.45)";
          ctx.lineWidth = 8;
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(-80 + i * 50, -50);
            ctx.lineTo(-50 + i * 50, 40);
            ctx.stroke();
          }
        }
      } else {
        // garlic slices / onion slivers scattered
        const n = it === "garlic" ? 22 : 18;
        for (let i = 0; i < n; i++) {
          const a = i * 2.4;
          const r = Math.sqrt(i / n) * 120;
          const col = Art.doneColor(def.raw, def.cooked, def.burnt, bottomDone + ((i % 3) - 1) * 0.05);
          if (it === "garlic") Art.ellipse(ctx, Math.cos(a) * r, Math.sin(a) * r * 0.6, 12, 9, col, a);
          else {
            ctx.strokeStyle = col;
            ctx.lineWidth = 7;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 0.6, 18, a, a + 2);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
    draw(ctx, t) {
      Art.burner(ctx, 360, 470, 150, this.finishing ? 0 : this.heat / 3, t);
      Art.pan(ctx, 330, 450, 190, this.heat / 3);
      const k = this.flipAnim > 0 ? Math.abs(Math.cos((1 - this.flipAnim / 0.45) * Math.PI)) : 1;
      const lift = this.flipAnim > 0 ? Math.sin((1 - this.flipAnim / 0.45) * Math.PI) * 90 : 0;
      const top = this.sides > 1 && this.side > 0 ? this.d[this.side - 1] : 0;
      const single = this.sides === 1;
      this.drawItem(ctx, 330, 450 - lift, single ? this.d[0] : top, this.d[this.side], Math.max(0.08, k));
      Art.steam(ctx, 330, 380, M.clamp(this.d[this.side], 0, 1) * 0.8, t, 160);
      // sizzle: bubbling oil hugging the food, more and faster with heat
      if (!this.finishing) {
        const still = M.profile.settings.reduceMotion;
        const bubbles = 10 + this.heat * 10;
        for (let i = 0; i < bubbles; i++) {
          const a = (i / bubbles) * Math.PI * 2 + i * 0.37;
          const ph = still ? 0.5 : (t * (1.2 + this.heat * 0.9) + i * 0.618) % 1;
          const ring = 1.02 + ((i * 7) % 5) * 0.035;
          const bx = 330 + Math.cos(a) * 128 * ring;
          const by = 450 - lift + Math.sin(a) * 68 * ring;
          const r = (1.4 + ((i * 3) % 4) * 0.7) * (0.4 + ph);
          ctx.globalAlpha = 1 - ph * 0.7;
          ctx.strokeStyle = "rgba(255,236,190,0.95)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(bx, by, r + 0.8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,250,235,0.9)";
          ctx.beginPath();
          ctx.arc(bx - r * 0.3, by - r * 0.3, Math.max(0.6, r * 0.35), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (this.heat >= 2 && !still) {
          // thin smoke wisps curling up off the pan
          ctx.strokeStyle = this.heat === 3 ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.2)";
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          for (let w = 0; w < this.heat; w++) {
            const ph = (t * 0.35 + w * 0.41) % 1;
            const x0 = 250 + w * 70;
            ctx.globalAlpha = Math.sin(ph * Math.PI);
            ctx.beginPath();
            for (let s = 0; s <= 10; s++) {
              const yy = 400 - ph * 60 - s * 14;
              const xx = x0 + Math.sin(s * 0.7 + t * 1.6 + w) * (6 + s * 1.4);
              if (s === 0) ctx.moveTo(xx, yy);
              else ctx.lineTo(xx, yy);
            }
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }
      if (this.pov) {
        Art.hand(ctx, 600, 330, { tool: "spatula", side: 1, toolRot: -0.5 });
      }
      this.gauge(ctx, 180, 120, 360, this.d[this.side] / 1.3, [this.zone[0] / 1.3, this.zone[1] / 1.3], this.sides > 1 ? "Side " + (this.side + 1) + " of " + this.sides : "Doneness");
      this.drawButtons(ctx);
    }
  }

  // ------------------------------------------------------------------ BOIL
  const BOIL = {
    egg: { time: 7, label: "Lift the egg", water: "#CFE0E3" },
    noodles: { time: 5.5, label: "Lift the noodles", water: "#E6E0C8" },
    soup: { time: 6, label: "Turn off the heat", water: "#C8442F" },
  };

  class Boil extends Base {
    constructor(step, env) {
      super(step, env);
      this.def = BOIL[step.item];
      this.phase = step.item === "soup" ? "cook" : "drop";
      this.p = 0;
      this.zone = [0.78, 1.0];
      this.lift = 0;
      this.buttons = [{ id: "act", label: "", x: 260, y: 640, w: 200, h: 48, primary: true }];
      this.hint = step.item === "soup" ? "Let it simmer, then turn off the heat in the green band." : "Tap to drop it in. Lift it out in the green band.";
    }
    act() {
      if (this.finishing) return;
      if (this.phase === "drop") {
        this.phase = "cook";
        M.audio.play("drip", this.pan);
        M.audio.play("bubble", this.pan, 1);
        return;
      }
      const c = (this.zone[0] + this.zone[1]) / 2;
      const v = this.p;
      let q;
      if (v >= this.zone[0] && v <= this.zone[1]) q = 1 - Math.abs(v - c) * 0.9;
      else q = Math.max(0.15, 1 - (v < this.zone[0] ? this.zone[0] - v : v - this.zone[1]) * 2.2);
      this.phase = "lift";
      M.audio.stopLoop("boil");
      M.audio.play("steam", this.pan);
      let note = gradeNote(q, "Just right", "Close", v < this.zone[0] ? "Underdone" : "Overcooked");
      if (q >= 0.85 && this.step.item === "egg") note = "Jammy yolk";
      if (q >= 0.85 && this.step.item === "noodles") note = "Springy noodles";
      this.finish(q, note);
    }
    onButton() {
      this.act();
    }
    onDown(x, y) {
      if (M.dist(x, y, 360, 420) < 240) this.act();
    }
    onKey(code, down) {
      if (down && (code === "Space" || code === "Enter")) this.act();
    }
    auto() {
      if (this.phase === "drop") this.act();
      else if (this.phase === "cook" && this.p >= 0.89) this.act();
    }
    update(dt) {
      const b = this.buttons[0];
      b.label = this.phase === "drop" ? "Drop it in" : this.def.label;
      b.hidden = !!this.finishing;
      if (this.phase === "lift") this.lift = Math.min(1, this.lift + dt * 2.5);
      if (this.phase === "cook") {
        this.p += dt / this.def.time;
        if (this.p > 1.4) this.act();
      }
      M.audio.loop("boil", "boil", this.phase === "lift" ? 0 : 0.7, 0, this.pan);
      this.status = this.phase === "drop" ? "Water is boiling" : this.phase === "cook" ? Math.round(this.p * this.def.time) + " min" : "Done";
    }
    draw(ctx, t) {
      Art.burner(ctx, 360, 560, 150, this.phase === "lift" ? 0 : 0.8, t);
      Art.pot(ctx, 360, 400, 170, 0.85, this.def.water, this.phase === "lift" ? 0.1 : 0.9, t);
      const it = this.step.item;
      if (it === "egg" && this.phase !== "drop") {
        const y = 404 - this.lift * 160;
        Art.egg(ctx, 360 + Math.sin(t * 3) * 10 * (1 - this.lift), y, 0.9, Math.sin(t * 2) * 0.3, 0);
      }
      if (it === "noodles" && this.phase !== "drop") {
        ctx.save();
        ctx.translate(0, -this.lift * 160);
        ctx.strokeStyle = "#F0D79A";
        ctx.lineWidth = 4;
        for (let i = 0; i < 7; i++) {
          ctx.beginPath();
          for (let k = 0; k <= 20; k++) {
            const px = 260 + k * 10;
            const py = 400 + Math.sin(k * 0.8 + t * 2 + i) * 10 + (i - 3) * 6;
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
      if (this.phase === "drop") {
        if (it === "egg") Art.egg(ctx, 470, 230, 1, 0.3, 0);
        if (it === "noodles") {
          ctx.fillStyle = "#F0D79A";
          Art.rr(ctx, 410, 200, 120, 60, 18);
          ctx.fill();
          ctx.strokeStyle = "#D9BD7A";
          ctx.lineWidth = 2;
          for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(418, 208 + i * 9);
            ctx.bezierCurveTo(450, 200 + i * 9, 490, 218 + i * 9, 522, 206 + i * 9);
            ctx.stroke();
          }
        }
      }
      Art.steam(ctx, 360, 340, this.phase === "lift" ? 0.4 : 0.9, t, 200);
      if (this.pov && this.phase !== "drop") {
        Art.hand(ctx, 560, 230 - this.lift * 40, { tool: "ladle", side: 1, toolRot: 0.6 });
      }
      if (this.phase !== "drop") this.gauge(ctx, 180, 120, 360, this.p / 1.3, [this.zone[0] / 1.3, this.zone[1] / 1.3], "Time in the pot");
      this.drawButtons(ctx);
    }
  }

  // ------------------------------------------------------------------ SEASON
  class Season extends Base {
    constructor(step, env) {
      super(step, env);
      this.level = 0;
      this.band = step.target;
      this.grains = [];
      this.tilt = 0;
      this.lastY = null;
      this.lastDir = 0;
      this.buttons = [{ id: "done", label: "Done", x: 500, y: 640, w: 180, h: 48, primary: true, hidden: true }];
      this.hint = "Tap to shake. Stop inside the green band, then press Done or Enter.";
      this.base = env.seasonBase || "bowl";
      this.color = env.bowlColor || "#F2C14E";
    }
    shake() {
      if (this.finishing) return;
      this.level += M.rand(0.07, 0.1);
      this.tilt = 1;
      M.audio.play("shake", this.pan);
      for (let i = 0; i < 14; i++) {
        this.grains.push({ x: this.px + M.rand(-14, 14), y: 260, vy: M.rand(160, 300), life: 1 });
      }
      if (this.level > this.band[1] + 0.28) this.complete();
    }
    complete() {
      if (this.finishing) return;
      const [a, b] = this.band;
      const c = (a + b) / 2;
      let q;
      if (this.level >= a && this.level <= b) q = 1 - (Math.abs(this.level - c) / ((b - a) / 2)) * 0.2;
      else if (this.level < a) q = Math.max(0.3, 0.8 - (a - this.level) * 2.5);
      else q = Math.max(0.2, 0.8 - (this.level - b) * 2.5);
      this.finish(q, gradeNote(q, "Seasoned just right", "Close", this.level < a ? "Under-seasoned" : "Too salty"));
    }
    onButton() {
      this.complete();
    }
    onDown(x, y) {
      this.lastY = y;
      this.shake();
    }
    onMove(x, y) {
      if (this.down && this.lastY != null) {
        const dir = Math.sign(y - this.lastY);
        if (dir !== 0 && dir !== this.lastDir && Math.abs(y - this.lastY) > 4) {
          if (dir > 0) this.shake();
          this.lastDir = dir;
        }
        this.lastY = y;
      }
    }
    onKey(code, down) {
      if (!down) return;
      if (code === "Space") this.shake();
      if (code === "Enter") this.complete();
    }
    auto(dt) {
      this.autoT = (this.autoT || 0) + dt;
      if (this.autoT > 0.3) {
        this.autoT = 0;
        const c = (this.band[0] + this.band[1]) / 2;
        if (this.level < c - 0.05) {
          this.px = 360;
          this.shake();
        } else this.complete();
      }
    }
    update(dt) {
      this.tilt = Math.max(0, this.tilt - dt * 4);
      this.grains.forEach((g) => {
        g.y += g.vy * dt;
        g.life -= dt * 1.4;
      });
      this.grains = this.grains.filter((g) => g.life > 0 && g.y < 470);
      this.buttons[0].hidden = this.level < 0.08 || !!this.finishing;
      this.status = "Seasoning " + Math.round(this.level * 100) + "%";
    }
    draw(ctx) {
      if (this.base === "steak") {
        Art.board(ctx, 70, 300, 580, 280);
        Art.sliced(ctx, "steak", 360 - 170, 440, [], 0);
      } else {
        Art.bowl(ctx, 360, 474, 170, this.color, 0.7);
      }
      // grains on the surface
      ctx.fillStyle = this.step.spice === "pepper" ? "#2A2420" : "#FFFFFF";
      const n = Math.floor(this.level * 80);
      for (let i = 0; i < n; i++) {
        const a = i * 2.39;
        const r = Math.sqrt(i / 80) * 120;
        ctx.fillRect(360 + Math.cos(a) * r, 470 + Math.sin(a) * r * 0.32, 2.4, 2.4);
      }
      this.grains.forEach((g) => {
        ctx.globalAlpha = Math.max(0, g.life);
        ctx.fillRect(g.x, g.y, 2.4, 2.4);
      });
      ctx.globalAlpha = 1;
      const sx = M.clamp(this.px, 200, 520);
      Art.shaker(ctx, sx, 200, this.step.spice, Math.PI - 0.4 + this.tilt * 0.35);
      if (this.pov) Art.hand(ctx, sx + 6, 170, { side: 1 });
      this.gauge(ctx, 180, 120, 360, this.level, this.band, this.step.spice === "pepper" ? "Pepper" : "Salt");
      this.drawButtons(ctx);
    }
  }

  // ------------------------------------------------------------------ PLATE
  class Plate extends Base {
    constructor(step, env) {
      super(step, env);
      this.dish = M.DISHES[step.dish];
      this.placed = this.dish.items.map(() => null);
      this.qs = [];
      this.drag = null;
      this.selected = null;
      this.cx = 360;
      this.cy = 330;
      this.s = 1.3;
      this.hint = "Drag each item onto the dish, or tap an item then tap the plate. Space places the next one.";
      this.finishDelay = 1.3;
    }
    tray() {
      const n = this.dish.items.length;
      const w = 150;
      const gap = 14;
      const total = n * w + (n - 1) * gap;
      const x0 = S / 2 - total / 2;
      return this.dish.items.map((it, i) => ({ i, x: x0 + i * (w + gap), y: 556, w, h: 118 }));
    }
    target(i) {
      const it = this.dish.items[i];
      return { x: this.cx + it[1] * this.s, y: this.cy + it[2] * this.s };
    }
    place(i, x, y) {
      const t = this.target(i);
      const d = M.dist(x, y, t.x, t.y);
      if (d > 190) return false;
      const dx = M.clamp((x - t.x) / this.s, -26, 26);
      const dy = M.clamp((y - t.y) / this.s, -18, 18);
      this.placed[i] = { dx, dy };
      this.landed = this.landed || {};
      this.landed[i] = this.t;
      this.qs.push(1 - Math.min(1, d / 140) * 0.55);
      const recipe = M.recipeById ? M.recipeById(this.step.dish) : null;
      const crumb = recipe && recipe.color ? recipe.color : "#C9A27A";
      this.emit(6, t.x + dx * this.s, t.y + dy * this.s, { speed: 110, spread: 2.8, life: 0.45, size: 2.4, color: crumb, floor: t.y + dy * this.s + 22 });
      M.audio.play("plate", this.pan + (x - 360) / 900);
      // a soft settle ring shows where it landed; a tight ring means a good spot
      this.emit(1, t.x + dx * this.s, t.y + dy * this.s, { speed: 0, gravity: 0, life: 0.55, size: 26, kind: "ring", color: d < 60 ? "#3F6B4E" : "#8A5A12" });
      if (this.placed.every(Boolean)) {
        const q = this.qs.reduce((a, b) => a + b, 0) / this.qs.length;
        setTimeout(() => M.audio.play("clink", this.pan), 300);
        this.finish(q, gradeNote(q, "Beautiful plating", "Neat enough", "A bit messy"));
      }
      return true;
    }
    onDown(x, y) {
      const hit = this.tray().find((r) => !this.placed[r.i] && M.inRect(x, y, r));
      if (hit) {
        this.drag = { i: hit.i, x, y };
        this.selected = hit.i;
        M.audio.play("tick");
        return;
      }
      if (this.selected != null && !this.placed[this.selected]) {
        if (this.place(this.selected, x, y)) this.selected = null;
      }
    }
    onMove(x, y) {
      if (this.drag) {
        this.drag.x = x;
        this.drag.y = y;
      }
    }
    onUp(x, y) {
      if (this.drag) {
        const moved = y < 540;
        if (moved && this.place(this.drag.i, x, y)) this.selected = null;
        this.drag = null;
      }
    }
    onKey(code, down) {
      if (down && (code === "Space" || code === "Enter")) {
        const i = this.placed.findIndex((p) => !p);
        if (i >= 0) {
          const t = this.target(i);
          this.place(i, t.x + M.rand(-8, 8), t.y + M.rand(-6, 6));
        }
      }
    }
    auto(dt) {
      this.autoT = (this.autoT || 0) + dt;
      if (this.autoT > 0.3) {
        this.autoT = 0;
        this.onKey("Space", true);
      }
    }
    update() {
      const n = this.placed.filter(Boolean).length;
      this.status = n + " of " + this.placed.length + " placed";
    }
    draw(ctx, t) {
      Art.dish(ctx, this.step.dish, this.cx, this.cy, this.s, this.placed);
      // ghost targets
      if (M.profile.settings.hints) {
        this.placed.forEach((p, i) => {
          if (p) return;
          const tg = this.target(i);
          ctx.save();
          ctx.globalAlpha = i === this.selected ? 0.32 : 0.18;
          Art.COMPONENTS[this.dish.items[i][0]](ctx, tg.x, tg.y, this.s);
          ctx.restore();
          ctx.strokeStyle = i === this.selected ? "rgba(180,71,43,0.9)" : "rgba(31,36,32,0.3)";
          ctx.setLineDash([6, 6]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(tg.x, tg.y, 34, 22, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }
      if (this.landed) {
        Object.keys(this.landed).forEach((key) => {
          const i = Number(key);
          const age = this.t - this.landed[i];
          const p = this.placed[i];
          if (!p || age > 0.3) return;
          const tg = this.target(i);
          const k = 1 - age / 0.3;
          ctx.save();
          ctx.globalAlpha = 0.55 * k;
          ctx.translate(tg.x + p.dx * this.s, tg.y + p.dy * this.s);
          ctx.scale(1 + 0.12 * k, 1 - 0.08 * k);
          Art.COMPONENTS[this.dish.items[i][0]](ctx, 0, 0, this.s);
          ctx.restore();
        });
      }
      if (this.finishing) {
        const hot = ["ramen", "tomato_soup", "miso", "fried_rice", "steak"].includes(this.step.dish);
        if (hot) Art.steam(ctx, this.cx, this.cy - 40, 0.8, t, 160);
      }
      // tray
      this.tray().forEach((r) => {
        ctx.fillStyle = r.i === this.selected ? "#F3DED6" : "rgba(255,255,255,0.92)";
        Art.rr(ctx, r.x, r.y, r.w, r.h, 12);
        ctx.fill();
        ctx.strokeStyle = r.i === this.selected ? "#B4472B" : "rgba(31,36,32,0.14)";
        ctx.lineWidth = r.i === this.selected ? 2 : 1;
        ctx.stroke();
        if (this.placed[r.i] || (this.drag && this.drag.i === r.i)) {
          ctx.fillStyle = "rgba(31,36,32,0.35)";
          ctx.font = "600 14px Segoe UI, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(this.placed[r.i] ? "Placed" : "", r.x + r.w / 2, r.y + r.h / 2 + 5);
          ctx.textAlign = "start";
          return;
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
        ctx.clip();
        Art.shadow(ctx, r.x + r.w / 2 + 3, r.y + r.h / 2 + 22, 54, 12, 0.14);
        Art.ellipse(ctx, r.x + r.w / 2, r.y + r.h / 2 + 12, 58, 30, "#D9A86C");
        Art.ellipse(ctx, r.x + r.w / 2, r.y + r.h / 2 + 9, 56, 27, "#E4B87E");
        Art.COMPONENTS[this.dish.items[r.i][0]](ctx, r.x + r.w / 2, r.y + r.h / 2 + 6, 0.78);
        ctx.restore();
      });
      if (this.drag) {
        Art.shadow(ctx, this.drag.x + 10, this.drag.y + 34, 46 * this.s * 0.8, 12, 0.2);
        Art.COMPONENTS[this.dish.items[this.drag.i][0]](ctx, this.drag.x, this.drag.y - 6, this.s * 1.06);
        if (this.pov) Art.hand(ctx, this.drag.x + 20, this.drag.y + 30, { side: 1 });
      }
    }
  }

  M.MINIGAMES = { chop: Chop, crack: Crack, pour: Pour, stir: Stir, fry: Fry, boil: Boil, season: Season, plate: Plate };
  M.VIRTUAL = S;
})();
