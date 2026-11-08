/* Mise - restaurant service: chef, server and owner roles; first-person counter or third-person floor. */
(function () {
  "use strict";
  const M = window.Mise;
  const Art = M.art;

  const QUEUE_MAX = 4;
  const PASS_MAX = 4;

  function layoutFor(landscape, camera, nTables) {
    if (camera === "first") {
      if (landscape) {
        const W = 1000;
        const H = 640;
        const seats = [];
        for (let i = 0; i < nTables; i++) seats.push({ x: nTables === 1 ? 600 : 270 + (i * 660) / Math.max(1, nTables - 1), y: 300 });
        return {
          W, H, landscape, fp: true,
          door: { x: 90, y: 220 },
          queue: [0, 1, 2, 3].map((i) => ({ x: 64 + i * 46, y: 262 })),
          tables: seats,
          pass: [0, 1, 2, 3].map((i) => ({ x: 110 + i * 92, y: 600 })),
          stove: { x: 880, y: 598 },
          player: { x: 700, y: 600 },
        };
      }
      const W = 640;
      const H = 900;
      const seats = [];
      const perRow = Math.min(3, nTables);
      for (let i = 0; i < nTables; i++) {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const count = row === 0 ? perRow : nTables - 3;
        seats.push({ x: count === 1 ? 320 : 120 + (col * 400) / Math.max(1, count - 1), y: 400 + row * 190 });
      }
      return {
        W, H, landscape, fp: true,
        door: { x: 70, y: 150 },
        queue: [0, 1, 2, 3].map((i) => ({ x: 170 + i * 50, y: 200 })),
        tables: seats,
        pass: [0, 1, 2, 3].map((i) => ({ x: 100 + i * 100, y: 850 })),
        stove: { x: 560, y: 850 },
        player: { x: 320, y: 850 },
      };
    }
    if (landscape) {
      // a small room keeps its tables in the middle row instead of leaving half the floor empty
      const pos = nTables <= 3 ? [[330, 330], [545, 330], [760, 330]] : [[330, 225], [545, 225], [760, 225], [330, 455], [545, 455], [760, 455]];
      return {
        W: 1000, H: 640, landscape, fp: false,
        door: { x: 36, y: 560 },
        queue: [0, 1, 2, 3].map((i) => ({ x: 110, y: 520 - i * 80 })),
        tables: pos.slice(0, nTables).map(([x, y]) => ({ x, y })),
        pass: [0, 1, 2, 3].map((i) => ({ x: 935, y: 150 + i * 82 })),
        stove: { x: 935, y: 520 },
        player: { x: 860, y: 560 },
      };
    }
    const pos = [[190, 300], [450, 300], [190, 500], [450, 500], [190, 700], [450, 700]];
    return {
      W: 640, H: 900, landscape, fp: false,
      door: { x: 40, y: 60 },
      queue: [0, 1, 2, 3].map((i) => ({ x: 130 + i * 80, y: 110 })),
      tables: pos.slice(0, nTables).map(([x, y]) => ({ x, y })),
      pass: [0, 1, 2, 3].map((i) => ({ x: 130 + i * 110, y: 855 })),
      stove: { x: 575, y: 855 },
      player: { x: 320, y: 790 },
    };
  }

  function weightedType() {
    const total = M.CUSTOMERS.reduce((a, c) => a + c.weight, 0);
    let r = Math.random() * total;
    for (const c of M.CUSTOMERS) {
      r -= c.weight;
      if (r <= 0) return c;
    }
    return M.CUSTOMERS[0];
  }

  class Restaurant {
    constructor(role, camera) {
      const shop = M.profile.shop;
      this.role = role;
      this.camera = camera;
      this.day = shop.day;
      this.duration = role === "chef" ? 210 : 180;
      this.time = 0;
      this.earned = 0;
      this.tips = 0;
      this.served = 0;
      this.lost = 0;
      this.qualitySum = 0;
      this.repStart = shop.reputation;
      this.nTables = Math.min(6, 3 + M.upgradeLevel("tables"));
      this.tables = [];
      for (let i = 0; i < this.nTables; i++) this.tables.push({ i, state: "free", customer: null, dirtyT: 0 });
      this.customers = [];
      this.tickets = [];
      this.pass = [];
      this.player = { spot: { kind: "home" }, from: null, k: 1, walk: 0, tasks: [], carry: [], busy: 0 };
      this.selected = null;
      this.chain = { type: null, n: 0 };
      this.floaters = [];
      this.nextId = 1;
      this.spawnT = 2;
      this.npcT = 0;
      this.ended = false;
      this.cook = null;
      this.landscape = true;
      this.layout = layoutFor(true, camera, this.nTables);
      this.t = 0;
      this.summary = null;
    }

    // ---------- helpers ----------
    priceMult(id) {
      return M.profile.shop.prices[id] || 1;
    }
    avgPriceMult() {
      const m = M.profile.shop.menu;
      return m.reduce((a, id) => a + this.priceMult(id), 0) / Math.max(1, m.length);
    }
    spotPos(spot) {
      const L = this.layout;
      if (!spot) return L.door;
      if (spot.kind === "queue") return L.queue[M.clamp(spot.i | 0, 0, L.queue.length - 1)];
      if (spot.kind === "table") {
        const tp = L.tables[M.clamp(spot.i | 0, 0, L.tables.length - 1)];
        if (L.fp) return tp;
        return { x: tp.x - (spot.side === "player" ? -70 : 62), y: tp.y + (spot.side === "player" ? 30 : 0) };
      }
      if (spot.kind === "pass") {
        const p = L.pass[M.clamp(spot.i | 0, 0, L.pass.length - 1)];
        return L.fp ? p : { x: p.x - 60, y: p.y };
      }
      if (spot.kind === "stove") return L.fp ? L.stove : { x: L.stove.x - 60, y: L.stove.y };
      if (spot.kind === "home") return L.player;
      return L.door;
    }
    pos(entity) {
      const to = this.spotPos(entity.spot);
      if (!entity.from || entity.k >= 1) return to;
      const from = this.spotPos(entity.from);
      const k = M.ease(entity.k);
      return { x: M.lerp(from.x, to.x, k), y: M.lerp(from.y, to.y, k) };
    }
    moveTo(entity, spot) {
      entity.from = entity.spot;
      entity.spot = spot;
      entity.k = 0;
    }
    float(text, spot, color) {
      const p = this.spotPos(spot);
      this.floaters.push({ text, x: p.x, y: p.y - 60, life: 1.6, color: color || "#3F6B4E" });
    }
    queueList() {
      return this.customers.filter((c) => c.state === "queue").sort((a, b) => a.arrived - b.arrived);
    }
    availableMenu() {
      const stock = M.profile.shop.stock;
      return M.profile.shop.menu.filter((id) => {
        const r = M.recipeById(id);
        return r && r.stock.every((s) => (stock[s] || 0) > 0);
      });
    }
    patienceRate(c) {
      const base = { queue: 1 / 50, reading: 1 / 160, ready: 1 / 38, waiting: this.role === "chef" ? 1 / 115 : 1 / 62, eating: 0, check: 1 / 45, walking: 0, leaving: 0 }[c.state] || 0;
      let r = base / (c.type.patience * (1 + 0.15 * M.upgradeLevel("chairs")));
      if (c.state === "queue") r *= 1 - 0.25 * M.upgradeLevel("records");
      r *= Math.pow(this.priceMult(c.order || "fried_rice"), 1.4);
      if (this.role === "owner" && this.cook) r *= 0.6;
      return r;
    }

    // ---------- spawning ----------
    spawn() {
      if (this.queueList().length >= QUEUE_MAX) return;
      const type = weightedType();
      const c = {
        id: this.nextId++,
        type,
        state: "queue",
        patience: 1,
        arrived: this.time,
        spot: { kind: "door" },
        from: null,
        k: 1,
        timer: 0,
        order: null,
        mood: 0.6,
        skin: M.pick(M.SKINS),
        blinkT: Math.random() * 4,
      };
      this.customers.push(c);
      this.relayoutQueue();
      M.audio.play("bell", -0.6);
    }
    relayoutQueue() {
      this.queueList().forEach((c, i) => {
        if (!c.spot || c.spot.kind !== "queue" || c.spot.i !== i) this.moveTo(c, { kind: "queue", i });
      });
    }

    // ---------- actions (validated when performed) ----------
    seat(c, ti) {
      const t = this.tables[ti];
      if (!c || c.state !== "queue" || !t || t.state !== "free") return false;
      const menu = this.availableMenu();
      if (!menu.length) {
        this.leave(c, "Sold out");
        return false;
      }
      c.order = M.pick(menu);
      c.state = "reading";
      c.timer = M.rand(2.5, 4.5);
      c.patience = Math.min(1, c.patience + 0.15);
      c.table = ti;
      t.state = "occupied";
      t.customer = c.id;
      this.moveTo(c, { kind: "table", i: ti, side: "guest" });
      this.relayoutQueue();
      this.bumpChain("seat", { kind: "table", i: ti });
      return true;
    }
    takeOrder(ti) {
      const c = this.customerAt(ti);
      if (!c || c.state !== "ready") return false;
      const r = M.recipeById(c.order);
      r.stock.forEach((s) => {
        M.profile.shop.stock[s] = Math.max(0, (M.profile.shop.stock[s] || 0) - 1);
        // management shows up during service: warn when a category runs low or out
        const left = M.profile.shop.stock[s];
        const label = M.STOCK[s] ? M.STOCK[s].name : s;
        if (left === 0) {
          this.float(label + " is out", { kind: "table", i: ti }, "#B4472B");
        } else if (left === 3) {
          this.float(label + " running low", { kind: "table", i: ti }, "#8A5A12");
        }
      });
      const tk = { id: this.nextId++, customer: c.id, recipe: c.order, table: ti, state: "new", progress: 0, quality: 0, created: this.time };
      this.tickets.push(tk);
      c.state = "waiting";
      c.patience = Math.min(1, c.patience + 0.1);
      M.audio.play("page", this.panFor(ti));
      this.bumpChain("order", { kind: "table", i: ti });
      return true;
    }
    pickUp(slot) {
      const d = this.pass[slot];
      if (!d || this.player.carry.length >= 2) return false;
      this.pass.splice(slot, 1);
      this.player.carry.push(d);
      M.audio.play("plate", -0.2);
      return true;
    }
    serve(ti, dishFromNpc) {
      const c = this.customerAt(ti);
      if (!c || c.state !== "waiting") return false;
      let dish = dishFromNpc;
      if (!dish) {
        const idx = this.player.carry.findIndex((d) => d.table === ti);
        if (idx < 0) return false;
        dish = this.player.carry.splice(idx, 1)[0];
      }
      c.state = "eating";
      c.timer = M.rand(5, 7.5);
      c.quality = dish.quality;
      c.mood = 0.5 + dish.quality * 0.5;
      const tk = this.tickets.find((x) => x.id === dish.ticket);
      if (tk) tk.state = "served";
      M.audio.play("clink", this.panFor(ti));
      this.bumpChain("serve", { kind: "table", i: ti });
      return true;
    }
    collect(ti) {
      const c = this.customerAt(ti);
      if (!c || c.state !== "check") return false;
      const r = M.recipeById(c.order);
      const price = Math.round(r.price * this.priceMult(r.id));
      const tip = Math.round(price * c.type.tip * (0.08 + 0.32 * c.patience + 0.25 * (c.quality || 0.7)));
      this.earned += price + tip;
      this.tips += tip;
      this.served += 1;
      this.qualitySum += c.quality || 0.7;
      const repGain = ((c.quality || 0.7) - 0.6) * 0.09 * (c.type.critic ? 3 : 1) * (1 + 0.25 * M.upgradeLevel("lamps")) + (c.patience > 0.5 ? 0.02 : 0);
      M.profile.shop.reputation = M.clamp(M.profile.shop.reputation + repGain, 0, 5);
      this.float("+" + M.fmtMoney(price + tip), { kind: "table", i: ti });
      M.audio.play("coin", this.panFor(ti));
      const t = this.tables[ti];
      t.state = "dirty";
      t.customer = null;
      t.dirtyT = 0;
      this.leaveQuiet(c);
      this.bumpChain("collect", { kind: "table", i: ti });
      return true;
    }
    clean(ti) {
      const t = this.tables[ti];
      if (!t || t.state !== "dirty") return false;
      t.state = "free";
      M.audio.play("clink", this.panFor(ti));
      setTimeout(() => M.audio.play("clink", this.panFor(ti)), 120);
      this.bumpChain("clean", { kind: "table", i: ti });
      return true;
    }
    bumpChain(type, spot) {
      if (this.role === "chef") return;
      if (this.chain.type === type) this.chain.n += 1;
      else this.chain = { type, n: 1 };
      if (this.chain.n >= 2) {
        const bonus = this.chain.n - 1;
        this.earned += bonus;
        this.float("Chain x" + this.chain.n + "  +" + M.fmtMoney(bonus), spot, "#B4472B");
      }
    }
    customerAt(ti) {
      const t = this.tables[ti];
      if (!t || !t.customer) return null;
      return this.customers.find((c) => c.id === t.customer);
    }
    leave(c, why) {
      this.lost += 1;
      M.profile.shop.reputation = M.clamp(M.profile.shop.reputation - 0.08, 0, 5);
      if (c.table != null) {
        const t = this.tables[c.table];
        if (t && t.customer === c.id) {
          t.customer = null;
          t.state = c.state === "eating" || c.state === "check" ? "dirty" : "free";
        }
      }
      this.tickets = this.tickets.filter((tk) => tk.customer !== c.id || tk.state === "served");
      this.pass = this.pass.filter((d) => d.customer !== c.id);
      this.player.carry = this.player.carry.filter((d) => d.customer !== c.id);
      if (this.cook && this.cook.ticket && this.cook.ticket.customer === c.id) {
        this.cook.ticket.orphan = true;
      }
      this.float(why || "Left", c.spot && c.spot.kind === "table" ? c.spot : { kind: "queue", i: 0 }, "#B4472B");
      this.leaveQuiet(c);
    }
    leaveQuiet(c) {
      c.state = "leaving";
      c.table = null;
      this.moveTo(c, { kind: "door" });
      this.relayoutQueue();
    }
    panFor(ti) {
      const p = this.layout.tables[ti] || { x: this.layout.W / 2 };
      return (p.x / this.layout.W) * 1.6 - 0.8;
    }

    // ---------- player task queue (server / owner) ----------
    queueTask(task) {
      if (this.role === "chef") return;
      if (this.player.tasks.length >= 5) {
        M.audio.play("soft-fail");
        return;
      }
      this.player.tasks.push(task);
      M.audio.play("tick");
    }
    taskSpot(task) {
      if (task.kind === "seat" || task.kind === "table") return { kind: "table", i: task.table, side: "player" };
      if (task.kind === "pick") {
        const slot = this.pass.findIndex((d) => d.ticket === task.ticket);
        return { kind: "pass", i: Math.max(0, slot) };
      }
      if (task.kind === "stove") return { kind: "stove" };
      return { kind: "home" };
    }
    runTask(task) {
      if (task.kind === "seat") {
        const c = this.customers.find((x) => x.id === task.customer);
        return this.seat(c, task.table);
      }
      if (task.kind === "pick") {
        const slot = this.pass.findIndex((d) => d.ticket === task.ticket);
        return slot >= 0 ? this.pickUp(slot) : false;
      }
      if (task.kind === "table") {
        const ti = task.table;
        const c = this.customerAt(ti);
        if (c && c.state === "ready") return this.takeOrder(ti);
        if (c && c.state === "waiting" && this.player.carry.some((d) => d.table === ti)) return this.serve(ti);
        if (c && c.state === "check") return this.collect(ti);
        if (this.tables[ti].state === "dirty") return this.clean(ti);
        return false;
      }
      if (task.kind === "stove") {
        this.openCookForOldest();
        return true;
      }
      return false;
    }

    // ---------- tickets ----------
    pendingTickets() {
      return this.tickets.filter((t) => t.state === "new");
    }
    openCook(ticketId) {
      if (this.cook) return false;
      if (this.role === "server") return false;
      const tk = this.tickets.find((t) => t.id === ticketId && t.state === "new");
      if (!tk) return false;
      tk.state = "cooking";
      const recipe = M.recipeById(tk.recipe);
      this.cook = new M.CookSession(recipe, {
        camera: this.camera,
        mode: this.role,
        onComplete: (res) => {
          setTimeout(() => this.finishCook(tk, res.quality), 700);
        },
      });
      this.cook.ticket = tk;
      M.emit("cookStart", { restaurant: this, ticket: tk });
      return true;
    }
    openCookForOldest() {
      const tk = this.pendingTickets()[0];
      if (tk) this.openCook(tk.id);
    }
    finishCook(tk, q) {
      if (this.cook) this.cook.destroy();
      this.cook = null;
      M.emit("cookEnd", { restaurant: this });
      if (tk.orphan || !this.customers.some((c) => c.id === tk.customer && c.state === "waiting")) {
        this.float("Guest left", { kind: "pass", i: 0 }, "#B4472B");
        return;
      }
      this.dishReady(tk, q);
    }
    dishReady(tk, q) {
      tk.state = "ready";
      tk.quality = q;
      this.pass.push({ ticket: tk.id, recipe: tk.recipe, table: tk.table, customer: tk.customer, quality: q, readyAt: this.time });
      M.audio.play("ding", 0.6);
    }

    // ---------- update ----------
    update(dt) {
      this.t += dt;
      if (this.cook) this.cook.update(dt);
      if (this.ended) return;
      const simDt = this.role === "owner" && this.cook ? dt * 0.35 : dt;
      this.time += simDt;
      // spawn
      if (this.time < this.duration - 15) {
        this.spawnT -= simDt;
        if (this.spawnT <= 0) {
          this.spawn();
          const base = this.role === "chef" ? 27 : 13;
          const rep = M.profile.shop.reputation;
          this.spawnT = (base / (0.75 + rep * 0.12)) * this.avgPriceMult() * M.rand(0.7, 1.3);
        }
      }
      // customers
      this.customers.forEach((c) => {
        if (c.k < 1) c.k = Math.min(1, c.k + simDt * (this.layout.fp ? 2.5 : 1.3));
        c.blinkT -= simDt;
        if (c.blinkT < -0.15) c.blinkT = M.rand(2, 5);
        if (c.state === "leaving") return;
        c.patience -= this.patienceRate(c) * simDt;
        c.mood = M.lerp(c.mood, c.patience, 0.02);
        if (c.state === "reading") {
          c.timer -= simDt;
          if (c.timer <= 0) c.state = "ready";
        } else if (c.state === "eating") {
          c.timer -= simDt;
          if (Math.random() < simDt * 1.5) M.audio.play("chew", this.panFor(c.table));
          if (c.timer <= 0) {
            c.state = "check";
            c.patience = Math.max(c.patience, 0.6);
          }
        }
        if (c.patience <= 0) this.leave(c, "Left unhappy");
      });
      this.customers = this.customers.filter((c) => !(c.state === "leaving" && c.k >= 1));
      // NPC kitchen
      const cookSpeed = 1 + 0.2 * M.upgradeLevel("burner");
      const npcCooks = this.role === "server" || (this.role === "owner" && M.upgradeLevel("linecook") > 0);
      if (npcCooks && this.pass.length < PASS_MAX) {
        const slowdown = this.role === "owner" ? 1.6 : 1;
        const tk = this.tickets.find((t) => t.state === "new" || t.state === "npc");
        if (tk) {
          tk.state = "npc";
          const r = M.recipeById(tk.recipe);
          const cookTime = ((5 + r.steps.length * 2.2) * slowdown) / cookSpeed;
          tk.progress += simDt / cookTime;
          if (tk.progress >= 1) this.dishReady(tk, M.rand(0.72, 0.93));
        }
      }
      // NPC front of house
      this.npcT += simDt;
      if (this.npcT > 0.5) {
        this.npcT = 0;
        this.npcFront();
      }
      // dirty tables timer
      this.tables.forEach((t) => {
        if (t.state === "dirty") t.dirtyT += simDt;
      });
      // player
      this.updatePlayer(simDt);
      // floaters
      this.floaters.forEach((f) => {
        f.life -= dt;
        f.y -= dt * 24;
      });
      this.floaters = this.floaters.filter((f) => f.life > 0);
      // end of day
      const active = this.customers.filter((c) => c.state !== "leaving").length;
      if (this.time >= this.duration && (active === 0 || this.time > this.duration + 45)) this.endDay();
    }
    npcFront() {
      const chefRole = this.role === "chef";
      const host = chefRole || M.upgradeLevel("host") > 0;
      const busser = chefRole || M.upgradeLevel("busser") > 0;
      if (host) {
        const q = this.queueList()[0];
        const free = this.tables.find((t) => t.state === "free");
        if (q && free && this.time - q.arrived > 1.2 && (q.k >= 1 || this.layout.fp)) this.seat(q, free.i);
      }
      if (busser) {
        this.tables.forEach((t) => {
          if (t.state === "dirty" && t.dirtyT > 2.5) this.clean(t.i);
        });
      }
      if (chefRole) {
        this.tables.forEach((t) => {
          const c = this.customerAt(t.i);
          if (!c) return;
          if (c.state === "ready") this.takeOrder(t.i);
          else if (c.state === "check") this.collect(t.i);
        });
        // runner delivers dishes from the pass
        for (let i = this.pass.length - 1; i >= 0; i--) {
          const d = this.pass[i];
          if (this.time - d.readyAt > 1.5) {
            this.pass.splice(i, 1);
            this.serve(d.table, d);
          }
        }
      }
    }
    updatePlayer(dt) {
      const p = this.player;
      if (p.k < 1) {
        const from = this.spotPos(p.from);
        const to = this.spotPos(p.spot);
        const d = Math.max(1, M.dist(from.x, from.y, to.x, to.y));
        p.k = Math.min(1, p.k + (dt * 330) / d);
        p.walk += dt;
        if (p.k >= 1) p.busy = this.layout.fp ? 0.25 : 0.2;
        return;
      }
      if (p.busy > 0) {
        p.busy -= dt;
        if (p.busy <= 0 && p.current) {
          this.runTask(p.current);
          p.current = null;
        }
        return;
      }
      if (p.tasks.length) {
        const task = p.tasks.shift();
        p.current = task;
        const spot = this.taskSpot(task);
        if (this.layout.fp) {
          p.spot = spot;
          p.k = 1;
          p.busy = 0.3;
        } else {
          this.moveTo(p, spot);
        }
      }
    }
    endDay() {
      if (this.ended) return;
      this.ended = true;
      if (this.cook) {
        this.cook.destroy();
        this.cook = null;
      }
      M.audio.stopAllLoops();
      const shop = M.profile.shop;
      const goal = M.dayGoal(this.day);
      const stars = goal.filter((g) => this.earned >= g).length;
      shop.coins += this.earned;
      shop.totalServed += this.served;
      shop.bestDay = Math.max(shop.bestDay, this.earned);
      const summary = {
        day: this.day,
        role: this.role,
        earned: this.earned,
        tips: this.tips,
        served: this.served,
        lost: this.lost,
        avgQuality: this.served ? this.qualitySum / this.served : 0,
        repDelta: shop.reputation - this.repStart,
        stars,
        goal,
      };
      shop.history.unshift(summary);
      shop.history = shop.history.slice(0, 10);
      shop.day += 1;
      M.saveProfile();
      this.summary = summary;
      M.emit("dayEnd", summary);
    }

    // ---------- input ----------
    setView(view) {
      const landscape = view.stage.w >= view.stage.h * 0.9;
      if (landscape !== this.landscape || !this.layoutInit) {
        this.landscape = landscape;
        this.layoutInit = true;
        this.layout = layoutFor(landscape, this.camera, this.nTables);
      }
    }
    roomTransform(view) {
      const st = view.stage;
      const L = this.layout;
      const sc = Math.min(st.w / L.W, st.h / L.H);
      return { sc, ox: st.x + (st.w - L.W * sc) / 2, oy: st.y + (st.h - L.H * sc) / 2 };
    }
    toRoom(view, x, y) {
      const tr = this.roomTransform(view);
      return { x: (x - tr.ox) / tr.sc, y: (y - tr.oy) / tr.sc };
    }
    hit(x, y) {
      const L = this.layout;
      // customers in the queue
      const q = this.queueList();
      for (const c of q) {
        const p = this.pos(c);
        const r = L.fp ? { x: p.x - 26, y: p.y - 70, w: 52, h: 110 } : { x: p.x - 30, y: p.y - 60, w: 60, h: 90 };
        if (M.inRect(x, y, r)) return { kind: "customer", c };
      }
      for (let i = 0; i < this.layout.tables.length; i++) {
        const tp = L.tables[i];
        const r = L.fp ? { x: tp.x - 55, y: tp.y - 90, w: 110, h: 220 } : { x: tp.x - 110, y: tp.y - 80, w: 220, h: 150 };
        if (M.inRect(x, y, r)) return { kind: "table", i };
      }
      for (let i = 0; i < this.pass.length && i < L.pass.length; i++) {
        const p = L.pass[i];
        if (M.dist(x, y, p.x, p.y) < 44) return { kind: "pass", i };
      }
      if (this.role === "owner" && M.dist(x, y, L.stove.x, L.stove.y) < 56) return { kind: "stove" };
      return null;
    }
    pointer(view, type, x, y) {
      if (this.cook) {
        this.cook.pointer(view, type, x, y);
        return;
      }
      if (this.role === "chef" || this.ended) return;
      const r = this.toRoom(view, x, y);
      const h = this.hit(r.x, r.y);
      if (type === "down") {
        if (!h) {
          this.selected = null;
          return;
        }
        if (h.kind === "customer") {
          this.selected = h.c.id;
          this.dragging = true;
          M.audio.play("select");
          return;
        }
        if (h.kind === "table") {
          if (this.selected != null) {
            this.queueTask({ kind: "seat", customer: this.selected, table: h.i });
            this.selected = null;
          } else {
            this.queueTask({ kind: "table", table: h.i });
          }
        } else if (h.kind === "pass") {
          const d = this.pass[h.i];
          const queuedPicks = this.player.tasks.filter((t) => t.kind === "pick").length;
          if (this.player.carry.length + queuedPicks >= 2) {
            this.float("Hands full", { kind: "pass", i: h.i }, "#B4472B");
            M.audio.play("soft-fail");
          } else this.queueTask({ kind: "pick", ticket: d.ticket });
        } else if (h.kind === "stove") {
          if (this.pendingTickets().length) this.queueTask({ kind: "stove" });
          else this.float("No tickets", { kind: "stove" }, "#565D58");
        }
      } else if (type === "up") {
        if (this.dragging && this.selected != null && h && h.kind === "table") {
          this.queueTask({ kind: "seat", customer: this.selected, table: h.i });
          this.selected = null;
        }
        this.dragging = false;
      }
    }
    key(code, down) {
      if (this.cook) {
        this.cook.key(code, down);
        return;
      }
      if (!down || this.role === "chef") return;
      // keyboard play: 1-6 act on tables, Q seats queue head, P picks up from the pass
      if (/^Digit[1-6]$/.test(code)) {
        const i = Number(code.slice(5)) - 1;
        if (i < this.tables.length) {
          if (this.selected != null) {
            this.queueTask({ kind: "seat", customer: this.selected, table: i });
            this.selected = null;
          } else this.queueTask({ kind: "table", table: i });
        }
      } else if (code === "KeyQ") {
        const c = this.queueList()[0];
        if (c) {
          this.selected = c.id;
          M.audio.play("select");
        }
      } else if (code === "KeyP") {
        if (this.pass[0]) this.pointerPick(0);
      } else if (code === "KeyK" && this.role === "owner") {
        this.queueTask({ kind: "stove" });
      }
    }
    pointerPick(i) {
      const d = this.pass[i];
      if (d) this.queueTask({ kind: "pick", ticket: d.ticket });
    }

    // Auto-play for tests: performs sensible server actions.
    autoServe() {
      if (this.cook) {
        this.cook.autoplay = true;
        return;
      }
      if (this.role === "chef") {
        const tk = this.pendingTickets()[0];
        if (tk) this.openCook(tk.id);
        return;
      }
      if (this.player.tasks.length > 1) return;
      const free = this.tables.find((t) => t.state === "free");
      const q = this.queueList()[0];
      if (q && free) {
        this.queueTask({ kind: "seat", customer: q.id, table: free.i });
        return;
      }
      for (const t of this.tables) {
        const c = this.customerAt(t.i);
        if ((c && (c.state === "ready" || c.state === "check")) || t.state === "dirty") {
          this.queueTask({ kind: "table", table: t.i });
          return;
        }
      }
      if (this.pass[0] && this.player.carry.length < 2) {
        this.queueTask({ kind: "pick", ticket: this.pass[0].ticket });
        return;
      }
      const carry = this.player.carry[0];
      if (carry) {
        this.queueTask({ kind: "table", table: carry.table });
        return;
      }
      if (this.role === "owner" && this.pendingTickets().length && !M.upgradeLevel("linecook")) this.queueTask({ kind: "stove" });
    }

    // ---------- drawing ----------
    draw(ctx, view) {
      this.setView(view);
      if (this.cook) {
        this.cook.draw(ctx, view);
        return;
      }
      if (this.role === "chef") {
        this.drawChefIdle(ctx, view);
        return;
      }
      ctx.fillStyle = this.layout.fp ? "#DCCFB9" : "#E4DCCD";
      ctx.fillRect(0, 0, view.w, view.h);
      const tr = this.roomTransform(view);
      ctx.save();
      ctx.translate(tr.ox, tr.oy);
      ctx.scale(tr.sc, tr.sc);
      Art.rr(ctx, 0, 0, this.layout.W, this.layout.H, 16);
      ctx.clip();
      if (this.layout.fp) this.drawCounter(ctx);
      else this.drawFloor(ctx);
      this.drawFloaters(ctx);
      ctx.restore();
    }
    drawChefIdle(ctx, view) {
      if (this.camera === "first") {
        Art.backdrop(ctx, view.w, view.h, this.t);
        const st = view.stage;
        const size = Math.min(st.w, st.h);
        const x = st.x + (st.w - size) / 2;
        const y = st.y + (st.h - size) / 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(size / 720, size / 720);
        Art.board(ctx, 50, 230, 620, 330);
        Art.tool(ctx, "knife", 520, 300, -1.2);
        Art.label(ctx, this.pendingTickets().length ? "Pick a ticket from the rail to start cooking" : "Waiting for the next order", 360, 160, { size: 18 });
        ctx.restore();
        return;
      }
      ctx.fillStyle = "#E4E0D7";
      ctx.fillRect(0, 0, view.w, view.h);
      const st = view.stage;
      const sc = Math.min(st.w / 1000, st.h / 640);
      ctx.save();
      ctx.translate(st.x + (st.w - 1000 * sc) / 2, st.y + (st.h - 640 * sc) / 2);
      ctx.scale(sc, sc);
      Art.rr(ctx, 0, 0, 1000, 640, 18);
      ctx.clip();
      M.drawKitchenRoom(ctx, this.t, { home: false, active: null });
      Art.personTop(ctx, 500, 330, { scale: 1.5, coat: "#F4F1EA", apron: "#1F2420", hat: true, skin: M.SKINS[M.profile.settings.skin] });
      Art.label(ctx, this.pendingTickets().length ? "Pick a ticket from the rail to start cooking" : "Waiting for the next order", 500, 600, { size: 18 });
      ctx.restore();
    }
    // Furniture and light that make the room feel lived in; none of it is interactive.
    drawDecor(ctx, L) {
      const tod = M.profile.settings.timeOfDay;
      const glow = tod === "morning" ? 0.1 : tod === "night" ? 0.26 : 0.18;
      // pendant light pools over each table
      L.tables.forEach((tp) => {
        const g = ctx.createRadialGradient(tp.x, tp.y, 10, tp.x, tp.y, 125);
        g.addColorStop(0, "rgba(255,214,150," + glow + ")");
        g.addColorStop(1, "rgba(255,214,150,0)");
        ctx.fillStyle = g;
        ctx.fillRect(tp.x - 130, tp.y - 130, 260, 260);
      });
      const plant = (x, y, s) => {
        Art.shadow(ctx, x + 4, y + 6, 26 * s, 12 * s, 0.14);
        Art.ellipse(ctx, x, y, 20 * s, 20 * s, "#B86F4C");
        Art.ellipse(ctx, x, y, 15 * s, 15 * s, "#6B4A32");
        for (let i = 0; i < 7; i++) {
          const a = i * 0.9;
          Art.ellipse(ctx, x + Math.cos(a) * 16 * s, y + Math.sin(a) * 16 * s, 15 * s, 7 * s, i % 2 ? "#4F7A4A" : "#5E8C55", a);
        }
        Art.ellipse(ctx, x, y, 8 * s, 8 * s, "#6FA05E");
      };
      // pickup counter: brushed steel, a lip, a warm lamp and an outlined spot per plate
      this.drawPickupCounter(ctx, L);
      if (L.landscape) {
        // afternoon light falling from the two windows
        const sun = tod === "night" ? 0.0 : tod === "morning" ? 0.16 : 0.11;
        if (sun > 0) {
          [300, 560].forEach((wx) => {
            ctx.fillStyle = "rgba(255,236,200," + sun + ")";
            ctx.beginPath();
            ctx.moveTo(wx, 60);
            ctx.lineTo(wx + 160, 60);
            ctx.lineTo(wx + 210, 200);
            ctx.lineTo(wx + 50, 200);
            ctx.closePath();
            ctx.fill();
          });
        }
        // sideboard under the windows: cake dome, jars, cups, water jug
        ctx.fillStyle = "#8E5F3A";
        Art.rr(ctx, 250, 64, 590, 30, 6);
        ctx.fill();
        ctx.fillStyle = "#A8744A";
        Art.rr(ctx, 250, 64, 590, 6, 3);
        ctx.fill();
        Art.ellipse(ctx, 300, 79, 18, 10, "#F4EFE6");
        Art.ellipse(ctx, 300, 79, 13, 7, "#D9A05B");
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(300, 77, 17, 10, 0, Math.PI, 0);
        ctx.stroke();
        ["#C9A27A", "#7DA05E", "#D8432F"].forEach((jar, i) => {
          Art.ellipse(ctx, 360 + i * 26, 79, 9, 9, "#F4EFE6");
          Art.ellipse(ctx, 360 + i * 26, 79, 6, 6, jar);
        });
        for (let i = 0; i < 6; i++) {
          Art.ellipse(ctx, 640 + (i % 3) * 18, 74 + Math.floor(i / 3) * 12, 7, 5, "#FBF8F2");
          Art.ellipse(ctx, 640 + (i % 3) * 18, 74 + Math.floor(i / 3) * 12, 4, 3, "#E6DCCB");
        }
        Art.ellipse(ctx, 740, 79, 12, 12, "rgba(190,220,230,0.85)");
        Art.ellipse(ctx, 740, 79, 7, 7, "rgba(230,245,250,0.9)");
        Art.ellipse(ctx, 800, 79, 10, 10, "#6B4A32");
        // waiting bench along the left wall beside the queue
        ctx.fillStyle = "#7A5638";
        Art.rr(ctx, 22, 360, 30, 150, 8);
        ctx.fill();
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = "#C9A27A";
          Art.rr(ctx, 26, 366 + i * 48, 22, 42, 6);
          ctx.fill();
        }
        // doormat inside the entrance
        ctx.fillStyle = "#8A6A4A";
        Art.rr(ctx, 20, 528, 60, 74, 6);
        ctx.fill();
        ctx.strokeStyle = "rgba(244,239,230,0.35)";
        ctx.lineWidth = 2;
        Art.rr(ctx, 26, 534, 48, 62, 4);
        ctx.stroke();
        // banquette along the far wall with cushions
        ctx.fillStyle = "#8E5F3A";
        Art.rr(ctx, 250, 588, 590, 38, 10);
        ctx.fill();
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i % 2 ? "#C9A27A" : "#B4472B";
          Art.rr(ctx, 262 + i * 97, 594, 86, 24, 8);
          ctx.fill();
        }
        // host stand by the door with a menu
        ctx.fillStyle = "#7A5638";
        Art.rr(ctx, 24, 296, 46, 36, 6);
        ctx.fill();
        ctx.fillStyle = "#F4EFE6";
        Art.rr(ctx, 32, 302, 20, 24, 2);
        ctx.fill();
        plant(42, 96, 1.1);
        plant(206, 610, 0.9);
        plant(848, 96, 0.9);
        // pass: heat lamps and a ticket rail over the steel
        const lamp = ctx.createLinearGradient(884, 0, 984, 0);
        lamp.addColorStop(0, "rgba(255,170,90,0.0)");
        lamp.addColorStop(0.5, "rgba(255,170,90,0.22)");
        lamp.addColorStop(1, "rgba(255,170,90,0.0)");
        ctx.fillStyle = lamp;
        ctx.fillRect(884, 110, 100, 400);
        ctx.strokeStyle = "rgba(31,36,32,0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(884, 104);
        ctx.lineTo(984, 104);
        ctx.stroke();
        for (let i = 0; i < Math.min(4, this.tickets.length); i++) {
          ctx.fillStyle = "#FBF8F2";
          ctx.fillRect(890 + i * 24, 98, 18, 22);
          ctx.fillStyle = "rgba(31,36,32,0.35)";
          ctx.fillRect(893 + i * 24, 104, 12, 2);
          ctx.fillRect(893 + i * 24, 109, 9, 2);
        }
      } else {
        plant(36, 110, 0.9);
        plant(604, 110, 0.9);
        plant(36, 780, 0.9);
        plant(604, 780, 0.9);
        const lamp = ctx.createLinearGradient(0, 812, 0, 886);
        lamp.addColorStop(0, "rgba(255,170,90,0.0)");
        lamp.addColorStop(0.5, "rgba(255,170,90,0.2)");
        lamp.addColorStop(1, "rgba(255,170,90,0.0)");
        ctx.fillStyle = lamp;
        ctx.fillRect(60, 812, 540, 74);
      }
    }
    drawPickupCounter(ctx, L) {
      const xs = L.pass.map((p) => p.x);
      const ys = L.pass.map((p) => p.y);
      const vertical = L.landscape;
      // brushed steel lines
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      if (vertical) {
        for (let y = 96; y < 586; y += 7) {
          ctx.beginPath();
          ctx.moveTo(888, y);
          ctx.lineTo(980, y);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(31,36,32,0.18)";
        ctx.fillRect(884, 90, 5, 500);
      } else {
        for (let x = 64; x < 598; x += 7) {
          ctx.beginPath();
          ctx.moveTo(x, 816);
          ctx.lineTo(x, 882);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(31,36,32,0.18)";
        ctx.fillRect(60, 812, 540, 5);
      }
      // a warm lamp and an outlined spot for each plate
      for (let i = 0; i < L.pass.length; i++) {
        const g = ctx.createRadialGradient(xs[i], ys[i], 4, xs[i], ys[i], 46);
        g.addColorStop(0, "rgba(255,180,110,0.30)");
        g.addColorStop(1, "rgba(255,180,110,0)");
        ctx.fillStyle = g;
        ctx.fillRect(xs[i] - 46, ys[i] - 46, 92, 92);
        if (!this.pass[i]) {
          ctx.strokeStyle = "rgba(31,36,32,0.22)";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 5]);
          ctx.beginPath();
          ctx.ellipse(xs[i], ys[i], 30, 20, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      // stack of clean plates at the end of the counter
      const sx = vertical ? 935 : 560;
      const sy = vertical ? 470 : 850;
      if (vertical) {
        for (let k = 0; k < 4; k++) {
          Art.ellipse(ctx, sx, sy - k * 4, 24, 15, k === 3 ? "#FBF9F4" : "#E6E1D6");
        }
      }
    }
    drawFloor(ctx) {
      const L = this.layout;
      // wooden floor
      ctx.fillStyle = "#D8BE97";
      ctx.fillRect(0, 0, L.W, L.H);
      ctx.strokeStyle = "rgba(120,85,50,0.16)";
      ctx.lineWidth = 2;
      for (let y = 0; y < L.H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(L.W, y);
        ctx.stroke();
      }
      // walls / kitchen side
      if (L.landscape) {
        ctx.fillStyle = "#EDE6DA";
        ctx.fillRect(0, 0, L.W, 60);
        Art.windowScene(ctx, 300, 8, 160, 44, M.profile.settings.timeOfDay, this.t);
        Art.windowScene(ctx, 560, 8, 160, 44, M.profile.settings.timeOfDay, this.t);
        ctx.fillStyle = "#AEB4B2";
        ctx.fillRect(880, 90, 110, 500);
        ctx.fillStyle = "#D9DDDB";
        ctx.fillRect(884, 90, 100, 500);
        ctx.fillStyle = "rgba(31,36,32,0.6)";
        ctx.font = "600 14px Segoe UI, sans-serif";
        ctx.fillText("Pickup", 906, 84);
        // door
        ctx.fillStyle = "#9A6B3E";
        ctx.fillRect(0, 520, 18, 90);
        ctx.fillStyle = "rgba(31,36,32,0.55)";
        ctx.fillText("Entrance", 26, 625);
      } else {
        ctx.fillStyle = "#EDE6DA";
        ctx.fillRect(0, 0, L.W, 50);
        ctx.fillStyle = "#AEB4B2";
        ctx.fillRect(60, 815, 540, 80);
        ctx.fillStyle = "#D9DDDB";
        ctx.fillRect(60, 812, 540, 74);
        ctx.fillStyle = "rgba(31,36,32,0.6)";
        ctx.font = "600 14px Segoe UI, sans-serif";
        ctx.fillText("Pickup counter", 66, 806);
        ctx.fillStyle = "#9A6B3E";
        ctx.fillRect(10, 0, 70, 14);
        ctx.fillStyle = "rgba(31,36,32,0.55)";
        ctx.fillText("Entrance", 88, 30);
      }
      // rug sized to the tables actually in the room
      const ys = L.tables.map((t) => t.y);
      const top = Math.min.apply(null, ys) - 105;
      const bottom = Math.max.apply(null, ys) + 105;
      ctx.fillStyle = "rgba(180,71,43,0.12)";
      if (L.landscape) Art.rr(ctx, 230, top, 630, bottom - top, 30);
      else Art.rr(ctx, 80, top, 480, bottom - top, 30);
      ctx.fill();
      ctx.strokeStyle = "rgba(180,71,43,0.22)";
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 6]);
      if (L.landscape) Art.rr(ctx, 244, top + 14, 602, bottom - top - 28, 22);
      else Art.rr(ctx, 94, top + 14, 452, bottom - top - 28, 22);
      ctx.stroke();
      ctx.setLineDash([]);
      this.drawDecor(ctx, L);
      // tables
      this.tables.forEach((t, i) => this.drawTableTop(ctx, t, L.tables[i], i));
      // queue line rope
      ctx.strokeStyle = "rgba(122,86,56,0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      const q0 = L.queue[0];
      const q3 = L.queue[3];
      if (L.landscape) {
        ctx.moveTo(q0.x + 40, q0.y + 30);
        ctx.lineTo(q3.x + 40, q3.y - 30);
      } else {
        ctx.moveTo(q0.x - 30, q0.y + 40);
        ctx.lineTo(q3.x + 30, q3.y + 40);
      }
      ctx.stroke();
      // pass dishes
      this.pass.slice(0, L.pass.length).forEach((d, i) => {
        const p = L.pass[i];
        Art.ellipse(ctx, p.x, p.y, 30, 20, "#FBF9F4");
        Art.ellipse(ctx, p.x, p.y, 20, 13, M.recipeById(d.recipe).color);
        Art.label(ctx, "T" + (d.table + 1), p.x, p.y - 32, { size: 12 });
      });
      if (this.role === "owner") {
        const s = L.stove;
        ctx.fillStyle = "#2F2C2A";
        Art.rr(ctx, s.x - 40, s.y - 34, 80, 68, 10);
        ctx.fill();
        Art.ellipse(ctx, s.x, s.y, 20, 16, this.pendingTickets().length ? "#C8553D" : "#46413E");
        Art.label(ctx, "Stove", s.x, s.y - 50, { size: 12 });
      }
      // customers (queue + walking)
      const people = this.customers.slice().sort((a, b) => this.pos(a).y - this.pos(b).y);
      people.forEach((c) => {
        const p = this.pos(c);
        const seated = c.state !== "queue" && c.state !== "leaving" && c.k >= 1;
        Art.personTop(ctx, p.x, p.y, { coat: c.type.coat, hair: c.type.hair, skin: c.skin, seated, walk: c.k < 1 ? this.t : 0, scale: L.landscape ? 1.05 : 1.3 });
        if (c.id === this.selected) {
          ctx.strokeStyle = "#B4472B";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y + 20, 32, 12, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (c.state !== "leaving") {
          Art.patience(ctx, p.x - 26, p.y + 30, 52, c.patience);
          this.drawBubble(ctx, c, p.x, p.y - 72);
        }
      });
      // player
      const pp = this.pos(this.player);
      Art.personTop(ctx, pp.x, pp.y, { coat: "#1F2420", apron: "#F4EFE6", hair: "#2E2420", skin: M.SKINS[M.profile.settings.skin], walk: this.player.k < 1 ? this.player.walk : 0, carry: this.player.carry.map((d) => d.recipe), scale: L.landscape ? 1.15 : 1.4 });
      this.drawTaskMarkers(ctx);
    }
    drawTableTop(ctx, t, tp, i) {
      Art.shadow(ctx, tp.x, tp.y + 40, 66, 14, 0.14);
      // chairs
      ctx.fillStyle = "#7A5638";
      Art.rr(ctx, tp.x - 92, tp.y - 22, 30, 44, 8);
      ctx.fill();
      Art.rr(ctx, tp.x + 62, tp.y - 22, 30, 44, 8);
      ctx.fill();
      Art.ellipse(ctx, tp.x, tp.y + 6, 56, 40, "#9A6B3E");
      Art.ellipse(ctx, tp.x, tp.y, 56, 40, "#C49A64");
      ctx.fillStyle = "rgba(31,36,32,0.55)";
      ctx.font = "700 13px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(i + 1), tp.x + 40, tp.y - 26);
      ctx.textAlign = "start";
      const c = this.customerAt(i);
      if (t.state === "dirty") {
        Art.ellipse(ctx, tp.x - 6, tp.y, 20, 13, "#F1ECE2");
        ctx.fillStyle = "rgba(120,80,40,0.5)";
        for (let k = 0; k < 5; k++) Art.ellipse(ctx, tp.x - 12 + k * 4, tp.y - 2 + (k % 2) * 4, 2, 2);
        ctx.fill();
        Art.label(ctx, "Clear table", tp.x, tp.y - 58, { size: 12, bg: "rgba(29,33,31,0.8)" });
      } else if (c && (c.state === "eating" || c.state === "check")) {
        const r = M.recipeById(c.order);
        Art.ellipse(ctx, tp.x - 6, tp.y, 22, 15, "#FBF9F4");
        Art.ellipse(ctx, tp.x - 6, tp.y, 15 * (c.state === "check" ? 0.3 : 1), 10 * (c.state === "check" ? 0.3 : 1), r.color);
      } else if (c) {
        Art.rr(ctx, tp.x - 18, tp.y - 10, 26, 20, 3);
        ctx.fillStyle = "#FBF8F2";
        ctx.fill();
      }
    }
    drawBubble(ctx, c, x, y) {
      let text = null;
      let bg = "rgba(29,33,31,0.86)";
      if (c.state === "queue") text = c.type.label;
      else if (c.state === "reading") text = "Reading menu";
      else if (c.state === "ready") {
        text = "Ready to order";
        bg = "#B4472B";
      } else if (c.state === "waiting") text = M.recipeById(c.order).short;
      else if (c.state === "check") {
        text = "Bill please";
        bg = "#3F6B4E";
      }
      if (text) Art.label(ctx, text, x, y, { size: 12, bg });
    }
    drawTaskMarkers(ctx) {
      const all = (this.player.current ? [this.player.current] : []).concat(this.player.tasks);
      all.forEach((task, n) => {
        const p = this.spotPos(this.taskSpot(task));
        const y = p.y - (this.layout.fp ? 120 : 40);
        Art.ellipse(ctx, p.x + 30, y, 13, 13, n === 0 ? "#B4472B" : "#1F2420");
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "700 13px Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(n + 1), p.x + 30, y + 0.5);
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
      });
    }
    drawCounter(ctx) {
      const L = this.layout;
      const wallH = L.landscape ? 360 : 460;
      // back wall
      ctx.fillStyle = "#EDE6DA";
      ctx.fillRect(0, 0, L.W, wallH);
      // noren curtain + door
      const d = L.door;
      ctx.fillStyle = "#6B4A2E";
      ctx.fillRect(d.x - 60, d.y - 160, 120, 210);
      ctx.fillStyle = "#3A2C22";
      ctx.fillRect(d.x - 50, d.y - 150, 100, 200);
      ctx.fillStyle = "#B4472B";
      for (let i = 0; i < 3; i++) ctx.fillRect(d.x - 54 + i * 37, d.y - 160, 34, 70);
      // menu board
      const mbx = L.landscape ? 330 : 300;
      const mby = L.landscape ? 30 : 30;
      ctx.fillStyle = "#26302B";
      Art.rr(ctx, mbx, mby, L.landscape ? 340 : 300, 120, 8);
      ctx.fill();
      ctx.fillStyle = "#F4EFE6";
      ctx.font = "600 15px Iowan Old Style, Georgia, serif";
      M.profile.shop.menu.slice(0, 8).forEach((id, i) => {
        const r = M.recipeById(id);
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cw = (L.landscape ? 340 : 300) / 2;
        ctx.fillText(r.short, mbx + 14 + col * cw, mby + 28 + row * 24);
        ctx.fillText(M.fmtMoney(r.price * this.priceMult(id)), mbx + col * cw + cw - 46, mby + 28 + row * 24);
      });
      // lamps
      for (let i = 0; i < 3; i++) {
        const lx = L.W * (0.35 + i * 0.22);
        ctx.strokeStyle = "#3A3532";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, 170);
        ctx.stroke();
        Art.ellipse(ctx, lx, 182, 28, 16, "#F2E3C4");
        const g = ctx.createRadialGradient(lx, 200, 10, lx, 260, 200);
        g.addColorStop(0, "rgba(255,220,160,0.25)");
        g.addColorStop(1, "rgba(255,220,160,0)");
        ctx.fillStyle = g;
        ctx.fillRect(lx - 200, 180, 400, 260);
      }
      // queue at the door (front view)
      this.queueList().forEach((c) => {
        const p = this.pos(c);
        Art.personFront(ctx, p.x, p.y - 30, 0.55, { coat: c.type.coat, hair: c.type.hair, skin: c.skin, mood: c.patience, blink: c.blinkT < 0 });
        if (c.id === this.selected) {
          ctx.strokeStyle = "#B4472B";
          ctx.lineWidth = 3;
          Art.rr(ctx, p.x - 26, p.y - 74, 52, 100, 10);
          ctx.stroke();
        }
        Art.patience(ctx, p.x - 20, p.y + 14, 40, c.patience);
      });
      // seated guests
      L.tables.forEach((tp, i) => {
        const c = this.customerAt(i);
        if (c && c.k >= 1) {
          Art.personFront(ctx, tp.x, tp.y, 0.95, { coat: c.type.coat, hair: c.type.hair, skin: c.skin, mood: c.mood, blink: c.blinkT < 0 });
        } else if (c) {
          const p = this.pos(c);
          Art.personFront(ctx, p.x, p.y, 0.8, { coat: c.type.coat, hair: c.type.hair, skin: c.skin });
        }
      });
      // counter
      const cy = L.landscape ? 360 : 460;
      const g = ctx.createLinearGradient(0, cy, 0, L.H);
      g.addColorStop(0, "#C99A63");
      g.addColorStop(1, "#B08250");
      ctx.fillStyle = g;
      ctx.fillRect(0, cy, L.W, L.H - cy);
      ctx.fillStyle = "#D9AC72";
      ctx.fillRect(0, cy, L.W, 16);
      if (!L.landscape) {
        // second counter row for portrait
        ctx.fillStyle = "#D9AC72";
        ctx.fillRect(0, cy + 190, L.W, 12);
      }
      // seats: placemats, dishes, bubbles
      L.tables.forEach((tp, i) => {
        const t = this.tables[i];
        const c = this.customerAt(i);
        const my = tp.y + 120;
        ctx.fillStyle = "rgba(251,248,242,0.75)";
        Art.rr(ctx, tp.x - 46, my - 22, 92, 44, 6);
        ctx.fill();
        ctx.fillStyle = "rgba(31,36,32,0.6)";
        ctx.font = "700 13px Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Seat " + (i + 1), tp.x, my + 38);
        ctx.textAlign = "start";
        if (t.state === "dirty") {
          Art.ellipse(ctx, tp.x, my, 30, 14, "#F1ECE2");
          Art.label(ctx, "Clear", tp.x, my - 40, { size: 12 });
        } else if (c && (c.state === "eating" || c.state === "check")) {
          const r = M.recipeById(c.order);
          Art.ellipse(ctx, tp.x, my, 34, 15, "#FBF9F4");
          Art.ellipse(ctx, tp.x, my, 24 * (c.state === "check" ? 0.3 : 1), 10 * (c.state === "check" ? 0.3 : 1), r.color);
          if (c.state === "eating") Art.steam(ctx, tp.x, my - 10, 0.5, this.t, 30);
        }
        if (c && c.k >= 1 && c.state !== "leaving") {
          Art.patience(ctx, tp.x - 34, tp.y + 76, 68, c.patience, false);
          this.drawBubble(ctx, c, tp.x, tp.y - 92);
        }
      });
      // pass shelf (your side)
      const py = L.pass[0].y;
      ctx.fillStyle = "#9DA3A1";
      Art.rr(ctx, L.pass[0].x - 60, py - 40, L.pass[3].x - L.pass[0].x + 120, 80, 10);
      ctx.fill();
      ctx.fillStyle = "#D9DDDB";
      Art.rr(ctx, L.pass[0].x - 56, py - 44, L.pass[3].x - L.pass[0].x + 112, 72, 10);
      ctx.fill();
      ctx.fillStyle = "rgba(31,36,32,0.6)";
      ctx.font = "600 13px Segoe UI, sans-serif";
      ctx.fillText("Pickup counter", L.pass[0].x - 50, py - 50);
      this.pass.slice(0, L.pass.length).forEach((dsh, i) => {
        const p = L.pass[i];
        Art.ellipse(ctx, p.x, p.y - 6, 34, 18, "#FBF9F4");
        Art.ellipse(ctx, p.x, p.y - 6, 23, 12, M.recipeById(dsh.recipe).color);
        Art.label(ctx, "Seat " + (dsh.table + 1), p.x, p.y + 22, { size: 11 });
      });
      if (this.role === "owner") {
        const s = L.stove;
        ctx.fillStyle = "#2F2C2A";
        Art.rr(ctx, s.x - 50, s.y - 36, 100, 72, 10);
        ctx.fill();
        Art.ellipse(ctx, s.x, s.y, 24, 18, this.pendingTickets().length ? "#C8553D" : "#46413E");
        Art.label(ctx, "Stove", s.x, s.y - 50, { size: 12 });
      }
      // what you are carrying (first-person hands)
      const carry = this.player.carry;
      const hx = L.player.x;
      carry.forEach((dsh, i) => {
        const x = hx + (i ? 90 : 0);
        Art.ellipse(ctx, x, L.H - 40, 40, 20, "#FBF9F4");
        Art.ellipse(ctx, x, L.H - 40, 27, 13, M.recipeById(dsh.recipe).color);
        const skin = M.SKINS[M.profile.settings.skin];
        Art.ellipse(ctx, x + 30, L.H - 26, 16, 12, skin);
      });
      this.drawTaskMarkers(ctx);
    }
    drawFloaters(ctx) {
      this.floaters.forEach((f) => {
        ctx.globalAlpha = Math.min(1, f.life);
        Art.label(ctx, f.text, f.x, f.y, { size: 13, bg: f.color });
        ctx.globalAlpha = 1;
      });
    }
  }

  M.Restaurant = Restaurant;
})();
