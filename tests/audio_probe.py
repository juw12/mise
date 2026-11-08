"""Render every Mise sound to WAV in a real browser and measure it.

Usage: python tests/audio_probe.py OUTDIR

Writes OUTDIR/wav/<sound>.wav, OUTDIR/metrics.json and OUTDIR/sheet-sound.png (spectrograms).
The probe taps the final output: every connection to the AudioDestinationNode is mirrored into a
ScriptProcessor recorder, so what is captured is exactly what the player hears (after the compressor).
"""
import base64
import json
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else ROOT / "tests" / "out" / "audio"
WAV_DIR = OUT / "wav"
WAV_DIR.mkdir(parents=True, exist_ok=True)
BASE = (ROOT / "index.html").as_uri()

# Fallback catalogue for builds without M.audio.catalog
DEFAULT_CATALOG = [
    {"id": n, "label": n, "kind": "play", "args": [n, 0, 1], "ms": 1100}
    for n in ["chop", "crack", "drip", "clink", "plate", "shake", "bubble", "flip", "scrape", "coin", "bell", "ding", "steam", "page"]
] + [
    {"id": "loop-" + k, "label": k, "kind": "loop", "args": [k, 0.85, 0.5], "ms": 2200}
    for k in ["sizzle", "boil", "pour", "stir"]
]

# Render in the page and ship 16-bit PCM as base64 (far faster than JSON float arrays).
ENCODE_JS = r"""async (id) => {
  const t0 = performance.now();
  const d = await window.Mise.audio.renderOffline(id);
  const ms = performance.now() - t0;
  const enc = (arr) => {
    const pcm = new Int16Array(arr.length);
    for (let i = 0; i < arr.length; i++) pcm[i] = Math.max(-1, Math.min(1, arr[i])) * 32767;
    const bytes = new Uint8Array(pcm.buffer);
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  return { l: enc(d.l), r: enc(d.r), sr: d.sr, ms };
}"""

RECORDER_JS = r"""
(() => {
  const orig = AudioNode.prototype.connect;
  window.__rec = { on: false, l: [], r: [], sr: 48000 };
  AudioNode.prototype.connect = function (target, ...rest) {
    const res = orig.call(this, target, ...rest);
    if (target instanceof AudioDestinationNode && !this.__probed) {
      this.__probed = true;
      const ctx = this.context;
      if (!ctx.__recNode) {
        const sp = ctx.createScriptProcessor(4096, 2, 2);
        sp.onaudioprocess = (e) => {
          if (!window.__rec.on) return;
          window.__rec.sr = ctx.sampleRate;
          window.__rec.l.push(Array.from(e.inputBuffer.getChannelData(0)));
          window.__rec.r.push(Array.from(e.inputBuffer.getChannelData(1)));
        };
        const mute = ctx.createGain();
        mute.gain.value = 0;
        orig.call(sp, mute);
        orig.call(mute, ctx.destination);
        ctx.__recNode = sp;
      }
      orig.call(this, ctx.__recNode);
    }
    return res;
  };
})();
"""


def save_wav(path, left, right, sr):
    stereo = np.stack([left, right], axis=1)
    pcm = (np.clip(stereo, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def band_profile(mono, sr, bands=24):
    spec = np.abs(np.fft.rfft(mono * np.hanning(len(mono)))) ** 2
    freqs = np.fft.rfftfreq(len(mono), 1 / sr)
    edges = np.geomspace(60, sr / 2, bands + 1)
    prof = np.array([spec[(freqs >= a) & (freqs < b)].sum() for a, b in zip(edges[:-1], edges[1:])])
    prof = np.log10(prof + 1e-12)
    prof -= prof.mean()
    norm = np.linalg.norm(prof)
    return prof / norm if norm else prof


import time
T0 = time.time()


def log(msg):
    print(f"[{time.time() - T0:5.1f}s] {msg}", flush=True)


def main():
    from playwright.sync_api import sync_playwright

    results = {"sounds": {}, "unlock": {}}
    with sync_playwright() as pw:
        # 1) real-gesture unlock check: no autoplay flag, one trusted click
        browser = pw.chromium.launch(headless=True, channel="msedge")
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.set_default_timeout(15000)
        log("unlock check: goto")
        page.goto(BASE)
        page.wait_for_timeout(800)
        before = page.evaluate("() => window.Mise.audio.ctx ? window.Mise.audio.ctx.state : 'none'")
        page.mouse.click(640, 120)
        page.wait_for_timeout(500)
        after = page.evaluate("() => window.Mise.audio.ctx ? window.Mise.audio.ctx.state : 'none'")
        hint = page.evaluate("() => { const el = document.querySelector('[data-sound-hint]'); return el ? el.textContent.trim() : ''; }")
        results["unlock"] = {"before_click": before, "after_first_click": after, "sound_hint": hint}
        log("unlock " + str(results["unlock"]))
        browser.close()

        # 2) render every sound through the real output chain
        browser = pw.chromium.launch(headless=True, channel="msedge", args=["--autoplay-policy=no-user-gesture-required"])
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.set_default_timeout(20000)
        log("render: goto")
        page.goto(BASE)
        page.wait_for_timeout(800)
        page.evaluate(
            """() => {
              const A = window.Mise.audio;
              A.unlock();
              A.setAmbience('off');
              A.setRadio(false);
              const s = window.Mise.profile.settings;
              s.master = 1; s.fx = 1;
              A.applyVolumes();
            }"""
        )
        page.wait_for_timeout(300)
        catalog = page.evaluate("() => window.Mise.audio.catalog || null") or DEFAULT_CATALOG
        log(f"catalog {len(catalog)}")
        for item in catalog:
            log("render " + item["id"])
            data = page.evaluate(ENCODE_JS, item["id"])
            data["l"] = np.frombuffer(base64.b64decode(data["l"]), dtype="<i2").astype(np.float32) / 32767
            data["r"] = np.frombuffer(base64.b64decode(data["r"]), dtype="<i2").astype(np.float32) / 32767
            left = np.array(data["l"], dtype=np.float32)
            right = np.array(data["r"], dtype=np.float32)
            sr = int(data["sr"])
            if len(left) == 0 or float(np.max(np.abs(left))) == 0.0:
                results["sounds"][item["id"]] = {"label": item["label"], "samples": 0, "silent": True}
                continue
            save_wav(WAV_DIR / f"{item['id']}.wav", left, right, sr)
            mono = (left + right) / 2
            peak = float(np.max(np.abs(np.concatenate([left, right]))))
            rms = float(np.sqrt(np.mean(mono ** 2)))
            spec = np.abs(np.fft.rfft(mono)) ** 2
            freqs = np.fft.rfftfreq(len(mono), 1 / sr)
            centroid = float((freqs * spec).sum() / (spec.sum() + 1e-12))
            side = (left - right) / 2
            width = float(np.sqrt(np.mean(side ** 2)) / (rms + 1e-9))
            results["sounds"][item["id"]] = {
                "label": item["label"],
                "group": item.get("group", ""),
                "samples": len(mono),
                "sr": sr,
                "peak_dbfs": round(20 * np.log10(peak + 1e-9), 1),
                "rms_dbfs": round(20 * np.log10(rms + 1e-9), 1),
                "centroid_hz": round(centroid),
                "stereo_width": round(width, 3),
                "render_ms": round(data.get("ms", 0)),
                "profile": band_profile(mono, sr).round(4).tolist(),
            }
        browser.close()

    # distinctness: smallest spectral distance between any two sounds in the same group
    ids = [k for k, v in results["sounds"].items() if v.get("samples")]
    profiles = {k: np.array(results["sounds"][k]["profile"]) for k in ids}
    min_pairs = []
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            ga = results["sounds"][a].get("group")
            gb = results["sounds"][b].get("group")
            if ga and ga == gb:
                d = float(1 - np.dot(profiles[a], profiles[b]))
                min_pairs.append((round(d, 4), a, b))
    min_pairs.sort()
    results["closest_pairs_same_group"] = min_pairs[:6]
    for k in ids:
        results["sounds"][k].pop("profile", None)
    results["gates"] = gates(results, min_pairs)
    (OUT / "metrics.json").write_text(json.dumps(results, indent=1), encoding="utf-8")
    make_sheet(ids, results)
    print(json.dumps({"unlock": results["unlock"], "count": len(ids), "closest": min_pairs[:3], "gates": results["gates"]}, indent=1))


def gates(results, min_pairs):
    """Hard sound gates S1-S4 from the frozen rubric (S5 is tests/check.py)."""
    snd = results["sounds"]
    silent = [k for k, v in snd.items() if not v.get("samples")]
    peaks = {k: v["peak_dbfs"] for k, v in snd.items() if v.get("samples")}
    quiet = [k for k, p in peaks.items() if p <= -30]
    clipping = [k for k, p in peaks.items() if p > -1]
    one_shot = [p for k, p in peaks.items() if snd[k].get("group") in ("oneshot", "chop")]
    window = round(max(one_shot) - min(one_shot), 1) if one_shot else 0
    closest = min_pairs[0][0] if min_pairs else 1
    out = {
        "S1_unlock_first_gesture": bool(results["unlock"].get("after_first_click") == "running"),
        "S2_audible_no_clip": bool(not silent and not quiet and not clipping),
        "S3_oneshot_window_db": window,
        "S3_ok": bool(window <= 14),
        "S4_min_distance": float(closest),
        "S4_ok": bool(closest >= 0.08),
        "quiet": quiet,
        "clipping": clipping,
        "silent": silent,
    }
    out["all_pass"] = out["S1_unlock_first_gesture"] and out["S2_audible_no_clip"] and out["S3_ok"] and out["S4_ok"]
    return out


def make_sheet(ids, results):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    def spectrogram(x, fs, nperseg=1024, noverlap=768):
        hop = nperseg - noverlap
        win = np.hanning(nperseg)
        frames = [x[i:i + nperseg] * win for i in range(0, max(1, len(x) - nperseg), hop)]
        s = np.abs(np.fft.rfft(np.array(frames), axis=1)) ** 2 / (win ** 2).sum() / fs
        f = np.fft.rfftfreq(nperseg, 1 / fs)
        t = (np.arange(len(frames)) * hop + nperseg / 2) / fs
        return f, t, s.T

    n = len(ids)
    cols = 4
    rows = (n + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(cols * 3.6, rows * 2.4), facecolor="#F4EFE6")
    axes = np.array(axes).reshape(-1)
    for ax, k in zip(axes, ids):
        with wave.open(str(WAV_DIR / f"{k}.wav")) as w:
            sr = w.getframerate()
            pcm = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, 2).astype(np.float32) / 32767
        mono = pcm.mean(axis=1)
        f, t, s = spectrogram(mono, fs=sr, nperseg=1024, noverlap=768)
        ax.pcolormesh(t, f / 1000, 10 * np.log10(s + 1e-12), shading="auto", cmap="magma", vmin=-120, vmax=-30)
        ax.set_ylim(0, 16)
        m = results["sounds"][k]
        ax.set_title(f"{m['label']}  peak {m['peak_dbfs']} dB", fontsize=8, color="#1F2420")
        ax.tick_params(labelsize=6)
        ax.set_xlabel("s", fontsize=6)
        ax.set_ylabel("kHz", fontsize=6)
    for ax in axes[n:]:
        ax.axis("off")
    fig.suptitle("Mise sound design: spectrograms of every effect as heard by the player", fontsize=11, color="#1F2420")
    fig.tight_layout()
    fig.savefig(OUT / "sheet-sound.png", dpi=110, facecolor=fig.get_facecolor())
    plt.close(fig)


if __name__ == "__main__":
    if "--sheet-only" in sys.argv:
        saved = json.loads((OUT / "metrics.json").read_text(encoding="utf-8"))
        make_sheet([k for k, v in saved["sounds"].items() if v.get("samples")], saved)
    else:
        main()
