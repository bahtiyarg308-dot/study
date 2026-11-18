# -*- coding: utf-8 -*-
"""Озвучка эпизода: сценарий -> произносимый текст -> фонемы (espeak-ng) -> правка ударений -> Piper (onnxruntime).
Запуск: python3 tts2.py <episode.py> <каталог_голоса> <каталог_кэша> <каталог_вывода>
Выход: timeline.json (сцены, биты, предложения, огибающая громкости для липсинка), narration.wav
"""
import hashlib, importlib.util, json, os, re, subprocess, sys, unicodedata, wave
import numpy as np
import onnxruntime as ort
from num2words import num2words

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30

# ---------- произношение терминов (экранный вид -> как читать) ----------
PRON = json.load(open(os.path.join(HERE, "pron.json"), encoding="utf-8"))
_PRON_SORTED = sorted(PRON.items(), key=lambda kv: -len(kv[0]))

def display(t):
    return re.sub(r"\{([^|}]*)\|[^}]*\}", r"\1", t)

def spoken(t):
    t = re.sub(r"\{[^|}]*\|([^}]*)\}", r"\1", t)
    for k, v in _PRON_SORTED:
        t = re.sub(r"(?<![A-Za-zА-Яа-я0-9_])" + re.escape(k) + r"(?![A-Za-z0-9_])", v, t)
    t = t.replace("→", ",").replace(" — ", ", ").replace("—", ",").replace("«", "").replace("»", "").replace("…", ".")
    t = t.replace("(", ", ").replace(")", ", ").replace(" ,", ",").replace(",,", ",").replace("*", "").replace("`", "")
    def num(m):
        s = m.group(0).replace(",", ".")
        try:
            return num2words(float(s) if "." in s else int(s), lang="ru")
        except Exception:
            return s
    t = re.sub(r"\d+(?:[.,]\d+)?", num, t)
    left = re.findall(r"[A-Za-z0-9]+", t)
    assert not left, f"нет произношения для: {left} в «{t}» (добавь в pron.json или используй {{экран|речь}})"
    return t

def sentences(t):
    return [s for s in re.split(r"(?<=[.!?])\s+", t.strip()) if s]

# ---------- фонемы ----------
STRESS_FIX = []
_f = os.path.join(HERE, "stress_fix.json")
if os.path.exists(_f):
    STRESS_FIX = [tuple(x) for x in json.load(open(_f, encoding="utf-8"))]
FIX_HITS = {}

def espeak_ipa(clause):
    out = subprocess.run(["espeak-ng", "-q", "-v", "ru", "--ipa", "--", clause], capture_output=True, text=True, check=True).stdout
    return " ".join(out.split())

def phonemize(text):
    parts = re.split(r"([,.;:!?])", text); res = []; i = 0
    while i < len(parts):
        clause = parts[i].strip(); punct = parts[i + 1] if i + 1 < len(parts) else ""; i += 2
        if not clause: continue
        ipa = espeak_ipa(clause)
        for pat, rep in STRESS_FIX:
            if pat in ipa: FIX_HITS[pat] = FIX_HITS.get(pat, 0) + 1; ipa = ipa.replace(pat, rep)
        res.append(ipa + punct)
    return unicodedata.normalize("NFD", " ".join(res))

class Voice:
    def __init__(self, mdir, name="irina", length_scale=1.04, noise_scale=0.64, noise_w=0.78):
        cfg = json.load(open(f"{mdir}/ru_RU-{name}-medium.onnx.json"))
        self.idmap = cfg["phoneme_id_map"]; self.sr = cfg["audio"]["sample_rate"]
        self.sess = ort.InferenceSession(f"{mdir}/ru_RU-{name}-medium.onnx", providers=["CPUExecutionProvider"])
        self.scales = np.array([noise_scale, length_scale, noise_w], dtype=np.float32); self.missing = set()
    def ids(self, ph):
        m = self.idmap; ids = list(m["^"]) + list(m["_"])
        for ch in ph:
            if ch in m: ids += list(m[ch]) + list(m["_"])
            else: self.missing.add(ch)
        return ids + list(m["$"])
    def synth(self, ph):
        ids = np.array([self.ids(ph)], dtype=np.int64)
        return self.sess.run(None, {"input": ids, "input_lengths": np.array([ids.shape[1]], dtype=np.int64), "scales": self.scales})[0].squeeze().astype(np.float32)

def trim(x, sr, thr=0.012, keep=0.05):
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0: return x
    return x[max(0, idx[0] - int(keep * sr)): min(len(x), idx[-1] + int(keep * sr))]

def write_wav(path, x, sr):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())

GAP_SENT, GAP_BEAT, GAP_SCENE, LEAD_IN, TAIL = 0.26, 0.38, 1.15, 1.2, 1.5

def load_episode(path):
    spec = importlib.util.spec_from_file_location("ep", path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m.EP

def main():
    ep_path, mdir, cache, out = sys.argv[1:5]
    os.makedirs(cache, exist_ok=True); os.makedirs(out, exist_ok=True)
    EP = load_episode(ep_path); v = Voice(mdir); sr = v.sr
    chunks = [np.zeros(int(LEAD_IN * sr), np.float32)]; t = LEAD_IN
    def sil(sec):
        nonlocal t; chunks.append(np.zeros(int(sec * sr), np.float32)); t += sec
    tl = dict(sample_rate=sr, id=EP["id"], title=EP["title"], scenes=[])
    for si, sc in enumerate(EP["scenes"]):
        scene = {k: val for k, val in sc.items() if k != "beats"}; scene.update(start=t, beats=[])
        for bi, b in enumerate(sc["beats"]):
            text, opt = (b, {}) if isinstance(b, str) else (b[0], b[1])
            beat = dict(i=bi, text=display(text), start=t, sents=[], **opt)
            for s_raw in sentences(text):
                s_say = spoken(s_raw)
                key = hashlib.sha1((f"v5|{v.scales.tolist()}|" + s_say).encode()).hexdigest()[:16]; wp = f"{cache}/{key}.npy"
                if os.path.exists(wp): x = np.load(wp)
                else: x = trim(v.synth(phonemize(s_say)), sr); np.save(wp, x)
                s0 = t; chunks.append(x); t += len(x) / sr
                beat["sents"].append(dict(text=display(s_raw), start=s0, end=t)); sil(GAP_SENT)
            beat["end"] = beat["sents"][-1]["end"]
            pause = opt.get("pause")
            if pause is not None: sil(max(0.0, pause - GAP_SENT))
            elif bi < len(sc["beats"]) - 1: sil(max(0.0, GAP_BEAT - GAP_SENT))
            scene["beats"].append(beat)
        sil(GAP_SCENE - GAP_SENT); scene["end"] = t; tl["scenes"].append(scene)
    sil(TAIL); tl["total"] = t
    audio = np.concatenate(chunks)
    # огибающая громкости для синхронизации рта (на кадр)
    n = int(np.ceil(t * FPS)); win = int(sr / FPS); env = np.zeros(n, np.float32)
    for f in range(n):
        a = audio[max(0, int(f / FPS * sr) - win // 2): int(f / FPS * sr) + win // 2]
        env[f] = np.sqrt(np.mean(a ** 2)) if len(a) else 0
    ref = np.percentile(env[env > 0.003], 90) if np.any(env > 0.003) else 1; env = np.clip(env / ref, 0, 1.2)
    sm = np.zeros_like(env); cur = 0.0
    for i, e in enumerate(env):
        cur = cur + (e - cur) * (0.65 if e > cur else 0.35); sm[i] = cur
    tl["env"] = [round(float(x), 2) for x in sm]
    write_wav(os.path.join(out, "narration.wav"), audio, sr)
    json.dump(tl, open(os.path.join(out, "timeline.json"), "w", encoding="utf-8"), ensure_ascii=False)
    if v.missing: print("ВНИМАНИЕ: символы без id:", "".join(sorted(v.missing)))
    print(f"озвучка готова: {t:.1f} с ({t/60:.1f} мин), сцен {len(tl['scenes'])}, слов ~{sum(len(re.findall(r'\\w+', b['text'])) for s in tl['scenes'] for b in s['beats'])}")

if __name__ == "__main__":
    main()
