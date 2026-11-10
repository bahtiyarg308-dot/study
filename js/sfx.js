// Тихие звуки интерфейса: рождаются на телефоне, файлов нет. Выключаются в настройках.
export const cfg = { on: true, vol: 2 };
let actx = null, out = null;
const ctx = () => {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    const comp = actx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6; comp.connect(actx.destination);
    out = actx.createGain(); out.connect(comp);
  }
  if (actx.state === 'suspended') actx.resume().catch(() => { });
  out.gain.value = [0, .28, .5, .8][cfg.vol] ?? .5;
  return actx;
};
function tone(c, f, t, d, v, type = 'sine', f2 = null) {
  const T = c.currentTime + t, os = c.createOscillator(), g = c.createGain();
  os.type = type; os.frequency.setValueAtTime(f, T); if (f2) os.frequency.exponentialRampToValueAtTime(f2, T + d);
  g.gain.setValueAtTime(.0001, T); g.gain.exponentialRampToValueAtTime(v, T + .006); g.gain.exponentialRampToValueAtTime(.0001, T + .006 + d);
  os.connect(g); g.connect(out); os.start(T); os.stop(T + d + .06);
}
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0];
export function sfx(name, a = 0) {
  if (!cfg.on || !cfg.vol) return;
  const c = ctx(); if (!c) return;
  switch (name) {
    case 'tap': tone(c, 760, 0, .05, .14, 'triangle'); break;
    case 'lens': tone(c, PENTA[a % 5], 0, .16, .2, 'sine'); break;
    case 'toggle': tone(c, a ? 740 : 520, 0, .07, .16, 'triangle'); break;
    case 'add': tone(c, 523, 0, .09, .16, 'sine'); tone(c, 784, .07, .12, .16, 'sine'); break;
    case 'done': tone(c, 659, 0, .08, .18, 'triangle'); tone(c, 988, .08, .14, .18, 'triangle'); break;
    case 'tail': [392, 523, 659, 784].forEach((f, i) => tone(c, f, i * .07, .22, .17, 'triangle')); break; // хвост закрыт
    case 'del': tone(c, 420, 0, .12, .16, 'triangle', 220); break;
    case 'open': tone(c, 600, 0, .06, .1, 'sine'); break;
    case 'close': tone(c, 440, 0, .06, .1, 'sine'); break;
    case 'end': [523, 659, 784].forEach((f, i) => tone(c, f, i * .16, .5, .2, 'sine')); break; // таймер вышел
  }
}
export const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* нет поддержки */ } };
