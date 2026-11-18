# Видео-разбор доклада «Перлит, бейнит, мартенсит»

- `out/Video_razbor_Ganiev.mp4` — готовое видео (1080p, 30 к/с, ≈ 13 мин, с главами)
- `out/Video_razbor_Ganiev.srt` — субтитры (текст озвучки)
- `src/script.py` — **сценарий** (единый источник: озвучка, субтитры, тайминги анимации)
- `src/tts.py` — озвучка: espeak-ng (фонемы) → правка ударений (`src/stress_fix.json`) → нейросеть Piper (голос Irina)
- `src/render/` — отрисовка кадров (Node + `@napi-rs/canvas`), `src/build.py` — сборка

## Пересборка после правки текста

```bash
apt-get install -y espeak-ng ffmpeg
pip install onnxruntime numpy
npm install @napi-rs/canvas                       # в любой каталог, путь — в NODE_PATH
# голос: https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-ru_RU-irina-medium.tar.bz2
python3 src/build.py <рабочий_каталог> <каталог_с_моделью_irina> <путь_к_node_modules> out/Video_razbor_Ganiev.mp4
```

Меняется только `src/script.py` — картинка подстроится под новую длину фраз сама.
Если какое-то слово звучит с неверным ударением — добавь пару «как есть → как надо» в `src/stress_fix.json`.
