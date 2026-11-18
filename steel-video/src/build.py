#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка видео целиком.
   python3 build.py <рабочий_каталог> <каталог_голоса_irina> <каталог_node_modules> <выходной_mp4>
"""
import json, os, subprocess, sys, math
work, voice, nodem, out = sys.argv[1:5]
src = os.path.dirname(os.path.abspath(__file__))
FPS = 30
env = dict(os.environ, NODE_PATH=nodem)
os.makedirs(f"{work}/seg", exist_ok=True)

# 1. озвучка + тайминги
subprocess.run(["python3", f"{src}/tts.py", voice, f"{work}/cache", f"{work}/timeline.json"], check=True)
tl = json.load(open(f"{work}/timeline.json", encoding="utf-8"))
total = tl["total"]; N = math.ceil(total * FPS)

# 2. рендер кадров в 4 потока
parts = 4; step = math.ceil(N / parts); procs = []
for k in range(parts):
    f0, f1 = k * step, min(N, (k + 1) * step)
    procs.append(subprocess.Popen(["node", f"{src}/render/main.js", "range", f"{work}/timeline.json", str(FPS), str(f0), str(f1), f"{work}/seg/part{k}.mp4"], env=env))
for p in procs:
    if p.wait() != 0: sys.exit("ошибка рендера")
open(f"{work}/seg/list.txt", "w").write("".join(f"file 'part{k}.mp4'\n" for k in range(parts)))

# 3. звук: нормализация громкости
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"{work}/narration.wav", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000",
                "-ac", "2", "-c:a", "aac", "-b:a", "192k", f"{work}/narration.m4a"], check=True)

# 4. главы + субтитры
def ts(t, sep=","):
    h, m, s = int(t // 3600), int(t % 3600 // 60), t % 60
    return f"{h:02d}:{m:02d}:{int(s):02d}{sep}{int(round((s - int(s)) * 1000)):03d}"
meta = [";FFMETADATA1", "title=Перлит, бейнит, мартенсит: разбор доклада", "artist=Видео для подготовки к докладу"]
for i, sc in enumerate(tl["scenes"]):
    a = 0 if i == 0 else int(sc["start"] * 1000); b = int(total * 1000) if i == len(tl["scenes"]) - 1 else int(tl["scenes"][i + 1]["start"] * 1000)
    meta += ["[CHAPTER]", "TIMEBASE=1/1000", f"START={a}", f"END={b}", f"title={sc['chapter']}"]
open(f"{work}/meta.txt", "w", encoding="utf-8").write("\n".join(meta) + "\n")
srt = []; n = 1
for sc in tl["scenes"]:
    for b in sc["beats"]:
        for s in b["sents"]:
            srt.append(f"{n}\n{ts(s['start'])} --> {ts(s['end'] + 0.15)}\n{s['text']}\n"); n += 1
srt_path = os.path.splitext(out)[0] + ".srt"
open(srt_path, "w", encoding="utf-8").write("\n".join(srt))

# 5. финальная склейка
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", f"{work}/seg/list.txt", "-i", f"{work}/narration.m4a",
                "-i", f"{work}/meta.txt", "-map", "0:v", "-map", "1:a", "-map_metadata", "2", "-map_chapters", "2", "-c", "copy", "-shortest", "-movflags", "+faststart", out], check=True)
print("ГОТОВО:", out, f"{os.path.getsize(out)/1e6:.1f} МБ")
