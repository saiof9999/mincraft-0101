export function makeAudio() {
  let ctx;
  let noiseBuf;
  let lastStep = 0;

  const ensure = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };

  const dispose = () => {
    try {
      ctx?.close?.();
    } catch {}
    ctx = null;
    noiseBuf = null;
  };

  const beep = (f, d = 0.08, type = "square", g = 0.04, f2 = 0) => {
    try {
      const c = ensure();
      const o = c.createOscillator();
      const gain = c.createGain();
      const t = c.currentTime;
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + d);
      gain.gain.setValueAtTime(g, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(gain).connect(c.destination);
      o.start(t);
      o.stop(t + d + 0.02);
    } catch {}
  };

  const noise = ({ dur = 0.1, freq = 800, q = 1.2, gain = 0.12, type = "bandpass", slide = 0 } = {}) => {
    try {
      const c = ensure();
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const flt = c.createBiquadFilter();
      flt.type = type;
      const t = c.currentTime;
      flt.frequency.setValueAtTime(freq, t);
      flt.Q.value = q;
      if (slide) flt.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), t + dur);
      const gn = c.createGain();
      gn.gain.setValueAtTime(gain, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(flt).connect(gn).connect(c.destination);
      src.start(t, Math.random() * 0.3);
      src.stop(t + dur + 0.05);
    } catch {}
  };

  const MATS = { stone: 620, dirt: 300, sand: 1500, wood: 420, glass: 2200, snow: 1100 };

  return {
    click: () => beep(420, 0.05),
    break: () => {
      noise({ dur: 0.16, freq: 700, q: 0.8, gain: 0.16, slide: -420 });
      beep(120, 0.1, "triangle", 0.05, 70);
    },
    place: () => noise({ dur: 0.09, freq: 500, q: 1.5, gain: 0.14, slide: -180 }),
    hurt: () => {
      beep(240, 0.18, "sawtooth", 0.09, 90);
      noise({ dur: 0.12, freq: 300, q: 1, gain: 0.08, slide: -120 });
    },
    eat: () => {
      noise({ dur: 0.09, freq: 900, q: 2, gain: 0.1 });
      setTimeout(() => noise({ dur: 0.09, freq: 700, q: 2, gain: 0.1 }), 110);
    },
    portal: () => {
      beep(140, 0.7, "sine", 0.06, 620);
      beep(147, 0.7, "sine", 0.05, 660);
    },
    splash: () => noise({ dur: 0.3, freq: 1200, q: 0.7, gain: 0.12, slide: -700 }),
    dig: (mat) => noise({ dur: 0.09, freq: MATS[mat] || 500, q: 1.1, gain: 0.1, slide: -120 }),
    step: (mat) => {
      const t = performance.now();
      if (t - lastStep < 90) return;
      lastStep = t;
      noise({ dur: 0.07, freq: (MATS[mat] || 400) * 0.8, q: 0.9, gain: 0.06, slide: -100 });
    },
    pop: () => beep(660, 0.06, "sine", 0.05, 990),
    bubble: () => beep(260 + Math.random() * 240, 0.14, "sine", 0.05, 880),
    dispose,
  };
}
