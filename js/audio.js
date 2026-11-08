/* Mise - procedural ASMR audio. No sample files: every sound is synthesised with Web Audio. */
(function () {
  "use strict";
  const M = window.Mise;

  const A = (M.audio = {
    ctx: null,
    ready: false,
    loops: {},
    lastCaption: {},
  });

  let master, fxBus, ambBus, radioBus, comp;
  let whiteBuf, pinkBuf, brownBuf;

  function makeNoise(ctx, kind) {
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
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
    return buf;
  }

  A.unlock = function () {
    if (A.ctx) {
      if (A.ctx.state === "suspended") A.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      A.ctx = new Ctx();
    } catch (e) {
      return;
    }
    const ctx = A.ctx;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master = ctx.createGain();
    fxBus = ctx.createGain();
    ambBus = ctx.createGain();
    radioBus = ctx.createGain();
    fxBus.connect(master);
    ambBus.connect(master);
    radioBus.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);
    whiteBuf = makeNoise(ctx, "white");
    pinkBuf = makeNoise(ctx, "pink");
    brownBuf = makeNoise(ctx, "brown");
    A.ready = true;
    A.applyVolumes();
    A.setAmbience(M.profile.settings.ambienceKind);
    A.setRadio(M.profile.settings.radioOn);
  };

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
    if (!M.profile.settings.captions) return;
    const now = performance.now();
    if (A.lastCaption[key] && now - A.lastCaption[key] < 1400) return;
    A.lastCaption[key] = now;
    M.emit("caption", text);
  }

  function out(pan) {
    const p = A.ctx.createStereoPanner ? A.ctx.createStereoPanner() : null;
    if (p) {
      p.pan.value = M.clamp(pan || 0, -1, 1);
      p.connect(fxBus);
      return p;
    }
    return fxBus;
  }

  function noiseHit(opts) {
    const ctx = A.ctx;
    const t = ctx.currentTime + (opts.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = opts.buf || whiteBuf;
    src.playbackRate.value = opts.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = opts.type || "bandpass";
    f.frequency.value = opts.freq || 2000;
    f.Q.value = opts.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain || 0.5, t + (opts.attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (opts.attack || 0.002) + (opts.decay || 0.08));
    src.connect(f);
    f.connect(g);
    g.connect(out(opts.pan));
    src.start(t, Math.random() * 2);
    src.stop(t + (opts.attack || 0.002) + (opts.decay || 0.08) + 0.05);
  }

  function tone(opts) {
    const ctx = A.ctx;
    const t = ctx.currentTime + (opts.delay || 0);
    const o = ctx.createOscillator();
    o.type = opts.wave || "sine";
    o.frequency.setValueAtTime(opts.freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + (opts.glide || opts.decay || 0.1));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain || 0.2, t + (opts.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (opts.attack || 0.004) + (opts.decay || 0.2));
    o.connect(g);
    g.connect(opts.bus || out(opts.pan));
    o.start(t);
    o.stop(t + (opts.attack || 0.004) + (opts.decay || 0.2) + 0.05);
  }

  // ---------- one-shot sounds ----------
  A.play = function (name, pan, intensity) {
    if (!A.ready) return;
    const k = intensity == null ? 1 : intensity;
    switch (name) {
      case "chop": {
        // knife through food, then the board knock
        noiseHit({ freq: 3200, q: 0.8, gain: 0.25 * k, decay: 0.035, pan });
        noiseHit({ freq: 900, q: 1.4, gain: 0.35 * k, decay: 0.06, delay: 0.012, pan });
        tone({ freq: 170, to: 90, gain: 0.35 * k, decay: 0.09, delay: 0.012, pan });
        caption("chop", "Knife on the wooden board");
        break;
      }
      case "crack": {
        for (let i = 0; i < 4; i++) {
          noiseHit({ freq: 2500 + Math.random() * 2500, q: 3, gain: 0.3, decay: 0.02, delay: i * 0.018, pan });
        }
        tone({ freq: 320, to: 180, gain: 0.12, decay: 0.05, pan });
        caption("crack", "Egg shell cracking");
        break;
      }
      case "drip": {
        tone({ freq: 700, to: 1400, gain: 0.12, decay: 0.08, glide: 0.06, pan });
        break;
      }
      case "clink": {
        [2210, 3370, 4930, 6120].forEach((f, i) => tone({ freq: f * (0.98 + Math.random() * 0.04), gain: 0.07 / (i + 1), decay: 0.6 - i * 0.1, pan }));
        caption("clink", "Ceramic plate set down");
        break;
      }
      case "plate": {
        tone({ freq: 210, to: 120, gain: 0.25, decay: 0.12, pan });
        [1880, 2960, 4210].forEach((f, i) => tone({ freq: f, gain: 0.05 / (i + 1), decay: 0.45, pan }));
        caption("plate", "Plate on the counter");
        break;
      }
      case "shake": {
        for (let i = 0; i < 7; i++) {
          noiseHit({ freq: 5000 + Math.random() * 3000, q: 2, gain: 0.12, decay: 0.025, delay: i * 0.022 + Math.random() * 0.01, pan });
        }
        caption("shake", "Salt grains falling");
        break;
      }
      case "bubble": {
        const f = 300 + Math.random() * 500;
        tone({ freq: f, to: f * 2.4, gain: 0.08 * k, decay: 0.06, glide: 0.05, pan });
        break;
      }
      case "flip": {
        noiseHit({ freq: 600, q: 0.6, gain: 0.25, attack: 0.05, decay: 0.15, buf: pinkBuf, pan });
        tone({ freq: 140, to: 80, gain: 0.3, decay: 0.12, delay: 0.18, pan });
        caption("flip", "Flip and land in the pan");
        break;
      }
      case "scrape": {
        noiseHit({ freq: 2400, q: 4, gain: 0.18, attack: 0.03, decay: 0.2, pan });
        caption("scrape", "Knife scraping the board");
        break;
      }
      case "tick": {
        tone({ freq: 1600, gain: 0.05, decay: 0.03, bus: fxBus });
        break;
      }
      case "select": {
        tone({ freq: 660, gain: 0.06, decay: 0.08, bus: fxBus });
        tone({ freq: 990, gain: 0.04, decay: 0.1, delay: 0.04, bus: fxBus });
        break;
      }
      case "coin": {
        tone({ freq: 1320, gain: 0.08, decay: 0.15, pan });
        tone({ freq: 1760, gain: 0.08, decay: 0.3, delay: 0.07, pan });
        caption("coin", "Coins on the counter");
        break;
      }
      case "bell": {
        [1046, 2093, 3140, 4190].forEach((f, i) => tone({ freq: f, gain: 0.08 / (i + 1), decay: 1.2 - i * 0.2, pan }));
        caption("bell", "Door bell");
        break;
      }
      case "ding": {
        [1568, 3136].forEach((f, i) => tone({ freq: f, gain: 0.09 / (i + 1), decay: 0.9, pan }));
        caption("ding", "Order up");
        break;
      }
      case "success": {
        [523, 659, 784].forEach((f, i) => tone({ freq: f, gain: 0.07, decay: 0.5, delay: i * 0.09, wave: "triangle", bus: fxBus }));
        break;
      }
      case "soft-fail": {
        tone({ freq: 330, to: 260, gain: 0.07, decay: 0.3, wave: "triangle", bus: fxBus });
        break;
      }
      case "page": {
        noiseHit({ freq: 3000, q: 0.5, gain: 0.08, attack: 0.04, decay: 0.12, buf: pinkBuf, pan });
        break;
      }
      case "steam": {
        noiseHit({ freq: 5000, q: 0.4, type: "highpass", gain: 0.14, attack: 0.2, decay: 0.6, pan });
        caption("steam", "Steam rising");
        break;
      }
      case "chew": {
        noiseHit({ freq: 700, q: 1, gain: 0.05, decay: 0.05, pan });
        break;
      }
      default:
        break;
    }
  };

  // ---------- continuous loops (sizzle, boil, pour, stir) ----------
  function makeLoop(kind, pan) {
    const ctx = A.ctx;
    const src = ctx.createBufferSource();
    src.loop = true;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    g.gain.value = 0;
    let crackleTimer = null;
    const node = { kind, level: 0, src, f, g };
    if (kind === "sizzle") {
      src.buffer = whiteBuf;
      f.type = "highpass";
      f.frequency.value = 3800;
      crackleTimer = setInterval(() => {
        if (node.level > 0.05 && Math.random() < node.level) {
          noiseHit({ freq: 3000 + Math.random() * 4000, q: 6, gain: 0.12 * node.level, decay: 0.012, pan: (pan || 0) + Math.random() * 0.4 - 0.2 });
        }
      }, 45);
    } else if (kind === "boil") {
      src.buffer = brownBuf;
      f.type = "lowpass";
      f.frequency.value = 500;
      crackleTimer = setInterval(() => {
        if (node.level > 0.05 && Math.random() < node.level * 0.8) A.play("bubble", (pan || 0) + Math.random() * 0.3 - 0.15, node.level);
      }, 70);
    } else if (kind === "pour") {
      src.buffer = pinkBuf;
      f.type = "bandpass";
      f.Q.value = 2.5;
      f.frequency.value = 900;
    } else if (kind === "stir") {
      src.buffer = pinkBuf;
      f.type = "bandpass";
      f.Q.value = 1.2;
      f.frequency.value = 1400;
    } else if (kind === "simmer") {
      src.buffer = brownBuf;
      f.type = "lowpass";
      f.frequency.value = 300;
    }
    src.connect(f);
    f.connect(g);
    g.connect(out(pan));
    src.start(0, Math.random() * 2);
    node.set = function (level, extra) {
      node.level = level;
      const t = ctx.currentTime;
      const peak = { sizzle: 0.22, boil: 0.35, pour: 0.5, stir: 0.35, simmer: 0.3 }[kind] || 0.3;
      g.gain.setTargetAtTime(level * peak, t, 0.08);
      if (kind === "pour" && extra != null) f.frequency.setTargetAtTime(600 + extra * 1400, t, 0.1);
      if (kind === "stir" && extra != null) f.frequency.setTargetAtTime(900 + extra * 1800, t, 0.05);
      if (kind === "sizzle" && extra != null) f.frequency.setTargetAtTime(4500 - extra * 1800, t, 0.2);
    };
    node.stop = function () {
      clearInterval(crackleTimer);
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      setTimeout(() => {
        try {
          src.stop();
        } catch (e) {
          /* already stopped */
        }
      }, 600);
    };
    return node;
  }

  const loopCaptions = {
    sizzle: "Oil sizzling",
    boil: "Water at a rolling boil",
    pour: "Pouring",
    stir: "Spoon around the bowl",
    simmer: "Low simmer",
  };

  A.loop = function (id, kind, level, extra, pan) {
    if (!A.ready) return;
    let node = A.loops[id];
    if (!node) {
      node = A.loops[id] = makeLoop(kind, pan);
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
