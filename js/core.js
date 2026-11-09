/* Mise - core utilities, safe storage and persistent profile. */
(function () {
  "use strict";

  const M = (window.Mise = window.Mise || {});

  // ---------- math helpers ----------
  M.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  M.lerp = (a, b, t) => a + (b - a) * t;
  M.rand = (a, b) => a + Math.random() * (b - a);
  M.randInt = (a, b) => Math.floor(M.rand(a, b + 1));
  M.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  M.ease = (t) => 1 - Math.pow(1 - M.clamp(t, 0, 1), 3);
  M.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  M.inRect = (x, y, r) => x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
  M.fmtMoney = (n) => "$" + Math.round(n).toLocaleString("en-US");
  M.fmtTime = (s) => {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };

  // ---------- storage that never throws (file://, sandboxed iframes, private mode) ----------
  const memory = {};
  function storageOk() {
    try {
      const k = "__mise_probe__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }
  const persistent = storageOk();
  M.store = {
    persistent,
    get(key) {
      try {
        return persistent ? window.localStorage.getItem(key) : memory[key] ?? null;
      } catch (e) {
        return memory[key] ?? null;
      }
    },
    set(key, value) {
      memory[key] = value;
      try {
        if (persistent) window.localStorage.setItem(key, value);
      } catch (e) {
        /* quota or denied: keep the in-memory copy */
      }
    },
    remove(key) {
      delete memory[key];
      try {
        if (persistent) window.localStorage.removeItem(key);
      } catch (e) {
        /* ignore */
      }
    },
  };

  // ---------- profile ----------
  const SAVE_KEY = "mise.save.v1";

  M.defaultProfile = () => ({
    version: 1,
    settings: {
      master: 0.8,
      fx: 0.9,
      ambience: 0.5,
      radio: 0.35,
      ambienceKind: "rain",
      radioOn: true,
      captions: true,
      hints: true,
      reduceMotion: false,
      skin: 1,
      camera: "first",
      timeOfDay: "evening",
    },
    tips: { back: false }, // one-time hints already shown
    home: {
      cooked: {}, // recipeId -> { count, best }
      journal: [], // { recipeId, quality, notes, at }
    },
    shop: {
      day: 1,
      coins: 60,
      reputation: 1.0, // 0..5
      bestDay: 0,
      totalServed: 0,
      upgrades: {}, // upgradeId -> level
      menu: ["fried_rice", "salad", "tamagoyaki"],
      prices: {}, // recipeId -> multiplier (0.8..1.4)
      stock: { produce: 14, protein: 10, pantry: 16, dairy: 8 },
      staff: {},
      history: [], // last days
    },
  });

  function merge(base, extra) {
    if (!extra || typeof extra !== "object") return base;
    for (const k of Object.keys(base)) {
      if (!(k in extra)) continue;
      if (base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
        base[k] = merge(base[k], extra[k]);
      } else {
        base[k] = extra[k];
      }
    }
    // keep dynamic keys such as cooked recipes / upgrade levels
    for (const k of Object.keys(extra)) {
      if (!(k in base)) base[k] = extra[k];
    }
    return base;
  }

  M.loadProfile = () => {
    const raw = M.store.get(SAVE_KEY);
    let p = M.defaultProfile();
    if (raw) {
      try {
        p = merge(p, JSON.parse(raw));
      } catch (e) {
        /* corrupt save: start fresh */
      }
    }
    return p;
  };

  M.saveProfile = () => {
    if (!M.profile) return;
    M.store.set(SAVE_KEY, JSON.stringify(M.profile));
  };

  M.resetProfile = () => {
    M.store.remove(SAVE_KEY);
    M.profile = M.defaultProfile();
    M.saveProfile();
  };

  M.profile = M.loadProfile();

  // ---------- tiny event bus ----------
  const handlers = {};
  M.on = (name, fn) => {
    (handlers[name] = handlers[name] || []).push(fn);
  };
  M.emit = (name, data) => {
    (handlers[name] || []).forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error(e);
      }
    });
  };
})();
