/* Mise - a cooking session: runs a recipe's steps, in first or third person. */
(function () {
  "use strict";
  const M = window.Mise;
  const Art = M.art;
  const RW = 1000;
  const RH = 640;

  // Station positions in the third-person kitchen (room coords 1000 x 640).
  const STATIONS = {
    board: { x: 170, y: 168, label: "Board" },
    bowl: { x: 345, y: 168, label: "Prep" },
    stove: { x: 535, y: 168, label: "Stove" },
    pot: { x: 715, y: 168, label: "Pot" },
    pass: { x: 875, y: 168, label: "Plate" },
  };
  M.KITCHEN_STATIONS = STATIONS;

  function stationFor(step) {
    if (step.type === "pour" || step.type === "stir") {
      if (step.vessel === "pan") return "stove";
      if (step.vessel === "pot") return "pot";
      return "bowl";
    }
    return M.ACTIONS[step.type].station;
  }

  // ---------- third-person kitchen room ----------
  function drawKitchenRoom(ctx, t, o) {
    const home = o.home;
    const tod = M.profile.settings.timeOfDay;
    // floor
    if (home) {
      ctx.fillStyle = "#D8BE97";
      ctx.fillRect(0, 0, RW, RH);
      ctx.strokeStyle = "rgba(120,85,50,0.18)";
      ctx.lineWidth = 2;
      for (let y = 230; y < RH; y += 34) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(RW, y);
        ctx.stroke();
        for (let x = ((y / 34) % 2) * 90; x < RW; x += 180) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 34);
          ctx.stroke();
        }
      }
    } else {
      ctx.fillStyle = "#E6E1D6";
      ctx.fillRect(0, 0, RW, RH);
      ctx.fillStyle = "#DAD3C5";
      for (let y = 230; y < RH; y += 44) {
        for (let x = 0; x < RW; x += 44) {
          if (((x + y) / 44) % 2 < 1) ctx.fillRect(x, y, 44, 44);
        }
      }
    }
    // back wall
    ctx.fillStyle = home ? "#EFE8DC" : "#E9E6E0";
    ctx.fillRect(0, 0, RW, 110);
    Art.windowScene(ctx, 410, 14, 180, 80, tod, t);
    ctx.strokeStyle = "#FBF8F2";
    ctx.lineWidth = 6;
    ctx.strokeRect(410, 14, 180, 80);
    if (home) {
      // framed print + shelf
      ctx.fillStyle = "#3F6B4E";
      ctx.fillRect(120, 26, 70, 52);
      ctx.strokeStyle = "#B88752";
      ctx.lineWidth = 5;
      ctx.strokeRect(120, 26, 70, 52);
      ctx.fillStyle = "#F4EFE6";
      Art.ellipse(ctx, 155, 52, 14, 14, "#E0B36A");
    } else {
      // ticket rail on the wall
      ctx.fillStyle = "#9DA3A1";
      ctx.fillRect(660, 40, 300, 6);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = "#FBF8F2";
        ctx.fillRect(680 + i * 70, 46, 50, 46);
        ctx.fillStyle = "rgba(31,36,32,0.4)";
        for (let k = 0; k < 4; k++) ctx.fillRect(688 + i * 70, 56 + k * 8, 30 - k * 5, 2);
      }
    }
    // counter run
    ctx.fillStyle = home ? "#B88752" : "#AEB4B2";
    ctx.fillRect(40, 110, 920, 120);
    ctx.fillStyle = home ? "#E8DCC6" : "#D9DDDB";
    ctx.fillRect(40, 110, 920, 104);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(40, 110, 920, 4);
    // stations
    const active = o.active;
    Object.keys(STATIONS).forEach((k) => {
      const s = STATIONS[k];
      if (k === active) {
        ctx.fillStyle = "rgba(180,71,43,0.12)";
        Art.rr(ctx, s.x - 72, 116, 144, 94, 12);
        ctx.fill();
        ctx.strokeStyle = "#B4472B";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (k === "board") {
        ctx.fillStyle = "#D9AC72";
        Art.rr(ctx, s.x - 55, s.y - 36, 110, 64, 10);
        ctx.fill();
        ctx.fillStyle = "#D8432F";
        Art.ellipse(ctx, s.x - 16, s.y - 4, 14, 12, "#D8432F");
        ctx.fillStyle = "#C9CFCC";
        ctx.fillRect(s.x + 10, s.y - 20, 34, 6);
      } else if (k === "bowl") {
        Art.ellipse(ctx, s.x, s.y - 4, 36, 26, "#FBF9F4");
        Art.ellipse(ctx, s.x, s.y - 4, 28, 19, "#F2C14E");
      } else if (k === "stove") {
        ctx.fillStyle = "#2F2C2A";
        Art.rr(ctx, s.x - 70, s.y - 42, 140, 80, 10);
        ctx.fill();
        const hot = active === "stove";
        [-34, 34].forEach((dx, i) => {
          Art.ellipse(ctx, s.x + dx, s.y - 2, 24, 20, hot && i === 0 ? "#C8553D" : "#46413E");
          Art.ellipse(ctx, s.x + dx, s.y - 2, 15, 12, "#2B2826");
        });
        if (hot) Art.steam(ctx, s.x - 34, s.y - 20, 0.7, t, 40);
      } else if (k === "pot") {
        Art.ellipse(ctx, s.x, s.y - 4, 40, 32, "#C3C8C6");
        Art.ellipse(ctx, s.x, s.y - 6, 32, 25, active === "pot" ? "#D9E6E8" : "#8E9593");
        if (active === "pot") Art.steam(ctx, s.x, s.y - 26, 0.8, t, 50);
      } else if (k === "pass") {
        Art.ellipse(ctx, s.x, s.y - 4, 40, 28, "#FBF9F4");
        Art.ellipse(ctx, s.x, s.y - 4, 28, 19, "#F1ECE2");
      }
      ctx.fillStyle = "rgba(31,36,32,0.6)";
      ctx.font = "600 14px Segoe UI, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(s.label, s.x, 228 + 18);
      ctx.textAlign = "start";
    });
    if (home) {
      // rug, table, cat
      ctx.fillStyle = "#C8553D";
      Art.rr(ctx, 120, 420, 360, 170, 20);
      ctx.fill();
      ctx.strokeStyle = "#F4EFE6";
      ctx.lineWidth = 3;
      Art.rr(ctx, 136, 436, 328, 138, 14);
      ctx.stroke();
      // table
      Art.shadow(ctx, 760, 520, 120, 22, 0.15);
      ctx.fillStyle = "#9A6B3E";
      Art.ellipse(ctx, 760, 480, 120, 70, "#9A6B3E");
      Art.ellipse(ctx, 760, 474, 116, 66, "#B88752");
      Art.ellipse(ctx, 730, 470, 26, 16, "#FBF9F4");
      Art.ellipse(ctx, 800, 480, 12, 12, "#4F7A4A");
      // chairs
      ctx.fillStyle = "#7A5638";
      Art.rr(ctx, 600, 450, 40, 50, 10);
      ctx.fill();
      Art.rr(ctx, 880, 450, 40, 50, 10);
      ctx.fill();
      // sleeping cat on the rug
      const tail = Math.sin(t * 1.4) * 0.35;
      ctx.save();
      ctx.translate(300, 505);
      Art.shadow(ctx, 0, 16, 46, 10, 0.18);
      Art.ellipse(ctx, 0, 0, 44, 26, "#3B3532");
      Art.ellipse(ctx, 30, -10, 18, 16, "#3B3532");
      ctx.fillStyle = "#3B3532";
      ctx.beginPath();
      ctx.moveTo(22, -20);
      ctx.lineTo(26, -34);
      ctx.lineTo(32, -22);
      ctx.moveTo(34, -22);
      ctx.lineTo(42, -32);
      ctx.lineTo(44, -18);
      ctx.fill();
      ctx.strokeStyle = "#3B3532";
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-40, 6);
      ctx.quadraticCurveTo(-70, 20 + tail * 30, -50, 34);
      ctx.stroke();
      ctx.restore();
      // plants in corners
      [[70, 600], [950, 300]].forEach(([px, py]) => {
        ctx.fillStyle = "#C27A4A";
        Art.ellipse(ctx, px, py, 26, 20, "#C27A4A");
        for (let i = 0; i < 6; i++) Art.ellipse(ctx, px + Math.cos(i) * 18, py - 10 + Math.sin(i) * 12, 14, 22, "#4F7A4A", i);
      });
    } else {
      // swing door to the dining room
      ctx.fillStyle = "#B88752";
      ctx.fillRect(960, 300, 30, 140);
      ctx.fillStyle = "rgba(31,36,32,0.6)";
      ctx.font = "600 13px Segoe UI, sans-serif";
      ctx.fillText("Dining", 900, 290);
      // prep island
      ctx.fillStyle = "#AEB4B2";
      Art.rr(ctx, 260, 420, 480, 110, 14);
      ctx.fill();
      ctx.fillStyle = "#D9DDDB";
      Art.rr(ctx, 260, 416, 480, 100, 14);
      ctx.fill();
      for (let i = 0; i < 4; i++) Art.ellipse(ctx, 320 + i * 120, 466, 26, 18, "#FBF9F4");
    }
  }

  // ---------- session ----------
  class CookSession {
    constructor(recipe, opts) {
      this.recipe = recipe;
      this.opts = opts || {};
      this.camera = this.opts.camera || M.profile.settings.camera;
      this.home = this.opts.mode === "home";
      this.idx = -1;
      this.results = [];
      this.mg = null;
      this.state = "intro";
      this.timer = 0;
      this.t = 0;
      this.done = false;
      this.chef = { x: 500, y: 330, walk: 0, tx: 500, ty: 330 };
      this.autoplay = false;
      this.next();
    }
    get step() {
      return this.recipe.steps[this.idx];
    }
    next() {
      if (this.mg) this.mg.destroy();
      this.idx++;
      if (this.idx >= this.recipe.steps.length) {
        this.finish();
        return;
      }
      const step = this.step;
      const st = stationFor(step);
      this.station = st;
      const s = STATIONS[st];
      this.chef.tx = s.x;
      this.chef.ty = 300;
      const env = {
        pov: this.camera === "first",
        pan: this.camera === "third" ? (s.x - 500) / 600 : 0,
        seasonBase: this.recipe.id === "steak" ? "steak" : "bowl",
        bowlColor: this.recipe.id === "salad" ? "#9DC27A" : this.recipe.id === "tamagoyaki" ? "#F2D27A" : "#E8C98F",
      };
      this.mg = new M.MINIGAMES[step.type](step, env);
      this.state = "intro";
      this.timer = 0;
      M.emit("step", { session: this, idx: this.idx });
    }
    finish() {
      this.mg = null;
      this.done = true;
      this.state = "done";
      M.audio.stopAllLoops();
      const q = this.results.reduce((a, r) => a + r.q, 0) / Math.max(1, this.results.length);
      this.quality = q;
      M.audio.play("success");
      if (this.opts.onComplete) this.opts.onComplete({ recipe: this.recipe, quality: q, results: this.results });
    }
    update(dt) {
      this.t += dt;
      // chef walking (third person)
      const c = this.chef;
      const d = M.dist(c.x, c.y, c.tx, c.ty);
      if (d > 2) {
        const sp = 420 * dt;
        c.x += ((c.tx - c.x) / d) * Math.min(sp, d);
        c.y += ((c.ty - c.y) / d) * Math.min(sp, d);
        c.walk += dt;
      }
      if (!this.mg) return;
      if (this.state === "intro") {
        this.timer += dt;
        const walking = this.camera === "third" && d > 4;
        if (this.timer > 0.35 && !walking) this.state = "play";
        return;
      }
      if (this.state === "play") {
        if (this.autoplay) this.mg.auto(dt);
        this.mg.tick(dt);
        if (this.mg.done) {
          this.results.push({ q: this.mg.quality, note: this.mg.note, type: this.step.type });
          M.emit("stepDone", { session: this, idx: this.idx, q: this.mg.quality, note: this.mg.note });
          this.state = "between";
          this.timer = 0;
        }
      } else if (this.state === "between") {
        this.timer += dt;
        this.mg.tick(dt);
        if (this.timer > 0.5) this.next();
      }
    }
    // Where the minigame square sits on screen for the current view.
    panelRect(view) {
      const st = view.stage;
      if (this.camera === "first") {
        const size = Math.min(st.w, st.h);
        return { x: st.x + (st.w - size) / 2, y: st.y + (st.h - size) / 2, w: size, h: size };
      }
      const landscape = st.w > st.h * 1.05;
      if (landscape) {
        const size = Math.min(st.h, st.w * 0.46);
        return { x: st.x + st.w - size, y: st.y + (st.h - size) / 2, w: size, h: size };
      }
      const size = Math.min(st.w, st.h * 0.58);
      return { x: st.x + (st.w - size) / 2, y: st.y + st.h - size, w: size, h: size };
    }
    roomRect(view) {
      const st = view.stage;
      const p = this.panelRect(view);
      const landscape = st.w > st.h * 1.05;
      if (landscape) return { x: st.x, y: st.y, w: p.x - st.x - 12, h: st.h };
      return { x: st.x, y: st.y, w: st.w, h: p.y - st.y - 10 };
    }
    draw(ctx, view) {
      const t = this.t;
      if (this.camera === "first") {
        Art.backdrop(ctx, view.w, view.h, t);
        const p = this.panelRect(view);
        if (this.mg) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(p.w / M.VIRTUAL, p.h / M.VIRTUAL);
          this.mg.render(ctx, t);
          ctx.restore();
        }
        return;
      }
      // third person: room + station panel
      ctx.fillStyle = this.home ? "#E9DFCF" : "#E4E0D7";
      ctx.fillRect(0, 0, view.w, view.h);
      const r = this.roomRect(view);
      if (r.w > 40 && r.h > 40) {
        const sc = Math.min(r.w / RW, r.h / RH);
        const ox = r.x + (r.w - RW * sc) / 2;
        const oy = r.y + (r.h - RH * sc) / 2;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(sc, sc);
        Art.rr(ctx, 0, 0, RW, RH, 18);
        ctx.clip();
        drawKitchenRoom(ctx, t, { home: this.home, active: this.mg ? this.station : null });
        const c = this.chef;
        const moving = M.dist(c.x, c.y, c.tx, c.ty) > 2;
        Art.personTop(ctx, c.x, c.y, {
          scale: 1.5,
          coat: this.home ? "#3F6B8A" : "#F4F1EA",
          apron: this.home ? "#E9DFC9" : "#1F2420",
          hair: "#2E2420",
          skin: M.SKINS[M.profile.settings.skin],
          hat: !this.home,
          walk: moving ? c.walk : 0,
        });
        ctx.restore();
      }
      const p = this.panelRect(view);
      // station panel card
      ctx.save();
      ctx.shadowColor = "rgba(31,36,32,0.14)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = "#EFE7DA";
      Art.rr(ctx, p.x, p.y, p.w, p.h, 16);
      ctx.fill();
      ctx.restore();
      ctx.save();
      Art.rr(ctx, p.x, p.y, p.w, p.h, 16);
      ctx.clip();
      ctx.fillStyle = "#E2D6C3";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      if (this.mg && this.state !== "intro") {
        ctx.translate(p.x, p.y);
        ctx.scale(p.w / M.VIRTUAL, p.h / M.VIRTUAL);
        this.mg.render(ctx, t);
      } else if (this.mg) {
        ctx.fillStyle = "rgba(31,36,32,0.55)";
        ctx.font = "600 16px Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Walking to the " + STATIONS[this.station].label.toLowerCase(), p.x + p.w / 2, p.y + p.h / 2);
        ctx.textAlign = "start";
      }
      ctx.restore();
    }
    toVirtual(view, x, y) {
      const p = this.panelRect(view);
      return { x: ((x - p.x) / p.w) * M.VIRTUAL, y: ((y - p.y) / p.h) * M.VIRTUAL, inside: M.inRect(x, y, p) };
    }
    pointer(view, type, x, y) {
      if (!this.mg || this.state !== "play") return;
      const v = this.toVirtual(view, x, y);
      if (type === "down" && !v.inside) return;
      this.mg.pointer(type, v.x, v.y);
    }
    key(code, down) {
      if (this.mg && this.state === "play") this.mg.key(code, down);
    }
    destroy() {
      if (this.mg) this.mg.destroy();
      M.audio.stopAllLoops();
    }
  }

  M.CookSession = CookSession;
  M.drawKitchenRoom = drawKitchenRoom;

  // Render a finished dish to an image (used by cards and results).
  const dishCache = {};
  M.dishImage = function (id, size) {
    size = size || 240;
    const key = id + ":" + size;
    if (dishCache[key]) return dishCache[key];
    const c = document.createElement("canvas");
    c.width = size * 2;
    c.height = size * 2;
    const ctx = c.getContext("2d");
    ctx.scale(2, 2);
    Art.dish(ctx, id, size / 2, size / 2 + 4, size / 340, "all");
    dishCache[key] = c.toDataURL("image/png");
    return dishCache[key];
  };
})();
