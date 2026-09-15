export function makeAudio() {
  let ctx;
  const ensure = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  };
  const beep = (f, d = 0.08, type = "square", g = 0.04) => {
    try {
      const c = ensure();
      const o = c.createOscillator();
      const gain = c.createGain();
      o.type = type;
      o.frequency.value = f;
      gain.gain.value = g;
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + d);
      o.connect(gain).connect(c.destination);
      o.start();
      o.stop(c.currentTime + d);
    } catch {}
  };
  return {
    click: () => beep(420, 0.05),
    break: () => beep(90, 0.12, "sawtooth", 0.05),
    place: () => beep(180, 0.07, "square", 0.04),
    hurt: () => beep(140, 0.2, "sawtooth", 0.07),
    eat: () => beep(300, 0.1, "sine", 0.05),
    portal: () => beep(90, 0.4, "sine", 0.06),
    splash: () => beep(500, 0.2, "triangle", 0.04),
  };
}
