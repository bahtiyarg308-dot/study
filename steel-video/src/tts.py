# -*- coding: utf-8 -*-
"""Озвучка: текст -> фонемы (espeak-ng) -> правка ударений -> нейросеть Piper (onnxruntime).

Запуск:  python3 tts.py <каталог_модели> <каталог_кэша> <timeline.json>
"""
import hashlib, json, os, re, subprocess, sys, unicodedata, wave
import numpy as np
import onnxruntime as ort

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import script as SC

# --------------------------------------------------------------------------------------
# 1. «Экранный» текст -> «произносимый»
# --------------------------------------------------------------------------------------
SPOKEN = [
    ("500–650 °C", "от пятисот до шестисот пятидесяти градусов"),
    ("727 °C", "семьсот двадцать семь градусов Цельсия"),
    ("850 °C", "восемьсот пятьдесят градусов"),
    ("0,6 мкм", "шесть десятых микрометра"),
    ("0,3 мкм", "три десятых микрометра"),
    ("0,1 мкм", "одна десятая микрометра"),
    ("40Х", "сорок ха"),
    ("«Х»", "«ха»"),
    ("«С»", "«эс»"),
    ("С-кривая", "эс-кривая"),
    ("С-образная", "эс-образная"),
    ("Fe₃C", "эф е три цэ"),
    ("Слайды 1–2", "Слайды один и два"),
    ("Слайд 3", "Слайд три"), ("Слайд 4", "Слайд четыре"), ("Слайд 5", "Слайд пять"),
    ("Слайд 6", "Слайд шесть"), ("Слайд 7", "Слайд семь"),
    ("40 секунд", "сорок секунд"), ("30 секунд", "тридцать секунд"),
    ("45 секунд", "сорок пять секунд"), ("50 секунд", "пятьдесят секунд"),
]

def spoken(t):
    for a, b in SPOKEN:
        t = t.replace(a, b)
    t = t.replace(" — ", ", ").replace("—", ",").replace("«", "").replace("»", "")
    t = t.replace(":", ",") if False else t
    assert not re.search(r"[0-9A-Za-z]", t), f"остались цифры/латиница: {t}"
    return t

def sentences(t):
    return [s for s in re.split(r"(?<=[.!?])\s+", t.strip()) if s]

# --------------------------------------------------------------------------------------
# 2. Фонемизация + правка ударений
# --------------------------------------------------------------------------------------
# espeak-ng ошибается в ударении в этих словах -> правим прямо в IPA-строке
# (шаблон, замена). Сдвигаем знак основного ударения ˈ на последний слог.
STRESS_FIX = []
_extra = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stress_fix.json")
if os.path.exists(_extra):
    STRESS_FIX += [tuple(x) for x in json.load(open(_extra, encoding="utf-8"))]
FIX_HITS = {}

def espeak_ipa(clause):
    out = subprocess.run(["espeak-ng", "-q", "-v", "ru", "--ipa", "--", clause],
                         capture_output=True, text=True, check=True).stdout
    return " ".join(out.split())

def phonemize(text):
    """Возвращает строку фонем для Piper: клаузы через espeak, знаки препинания сохраняются."""
    parts = re.split(r"([,.;:!?])", text)
    res = []
    i = 0
    while i < len(parts):
        clause = parts[i].strip()
        punct = parts[i + 1] if i + 1 < len(parts) else ""
        i += 2
        if not clause:
            continue
        ipa = espeak_ipa(clause)
        for pat, rep in STRESS_FIX:
            if pat in ipa:
                FIX_HITS[pat] = FIX_HITS.get(pat, 0) + 1
                ipa = ipa.replace(pat, rep)
        res.append(ipa + punct)
    return unicodedata.normalize("NFD", " ".join(res))

# --------------------------------------------------------------------------------------
# 3. Синтез
# --------------------------------------------------------------------------------------
class Voice:
    def __init__(self, mdir, name="irina", length_scale=1.03, noise_scale=0.60, noise_w=0.70):
        cfg = json.load(open(f"{mdir}/ru_RU-{name}-medium.onnx.json"))
        self.idmap = cfg["phoneme_id_map"]
        self.sr = cfg["audio"]["sample_rate"]
        self.sess = ort.InferenceSession(f"{mdir}/ru_RU-{name}-medium.onnx", providers=["CPUExecutionProvider"])
        self.scales = np.array([noise_scale, length_scale, noise_w], dtype=np.float32)
        self.missing = set()

    def ids(self, phonemes):
        m = self.idmap
        ids = list(m["^"]) + list(m["_"])
        for ch in phonemes:
            if ch in m:
                ids += list(m[ch]) + list(m["_"])
            else:
                self.missing.add(ch)
        ids += list(m["$"])
        return ids

    def synth(self, phonemes):
        ids = np.array([self.ids(phonemes)], dtype=np.int64)
        out = self.sess.run(None, {"input": ids, "input_lengths": np.array([ids.shape[1]], dtype=np.int64),
                                   "scales": self.scales})[0]
        return out.squeeze().astype(np.float32)

def write_wav(path, x, sr):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((x * 32767).astype(np.int16).tobytes())

def trim(x, sr, thr=0.012, keep=0.05):
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(keep * sr)); b = min(len(x), idx[-1] + int(keep * sr))
    return x[a:b]

GAP_SENT, GAP_BEAT, GAP_SCENE = 0.26, 0.36, 0.90
LEAD_IN = 0.8     # тишина в начале ролика

def main():
    mdir, cache, out_json = sys.argv[1:4]
    os.makedirs(cache, exist_ok=True)
    v = Voice(mdir)
    sr = v.sr
    chunks = [np.zeros(int(LEAD_IN * sr), np.float32)]
    t = LEAD_IN
    timeline = dict(sample_rate=sr, scenes=[])
    def add_silence(sec):
        nonlocal t
        chunks.append(np.zeros(int(sec * sr), np.float32)); t += sec

    for si, sc in enumerate(SC.SCENES):
        scene = dict(id=sc["id"], chapter=sc["chapter"], label=sc["label"], title=sc["title"],
                     dark=sc.get("dark", False), start=t, beats=[])
        for bi, b in enumerate(sc["beats"]):
            cue, text = b[0], b[1]
            pause_after = b[2] if len(b) > 2 else None
            beat = dict(cue=cue, text=text, start=t, sents=[])
            for s_disp in sentences(text):
                s_say = spoken(s_disp)
                key = hashlib.sha1((f"v4|{v.scales.tolist()}|" + s_say).encode()).hexdigest()[:16]
                wp = f"{cache}/{key}.npy"
                if os.path.exists(wp):
                    x = np.load(wp)
                else:
                    ph = phonemize(s_say)
                    x = trim(v.synth(ph), sr)
                    np.save(wp, x)
                s0 = t
                chunks.append(x); t += len(x) / sr
                beat["sents"].append(dict(text=s_disp, start=s0, end=t))
                add_silence(GAP_SENT)
            t -= 0  # пауза после последнего предложения остаётся частью бита
            beat["end"] = beat["sents"][-1]["end"]
            if pause_after is not None:
                add_silence(max(0.0, pause_after - GAP_SENT))
            elif bi < len(sc["beats"]) - 1:
                add_silence(max(0.0, GAP_BEAT - GAP_SENT))
            scene["beats"].append(beat)
        add_silence(GAP_SCENE - GAP_SENT)
        scene["end"] = t
        timeline["scenes"].append(scene)
    add_silence(0.6)
    timeline["total"] = t
    audio = np.concatenate(chunks)
    write_wav(os.path.join(os.path.dirname(out_json), "narration.wav"), audio, sr)
    json.dump(timeline, open(out_json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if v.missing:
        print("ВНИМАНИЕ: символы без id:", "".join(sorted(v.missing)))
    unused=[p for p,_ in STRESS_FIX if p not in FIX_HITS]
    print("правки ударений сработали:", len(FIX_HITS), "из", len(STRESS_FIX), "| не сработали:", unused)
    print(f"готово: {t:.1f} с ({t/60:.1f} мин), сцен {len(timeline['scenes'])}")

if __name__ == "__main__":
    main()
