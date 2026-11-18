#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка эпизода: озвучка -> звук -> рендер (4 потока) -> склейка с главами и субтитрами.
   python3 build.py <ep> <рабочий_каталог> <каталог_голоса> <node_modules> <каталог_вывода> [--from-render]
"""
import json, math, os, subprocess, sys
ep, work, voice, nodem, outdir = sys.argv[1:6]; flags = sys.argv[6:]
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
wd = f"{work}/{ep}"; os.makedirs(f"{wd}/seg", exist_ok=True); os.makedirs(outdir, exist_ok=True)
env = dict(os.environ, NODE_PATH=nodem); FPS = 30
if "--skip-tts" not in flags:
    subprocess.run(["python3", f"{here}/tts2.py", f"{root}/episodes/{ep}.py", voice, f"{work}/cache", wd], check=True)
tl = json.load(open(f"{wd}/timeline.json", encoding="utf-8")); total = tl["total"]; N = math.ceil(total * FPS)
seed = int(ep[1:]) if ep[1:].isdigit() else 1
subprocess.run(["python3", f"{here}/audio.py", f"{wd}/timeline.json", f"{wd}/narration.wav", f"{wd}/mix.wav", str(seed)], check=True)
if "--skip-render" not in flags:
    for f in os.listdir(f"{wd}/seg"): os.remove(f"{wd}/seg/{f}")
    parts = 4; step = math.ceil(N / parts); procs = []
    for k in range(parts):
        f0, f1 = k * step, min(N, (k + 1) * step)
        procs.append(subprocess.Popen(["node", f"{here}/main.js", "range", f"{wd}/timeline.json", str(FPS), str(f0), str(f1), f"{wd}/seg/part{k}.mp4"], env=env))
    for p in procs:
        if p.wait() != 0: sys.exit("ошибка рендера")
    open(f"{wd}/seg/list.txt", "w").write("".join(f"file 'part{k}.mp4'\n" for k in range(parts)))
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"{wd}/mix.wav", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", f"{wd}/audio.m4a"], check=True)
def ts(t):
    h, m, s = int(t // 3600), int(t % 3600 // 60), t % 60
    return f"{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}"
meta = [";FFMETADATA1", f"title={tl['title']}", "artist=Курс ИИ-инженера"]
for i, sc in enumerate(tl["scenes"]):
    a = 0 if i == 0 else int(sc["start"] * 1000); b = int(total * 1000) if i == len(tl["scenes"]) - 1 else int(tl["scenes"][i + 1]["start"] * 1000)
    meta += ["[CHAPTER]", "TIMEBASE=1/1000", f"START={a}", f"END={b}", f"title={sc.get('chapter') or sc['label']}"]
open(f"{wd}/meta.txt", "w", encoding="utf-8").write("\n".join(meta) + "\n")
srt = []; n = 1
for sc in tl["scenes"]:
    for b in sc["beats"]:
        for s in b["sents"]: srt.append(f"{n}\n{ts(s['start'])} --> {ts(s['end'] + 0.15)}\n{s['text']}\n"); n += 1
name = f"{ep.upper()}_{tl['title'].split('. ',1)[-1].replace(' ', '_').replace(',', '')}"
out = f"{outdir}/{name}.mp4"; open(f"{outdir}/{name}.srt", "w", encoding="utf-8").write("\n".join(srt))
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", f"{wd}/seg/list.txt", "-i", f"{wd}/audio.m4a", "-i", f"{wd}/meta.txt",
                "-map", "0:v", "-map", "1:a", "-map_metadata", "2", "-map_chapters", "2", "-c", "copy", "-shortest", "-movflags", "+faststart", out], check=True)
print("ГОТОВО:", out, f"{os.path.getsize(out)/1e6:.1f} МБ, {total/60:.1f} мин")
