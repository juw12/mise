/* Mise - DOM user interface: screens, cookbook, management, HUD, ticket, rail, overlays. */
(function () {
  "use strict";
  const M = window.Mise;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const ICONS = {
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>',
    sound: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a4 4 0 010 6M19.5 6.5a8 8 0 010 11"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };
  function paintIcons(root) {
    $$(".ico[data-ico]", root).forEach((el) => {
      if (!el.innerHTML) el.innerHTML = ICONS[el.dataset.ico] || "";
    });
  }

  const UI = (M.ui = {
    selectedRecipe: null,
    tab: "upgrades",
    openStack: [],
  });

  // ---------------------------------------------------------------- screens
  UI.show = function (id) {
    $$(".screen").forEach((s) => s.classList.toggle("is-active", s.id === "screen-" + id));
    UI.current = id;
    if (id === "title") UI.renderTitle();
    if (id === "home") UI.renderHome();
    if (id === "shop") UI.renderShop();
    const h = $("#screen-" + id + " h1, #screen-" + id + " h2");
    if (h && id !== "game") {
      h.setAttribute("tabindex", "-1");
      h.focus({ preventScroll: true });
    }
    M.emit("screen", id);
  };

  // ---------------------------------------------------------------- title
  UI.renderTitle = function () {
    const s = M.profile.shop;
    const line = $("#title-shop-line");
    if (s.day > 1) {
      line.textContent = "Day " + s.day + " next. " + M.fmtMoney(s.coins) + " in the till, reputation " + s.reputation.toFixed(1) + " of 5.";
    } else {
      line.textContent = "Pick a role: chef, server or owner. Days, tips and upgrades.";
    }
  };

  UI.drawHero = function (t) {
    const cv = $("#hero");
    if (!cv || UI.current !== "title") return;
    const ctx = cv.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = 560;
    const H = 460;
    if (cv.width !== W * dpr) {
      cv.width = W * dpr;
      cv.height = H * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const A = M.art;
    A.board(ctx, 40, 150, 400, 250);
    const k = (Math.sin(t * 0.6) + 1) / 2;
    A.sliced(ctx, "cucumber", 80, 270, [190, 230, 270, 310, 350], 0.7 + 0.3 * k);
    A.sliced(ctx, "tomato", 150, 345, [235], 0.8);
    A.bowl(ctx, 470, 330, 78, "#F2C14E", 0.75);
    A.tool(ctx, "chopsticks", 495, 230, 0.5);
    A.egg(ctx, 470, 120, 0.85, 0.4, 0);
    A.steam(ctx, 470, 290, 0.0, t, 60);
  };

  // ---------------------------------------------------------------- segmented controls & toggles
  function bindSegs(root) {
    $$(".seg[data-setting]", root).forEach((seg) => {
      const key = seg.dataset.setting;
      const sync = () => {
        $$("button", seg).forEach((b) => b.setAttribute("aria-checked", String(M.profile.settings[key] === b.dataset.value)));
      };
      if (!seg.dataset.bound) {
        seg.dataset.bound = "1";
        seg.addEventListener("click", (e) => {
          const b = e.target.closest("button");
          if (!b) return;
          M.audio.unlock();
          M.profile.settings[key] = b.dataset.value;
          if (key === "ambienceKind") M.audio.setAmbience(b.dataset.value);
          M.audio.play("select");
          M.saveProfile();
          $$('.seg[data-setting="' + key + '"]').forEach((s2) => s2.dispatchEvent(new CustomEvent("sync")));
          UI.renderCamHelp();
        });
        seg.addEventListener("sync", sync);
        seg.addEventListener("keydown", (e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          const bs = $$("button", seg);
          const i = bs.findIndex((b) => b.getAttribute("aria-checked") === "true");
          const n = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length];
          n.click();
          n.focus();
          e.preventDefault();
        });
      }
      sync();
    });
    $$("[data-toggle]", root).forEach((inp) => {
      const key = inp.dataset.toggle;
      inp.checked = !!M.profile.settings[key];
      if (!inp.dataset.bound) {
        inp.dataset.bound = "1";
        inp.addEventListener("change", () => {
          M.audio.unlock();
          M.profile.settings[key] = inp.checked;
          if (key === "radioOn") M.audio.setRadio(inp.checked);
          M.saveProfile();
          $$('[data-toggle="' + key + '"]').forEach((o) => (o.checked = inp.checked));
        });
      }
    });
    UI.renderCamHelp();
  }
  UI.renderCamHelp = function () {
    const first = M.profile.settings.camera === "first";
    const txt = first ? "Your own hands at the board, close enough to hear the knife." : "See the whole kitchen and walk between stations.";
    const a = $("#cam-help");
    const b = $("#cam-help-2");
    if (a) a.textContent = txt;
    if (b) b.textContent = first ? "Behind the counter, guests across from you." : "The whole dining room from above, like a floor plan.";
  };

  // ---------------------------------------------------------------- home cookbook
  UI.renderHome = function () {
    const list = $("#recipe-list");
    const cooked = M.profile.home.cooked;
    if (!UI.selectedRecipe) UI.selectedRecipe = M.profile.home.last || M.RECIPES[0].id;
    list.innerHTML = M.RECIPES.map((r) => {
      const c = cooked[r.id];
      const best = c ? '<span class="best">Best ' + Math.round(c.best * 100) + "%</span>" : "<span>Not cooked yet</span>";
      return (
        '<button class="recipe" role="radio" aria-checked="' + (r.id === UI.selectedRecipe) + '" data-recipe="' + r.id + '">' +
        '<span class="recipe-img"><img alt="" src="' + M.dishImage(r.id, 220) + '"></span>' +
        '<span class="recipe-body"><b>' + esc(r.name) + "</b><p>" + esc(r.blurb) + "</p>" +
        '<span class="recipe-meta"><span>' + r.steps.length + " steps</span>" + best + "</span></span></button>"
      );
    }).join("");
    $$(".recipe", list).forEach((b) => {
      b.addEventListener("click", () => {
        M.audio.unlock();
        M.audio.play("page");
        UI.selectedRecipe = b.dataset.recipe;
        $$(".recipe", list).forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        UI.renderSelected();
      });
      b.addEventListener("dblclick", () => M.game.startHome(b.dataset.recipe));
    });
    bindSegs($("#screen-home"));
    UI.renderSelected();
    UI.renderJournal();
  };
  UI.renderSelected = function () {
    const r = M.recipeById(UI.selectedRecipe);
    $("#selected-card").innerHTML = "<b>" + esc(r.name) + '</b><ol>' + r.steps.map((s) => "<li>" + esc(s.label) + "</li>").join("") + "</ol>";
    $("#btn-cook").textContent = "Cook the " + r.name.toLowerCase();
    $("#mobile-cook-name").textContent = r.name;
    $("#btn-cook-m").textContent = "Cook";
  };
  UI.renderJournal = function () {
    const j = M.profile.home.journal.slice(0, 5);
    $("#journal-list").innerHTML = j.length
      ? j.map((e) => "<li><span>" + esc(M.recipeById(e.recipeId).name) + '</span><span class="pct">' + Math.round(e.quality * 100) + "%</span></li>").join("")
      : '<li class="journal-empty">Dishes you cook are noted here.</li>';
  };

  // ---------------------------------------------------------------- restaurant management
  UI.renderShop = function () {
    const s = M.profile.shop;
    $("#purse").innerHTML = "<b>" + M.fmtMoney(s.coins) + "</b><span>in the till</span>";
    $("#shop-stats").innerHTML =
      '<div class="stat"><b>Day ' + s.day + "</b><span>next service</span></div>" +
      '<div class="stat"><b>' + s.reputation.toFixed(1) + '</b><span>reputation of 5</span></div>' +
      '<div class="stat"><b>' + s.totalServed + "</b><span>guests served</span></div>";
    // pantry at a glance: each category is a bar, low stock turns terracotta
    $("#shop-pantry").innerHTML =
      '<span class="field-label">Pantry</span>' +
      Object.keys(M.STOCK)
        .map((k) => {
          const have = s.stock[k] || 0;
          const low = have < 4;
          const pct = Math.round(M.clamp(have / 20, 0, 1) * 100);
          return '<div class="pantry-row' + (low ? " is-low" : "") + '"><span>' + esc(M.STOCK[k].name) + '</span><i><em style="width:' + pct + '%"></em></i><b>' + have + "</b></div>";
        })
        .join("");
    const role = s.role || "server";
    $$("#roles .role").forEach((b) => {
      b.setAttribute("aria-checked", String(b.dataset.role === role));
      if (!b.dataset.bound) {
        b.dataset.bound = "1";
        b.addEventListener("click", () => {
          M.audio.unlock();
          M.audio.play("select");
          M.profile.shop.role = b.dataset.role;
          M.saveProfile();
          UI.renderShop();
        });
      }
    });
    const g = M.dayGoal(s.day);
    const avail = UI.stockWarning();
    $("#goal").innerHTML =
      "Today's goal: <b>" + M.fmtMoney(g[0]) + "</b> for one star, <b>" + M.fmtMoney(g[1]) + "</b> for two, <b>" + M.fmtMoney(g[2]) + "</b> for three." +
      (avail ? '<br><span class="warn">' + esc(avail) + "</span>" : "");
    $("#btn-open-day").textContent = "Open for day " + s.day + " as " + (role === "chef" ? "chef" : role === "server" ? "server" : "owner");
    bindSegs($("#screen-shop"));
    UI.renderTab(UI.tab);
  };
  UI.stockWarning = function () {
    const st = M.profile.shop.stock;
    const low = Object.keys(M.STOCK).filter((k) => (st[k] || 0) < 4);
    if (!low.length) return "";
    return "Low stock: " + low.map((k) => M.STOCK[k].name.toLowerCase()).join(", ") + ". Restock in the Market tab or some dishes will sell out.";
  };
  UI.renderTab = function (tab) {
    UI.tab = tab;
    $$(".tabs [role=tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    const body = $("#tab-body");
    const s = M.profile.shop;
    if (tab === "upgrades") {
      let html = "";
      let group = "";
      M.UPGRADES.forEach((u) => {
        if (u.group !== group) {
          group = u.group;
          html += '<p class="group-title">' + esc(group) + "</p>";
        }
        const lvl = M.upgradeLevel(u.id);
        const max = u.costs.length;
        const cost = u.costs[lvl];
        const btn = lvl >= max
          ? '<span class="ok">Owned</span>'
          : '<button class="btn btn-ghost btn-small" data-buy="' + u.id + '"' + (s.coins < cost ? " disabled" : "") + ">Buy " + M.fmtMoney(cost) + "</button>";
        html += '<div class="row-item"><div><b>' + esc(u.name) + "</b> <span class=\"lvl\">" + (max > 1 ? "Level " + lvl + " of " + max : "") + "</span><p>" + esc(u.desc) + "</p></div>" + btn + "</div>";
      });
      body.innerHTML = html;
      $$("[data-buy]", body).forEach((b) =>
        b.addEventListener("click", () => {
          const u = M.UPGRADES.find((x) => x.id === b.dataset.buy);
          const lvl = M.upgradeLevel(u.id);
          const cost = u.costs[lvl];
          if (s.coins < cost) return;
          s.coins -= cost;
          s.upgrades[u.id] = lvl + 1;
          M.audio.play("coin");
          M.saveProfile();
          UI.renderShop();
        })
      );
    } else if (tab === "menu") {
      body.innerHTML = M.RECIPES.map((r) => {
        const on = s.menu.includes(r.id);
        const owned = on || (s.unlocked || []).includes(r.id) || M.UNLOCK_COST[r.id] === 0;
        const mult = s.prices[r.id] || 1;
        let ctl;
        if (!owned) {
          const c = M.UNLOCK_COST[r.id];
          ctl = '<button class="btn btn-ghost btn-small" data-unlock="' + r.id + '"' + (s.coins < c ? " disabled" : "") + ">Learn " + M.fmtMoney(c) + "</button>";
        } else {
          ctl =
            '<div class="price-ctl"><input type="range" min="0.8" max="1.4" step="0.05" value="' + mult + '" data-price="' + r.id + '" aria-label="Price for ' + esc(r.name) + '">' +
            "<span>" + M.fmtMoney(r.price * mult) + '</span><label class="toggle"><input type="checkbox" data-menu="' + r.id + '"' + (on ? " checked" : "") + "><span>On menu</span></label></div>";
        }
        return '<div class="row-item row-menu"><img alt="" src="' + M.dishImage(r.id, 120) + '"><div><b>' + esc(r.name) + "</b><p>Base " + M.fmtMoney(r.price) + ", uses " + r.stock.map((k) => M.STOCK[k].name.toLowerCase()).join(" and ") + "</p></div>" + ctl + "</div>";
      }).join("") + '<p class="field-help">Higher prices earn more per plate, but guests get impatient sooner and arrive less often.</p>';
      $$("[data-unlock]", body).forEach((b) =>
        b.addEventListener("click", () => {
          const id = b.dataset.unlock;
          const c = M.UNLOCK_COST[id];
          if (s.coins < c) return;
          s.coins -= c;
          s.unlocked = (s.unlocked || []).concat(id);
          if (!s.menu.includes(id)) s.menu.push(id);
          M.audio.play("coin");
          M.saveProfile();
          UI.renderShop();
        })
      );
      $$("[data-price]", body).forEach((inp) =>
        inp.addEventListener("input", () => {
          s.prices[inp.dataset.price] = Number(inp.value);
          inp.nextElementSibling.textContent = M.fmtMoney(M.recipeById(inp.dataset.price).price * Number(inp.value));
          M.saveProfile();
        })
      );
      $$("[data-menu]", body).forEach((inp) =>
        inp.addEventListener("change", () => {
          const id = inp.dataset.menu;
          if (inp.checked && !s.menu.includes(id)) s.menu.push(id);
          if (!inp.checked) {
            if (s.menu.length <= 1) {
              inp.checked = true;
              return;
            }
            s.menu = s.menu.filter((x) => x !== id);
          }
          M.saveProfile();
        })
      );
    } else if (tab === "market") {
      body.innerHTML = Object.keys(M.STOCK).map((k) => {
        const d = M.STOCK[k];
        const have = s.stock[k] || 0;
        return '<div class="row-item"><div><b>' + esc(d.name) + "</b> <span class=\"lvl " + (have < 4 ? "warn" : "") + '">' + have + " portions</span><p>One pack adds " + d.pack + " portions.</p></div>" +
          '<button class="btn btn-ghost btn-small" data-stock="' + k + '"' + (s.coins < d.cost ? " disabled" : "") + ">Buy pack " + M.fmtMoney(d.cost) + "</button></div>";
      }).join("") + '<p class="field-help">Every dish uses one portion from each category it needs. When a category runs out, those dishes sell out.</p>';
      $$("[data-stock]", body).forEach((b) =>
        b.addEventListener("click", () => {
          const d = M.STOCK[b.dataset.stock];
          if (s.coins < d.cost) return;
          s.coins -= d.cost;
          s.stock[b.dataset.stock] = (s.stock[b.dataset.stock] || 0) + d.pack;
          M.audio.play("coin");
          M.saveProfile();
          UI.renderShop();
        })
      );
    } else {
      const h = s.history;
      body.innerHTML = h.length
        ? '<table class="ledger"><thead><tr><th>Day</th><th>Role</th><th>Takings</th><th>Served</th><th>Left</th><th>Stars</th></tr></thead><tbody>' +
          h.map((d) => "<tr><td>" + d.day + "</td><td>" + esc(d.role) + '</td><td class="num">' + M.fmtMoney(d.earned) + '</td><td class="num">' + d.served + '</td><td class="num">' + d.lost + '</td><td class="num">' + d.stars + " of 3</td></tr>").join("") +
          "</tbody></table>"
        : '<p class="field-help">Finished days are listed here.</p>';
    }
  };

  // ---------------------------------------------------------------- game HUD, ticket, rail, hint
  UI.enterGame = function (opts) {
    UI.show("game");
    $("#hud-kicker").innerHTML = opts.kickerLead
      ? '<span class="k-lead">' + esc(opts.kickerLead) + ", </span>" + esc(opts.kicker)
      : esc(opts.kicker);
    $("#hud-name").textContent = opts.name;
    $("#ticket").hidden = !opts.ticket;
    $("#rail").hidden = !opts.rail;
    $("#hud-stats").innerHTML = "";
    $("#captions").innerHTML = "";
    UI.lastHint = "";
  };
  UI.ticketNo = 1;
  UI.renderTicket = function (session) {
    if (!session) return;
    const r = session.recipe;
    $("#ticket-no").textContent = "No. " + String(UI.ticketNo).padStart(3, "0");
    $("#ticket-name").textContent = r.name;
    $("#ticket-steps").innerHTML = r.steps.map((s, i) => {
      const res = session.results[i];
      const cls = res ? "is-done" : i === session.idx ? "is-now" : "";
      const q = res ? '<span class="q">' + Math.round(res.q * 100) + "%</span>" : '<span class="q"></span>';
      const note = res ? '<span class="note">' + esc(res.note) + "</span>" : "";
      return '<li class="' + cls + '"><span class="lbl">' + esc(s.label) + "</span>" + q + note + "</li>";
    }).join("");
    const done = session.results.length;
    $("#ticket-foot").innerHTML = "<span>" + done + " of " + r.steps.length + " done</span><span>" + (M.game.mode === "home" ? "No timer" : "Table " + ((session.ticket && session.ticket.table + 1) || "")) + "</span>";
    $("#ticket-time").textContent = M.profile.settings.camera === "first" ? "First person" : "Third person";
    const now = $(".ticket-steps .is-now");
    if (now && now.scrollIntoView) now.scrollIntoView({ block: "nearest", inline: "center" });
  };
  UI.setHint = function (step, text, status) {
    const key = step + "|" + text + "|" + status;
    if (key === UI.lastHint) return;
    UI.lastHint = key;
    $("#hint-step").textContent = step || "";
    $("#hint-text").textContent = text || "";
    $("#hint-status").textContent = status || "";
    $("#hint").hidden = !text;
  };
  UI.renderRestaurantHud = function (rs) {
    const goal = M.dayGoal(rs.day);
    const pct = M.clamp(rs.earned / goal[2], 0, 1);
    const left = Math.max(0, rs.duration - rs.time);
    const ticks = goal.map((g) => '<em style="left:' + Math.round((g / goal[2]) * 100) + '%"></em>').join("");
    const html =
      '<div class="hud-stat"><b>' + (left > 0 ? M.fmtTime(left) : "Closing") + "</b><span>Time left</span></div>" +
      '<div class="hud-stat"><b>' + M.fmtMoney(rs.earned) + '</b><span>Takings</span></div>' +
      '<div class="hud-stat opt"><div class="goalbar" title="Goal"><i style="width:' + Math.round(pct * 100) + '%"></i>' + ticks + '</div><span>Goal</span></div>' +
      '<div class="hud-stat opt"><b>' + M.profile.shop.reputation.toFixed(1) + "</b><span>Reputation</span></div>";
    const el = $("#hud-stats");
    if (el.innerHTML !== html) el.innerHTML = html;
  };
  UI.renderRail = function (rs) {
    const rail = $("#rail");
    const canCook = rs.role !== "server" && !rs.cook;
    const items = rs.tickets.filter((t) => t.state !== "served");
    const html = items.map((t) => {
      const r = M.recipeById(t.recipe);
      const c = rs.customers.find((x) => x.id === t.customer);
      const pat = c ? c.patience : 0;
      let st = "New";
      let cls = "";
      if (t.state === "npc") st = "Line cook " + Math.round(t.progress * 100) + "%";
      if (t.state === "cooking") {
        st = "You are cooking";
        cls = "cooking";
      }
      if (t.state === "ready") {
        st = "Ready to serve";
        cls = "ready";
      }
      const actionable = canCook && t.state === "new";
      const tableWord = rs.layout.fp ? "Seat " : "Table ";
      return '<button class="rail-ticket' + (actionable ? " can-cook" : "") + '" data-ticket="' + t.id + '"' + (actionable ? "" : ' tabindex="-1" aria-disabled="true"') + ">" +
        '<span class="st">' + tableWord + (t.table + 1) + "</span><b>" + esc(r.short) + '</b><span class="st ' + cls + '">' + st + "</span>" +
        '<span class="pbar"><i class="' + (pat < 0.3 ? "low" : "") + '" style="width:' + Math.round(pat * 100) + '%"></i></span>' +
        (actionable ? '<span class="act">Cook this</span>' : "") + "</button>";
    }).join("");
    if (rail.dataset.html !== html) {
      rail.dataset.html = html;
      rail.innerHTML = html;
    }
  };

  // ---------------------------------------------------------------- captions
  M.on("caption", (text) => {
    const box = $("#captions");
    if (!box || UI.current !== "game") return;
    // the same sound repeating refreshes its caption instead of stacking duplicates
    const same = Array.from(box.children).find((c) => c.textContent === text);
    if (same) same.remove();
    const el = document.createElement("div");
    el.className = "caption";
    el.textContent = text;
    box.appendChild(el);
    const limit = window.innerWidth < 700 ? 1 : 3;
    while (box.children.length > limit) box.removeChild(box.firstChild);
    setTimeout(() => el.remove(), 2500);
  });

  // ---------------------------------------------------------------- overlays
  UI.open = function (id) {
    const ov = $("#ov-" + id);
    if (!ov) return;
    if (id === "settings") UI.renderSettings();
    ov.hidden = false;
    paintIcons(ov);
    UI.openStack.push({ id, focus: document.activeElement });
    UI.syncInert();
    // the dialog opens on its main choice; the small Back pill at the top is one Tab (or tap) away
    const f = $("button:not(.sheet-back), input", ov);
    if (f) f.focus();
    M.emit("overlay", id);
  };
  UI.close = function (id) {
    const ov = $("#ov-" + id);
    if (!ov || ov.hidden) return;
    ov.hidden = true;
    const i = UI.openStack.findIndex((o) => o.id === id);
    if (i >= 0) {
      const prev = UI.openStack[i].focus;
      UI.openStack.splice(i, 1);
      UI.syncInert();
      if (prev && prev.focus) prev.focus();
    } else {
      UI.syncInert();
    }
    M.emit("overlay", null);
  };
  // Only the top dialog can be reached: screens and lower dialogs are inert while it is open.
  UI.syncInert = function () {
    const top = UI.topOverlay();
    $$(".screen").forEach((screen) => {
      screen.inert = !!top;
    });
    $$(".overlay").forEach((ov) => {
      ov.inert = !ov.hidden && ov.id !== "ov-" + top;
    });
  };
  UI.topOverlay = function () {
    const o = UI.openStack[UI.openStack.length - 1];
    return o ? o.id : null;
  };
  UI.renderSettings = function () {
    const s = M.profile.settings;
    $$("[data-slider]").forEach((inp) => {
      inp.value = s[inp.dataset.slider];
      if (!inp.dataset.bound) {
        inp.dataset.bound = "1";
        inp.addEventListener("input", () => {
          M.audio.unlock();
          s[inp.dataset.slider] = Number(inp.value);
          M.audio.applyVolumes();
          M.saveProfile();
        });
      }
    });
    const sampler = $("#sampler");
    if (sampler && !sampler.dataset.bound) {
      sampler.dataset.bound = "1";
      const picks = [
        ["chop-cucumber", "Cucumber"], ["chop-tomato", "Tomato"], ["chop-lettuce", "Lettuce"], ["chop-steak", "Steak"],
        ["crack", "Egg"], ["loop-sizzle", "Sizzle"], ["loop-pour", "Pour"], ["loop-stir-whisk", "Whisk"],
        ["loop-boil", "Boil"], ["shake", "Salt"], ["clink", "Plate"], ["ding", "Order bell"],
      ];
      sampler.innerHTML = picks.map(([id, label]) => '<button class="btn btn-ghost btn-small" data-preview="' + id + '">' + esc(label) + "</button>").join("");
      sampler.addEventListener("click", (e) => {
        const b = e.target.closest("[data-preview]");
        if (b) M.audio.preview(b.dataset.preview);
      });
    }
    bindSegs($("#ov-settings"));
    $("#swatches").innerHTML = M.SKINS.map((c, i) => '<button class="swatch" role="radio" aria-label="Skin tone ' + (i + 1) + '" aria-checked="' + (s.skin === i) + '" data-skin="' + i + '" style="background:' + c + '"></button>').join("");
    $$("[data-skin]").forEach((b) =>
      b.addEventListener("click", () => {
        s.skin = Number(b.dataset.skin);
        M.saveProfile();
        UI.renderSettings();
      })
    );
    $("#save-note").textContent = M.store.persistent ? "Progress is saved in this browser." : "This browser blocks storage here, so progress lasts until you close the page.";
  };

  UI.showResult = function (res) {
    const r = res.recipe;
    $("#result-img").src = M.dishImage(r.id, 320);
    $("#result-img").alt = r.name + ", plated";
    $("#result-h").textContent = r.name;
    $("#result-pct").textContent = Math.round(res.quality * 100) + "%";
    const q = res.quality;
    $("#result-word").textContent = q >= 0.9 ? "Restaurant quality" : q >= 0.75 ? "Lovely" : q >= 0.55 ? "Homestyle" : "Edible, and that counts";
    $("#result-notes").innerHTML = res.results.map((x, i) => "<li><span>" + esc(r.steps[i].label) + "</span><span>" + esc(x.note) + "</span></li>").join("");
    const c = M.profile.home.cooked[r.id];
    $("#result-saved").textContent = "Saved to your journal. Cooked " + c.count + (c.count === 1 ? " time" : " times") + ", best " + Math.round(c.best * 100) + "%.";
    UI.open("result");
  };

  UI.starSvg = function (on) {
    return '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="' + (on ? "#B4472B" : "none") + '" stroke="' + (on ? "#B4472B" : "#BFB5A4") + '" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  };
  UI.showDay = function (s) {
    $("#day-h").textContent = "Day " + s.day + " is done";
    $("#day-stars").innerHTML = [0, 1, 2].map((i) => UI.starSvg(i < s.stars)).join("");
    $("#day-stars-sr").textContent = s.stars + " of 3 stars";
    const rep = (s.repDelta >= 0 ? "+" : "") + s.repDelta.toFixed(2);
    $("#day-figures").innerHTML =
      "<dt>Takings</dt><dd>" + M.fmtMoney(s.earned) + "</dd>" +
      "<dt>of which tips</dt><dd>" + M.fmtMoney(s.tips) + "</dd>" +
      "<dt>Guests served</dt><dd>" + s.served + "</dd>" +
      "<dt>Guests who left</dt><dd>" + s.lost + "</dd>" +
      "<dt>Average dish</dt><dd>" + (s.served ? Math.round(s.avgQuality * 100) + "%" : "-") + "</dd>" +
      "<dt>Reputation</dt><dd>" + rep + "</dd>" +
      "<dt>Next goal</dt><dd>" + M.fmtMoney(M.dayGoal(s.day + 1)[1]) + "</dd>";
    UI.open("day");
  };

  // ---------------------------------------------------------------- wiring
  UI.init = function () {
    paintIcons(document);
    document.addEventListener("click", (e) => {
      const go = e.target.closest("[data-go]");
      if (go) {
        M.audio.unlock();
        M.audio.play("tick");
        UI.show(go.dataset.go);
        return;
      }
      const op = e.target.closest("[data-open]");
      if (op) {
        M.audio.unlock();
        UI.open(op.dataset.open);
        return;
      }
      const cl = e.target.closest("[data-close]");
      if (cl) {
        UI.close(cl.closest(".overlay").id.slice(3));
        return;
      }
      const act = e.target.closest("[data-act]");
      if (act) M.game.action(act.dataset.act);
      const tk = e.target.closest(".rail-ticket.can-cook");
      if (tk && M.game.restaurant) {
        M.audio.play("page");
        M.game.restaurant.openCook(Number(tk.dataset.ticket));
      }
      const tab = e.target.closest(".tabs [role=tab]");
      if (tab) {
        M.audio.play("tick");
        UI.renderTab(tab.dataset.tab);
      }
    });
    $$(".overlay").forEach((ov) =>
      ov.addEventListener("click", (e) => {
        if (e.target === ov && (ov.id === "ov-result" || ov.id === "ov-day")) {
          // results stay open on a stray tap; a small nudge and the lit note show it is on purpose
          const sheet = $(".sheet", ov);
          sheet.classList.remove("is-nudge");
          void sheet.offsetWidth;
          sheet.classList.add("is-nudge");
          return;
        }
        if (e.target === ov) {
          if (ov.id === "ov-pause") M.game.action("resume");
          else if (ov.id === "ov-leave") M.game.action("stay");
          else UI.close(ov.id.slice(3));
        }
      })
    );
    $("#btn-start").addEventListener("click", () => {
      M.audio.unlock();
      UI.show("home");
    });
    $("#btn-cook").addEventListener("click", () => M.game.startHome(UI.selectedRecipe));
    $("#btn-cook-m").addEventListener("click", () => M.game.startHome(UI.selectedRecipe));
    $("#btn-open-day").addEventListener("click", () => M.game.startDay(M.profile.shop.role || "server"));
    $("#btn-pause").addEventListener("click", () => M.game.pause());
    $("#btn-back").addEventListener("click", () => {
      M.audio.play("tick");
      M.game.back();
    });
    $("#btn-sound").addEventListener("click", () => {
      M.game.pause(true);
      UI.open("settings");
    });
    $("#btn-reset").addEventListener("click", () => {
      if (window.confirm("Reset all recipes, journal entries and restaurant progress?")) {
        M.resetProfile();
        UI.close("settings");
        UI.show("title");
      }
    });
    // focus trap inside dialogs
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const top = UI.topOverlay();
      if (!top) return;
      const ov = $("#ov-" + top);
      const f = $$("button:not([disabled]), input, [tabindex]:not([tabindex='-1'])", ov).filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    });
    UI.show("title");
  };
})();
