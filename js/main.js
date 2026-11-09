/* Mise - game controller, render loop, input routing and test hooks. */
(function () {
  "use strict";
  const M = window.Mise;
  const UI = M.ui;
  const $ = (s) => document.querySelector(s);

  const canvas = $("#stage");
  const ctx = canvas.getContext("2d");
  const screenGame = $("#screen-game");

  const G = (M.game = {
    mode: null, // "home" | "restaurant"
    session: null,
    restaurant: null,
    paused: false,
    speed: 1,
    autoplay: false,
    view: { w: 0, h: 0, stage: { x: 0, y: 0, w: 0, h: 0 } },
  });

  // ---------------------------------------------------------------- layout
  function computeView() {
    const w = screenGame.clientWidth;
    const h = screenGame.clientHeight;
    const narrow = w < 760 || w < h * 0.9;
    screenGame.classList.toggle("is-narrow", narrow);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = narrow ? 6 : 14;
    let top = $("#hud").offsetHeight + pad;
    let left = pad;
    const right = w - pad;
    let bottom = h - pad;
    const ticket = $("#ticket");
    const rail = $("#rail");
    const hint = $("#hint");
    if (!ticket.hidden) {
      if (narrow) top = Math.max(top, ticket.offsetTop + ticket.offsetHeight + pad);
      else left = ticket.offsetLeft + ticket.offsetWidth + pad;
    }
    if (!rail.hidden) top = Math.max(top, rail.offsetTop + Math.max(rail.offsetHeight, 40) + pad);
    if (!hint.hidden && hint.offsetHeight) bottom = Math.min(bottom, hint.offsetTop - pad);
    G.view = { w, h, narrow, stage: { x: left, y: top, w: Math.max(80, right - left), h: Math.max(80, bottom - top) } };
    return G.view;
  }

  // ---------------------------------------------------------------- flows
  // ---------------------------------------------------------------- back navigation
  // One hierarchy for the on-screen back button, Escape and the browser / phone Back:
  // title > cookbook or restaurant > kitchen > dialog. Leaving a kitchen with work in it asks first.
  G.touched = false;
  G.hasProgress = function () {
    if (G.restaurant) {
      const r = G.restaurant;
      // a service only has something to lose once orders, sales, used ingredients or player actions exist
      return !r.ended && (G.touched || r.tickets.length > 0 || r.served > 0 || r.lost > 0 || r.earned > 0 || r.stockUsed > 0);
    }
    if (G.session) return !G.session.done && (G.touched || G.session.idx > 0);
    return false;
  };
  // Exact consequences of leaving an unfinished service, built from what has happened so far.
  G.serviceLeaveText = function () {
    const r = G.restaurant;
    const day = M.profile.shop.day;
    const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
    const parts = [];
    const sofar = [];
    if (r.served > 0) sofar.push(plural(r.served, "table served", "tables served"));
    if (r.lost > 0) sofar.push(plural(r.lost, "guest left", "guests left"));
    if (r.tickets.length > 0) sofar.push(plural(r.tickets.length, "order waiting", "orders waiting"));
    if (sofar.length) parts.push("So far: " + sofar.join(", ") + ".");
    parts.push(r.earned > 0 ? "The " + M.fmtMoney(r.earned) + " taken today is not paid." : "Nothing has been paid yet today.");
    if (r.served > 0 || r.lost > 0) parts.push("Today's reputation change is undone.");
    if (r.stockUsed > 0) parts.push(plural(r.stockUsed, "ingredient", "ingredients") + " already used stay used.");
    parts.push("Day " + day + " does not count, so you can play it again.");
    return parts.join(" ");
  };
  G.requestLeave = function () {
    if (!G.hasProgress()) {
      G.action("quit");
      return;
    }
    const service = G.mode === "restaurant";
    $("#leave-h").textContent = service ? "Leave the service?" : "Leave the kitchen?";
    $("#leave-sub").textContent = service
      ? G.serviceLeaveText()
      : "This " + (G.session ? G.session.recipe.name.toLowerCase() : "dish") + " is not finished. Leaving clears it; nothing is added to your journal.";
    $("#btn-stay").textContent = service ? "Keep serving" : "Keep cooking";
    $("#btn-leave").textContent = service ? "Leave to the restaurant" : "Leave to the cookbook";
    UI.close("pause");
    G.paused = true;
    M.audio.stopAllLoops();
    UI.open("leave");
  };
  G.back = function () {
    const top = UI.topOverlay();
    if (top) {
      if (top === "leave") G.action("stay");
      else if (top === "pause") G.resume();
      else if (top === "result") G.action("cookbook");
      else if (top === "day") G.action("manage");
      else {
        UI.close(top);
        if (UI.current === "game" && !UI.topOverlay()) G.paused = false;
      }
      return true;
    }
    if (UI.current === "game") {
      G.requestLeave();
      return true;
    }
    if (UI.current === "home" || UI.current === "shop") {
      M.audio.play("tick");
      UI.show("title");
      return true;
    }
    return false;
  };
  function setBackLabel() {
    $("#btn-back").setAttribute("aria-label", G.mode === "restaurant" ? "Back to the restaurant" : "Back to the cookbook");
  }

  G.startHome = function (recipeId) {
    M.audio.unlock();
    G.cleanup();
    const recipe = M.recipeById(recipeId) || M.RECIPES[0];
    M.profile.home.last = recipe.id;
    M.saveProfile();
    G.mode = "home";
    G.lastRecipe = recipe.id;
    UI.ticketNo = (M.profile.home.journal.length || 0) + 1;
    UI.enterGame({ kicker: "Home kitchen", name: recipe.name, ticket: true, rail: false });
    G.session = new M.CookSession(recipe, {
      camera: M.profile.settings.camera,
      mode: "home",
      onComplete: (res) => {
        const h = M.profile.home;
        const c = h.cooked[recipe.id] || { count: 0, best: 0 };
        c.count += 1;
        c.best = Math.max(c.best, res.quality);
        h.cooked[recipe.id] = c;
        h.journal.unshift({ recipeId: recipe.id, quality: res.quality, notes: res.results.map((r) => r.note), at: Date.now() });
        h.journal = h.journal.slice(0, 40);
        M.saveProfile();
        UI.renderTicket(G.session);
        setTimeout(() => {
          if (G.session && G.session.done) UI.showResult(res);
        }, 900);
      },
    });
    G.session.autoplay = G.autoplay;
    UI.renderTicket(G.session);
    G.paused = false;
    G.touched = false;
    setBackLabel();
  };

  G.startDay = function (role) {
    M.audio.unlock();
    G.cleanup();
    M.profile.shop.role = role;
    M.saveProfile();
    G.mode = "restaurant";
    const names = { chef: "Chef on the line", server: "Working the floor", owner: "Running the place" };
    UI.enterGame({ kickerLead: "Restaurant", kicker: "day " + M.profile.shop.day, name: names[role], ticket: false, rail: true });
    G.restaurant = new M.Restaurant(role, M.profile.settings.camera);
    G.paused = false;
    G.touched = false;
    setBackLabel();
  };

  G.cleanup = function () {
    if (G.session) G.session.destroy();
    if (G.restaurant && !G.restaurant.ended) {
      // an unfinished service does not count: undo its reputation change (ingredients used stay used)
      M.profile.shop.reputation = G.restaurant.repStart;
      M.saveProfile();
    }
    if (G.restaurant && G.restaurant.cook) G.restaurant.cook.destroy();
    G.session = null;
    G.restaurant = null;
    M.audio.stopAllLoops();
    ["leave", "pause", "result", "day"].forEach((id) => UI.close(id));
    $("#screen-game").classList.remove("is-cooking");
  };

  G.pause = function (silent) {
    if (UI.current !== "game" || G.paused) return;
    G.paused = true;
    M.audio.stopAllLoops();
    if (!silent) UI.open("pause");
  };
  G.resume = function () {
    UI.close("pause");
    UI.close("settings");
    G.paused = false;
  };

  G.action = function (a) {
    M.audio.play("tick");
    if (a === "resume") G.resume();
    else if (a === "stay") {
      UI.close("leave");
      G.paused = false;
    } else if (a === "leave") G.requestLeave();
    else if (a === "restart") {
      UI.close("pause");
      if (G.mode === "home") G.startHome(G.lastRecipe);
      else G.startDay(M.profile.shop.role || "server");
    } else if (a === "quit") {
      const wasShop = G.mode === "restaurant";
      G.cleanup();
      G.mode = null;
      UI.show(wasShop ? "shop" : "home");
    } else if (a === "again") {
      UI.close("result");
      G.startHome(G.lastRecipe);
    } else if (a === "cookbook") {
      UI.close("result");
      G.cleanup();
      UI.show("home");
    } else if (a === "manage") {
      UI.close("day");
      G.cleanup();
      UI.tab = "upgrades";
      UI.show("shop");
    } else if (a === "title") {
      UI.close("day");
      G.cleanup();
      UI.show("title");
    }
  };

  M.on("step", () => UI.renderTicket(G.session || (G.restaurant && G.restaurant.cook)));
  M.on("stepDone", (e) => {
    UI.renderTicket(e.session);
    if (e.q >= 0.85) M.audio.play("success");
  });
  M.on("cookStart", (e) => {
    $("#ticket").hidden = false;
    $("#screen-game").classList.add("is-cooking");
    UI.ticketNo = e.ticket.id;
    UI.renderTicket(e.restaurant.cook);
    UI.lastHint = "";
  });
  M.on("cookEnd", () => {
    $("#ticket").hidden = true;
    $("#screen-game").classList.remove("is-cooking");
    UI.lastHint = "";
  });
  M.on("dayEnd", (summary) => {
    const rs = G.restaurant;
    setTimeout(() => {
      // only show the summary for the day that just ended, never over a new one
      if (G.restaurant === rs && rs && rs.ended && UI.current === "game") UI.showDay(summary);
    }, 600);
  });

  // ---------------------------------------------------------------- hints
  function updateHint() {
    const sess = G.session || (G.restaurant && G.restaurant.cook);
    if (sess && sess.mg && !sess.done) {
      const step = sess.step;
      const n = sess.recipe.steps.length;
      const label = "STEP " + (sess.idx + 1) + "/" + n;
      if (sess.state === "intro") UI.setHint(label, step.label, "");
      else UI.setHint(label, step.label + ". " + sess.mg.hint, sess.mg.status || "");
      return;
    }
    if (sess && sess.done) {
      UI.setHint("", "Plated. Nicely done.", Math.round(sess.quality * 100) + "%");
      return;
    }
    const rs = G.restaurant;
    if (rs) {
      if (rs.ended) {
        UI.setHint("", "Closed for the day.", "");
        return;
      }
      let text;
      if (rs.role === "chef") text = rs.pendingTickets().length ? "Pick a ticket from the rail to cook it." : "Waiting for orders. The server seats guests for you.";
      else if (rs.selected != null) text = "Now tap a free table to seat this guest.";
      else if (rs.queueList().length && rs.tables.some((t) => t.state === "free")) text = "Tap a guest in the queue, then a free table.";
      else if (rs.pass.length) text = "Dishes are ready on the pickup counter. Tap one to carry it, then tap its table.";
      else if (rs.role === "owner" && rs.pendingTickets().length && !M.upgradeLevel("linecook")) text = "New tickets. Tap the stove or a ticket to cook.";
      else text = "Tap tables to take orders, serve and collect the bill.";
      const hands = rs.role !== "chef" ? "Carrying " + rs.player.carry.length + " of 2" : "";
      UI.setHint("", text, hands);
      return;
    }
    UI.setHint("", "", "");
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  let hudT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    try {
      tick(now);
    } catch (err) {
      console.error(err);
    }
  }
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (UI.current === "title") UI.drawHero(now / 1000);
    if (UI.current === "game") {
      const view = computeView();
      const active = !G.paused && !UI.topOverlay();
      const steps = G.speed > 1 ? Math.round(G.speed) : 1;
      for (let i = 0; i < steps; i++) {
        if (active && G.session) G.session.update(dt);
        if (active && G.restaurant) {
          if (G.autoplay) G.restaurant.autoServe();
          if (G.restaurant.cook) G.restaurant.cook.autoplay = G.autoplay;
          G.restaurant.update(dt);
        }
      }
      ctx.clearRect(0, 0, view.w, view.h);
      if (G.session) G.session.draw(ctx, view);
      else if (G.restaurant) G.restaurant.draw(ctx, view);
      hudT += dt;
      if (hudT > 0.2) {
        hudT = 0;
        updateHint();
        if (G.restaurant) {
          UI.renderRestaurantHud(G.restaurant);
          UI.renderRail(G.restaurant);
        } else if (G.session) {
          const s = G.session;
          const html = '<div class="hud-stat"><b>' + Math.min(s.results.length + 1, s.recipe.steps.length) + " / " + s.recipe.steps.length + '</b><span>Step</span></div><div class="hud-stat opt"><b>' + (M.profile.settings.camera === "first" ? "First" : "Third") + "</b><span>View</span></div>";
          const el = $("#hud-stats");
          if (el.innerHTML !== html) el.innerHTML = html;
        }
      }
    }
  }

  // ---------------------------------------------------------------- input
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function route(type, e) {
    if (G.paused || UI.topOverlay()) return;
    if (type === "down") G.touched = true;
    const p = local(e);
    if (G.session) G.session.pointer(G.view, type, p.x, p.y);
    else if (G.restaurant) G.restaurant.pointer(G.view, type, p.x, p.y);
  }
  canvas.addEventListener("pointerdown", (e) => {
    M.audio.unlock();
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    route("down", e);
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => route("move", e));
  canvas.addEventListener("pointerup", (e) => route("up", e));
  canvas.addEventListener("pointercancel", (e) => route("up", e));

  const GAME_KEYS = ["Space", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // Escape is Back everywhere: closes a dialog, asks before leaving a kitchen with work in it, goes up a screen.
      G.back();
      return;
    }
    if (UI.current !== "game" || G.paused || UI.topOverlay()) return;
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if ((e.code === "Space" || e.code === "Enter") && (tag === "BUTTON" || tag === "INPUT")) {
      // keyboard players keep focus on the canvas region while cooking
      document.activeElement.blur();
    }
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (e.repeat && (e.code === "Space" || e.code === "Enter") && !(G.session && G.session.mg && (G.session.mg instanceof M.MINIGAMES.stir || G.session.mg instanceof M.MINIGAMES.pour))) return;
    M.audio.unlock();
    G.touched = true;
    if (G.session) G.session.key(e.code, true);
    else if (G.restaurant) G.restaurant.key(e.code, true);
  });
  document.addEventListener("keyup", (e) => {
    if (UI.current !== "game") return;
    if (G.session) G.session.key(e.code, false);
    else if (G.restaurant) G.restaurant.key(e.code, false);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && UI.current === "game") G.pause();
  });
  window.addEventListener("resize", () => {
    if (UI.current === "game") computeView();
  });

  // ---------------------------------------------------------------- browser and phone Back
  const Hist = { armed: false, skip: false };
  function wantsGuard() {
    return UI.current !== "title" || !!UI.topOverlay();
  }
  function syncHistory() {
    try {
      if (wantsGuard() && !Hist.armed) {
        history.pushState({ mise: 1 }, "");
        Hist.armed = true;
      } else if (!wantsGuard() && Hist.armed) {
        // back on the title through the game itself: drop the guard so the next system Back leaves the site
        Hist.armed = false;
        Hist.skip = true;
        history.back();
      }
    } catch (err) {
      Hist.armed = false;
    }
  }
  window.addEventListener("popstate", () => {
    if (Hist.skip) {
      Hist.skip = false;
      return;
    }
    if (!Hist.armed) return;
    Hist.armed = false;
    G.back();
    syncHistory();
  });
  M.on("screen", () => setTimeout(syncHistory, 0));
  M.on("overlay", () => setTimeout(syncHistory, 0));

  // ---------------------------------------------------------------- test hooks (used by the automated checks)
  window.__mise = {
    M,
    startHome: (id, camera) => {
      if (camera) M.profile.settings.camera = camera;
      G.startHome(id);
    },
    startDay: (role, camera, duration) => {
      if (camera) M.profile.settings.camera = camera;
      G.startDay(role);
      if (duration) G.restaurant.duration = duration;
    },
    autoplay: (on) => {
      G.autoplay = !!on;
      if (G.session) G.session.autoplay = !!on;
    },
    speed: (s) => {
      G.speed = s;
    },
    state: () => ({
      screen: UI.current,
      mode: G.mode,
      step: G.session ? G.session.idx : null,
      done: G.session ? G.session.done : null,
      quality: G.session ? G.session.quality : null,
      day: G.restaurant ? { time: G.restaurant.time, earned: G.restaurant.earned, served: G.restaurant.served, lost: G.restaurant.lost, ended: G.restaurant.ended, tickets: G.restaurant.tickets.length, cooking: !!G.restaurant.cook } : null,
      overlay: UI.topOverlay(),
    }),
  };

  UI.init();
  requestAnimationFrame(frame);
})();

// Keep the custom range track fill in sync with its value (round 3)
(function syncRangeFill() {
  const paint = (el) => {
    const min = parseFloat(el.min || 0);
    const max = parseFloat(el.max || 100);
    const pct = ((parseFloat(el.value) - min) / (max - min || 1)) * 100;
    el.style.setProperty("--fill", pct + "%");
  };
  document.addEventListener("input", (e) => {
    if (e.target && e.target.type === "range") {
      paint(e.target);
    }
  });
  const paintAll = () => document.querySelectorAll('input[type="range"]').forEach(paint);
  new MutationObserver(paintAll).observe(document.body, { childList: true, subtree: true });
  paintAll();
})();
