# -*- coding: utf-8 -*-
"""Звуковое оформление: обработка голоса, генеративная музыка с дакингом под речь, эффекты (whoosh/pop/sting).
Запуск: python3 audio.py <timeline.json> <narration.wav> <out.wav> [seed]
"""
import json, os, subprocess, sys, wave
import numpy as np

SR = 48000
LEAD = 0.35

def read_wav(path):
    with wave.open(path) as w:
        sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return sr, x

def write_wav(path, x, sr=SR):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(sr); w.writeframes((x * 32767).astype(np.int16).tobytes())

def lowpass(x, fc, sr=SR):
    a = 1 - np.exp(-2 * np.pi * fc / sr); y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s += a * (x[i] - s); y[i] = s
    return y

def smooth_env(env, ms_a=15, ms_r=300, sr=SR):
    # быстрая атака, медленный спад — для дакинга
    ka = 1 - np.exp(-1 / (ms_a * 1e-3 * sr)); kr = 1 - np.exp(-1 / (ms_r * 1e-3 * sr)); out = np.empty_like(env); s = 0.0
    for i in range(len(env)):
        e = env[i]; s += (ka if e > s else kr) * (e - s); out[i] = s
    return out

# ---------- голос ----------
def process_voice(src, tmp):
    out = tmp + ".voice.wav"
    af = "highpass=f=75,equalizer=f=220:t=q:w=1.0:g=-1.5,equalizer=f=3200:t=q:w=1.0:g=2.5,equalizer=f=7500:t=q:w=1.5:g=1.5,acompressor=threshold=-22dB:ratio=2.8:attack=8:release=140:makeup=5,aresample=%d" % SR
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af", af, "-ac", "1", out], check=True)
    sr, x = read_wav(out); os.remove(out); return x

# ---------- музыка ----------
NOTE = lambda m: 440.0 * 2 ** ((m - 69) / 12)
_PC = {}
def pad_note(freq, dur, rng):
    k = (round(freq, 2), round(dur, 2))
    if k in _PC: return _PC[k]
    n = int(dur * SR); t = np.arange(n) / SR; y = np.zeros(n, np.float32)
    for det in (-0.004, 0.0, 0.004):
        for h, amp in ((1, 1.0), (2, 0.5), (3, 0.28), (4, 0.15), (5, 0.08)):
            y += amp * np.sin(2 * np.pi * freq * (1 + det) * h * t + rng.uniform(0, 6.28)).astype(np.float32) / 3
    a = np.minimum(1, t / 0.9); r = np.minimum(1, (dur - t) / 1.1); _PC[k] = y * a * r; return _PC[k]

_PL = {}
def pluck(freq, dur, rng):
    k = (round(freq, 2), round(dur, 2))
    if k in _PL: return _PL[k]
    n = int(dur * SR); t = np.arange(n) / SR; y = np.zeros(n, np.float32)
    for h, amp in ((1, 1.0), (2, 0.45), (3, 0.2), (4, 0.1)):
        y += amp * np.sin(2 * np.pi * freq * h * t) * np.exp(-t * (3.2 + h * 1.6))
    _PL[k] = y * np.minimum(1, t / 0.004); return _PL[k]

def music(total, tl, seed):
    rng = np.random.default_rng(seed); n = int(total * SR) + SR; L = np.zeros(n, np.float32); R = np.zeros(n, np.float32)
    bpm = 76; beat = 60 / bpm; bar = beat * 4
    key = [0, 2, 3, 5, 7, 9, 10][seed % 7]                       # транспонирование
    # прогрессия: C G Am F (I V vi IV), в тёмных сценах начинаем с Am (даёт более «космический» оттенок)
    chords = [(48, [0, 4, 7]), (43, [0, 4, 7]), (45, [0, 3, 7]), (41, [0, 4, 7])]
    dark_spans = [(s["start"], s["end"]) for s in tl["scenes"] if s.get("dark")]
    isdark = lambda t: any(a <= t < b for a, b in dark_spans)
    nb = int(total / bar) + 2
    for b in range(nb):
        t0 = b * bar; ci = (b + (2 if isdark(t0) else 0)) % 4; root, ints = chords[ci]; root += key
        # пэд
        for iv in ints + [12]:
            p = pad_note(NOTE(root + 12 + iv), bar + 1.2, rng) * 0.055; i0 = int(t0 * SR); seg = min(len(p), n - i0)
            if seg > 0: L[i0:i0 + seg] += p[:seg] * 0.95; R[i0:i0 + seg] += p[:seg] * 1.0
        # бас
        for q in range(4):
            if q in (0, 2):
                bs = pluck(NOTE(root), beat * 1.8, rng) * 0.16; i0 = int((t0 + q * beat) * SR); seg = min(len(bs), n - i0)
                if seg > 0: L[i0:i0 + seg] += bs[:seg]; R[i0:i0 + seg] += bs[:seg]
        # арпеджио (восьмые), часть нот пропускаем
        pat = [0, 1, 2, 1, 2, 3, 2, 1]
        for q in range(8):
            if rng.random() < 0.22: continue
            iv = (ints + [12])[pat[q] % 4]; fr = NOTE(root + 24 + iv); pl = pluck(fr, 1.4, rng) * 0.075 * (0.7 + 0.3 * rng.random())
            i0 = int((t0 + q * beat / 2) * SR); seg = min(len(pl), n - i0); pan = 0.5 + 0.35 * np.sin(q * 1.7)
            if seg > 0: L[i0:i0 + seg] += pl[:seg] * (1 - pan) * 1.4; R[i0:i0 + seg] += pl[:seg] * pan * 1.4
    # лёгкое эхо (пинг-понг), «воздух»
    d = int(beat * 0.75 * SR)
    for k, g in enumerate((0.34, 0.18, 0.09), 1):
        L[d * k:] += R[:-d * k] * g; R[d * k:] += L[:-d * k] * g
    return np.stack([L, R], 1)[: int(total * SR)]

# ---------- эффекты ----------
def whoosh(dur=0.9, rng=None):
    n = int(dur * SR); x = rng.standard_normal(n).astype(np.float32); t = np.linspace(0, 1, n)
    fc = 300 + 5000 * np.sin(np.pi * t) ** 1.5; y = np.empty(n, np.float32); s = 0.0
    for i in range(n):
        a = 1 - np.exp(-2 * np.pi * fc[i] / SR); s += a * (x[i] - s); y[i] = s
    env = np.sin(np.pi * t) ** 2; return y * env * 1.6

def pop(freq=700, dur=0.16):
    n = int(dur * SR); t = np.arange(n) / SR; f = freq * np.exp(-t * 14); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 28)).astype(np.float32)

def sparkle():
    out = np.zeros(int(1.6 * SR), np.float32)
    for k, m in enumerate([76, 79, 83, 88, 91]):
        fr = NOTE(m); n = int(0.9 * SR); t = np.arange(n) / SR; y = (np.sin(2 * np.pi * fr * t) + 0.3 * np.sin(2 * np.pi * fr * 2 * t)) * np.exp(-t * 4.5) * 0.18
        i0 = int(k * 0.09 * SR); out[i0:i0 + n] += y[: len(out) - i0]
    return out

def add(buf, x, t, g=1.0, pan=0.5):
    i0 = int(t * SR);
    if i0 < 0: x = x[-i0:]; i0 = 0
    seg = min(len(x), len(buf) - i0)
    if seg > 0: buf[i0:i0 + seg, 0] += x[:seg] * g * (1 - pan) * 1.4; buf[i0:i0 + seg, 1] += x[:seg] * g * pan * 1.4

def main():
    tl_path, nar, out = sys.argv[1:4]; seed = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    tl = json.load(open(tl_path, encoding="utf-8")); total = tl["total"]; rng = np.random.default_rng(seed)
    voice = process_voice(nar, out); N = int(total * SR) + SR
    v = np.zeros(N, np.float32); v[: len(voice)] = voice[:N]
    # огибающая речи для дакинга
    env = np.convolve(np.abs(v), np.ones(int(0.02 * SR)) / int(0.02 * SR), mode="same")[::24]
    duck_s = smooth_env(env.astype(np.float32), 20, 450, SR / 24); duck = np.interp(np.arange(N), np.arange(len(duck_s)) * 24, duck_s)
    duck = np.clip(duck / 0.06, 0, 1)
    mus = music(total, tl, seed); M = np.zeros((N, 2), np.float32); M[: len(mus)] = mus[:N]
    mg = 0.85 * (1 - 0.72 * duck)[:, None]
    # на заставках без речи музыка чуть громче
    sfx = np.zeros((N, 2), np.float32)
    for sc in tl["scenes"]:
        if sc is not tl["scenes"][0]: add(sfx, whoosh(0.9, rng), sc["start"] - LEAD - 0.75, 0.30, 0.5)
        for b in sc["beats"][1:]:
            if sc.get("type") in ("hero", "quiz"): continue
            add(sfx, pop(620 + 120 * rng.random()), b["start"] - LEAD + 0.03, 0.085, 0.3 + 0.4 * rng.random())
    add(sfx, sparkle(), 0.2, 0.5, 0.5); add(sfx, sparkle(), total - 3.6, 0.45, 0.5)
    sp = duck > 0.6
    rms = lambda a: float(np.sqrt(np.mean(a ** 2)) + 1e-9)
    vdb = 20 * np.log10(rms(v[sp])); mdb = 20 * np.log10(rms((M * mg)[sp])); sdb = 20 * np.log10(rms(sfx[np.abs(sfx[:, 0]) > 1e-4]) if np.any(np.abs(sfx[:, 0]) > 1e-4) else 1e-5)
    print(f"баланс во время речи: голос {vdb:.1f} дБ, музыка {mdb:.1f} дБ (разница {vdb - mdb:.1f} дБ), эффекты {sdb:.1f} дБ")
    mix = np.stack([v, v], 1) * 0.75 + M * mg + sfx
    mix = np.tanh(mix * 0.85) / np.tanh(0.85)
    write_wav(out, mix[: int(total * SR)])
    print("звук готов:", out)

if __name__ == "__main__":
    main()
