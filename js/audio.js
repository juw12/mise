/* Mise - procedural ASMR audio. No sample files: every sound is synthesised with Web Audio.
   Signal path: voice (per hit, Haas stereo spread) -> effects bus -> dry + small wooden-room convolver
   -> master -> soft high shelf -> gentle compressor -> speakers. */
(function () {
  "use strict";
  const M = window.Mise;

  const A = (M.audio = {
    ctx: null,
    ready: false,
    loops: {},
    lastCaption: {},
  });

  let master, fxBus, ambBus, radioBus, comp, soften, room, roomSend, loopBus, ambTone;
  let hitDetune = 1;
  let whiteBuf, pinkBuf, brownBuf;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const jit = (v, amt) => v * (1 + (Math.random() * 2 - 1) * amt);

  // Stereo noise: each channel is independent, so every noise-based texture has natural width.
  function makeNoise(ctx, kind) {
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === "white") {
          d[i] = w;
        } else if (kind === "pink") {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        }
      }
    }
    return buf;
  }

  // A small wooden kitchen: a few early reflections, then a short tail that darkens as it decays.
  function makeRoomIR(ctx) {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 0.7);
    const buf = ctx.createBuffer(2, len, sr);
    const early = [0.006, 0.011, 0.017, 0.023, 0.031, 0.043];
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        lp += (Math.random() * 2 - 1 - lp) * (0.35 - 0.25 * Math.min(1, t / 0.5));
        d[i] = lp * Math.exp(-t / 0.11) * 0.6;
      }
      early.forEach((e, k) => {
        const i = Math.floor((e + (c ? 0.0017 * (k % 2 ? 1 : -1) : 0)) * sr);
        if (i > 0 && i < len) d[i] += (k % 2 ? -1 : 1) * 0.5 * Math.pow(0.72, k);
      });
    }
    return buf;
  }

  function buildGraph(ctx) {
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 10;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    soften = ctx.createBiquadFilter();
    soften.type = "highshelf";
    soften.frequency.value = 7500;
    soften.gain.value = -4;
    master = ctx.createGain();
    fxBus = ctx.createGain();
    ambBus = ctx.createGain();
    radioBus = ctx.createGain();
    room = ctx.createConvolver();
    room.buffer = makeRoomIR(ctx);
    roomSend = ctx.createGain();
    roomSend.gain.value = 0.28;
    // Loops (sizzle, boil, stir, pour) share a bus that dips briefly under every one-shot,
    // so knife cuts and clinks always sit in front of the beds.
    loopBus = ctx.createGain();
    loopBus.connect(fxBus);
    // Ambience is darkened so rain, cafe and fire stay behind the kitchen.
    ambTone = ctx.createBiquadFilter();
    ambTone.type = "lowpass";
    ambTone.frequency.value = 4200;
    ambTone.Q.value = 0.5;
    fxBus.connect(master);
    fxBus.connect(roomSend);
    roomSend.connect(room);
    room.connect(master);
    ambBus.connect(ambTone);
    ambTone.connect(master);
    radioBus.connect(master);
    master.connect(soften);
    soften.connect(comp);
    comp.connect(ctx.destination);
    whiteBuf = makeNoise(ctx, "white");
    pinkBuf = makeNoise(ctx, "pink");
    brownBuf = makeNoise(ctx, "brown");
  }

  function markSoundOn() {
    if (typeof document === "undefined") return;
    document.querySelectorAll("[data-sound-state]").forEach((el) => {
      el.textContent = "Sound is on. Best with headphones.";
    });
  }

  A.unlock = function () {
    if (A.ctx) {
      if (A.ctx.state === "suspended") A.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      A.ctx = new Ctx({ latencyHint: "interactive" });
    } catch (e) {
      try {
        A.ctx = new Ctx();
      } catch (e2) {
        return;
      }
    }
    buildGraph(A.ctx);
    A.ready = true;
    A.applyVolumes();
    A.setAmbience(M.profile.settings.ambienceKind);
    A.setRadio(M.profile.settings.radioOn);
    if (A.ctx.state === "suspended") A.ctx.resume();
    markSoundOn();
  };

  // Browsers only allow audio after a gesture: the first tap, click or key press anywhere starts it.
  ["pointerdown", "keydown", "touchend"].forEach((ev) => window.addEventListener(ev, () => A.unlock(), { capture: true, passive: true }));

  A.applyVolumes = function () {
    if (!A.ready) return;
    const s = M.profile.settings;
    const t = A.ctx.currentTime;
    master.gain.setTargetAtTime(s.master, t, 0.05);
    fxBus.gain.setTargetAtTime(s.fx, t, 0.05);
    ambBus.gain.setTargetAtTime(s.ambience * 0.8, t, 0.2);
    radioBus.gain.setTargetAtTime(s.radioOn ? s.radio * 0.6 : 0, t, 0.3);
  };

  function caption(key, text) {
    if (!M.profile.settings.captions || !text) return;
    const now = performance.now();
    if (A.lastCaption[key] && now - A.lastCaption[key] < 1400) return;
    A.lastCaption[key] = now;
    M.emit("caption", text);
  }

  // ---------- building blocks ----------
  // One voice per sound: a direct copy and a 3-11 ms later copy on the other side (Haas effect),
  // so even a mono source feels close and wide on headphones. The side flips at random per hit.
  function voice(pan, gain, width, dest) {
    const ctx = A.ctx;
    const input = ctx.createGain();
    input.gain.value = gain == null ? 1 : gain;
    const bus = dest || fxBus;
    if (!ctx.createStereoPanner) {
      input.connect(bus);
      return input;
    }
    const p = M.clamp(pan || 0, -1, 1);
    const w = width == null ? 0.3 : width;
    const side = Math.random() < 0.5 ? -1 : 1;
    const direct = ctx.createStereoPanner();
    direct.pan.value = M.clamp(p + side * w * 0.5, -1, 1);
    const late = ctx.createStereoPanner();
    late.pan.value = M.clamp(p - side * w, -1, 1);
    const dly = ctx.createDelay(0.05);
    dly.delayTime.value = rnd(0.0035, 0.011);
    const lateGain = ctx.createGain();
    lateGain.gain.value = 0.6;
    input.connect(direct);
    direct.connect(bus);
    input.connect(dly);
    dly.connect(lateGain);
    lateGain.connect(late);
    late.connect(bus);
    return input;
  }

  // Filtered noise burst. o: buf, type, freq, freqTo, sweep, q, gain, attack, hold, decay, rate.
  function noise(dest, t, o) {
    const ctx = A.ctx;
    const src = ctx.createBufferSource();
    src.buffer = o.buf === "pink" ? pinkBuf : o.buf === "brown" ? brownBuf : whiteBuf;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.type || "bandpass";
    f.frequency.setValueAtTime(Math.min((o.freq || 2000) * hitDetune, 20000), t);
    if (o.freqTo) f.frequency.exponentialRampToValueAtTime(Math.min(o.freqTo * hitDetune, 20000), t + (o.sweep || o.decay || 0.1));
    f.Q.value = o.q == null ? 1 : o.q;
    const g = ctx.createGain();
    const a = o.attack || 0.0015;
    const h = o.hold || 0;
    const d = o.decay || 0.06;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.gain || 0.3, t + a);
    if (h) g.gain.setValueAtTime(o.gain || 0.3, t + a + h);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + h + d);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 2.5);
    src.stop(t + a + h + d + 0.03);
  }

  // Decaying sine partial. o: freq, to, glide, gain, attack, decay, wave.
  function osc(dest, t, o) {
    const ctx = A.ctx;
    const n = ctx.createOscillator();
    n.type = o.wave || "sine";
    n.frequency.setValueAtTime(Math.min(o.freq * hitDetune, 20000), t);
    if (o.to) n.frequency.exponentialRampToValueAtTime(Math.min(o.to * hitDetune, 20000), t + (o.glide || o.decay || 0.1));
    const g = ctx.createGain();
    const a = o.attack || 0.002;
    const d = o.decay || 0.2;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.gain || 0.2, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    n.connect(g);
    if (o.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = M.clamp(o.pan, -1, 1);
      g.connect(p);
      p.connect(dest);
    } else {
      g.connect(dest);
    }
    n.start(t);
    n.stop(t + a + d + 0.03);
  }

  // Legacy helper still used by the room beds.
  function tone(opts) {
    osc(opts.bus || fxBus, A.ctx.currentTime + (opts.delay || 0), opts);
  }

  // A cloud of tiny clicks: cell walls breaking, grains, crackles. Front-loaded in time.
  function grains(dest, t, n, span, lo, hi, gain, decay, q) {
    for (let i = 0; i < n; i++) {
      const u = Math.random();
      noise(dest, t + span * u * u, {
        freq: rnd(lo, hi),
        q: q || rnd(3, 7),
        gain: gain * rnd(0.35, 1),
        decay: decay * rnd(0.6, 1.4),
        attack: 0.0006,
      });
    }
  }

  // A water drop: the resonant bubble rises in pitch as it closes (Minnaert).
  function droplet(dest, t, f0, gain, pan) {
    osc(dest, t, { freq: f0, to: f0 * 2.3, glide: 0.03, decay: 0.045, gain, attack: 0.001, pan });
    noise(dest, t, { type: "lowpass", freq: 1200, gain: gain * 0.4, decay: 0.012 });
  }

  function bubble(dest, t, f0, gain, len, wide) {
    const d = len || rnd(0.03, 0.06);
    if (!wide) {
      osc(dest, t, { freq: f0, to: f0 * 1.6, glide: 0.035, decay: d, gain, attack: 0.001 });
      return;
    }
    const s = Math.random() < 0.5 ? -1 : 1;
    osc(dest, t, { freq: f0, to: f0 * 1.6, glide: 0.035, decay: d, gain: gain * 0.75, attack: 0.001, pan: -0.55 * s });
    osc(dest, t + 0.004, { freq: f0 * 1.04, to: f0 * 1.68, glide: 0.035, decay: d * 0.9, gain: gain * 0.5, attack: 0.001, pan: 0.7 * s });
  }

  // End-grain wooden board: a soft thump plus its first few resonant modes.
  function boardKnock(v, t, k, pitch, damp) {
    noise(v, t, { buf: "pink", type: "lowpass", freq: 1100 * pitch, q: 0.7, gain: 0.55 * k, decay: 0.03 * damp });
    [
      [182, 0.11, 0.34],
      [397, 0.075, 0.2],
      [671, 0.05, 0.12],
      [1104, 0.032, 0.07],
      [1690, 0.02, 0.04],
    ].forEach(([f, d, g]) => osc(v, t, { freq: jit(f * pitch, 0.03), decay: d * damp, gain: g * k, attack: 0.0008 }));
  }

  // The steel edge meeting the food: a very short bright click.
  function blade(v, t, k, bright) {
    noise(v, t, { type: "highpass", freq: 4200 * bright, q: 0.7, gain: 0.22 * k, decay: 0.007 });
  }

  // ---------- knife sounds per ingredient ----------
  const CHOP = {
    // Crisp and watery: a mid crunch band (1.2-3 kHz) over a full board knock.
    cucumber(v, t, k) {
      blade(v, t, k, 1);
      grains(v, t, 14, 0.024, 1600, 3200, 0.7 * k, 0.008, 3);
      noise(v, t + 0.006, { freq: 2300, q: 2, gain: 0.5 * k, decay: 0.03 });
      noise(v, t + 0.012, { freq: 2900, q: 3, gain: 0.3 * k, decay: 0.02 });
      boardKnock(v, t + 0.028, 0.32 * k, 0.85, 1);
      return "Knife through crisp cucumber";
    },
    // A thin hollow stem: one very bright snap and a small, high knock.
    scallion(v, t, k) {
      blade(v, t, 1.2 * k, 1.5);
      grains(v, t, 5, 0.01, 6000, 11000, 0.6 * k, 0.006, 5);
      noise(v, t, { type: "highpass", freq: 5000, gain: 0.28 * k, decay: 0.03 });
      osc(v, t + 0.003, { freq: 2600, to: 1900, decay: 0.012, gain: 0.08 * k });
      boardKnock(v, t + 0.01, 0.35 * k, 1.6, 0.5);
      return "Scallion snapping under the knife";
    },
    // Small dense clove: a tight, high-pitched tock with a sticky low smack.
    garlic(v, t, k) {
      blade(v, t, 0.6 * k, 0.8);
      noise(v, t, { type: "lowpass", freq: 520, q: 2, gain: 0.22 * k, decay: 0.03 });
      noise(v, t, { freq: 1250, q: 4, gain: 0.5 * k, decay: 0.022 });
      noise(v, t + 0.003, { freq: 2200, q: 5, gain: 0.26 * k, decay: 0.012 });
      osc(v, t, { freq: 1200, to: 1000, decay: 0.025, gain: 0.13 * k, pan: -0.5 });
      osc(v, t, { freq: 1236, to: 1030, decay: 0.022, gain: 0.09 * k, pan: 0.6 });
      grains(v, t + 0.002, 4, 0.01, 6500, 9500, 0.18 * k, 0.003, 6);
      boardKnock(v, t + 0.008, 0.72 * k, 1.5, 0.6);
      return "Garlic clove, sticky and crisp";
    },
    // Layers: two waves of squeaky crackle in the upper mids, then the board.
    onion(v, t, k) {
      blade(v, t, k, 1);
      grains(v, t, 8, 0.012, 3400, 6000, 0.55 * k, 0.007, 8);
      grains(v, t + 0.022, 8, 0.014, 3200, 5600, 0.48 * k, 0.007, 8);
      osc(v, t + 0.01, { freq: 4200, to: 4700, decay: 0.03, gain: 0.06 * k });
      noise(v, t + 0.004, { buf: "pink", type: "highpass", freq: 3200, gain: 0.2 * k, attack: 0.004, decay: 0.05 });
      boardKnock(v, t + 0.045, 0.35 * k, 1.2, 0.8);
      return "Onion layers giving way";
    },
    // Taut skin pop, then a soft wet slide and a few drops of juice.
    tomato(v, t, k) {
      noise(v, t, { freq: 3000, q: 4, gain: 0.32 * k, decay: 0.006 });
      noise(v, t + 0.008, { buf: "pink", freq: 900, freqTo: 220, sweep: 0.12, q: 1.5, gain: 0.68 * k, attack: 0.006, decay: 0.15 });
      noise(v, t + 0.01, { buf: "brown", type: "lowpass", freq: 260, gain: 0.45 * k, attack: 0.008, decay: 0.09 });
      for (let i = 0; i < 3; i++) droplet(v, t + rnd(0.09, 0.22), rnd(500, 820), 0.08 * k, i % 2 ? 0.7 : -0.7);
      boardKnock(v, t + 0.075, 0.28 * k, 0.75, 0.7);
      return "Soft tomato, a little juice";
    },
    // Airy and bright: a long spray of tiny cell-wall cracks, barely any board.
    lettuce(v, t, k) {
      grains(v, t, 22, 0.07, 4500, 12000, 0.34 * k, 0.003, 4);
      noise(v, t, { type: "highpass", freq: 6000, gain: 0.26 * k, attack: 0.01, decay: 0.08 });
      boardKnock(v, t + 0.06, 0.25 * k, 1.1, 0.6);
      return "Crisp lettuce crackling";
    },
    // A slow, low saw stroke through fibre, then a deep knock.
    steak(v, t, k) {
      noise(v, t, { buf: "pink", freq: 520, freqTo: 300, sweep: 0.15, q: 1.4, gain: 0.55 * k, attack: 0.02, decay: 0.16 });
      noise(v, t, { freq: 1500, freqTo: 950, sweep: 0.22, q: 1.4, gain: 0.7 * k, attack: 0.04, hold: 0.06, decay: 0.17 });
      grains(v, t + 0.02, 5, 0.12, 400, 900, 0.2 * k, 0.014, 2);
      boardKnock(v, t + 0.15, 0.5 * k, 0.62, 1);
      blade(v, t + 0.15, 0.7 * k, 0.8);
      return "Knife drawing through the steak";
    },
    // Silken and wet: a dark, damped press with almost no attack.
    tofu(v, t, k) {
      noise(v, t, { buf: "brown", type: "lowpass", freq: 380, q: 1.2, gain: 0.7 * k, attack: 0.012, decay: 0.06 });
      osc(v, t, { freq: 150, to: 110, decay: 0.07, gain: 0.25 * k, attack: 0.006 });
      noise(v, t + 0.02, { buf: "brown", type: "lowpass", freq: 240, gain: 0.4 * k, decay: 0.05 });
      noise(v, t + 0.03, { buf: "pink", freq: 700, freqTo: 340, sweep: 0.09, q: 2, gain: 0.16 * k, attack: 0.01, decay: 0.09 });
      return "Silken tofu, a soft press";
    },
    // Springy omelette: the blade bounces twice on a hollow, higher squeak; the board barely speaks.
    tamago(v, t, k) {
      noise(v, t, { freq: 2350, q: 6, gain: 0.5 * k, decay: 0.035 });
      osc(v, t, { freq: 2300, to: 1750, decay: 0.05, gain: 0.1 * k, pan: -0.5 });
      osc(v, t, { freq: 2330, to: 1780, decay: 0.045, gain: 0.07 * k, pan: 0.6 });
      osc(v, t + 0.06, { freq: 2050, to: 1600, decay: 0.04, gain: 0.08 * k });
      noise(v, t + 0.06, { freq: 2150, q: 6, gain: 0.24 * k, decay: 0.025 });
      noise(v, t + 0.01, { buf: "pink", freq: 650, q: 1.5, gain: 0.16 * k, attack: 0.006, decay: 0.06 });
      noise(v, t + 0.005, { buf: "brown", type: "lowpass", freq: 320, gain: 0.3 * k, attack: 0.004, decay: 0.05 });
      boardKnock(v, t + 0.03, 0.2 * k, 1.35, 0.6);
      return "Springy rolled omelette";
    },
  };

  // Per-sound trims keep one-shots inside a narrow loudness window (measured by tests/audio_probe.py).
  // Knife cuts are trimmed per ingredient (the variant), everything else per sound name.
  const TRIM = { scrape: 1.4, page: 1.5, flip: 0.7, tamago: 1.5, steak: 0.6, cucumber: 1.25, shake: 1.3, crack: 1.15 };
  const WIDTH = { tick: 0.1, select: 0.1, success: 0.15, "soft-fail": 0.1, bell: 0.55, ding: 0.7, coin: 0.6, plate: 0.55, clink: 0.5, chop: 0.45, bubble: 0.6, drip: 0.5, crack: 0.45 };
  // UI blips stay exact; everything physical varies a little in pitch and level per hit.
  const STEADY = { tick: 1, select: 1, success: 1, "soft-fail": 1 };

  // ---------- one-shot sounds ----------
  A.play = function (name, pan, intensity, variant) {
    if (!A.ready) return;
    const k = intensity == null ? 1 : intensity;
    const t = A.ctx.currentTime + 0.005;
    const steady = STEADY[name];
    const trimKey = name === "chop" ? variant || "cucumber" : name;
    const trim = (TRIM[trimKey] || 1) * (steady ? 1 : rnd(0.9, 1.06));
    const v = voice(pan, trim, WIDTH[name]);
    hitDetune = steady ? 1 : rnd(0.975, 1.025);
    if (!steady && loopBus) {
      loopBus.gain.cancelScheduledValues(t);
      loopBus.gain.setTargetAtTime(0.6, t, 0.008);
      loopBus.gain.setTargetAtTime(1, t + 0.09, 0.18);
    }
    try {
    switch (name) {
      case "chop": {
        const fx = CHOP[variant] || CHOP.cucumber;
        caption("chop", fx(v, t, k));
        break;
      }
      case "crack": {
        osc(v, t, { freq: jit(1450, 0.04), decay: 0.035, gain: 0.16 });
        osc(v, t, { freq: jit(3020, 0.04), decay: 0.02, gain: 0.07 });
        noise(v, t, { freq: 950, q: 6, gain: 0.3, decay: 0.035 });
        grains(v, t, 7 + Math.floor(rnd(0, 6)), 0.026, 2000, 5500, 0.55, 0.005);
        grains(v, t + 0.2, 8 + Math.floor(rnd(0, 6)), 0.08, 2600, 6500, 0.22, 0.004);
        noise(v, t + 0.22, { buf: "pink", freq: 520, freqTo: 260, sweep: 0.16, q: 1.6, gain: 0.2, attack: 0.02, decay: 0.16 });
        osc(v, t + 0.24, { freq: 300, to: 520, glide: 0.06, decay: 0.07, gain: 0.08 });
        caption("crack", "Egg tapped on the rim, shell opening");
        break;
      }
      case "drip": {
        const f0 = rnd(650, 950);
        droplet(v, t, f0, 0.32);
        noise(v, t, { buf: "pink", type: "lowpass", freq: 700, gain: 0.26, decay: 0.05 });
        noise(v, t, { freq: 2600, q: 2, gain: 0.08, decay: 0.012 });
        droplet(v, t + rnd(0.07, 0.12), f0 * rnd(1.3, 1.7), 0.1);
        caption("drip", "A soft plop");
        break;
      }
      case "clink": {
        const f = rnd(1050, 1250);
        noise(v, t, { freq: 4200, q: 1.2, gain: 0.22, decay: 0.005 });
        [
          [1, 0.55, 0.16],
          [2.32, 0.4, 0.09],
          [4.25, 0.25, 0.05],
          [6.63, 0.15, 0.03],
        ].forEach(([r, d, g]) => {
          osc(v, t, { freq: f * r * jit(1, 0.004), decay: d, gain: g });
          osc(v, t, { freq: f * r * 1.004, decay: d * 0.8, gain: g * 0.5 });
        });
        osc(v, t + 0.06, { freq: f * 2.32, decay: 0.2, gain: 0.04 });
        caption("clink", "Ceramic plate set down");
        break;
      }
      case "plate": {
        noise(v, t, { buf: "pink", type: "lowpass", freq: 500, gain: 0.5, decay: 0.05 });
        osc(v, t, { freq: 150, to: 110, decay: 0.08, gain: 0.25 });
        const f = rnd(820, 950);
        [0, 0.028, 0.05].forEach((dt, i) => {
          noise(v, t + dt, { freq: 3000, q: 1, gain: 0.12 / (i + 1), decay: 0.004 });
          [
            [1, 0.3, 0.08],
            [2.32, 0.2, 0.05],
            [4.25, 0.12, 0.025],
          ].forEach(([r, d, g]) => osc(v, t + dt, { freq: f * r, decay: d, gain: g / (i + 1) }));
        });
        caption("plate", "Plate on the counter");
        break;
      }
      case "shake": {
        for (let s = 0; s < 2; s++) {
          const ts = t + s * 0.16;
          noise(v, ts, { freq: 5200, q: 1.4, gain: 0.16, attack: 0.02, decay: 0.07 });
          noise(v, ts + 0.02, { buf: "pink", freq: 3600, q: 0.8, gain: 0.07, attack: 0.04, decay: 0.16 });
          grains(v, ts + 0.03, 18 + Math.floor(rnd(0, 8)), 0.14, 5000, 10000, 0.22, 0.003, 4);
          grains(v, ts + 0.07, 10 + Math.floor(rnd(0, 5)), 0.13, 2200, 4500, 0.14, 0.004, 5);
        }
        caption("shake", "Salt grains falling");
        break;
      }
      case "bubble": {
        bubble(v, t, rnd(180, 320), 0.4 * k, rnd(0.06, 0.09), true);
        noise(v, t, { type: "lowpass", freq: 900, gain: 0.08 * k, decay: 0.01 });
        break;
      }
      case "flip": {
        noise(v, t, { buf: "pink", freq: 450, freqTo: 1300, sweep: 0.12, q: 1.4, gain: 0.22, attack: 0.06, decay: 0.12 });
        noise(v, t + 0.2, { buf: "pink", type: "lowpass", freq: 800, gain: 0.55, decay: 0.05 });
        osc(v, t + 0.2, { freq: 130, to: 85, decay: 0.09, gain: 0.3 });
        osc(v, t + 0.2, { freq: 1870, decay: 0.25, gain: 0.03 });
        osc(v, t + 0.2, { freq: 2950, decay: 0.18, gain: 0.02 });
        noise(v, t + 0.21, { type: "highpass", freq: 3500, gain: 0.2, attack: 0.01, decay: 0.45 });
        grains(v, t + 0.22, 10, 0.35, 2500, 7000, 0.18, 0.006);
        caption("flip", "Flip and land in the pan");
        break;
      }
      case "scrape": {
        const n = 22;
        for (let i = 0; i < n; i++) {
          noise(v, t + i * 0.016 + rnd(0, 0.006), { freq: rnd(1500, 3200), q: rnd(2, 4), gain: 0.2 * (0.5 + 0.5 * Math.sin((Math.PI * i) / n)), decay: 0.012 });
        }
        noise(v, t, { buf: "pink", type: "lowpass", freq: 900, gain: 0.18, attack: 0.08, decay: 0.25 });
        caption("scrape", "Knife scraping the board");
        break;
      }
      case "tick": {
        osc(v, t, { freq: 1250, decay: 0.03, gain: 0.06 });
        noise(v, t, { freq: 3000, q: 2, gain: 0.05, decay: 0.004 });
        break;
      }
      case "select": {
        [660, 990].forEach((f, i) => {
          osc(v, t + i * 0.045, { freq: f, decay: 0.12, gain: 0.06 });
          osc(v, t + i * 0.045, { freq: f * 4, decay: 0.02, gain: 0.015 });
        });
        break;
      }
      case "coin": {
        [0, 0.07, 0.15].forEach((dt, i) => {
          const f = rnd(2600, 3600);
          noise(v, t + dt, { freq: 6000, q: 1, gain: 0.15, decay: 0.003 });
          [
            [1, 0.22, 0.09],
            [2.76, 0.14, 0.05],
            [5.4, 0.08, 0.025],
          ].forEach(([r, d, g]) => osc(v, t + dt, { freq: Math.min(f * r, 12000), decay: d, gain: g / (1 + i * 0.4) }));
        });
        noise(v, t, { buf: "pink", type: "lowpass", freq: 600, gain: 0.2, decay: 0.03 });
        caption("coin", "Coins on the counter");
        break;
      }
      case "bell": {
        [0, 0.18].forEach((dt, i) => {
          const f = rnd(1180, 1260);
          noise(v, t + dt, { freq: 5000, q: 1, gain: 0.1, decay: 0.004 });
          [
            [1, 1.2, 0.09],
            [2.0, 0.9, 0.05],
            [2.76, 0.7, 0.04],
            [5.4, 0.35, 0.02],
            [8.9, 0.2, 0.008],
          ].forEach(([r, d, g]) => {
            osc(v, t + dt, { freq: Math.min(f * r, 12000), decay: d, gain: g / (1 + i * 0.6), pan: -0.45 });
            osc(v, t + dt, { freq: Math.min(f * r * 1.003, 12000), decay: d * 0.9, gain: (g * 0.55) / (1 + i * 0.6), pan: 0.6 });
          });
        });
        caption("bell", "Door bell");
        break;
      }
      case "ding": {
        const f = 1560;
        noise(v, t, { freq: 6000, q: 1, gain: 0.12, decay: 0.003 });
        [
          [1, 1.4, 0.11],
          [2.71, 0.8, 0.05],
          [5.15, 0.4, 0.02],
        ].forEach(([r, d, g]) => {
          osc(v, t, { freq: f * r, decay: d, gain: g * 0.85, pan: -0.5 });
          osc(v, t, { freq: f * r * 1.0025, decay: d, gain: g * 0.65, pan: 0.65 });
        });
        caption("ding", "Order up");
        break;
      }
      case "success": {
        [523, 659, 784].forEach((f, i) => {
          osc(v, t + i * 0.09, { freq: f, decay: 0.5, gain: 0.06, wave: "triangle" });
          osc(v, t + i * 0.09, { freq: f * 4, decay: 0.03, gain: 0.01 });
        });
        break;
      }
      case "soft-fail": {
        osc(v, t, { freq: 300, to: 240, decay: 0.12, gain: 0.08, wave: "triangle" });
        noise(v, t, { buf: "pink", type: "lowpass", freq: 600, gain: 0.1, decay: 0.03 });
        break;
      }
      case "page": {
        for (let i = 0; i < 9; i++) {
          noise(v, t + i * 0.018 + rnd(0, 0.01), { buf: "pink", freq: rnd(2000, 5000), q: 1.2, gain: rnd(0.08, 0.2), decay: 0.02 });
        }
        noise(v, t, { buf: "pink", type: "highpass", freq: 1500, gain: 0.18, attack: 0.05, decay: 0.15 });
        noise(v, t + 0.16, { buf: "pink", type: "lowpass", freq: 400, gain: 0.3, decay: 0.05 });
        break;
      }
      case "steam": {
        noise(v, t, { buf: "pink", freq: 3800, freqTo: 1500, sweep: 0.7, q: 0.6, gain: 0.28, attack: 0.12, hold: 0.15, decay: 0.6 });
        noise(v, t + 0.05, { type: "highpass", freq: 6500, gain: 0.05, attack: 0.1, decay: 0.4 });
        caption("steam", "Steam rising");
        break;
      }
      case "chew": {
        noise(v, t, { buf: "pink", type: "lowpass", freq: 700, q: 1, gain: 0.08, decay: 0.05 });
        grains(v, t + 0.01, 3, 0.04, 1200, 2600, 0.04, 0.006);
        break;
      }
      default:
        break;
    }
    } finally {
      hitDetune = 1;
    }
  };

  // ---------- continuous loops ----------
  // A loop = steady filtered-noise beds + a scheduler that drops transient events (fat pops, bubbles,
  // whisk tines, rice grains) on the audio clock. The same event code renders offline for tests.
  const LOOP_PEAK = { sizzle: 0.21, boil: 0.27, pour: 0.36, stir: 0.3, simmer: 0.22 };
  const familyOf = (kind) => (kind.indexOf("stir") === 0 ? "stir" : kind);

  function makeLoop(kind, pan) {
    const ctx = A.ctx;
    const family = familyOf(kind);
    const out = voice(pan, 1, 0.35, loopBus);
    const g = ctx.createGain();
    g.gain.value = 0;
    const amp = ctx.createGain();
    amp.connect(g);
    g.connect(out);
    const ev = ctx.createGain();
    ev.gain.value = LOOP_PEAK[family] || 0.3;
    ev.connect(out);
    const node = { kind, family, tool: kind.split("-")[1] || "spoon", level: 0, extra: 0, g, amp, srcs: [], next: ctx.currentTime, pan: pan || 0 };
    node.scatter = [-0.45, 0, 0.45].map((o) => {
      if (!ctx.createStereoPanner) return ev;
      const p = ctx.createStereoPanner();
      p.pan.value = M.clamp(node.pan + o, -1, 1);
      p.connect(ev);
      return p;
    });
    const bed = (buf, type, freq, q, gain) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const bg = ctx.createGain();
      bg.gain.value = gain;
      s.connect(f);
      f.connect(bg);
      bg.connect(amp);
      s.start(ctx.currentTime, Math.random() * 2.5);
      node.srcs.push(s);
      return { s, f, g: bg, base: freq };
    };
    const lfo = (rate, depth, param) => {
      const o = ctx.createOscillator();
      o.frequency.value = rate;
      const lg = ctx.createGain();
      lg.gain.value = depth;
      o.connect(lg);
      lg.connect(param);
      o.start(ctx.currentTime);
      node.srcs.push(o);
      return o;
    };
    if (family === "sizzle") {
      node.hiss = bed(whiteBuf, "bandpass", 4500, 0.55, 0.6);
      bed(pinkBuf, "bandpass", 1700, 0.8, 0.38);
      bed(pinkBuf, "lowpass", 700, 0.7, 0.14);
      lfo(rnd(5, 9), 0.12, node.hiss.g.gain);
    } else if (family === "boil") {
      bed(brownBuf, "lowpass", 450, 0.7, 0.9);
      bed(pinkBuf, "bandpass", 900, 1, 0.12);
    } else if (family === "pour") {
      node.stream = bed(pinkBuf, "bandpass", 900, 1.2, 0.6);
      node.cav = bed(pinkBuf, "bandpass", 600, 14, 1.4);
      amp.gain.value = 0.8;
      node.glug = lfo(5.5, 0.3, amp.gain);
    } else if (family === "simmer") {
      bed(brownBuf, "lowpass", 300, 0.7, 1);
    } else if (node.tool === "whisk") {
      node.swish = bed(pinkBuf, "bandpass", 3400, 1.8, 0.6);
      bed(brownBuf, "lowpass", 380, 0.8, 0.5);
      lfo(3, 0.25, amp.gain);
    } else if (node.tool === "chopsticks") {
      node.swish = bed(pinkBuf, "lowpass", 650, 0.8, 0.16);
    } else if (node.tool === "spatula") {
      node.swish = bed(whiteBuf, "bandpass", 2600, 2, 0.35);
      bed(pinkBuf, "lowpass", 700, 0.8, 0.3);
    } else if (node.tool === "tongs") {
      node.swish = bed(pinkBuf, "bandpass", 2200, 1.2, 0.9);
    } else if (node.tool === "ladle") {
      node.swish = bed(pinkBuf, "bandpass", 420, 1.4, 1.1);
      bed(whiteBuf, "bandpass", 2500, 3, 0.1);
      lfo(0.8, 0.45, amp.gain);
    } else {
      node.swish = bed(pinkBuf, "lowpass", 650, 0.9, 0.9);
      bed(brownBuf, "lowpass", 300, 0.7, 0.4);
      lfo(1.2, 0.35, amp.gain);
    }
    node.set = function (level, extra) {
      node.level = level;
      if (extra != null) node.extra = extra;
      const t = ctx.currentTime;
      g.gain.setTargetAtTime(level * (LOOP_PEAK[family] || 0.3), t, 0.08);
      if (family === "pour" && extra != null) {
        node.stream.f.frequency.setTargetAtTime(600 + extra * 1200, t, 0.1);
        node.cav.f.frequency.setTargetAtTime(380 + extra * 1500, t, 0.1);
      }
      if (family === "stir" && extra != null && node.swish) node.swish.f.frequency.setTargetAtTime(node.swish.base * (0.7 + extra * 0.9), t, 0.05);
      if (family === "sizzle" && extra != null) node.hiss.f.frequency.setTargetAtTime(4500 - extra * 1800, t, 0.2);
    };
    node.stop = function () {
      node.level = 0;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      setTimeout(() => {
        node.srcs.forEach((s) => {
          try {
            s.stop();
          } catch (e) {
            /* already stopped */
          }
        });
      }, 700);
    };
    return node;
  }

  const spot = (node) => node.scatter[(Math.random() * node.scatter.length) | 0];

  // Each tick schedules one event at time t and returns the gap to the next one (seconds).
  const STIR_TICKS = {
    whisk(node, t, L) {
      const d = spot(node);
      noise(d, t, { freq: rnd(3000, 6000), q: rnd(5, 9), gain: 0.55 * L * rnd(0.4, 1), decay: 0.005, attack: 0.0005 });
      if (Math.random() < 0.16) osc(d, t, { freq: rnd(3800, 4400), decay: 0.06, gain: 0.08 * L });
      return rnd(0.6, 1.4) / (8 + 24 * L);
    },
    chopsticks(node, t, L) {
      const d = spot(node);
      osc(d, t, { freq: rnd(2400, 3200), decay: 0.035, gain: 0.26 * L });
      noise(d, t, { freq: 3800, q: 2, gain: 0.35 * L, decay: 0.006 });
      if (Math.random() < 0.5) noise(d, t + 0.01, { buf: "pink", type: "lowpass", freq: 800, gain: 0.2 * L, decay: 0.04 });
      return rnd(0.7, 1.3) / (5 + 10 * L);
    },
    spatula(node, t, L) {
      const d = spot(node);
      grains(d, t, 4, 0.05, 4000, 8000, 0.25 * L, 0.004);
      if (Math.random() < 0.35) noise(d, t, { freq: rnd(2000, 3000), q: 3, gain: 0.3 * L, attack: 0.03, decay: 0.12 });
      return rnd(0.05, 0.12) / Math.max(0.3, L);
    },
    tongs(node, t, L) {
      const d = spot(node);
      grains(d, t, 3, 0.04, 1500, 3500, 0.4 * L, 0.007, 2);
      if (Math.random() < 0.12) {
        osc(d, t, { freq: 3200, decay: 0.04, gain: 0.08 * L });
        osc(d, t, { freq: 5150, decay: 0.03, gain: 0.04 * L });
      }
      return rnd(0.03, 0.08) / Math.max(0.3, L);
    },
    spoon(node, t, L) {
      const d = spot(node);
      if (Math.random() < 0.15) {
        const f = rnd(1650, 1800);
        osc(d, t, { freq: f, decay: 0.15, gain: 0.1 * L });
        osc(d, t, { freq: f * 2.6, decay: 0.08, gain: 0.04 * L });
      } else {
        droplet(d, t, rnd(300, 600), 0.08 * L);
      }
      return rnd(0.12, 0.3) / Math.max(0.3, L);
    },
  };
  // Ladle in broth: a slosh that rises and falls, and the steel bowl tinking the pot rim.
  STIR_TICKS.ladle = function (node, t, L) {
    const d = spot(node);
    if (Math.random() < 0.18) {
      const f = rnd(2300, 2600);
      osc(d, t, { freq: f, decay: 0.18, gain: 0.09 * L });
      osc(d, t, { freq: f * 2.76, decay: 0.09, gain: 0.04 * L });
    } else {
      noise(d, t, { buf: "pink", freq: rnd(300, 600), q: 2, gain: 0.35 * L, attack: 0.02, decay: 0.1 });
    }
    return rnd(0.12, 0.28) / Math.max(0.3, L);
  };

  const TICKS = {
    sizzle(node, t) {
      const L = node.level;
      if (L > 0.05) {
        const d = spot(node);
        if (Math.random() < 0.85) {
          noise(d, t, { freq: rnd(2200, 6500), q: rnd(1, 3), gain: 0.5 * L * rnd(0.3, 1), decay: rnd(0.002, 0.008), attack: 0.0005 });
        } else {
          noise(d, t, { freq: rnd(1200, 2400), q: 1.5, gain: 0.7 * L, decay: 0.018, attack: 0.0005 });
          grains(d, t + 0.01, 3, 0.04, 3000, 7000, 0.35 * L, 0.004);
        }
      }
      return rnd(0.008, 0.05) / Math.max(0.25, L);
    },
    boil(node, t) {
      const L = node.level;
      if (L > 0.05) {
        const d = spot(node);
        if (Math.random() < 0.1) {
          const f = rnd(110, 220);
          bubble(d, t, f, 0.5 * L, 0.12);
          noise(d, t, { type: "lowpass", freq: 350, gain: 0.3 * L, decay: 0.08 });
        } else {
          const f = rnd(250, 900);
          bubble(d, t, f, 0.35 * L * rnd(0.4, 1) * Math.sqrt(400 / f), 0, true);
        }
      }
      return rnd(0.015, 0.07) / Math.max(0.3, L);
    },
    pour(node, t) {
      const L = node.level;
      if (L > 0.1) {
        node.glug.frequency.setTargetAtTime(rnd(4, 8), t, 0.1);
        if (Math.random() < 0.6) droplet(spot(node), t, (380 + node.extra * 1500) * rnd(1.2, 1.8), 0.12 * L);
      }
      return rnd(0.06, 0.16);
    },
    simmer(node, t) {
      const L = node.level;
      if (L > 0.05 && Math.random() < 0.5) bubble(spot(node), t, rnd(200, 450), 0.25 * L);
      return rnd(0.15, 0.4);
    },
    stir(node, t) {
      const L = node.level;
      if (L <= 0.05) return 0.05;
      return (STIR_TICKS[node.tool] || STIR_TICKS.spoon)(node, t, L);
    },
  };

  function runTicks(node, until) {
    let guard = 0;
    while (node.next < until && guard++ < 96) {
      node.next += Math.max(0.004, TICKS[node.family](node, node.next));
    }
  }

  let schedTimer = null;
  function ensureScheduler() {
    if (schedTimer) return;
    schedTimer = setInterval(() => {
      if (!A.ready) return;
      const now = A.ctx.currentTime;
      Object.keys(A.loops).forEach((id) => {
        const node = A.loops[id];
        if (node.next < now - 0.05) node.next = now;
        runTicks(node, now + 0.12);
      });
    }, 30);
  }

  const loopCaptions = {
    sizzle: "Oil sizzling and popping",
    boil: "Water at a rolling boil",
    pour: "Pouring, the pitch rising as it fills",
    stir: "Spoon around the bowl",
    "stir-spoon": "Spoon around the bowl",
    "stir-whisk": "Whisk tines clicking through batter",
    "stir-chopsticks": "Chopsticks beating eggs against the bowl",
    "stir-spatula": "Spatula tossing rice in the pan",
    "stir-tongs": "Tongs tossing crisp leaves",
    "stir-ladle": "Ladle swirling the broth",
    simmer: "Low simmer",
  };

  A.loop = function (id, kind, level, extra, pan) {
    if (!A.ready) return;
    let node = A.loops[id];
    if (node && node.kind !== kind) {
      A.stopLoop(id);
      node = null;
    }
    if (!node) {
      node = A.loops[id] = makeLoop(kind, pan);
      ensureScheduler();
    }
    node.set(level, extra);
    if (level > 0.15) caption(kind, loopCaptions[kind]);
  };

  A.stopLoop = function (id) {
    const node = A.loops[id];
    if (node) {
      node.stop();
      delete A.loops[id];
    }
  };

  A.stopAllLoops = function () {
    Object.keys(A.loops).forEach(A.stopLoop);
  };

  // ---------- catalogue, previews and offline rendering ----------
  const ONESHOTS = [
    ["crack", "Egg crack"], ["drip", "Plop"], ["clink", "Ceramic clink"], ["plate", "Plate set down"],
    ["shake", "Salt shake"], ["bubble", "Bubble"], ["flip", "Flip in the pan"], ["scrape", "Knife scrape"],
    ["coin", "Coins"], ["bell", "Door bell"], ["ding", "Order up"], ["steam", "Steam"], ["page", "Page turn"],
  ];
  const CHOP_LIST = ["cucumber", "scallion", "garlic", "onion", "tomato", "lettuce", "steak", "tofu", "tamago"];
  const LOOP_LIST = [
    ["sizzle", "Oil sizzle"], ["boil", "Rolling boil"], ["pour", "Pouring"], ["stir-whisk", "Whisk in batter"],
    ["stir-chopsticks", "Chopsticks beating egg"], ["stir-spatula", "Spatula and rice"], ["stir-tongs", "Tongs and leaves"],
    ["stir-ladle", "Ladle in broth"],
  ];
  A.catalog = ONESHOTS.map(([n, label]) => ({ id: n, label, kind: "play", args: [n, 0, 1], ms: n === "bell" || n === "ding" ? 1600 : 1100, group: "oneshot" }))
    .concat(CHOP_LIST.map((ing) => ({ id: "chop-" + ing, label: "Knife: " + ing, kind: "play", args: ["chop", 0, 1, ing], ms: 700, group: "chop" })))
    .concat(LOOP_LIST.map(([k, label]) => ({ id: "loop-" + k, label, kind: "loop", args: [k, 0.85, 0.5], ms: 2200, group: "loop" })));

  let previewTimer = null;
  A.preview = function (id) {
    A.unlock();
    const item = A.catalog.find((c) => c.id === id);
    if (!item || !A.ready) return;
    if (item.kind === "play") {
      A.play.apply(null, item.args);
    } else {
      A.loop("preview", item.args[0], item.args[1], item.args[2], 0);
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => A.stopLoop("preview"), 2200);
    }
  };

  // Renders one catalogue entry through the same synthesis code into an OfflineAudioContext,
  // so sounds can be measured and exported even where no audio device exists.
  A.renderOffline = function (id) {
    const item = A.catalog.find((c) => c.id === id);
    if (!item) return Promise.reject(new Error("unknown sound " + id));
    const sr = 48000;
    const seconds = item.ms / 1000 + 0.4;
    const off = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
    const saved = { ctx: A.ctx, ready: A.ready, master, fxBus, ambBus, radioBus, comp, soften, room, roomSend, loopBus, ambTone, whiteBuf, pinkBuf, brownBuf, captions: M.profile.settings.captions };
    A.ctx = off;
    A.ready = true;
    buildGraph(off);
    M.profile.settings.captions = false;
    try {
      if (item.kind === "play") {
        A.play.apply(null, item.args);
      } else {
        A.renderLoopOffline(item.args[0], item.args[1], item.args[2], item.ms / 1000);
      }
    } finally {
      A.ctx = saved.ctx;
      A.ready = saved.ready;
      master = saved.master;
      fxBus = saved.fxBus;
      ambBus = saved.ambBus;
      radioBus = saved.radioBus;
      comp = saved.comp;
      soften = saved.soften;
      room = saved.room;
      roomSend = saved.roomSend;
      loopBus = saved.loopBus;
      ambTone = saved.ambTone;
      whiteBuf = saved.whiteBuf;
      pinkBuf = saved.pinkBuf;
      brownBuf = saved.brownBuf;
      M.profile.settings.captions = saved.captions;
    }
    return off.startRendering().then((buf) => ({ l: Array.from(buf.getChannelData(0)), r: Array.from(buf.getChannelData(1)), sr }));
  };

  A.renderLoopOffline = function (kind, level, extra, seconds) {
    const node = makeLoop(kind, 0);
    node.set(level, extra);
    const peak = (LOOP_PEAK[node.family] || 0.3) * level;
    node.g.gain.cancelScheduledValues(0);
    node.g.gain.setValueAtTime(0, 0);
    node.g.gain.setTargetAtTime(peak, 0, 0.08);
    node.g.gain.setTargetAtTime(0, seconds, 0.12);
    node.next = 0.02;
    runTicks(node, seconds);
    node.srcs.forEach((s) => s.stop(seconds + 0.5));
    return A.ctx;
  };

  // ---------- ambience beds ----------
  let amb = null;
  A.setAmbience = function (kind) {
    M.profile.settings.ambienceKind = kind;
    if (!A.ready) return;
    if (amb) {
      amb.stop();
      amb = null;
    }
    if (kind === "off") return;
    const ctx = A.ctx;
    const nodes = [];
    const timers = [];
    const bed = (buf, type, freq, q, gain) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q || 0.7;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(gain, ctx.currentTime, 1.2);
      s.connect(f);
      f.connect(g);
      g.connect(ambBus);
      s.start(0, Math.random() * 2);
      nodes.push({ s, g, f });
      return { s, f, g };
    };
    const drop = (busGain) => {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const f0 = 1800 + Math.random() * 2600;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 0.03);
      const g = ctx.createGain();
      g.gain.setValueAtTime(busGain * Math.random(), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      o.connect(g);
      if (p) {
        p.pan.value = Math.random() * 2 - 1;
        g.connect(p);
        p.connect(ambBus);
      } else {
        g.connect(ambBus);
      }
      o.start(t);
      o.stop(t + 0.06);
    };
    if (kind === "rain") {
      bed(pinkBuf, "lowpass", 1400, 0.5, 0.5);
      bed(whiteBuf, "highpass", 6000, 0.5, 0.05);
      timers.push(setInterval(() => drop(0.03), 60));
    } else if (kind === "cafe") {
      const murmur = bed(brownBuf, "bandpass", 420, 0.8, 0.55);
      bed(pinkBuf, "lowpass", 900, 0.5, 0.08);
      let ph = 0;
      timers.push(
        setInterval(() => {
          ph += 0.2;
          murmur.f.frequency.setTargetAtTime(380 + Math.sin(ph) * 80 + Math.random() * 60, ctx.currentTime, 0.3);
          if (Math.random() < 0.05) {
            [2600, 4100].forEach((f, i) => tone({ freq: f * (0.95 + Math.random() * 0.1), gain: 0.012 / (i + 1), decay: 0.4, bus: ambBus }));
          }
        }, 300)
      );
    } else if (kind === "fire") {
      bed(brownBuf, "lowpass", 380, 0.7, 0.5);
      timers.push(
        setInterval(() => {
          if (Math.random() < 0.35) {
            const t = ctx.currentTime;
            const s = ctx.createBufferSource();
            s.buffer = whiteBuf;
            const f = ctx.createBiquadFilter();
            f.type = "bandpass";
            f.frequency.value = 1500 + Math.random() * 3000;
            f.Q.value = 3;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.1 * Math.random(), t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
            s.connect(f);
            f.connect(g);
            g.connect(ambBus);
            s.start(t, Math.random());
            s.stop(t + 0.05);
          }
        }, 90)
      );
    } else if (kind === "night") {
      bed(brownBuf, "lowpass", 250, 0.5, 0.25);
      timers.push(
        setInterval(() => {
          if (Math.random() < 0.5) {
            for (let i = 0; i < 3; i++) tone({ freq: 4400 + Math.random() * 200, gain: 0.008, decay: 0.03, delay: i * 0.05, bus: ambBus });
          }
        }, 700)
      );
    }
    amb = {
      stop() {
        timers.forEach(clearInterval);
        nodes.forEach((n) => {
          n.g.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
          setTimeout(() => {
            try {
              n.s.stop();
            } catch (e) {
              /* stopped */
            }
          }, 1800);
        });
      },
    };
  };

  // ---------- generative lo-fi radio ----------
  let radioTimer = null;
  let radioStep = 0;
  const chords = [
    [174.61, 220.0, 261.63, 329.63], // Fmaj7
    [164.81, 196.0, 246.94, 293.66], // Em7
    [146.83, 174.61, 220.0, 261.63], // Dm7
    [130.81, 164.81, 196.0, 246.94], // Cmaj7
  ];
  const melodyScale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

  function radioNote(freq, start, dur, gain, wave) {
    const ctx = A.ctx;
    const o = ctx.createOscillator();
    o.type = wave || "triangle";
    o.frequency.value = freq;
    o.detune.value = Math.random() * 8 - 4;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.08);
    g.gain.setTargetAtTime(0, start + dur * 0.7, dur * 0.25);
    o.connect(f);
    f.connect(g);
    g.connect(radioBus);
    o.start(start);
    o.stop(start + dur + 1);
  }

  A.setRadio = function (on) {
    M.profile.settings.radioOn = !!on;
    if (!A.ready) return;
    A.applyVolumes();
    if (radioTimer) {
      clearInterval(radioTimer);
      radioTimer = null;
    }
    if (!on) return;
    const beat = 60 / 70;
    let next = A.ctx.currentTime + 0.2;
    radioTimer = setInterval(() => {
      const ctx = A.ctx;
      while (next < ctx.currentTime + 1.5) {
        const bar = Math.floor(radioStep / 4) % chords.length;
        const beatInBar = radioStep % 4;
        const chord = chords[bar];
        if (beatInBar === 0) {
          chord.forEach((f) => radioNote(f, next, beat * 4, 0.035, "triangle"));
          radioNote(chord[0] / 2, next, beat * 2, 0.06, "sine");
        }
        if (beatInBar === 2) radioNote(chord[0] / 2, next, beat * 2, 0.045, "sine");
        if (Math.random() < 0.38) radioNote(M.pick(melodyScale), next + (Math.random() < 0.5 ? 0 : beat / 2), beat * 1.5, 0.02, "sine");
        // soft brushed hat
        const s = ctx.createBufferSource();
        s.buffer = whiteBuf;
        const hf = ctx.createBiquadFilter();
        hf.type = "highpass";
        hf.frequency.value = 7000;
        const hg = ctx.createGain();
        hg.gain.setValueAtTime(beatInBar % 2 ? 0.012 : 0.006, next);
        hg.gain.exponentialRampToValueAtTime(0.0001, next + 0.06);
        s.connect(hf);
        hf.connect(hg);
        hg.connect(radioBus);
        s.start(next, Math.random());
        s.stop(next + 0.08);
        next += beat;
        radioStep++;
      }
    }, 250);
  };
})();
