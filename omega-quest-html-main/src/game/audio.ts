// Tiny synth audio engine — no external assets.
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let muted = false;
let musicStop: (() => void) | null = null;

export function initAudio() {
  if (ctx) return ctx;
  const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 0.6;
  masterGain.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.25;
  musicGain.connect(masterGain);
  return ctx;
}

export function setMuted(v: boolean) {
  muted = v;
  if (masterGain) masterGain.gain.value = v ? 0 : 0.6;
}
export function isMuted() {
  return muted;
}

function now() {
  return ctx!.currentTime;
}

export function sfx(type: "jump" | "shoot" | "hit" | "coin" | "dash" | "correct" | "wrong" | "roar" | "scare" | "portal") {
  if (!ctx || !masterGain) return;
  const t = now();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(masterGain);
  g.gain.setValueAtTime(0.0001, t);

  switch (type) {
    case "jump":
      o.type = "square";
      o.frequency.setValueAtTime(280, t);
      o.frequency.exponentialRampToValueAtTime(620, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
      break;
    case "shoot":
      o.type = "sawtooth";
      o.frequency.setValueAtTime(900, t);
      o.frequency.exponentialRampToValueAtTime(180, t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
      break;
    case "hit":
      o.type = "square";
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(50, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.start(t); o.stop(t + 0.32);
      break;
    case "coin":
      o.type = "triangle";
      o.frequency.setValueAtTime(880, t);
      o.frequency.setValueAtTime(1320, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
      break;
    case "dash":
      o.type = "sawtooth";
      o.frequency.setValueAtTime(420, t);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.18);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.start(t); o.stop(t + 0.22);
      break;
    case "correct": {
      const freqs = [523, 659, 784, 1047];
      freqs.forEach((f, i) => {
        const oo = ctx!.createOscillator();
        const gg = ctx!.createGain();
        oo.type = "triangle";
        oo.frequency.value = f;
        gg.gain.setValueAtTime(0.0001, t + i * 0.08);
        gg.gain.exponentialRampToValueAtTime(0.22, t + i * 0.08 + 0.02);
        gg.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.2);
        oo.connect(gg); gg.connect(masterGain!);
        oo.start(t + i * 0.08); oo.stop(t + i * 0.08 + 0.22);
      });
      // o was never started; do not call stop on it
      try { o.disconnect(); } catch {}
      return;
    }
    case "wrong":
      o.type = "sawtooth";
      o.frequency.setValueAtTime(220, t);
      o.frequency.linearRampToValueAtTime(80, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.start(t); o.stop(t + 0.6);
      break;
    case "roar":
      o.type = "sawtooth";
      o.frequency.setValueAtTime(80, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.start(t); o.stop(t + 0.75);
      break;
    case "scare":
      o.type = "square";
      o.frequency.setValueAtTime(60, t);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.start(t); o.stop(t + 0.45);
      break;
    case "portal":
      o.type = "sine";
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(880, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.start(t); o.stop(t + 0.55);
      break;
  }
}

export function playMusic(theme: "intro" | "game" | "boss" | "victory") {
  if (!ctx || !musicGain) return;
  stopMusic();
  const local = ctx;
  const out = musicGain;

  let chord: number[] = [];
  let bpm = 90;
  switch (theme) {
    case "intro": chord = [110, 130.81, 164.81, 196]; bpm = 60; break; // Am
    case "game": chord = [146.83, 174.61, 220, 261.63]; bpm = 110; break; // Dm7
    case "boss": chord = [98, 116.54, 146.83, 174.61]; bpm = 130; break; // Gm
    case "victory": chord = [261.63, 329.63, 392, 523.25]; bpm = 100; break; // C
  }

  const beat = 60 / bpm;
  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];

  // Pad chord
  chord.forEach((f) => {
    const o = local.createOscillator();
    const g = local.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.value = 0.05;
    o.connect(g); g.connect(out);
    o.start();
    oscs.push(o); gains.push(g);
  });

  // Bass arpeggio
  let step = 0;
  const bassO = local.createOscillator();
  const bassG = local.createGain();
  bassO.type = "triangle";
  bassG.gain.value = 0.0001;
  bassO.connect(bassG); bassG.connect(out);
  bassO.start();
  oscs.push(bassO); gains.push(bassG);

  const tick = window.setInterval(() => {
    if (!local) return;
    const t = local.currentTime;
    const note = chord[step % chord.length] / 2;
    bassO.frequency.setValueAtTime(note, t);
    bassG.gain.cancelScheduledValues(t);
    bassG.gain.setValueAtTime(0.0001, t);
    bassG.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    bassG.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.9);
    step++;
  }, beat * 1000);

  musicStop = () => {
    clearInterval(tick);
    const t = local.currentTime;
    gains.forEach((g) => {
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(0.0001, t, 0.1);
    });
    oscs.forEach((o) => { try { o.stop(t + 0.4); } catch {} });
  };
}

export function stopMusic() {
  if (musicStop) musicStop();
  musicStop = null;
}

export function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.rate = 0.95;
    u.pitch = 0.85;
    u.volume = muted ? 0 : 0.9;
    synth.speak(u);
  } catch {}
}
export function stopSpeak() {
  try { window.speechSynthesis?.cancel(); } catch {}
}

// ============== ElevenLabs narration ==============
let currentAudio: HTMLAudioElement | null = null;

export function stopNarration() {
  if (currentAudio) {
    try { currentAudio.pause(); currentAudio.src = ""; } catch {}
    currentAudio = null;
  }
  try { window.speechSynthesis?.cancel(); } catch {}
}

/**
 * Fetches narration audio and returns its duration in seconds (after metadata loads).
 * Does NOT start playback — call the returned `play()` to start, so caller can
 * synchronize visuals (typewriter) with audio start.
 */
export async function narratePrepare(text: string): Promise<{ play: () => Promise<void>; duration: number } | null> {
  stopNarration();
  if (muted) return null;
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/narrate`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) throw new Error("narrate failed");
    const data = await r.json();
    if (!data?.audio) throw new Error("no audio");
    const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
    audio.volume = muted ? 0 : 0.95;
    currentAudio = audio;
    // Wait for metadata so we can read duration
    const duration = await new Promise<number>((resolve) => {
      const done = () => resolve(isFinite(audio.duration) ? audio.duration : 4);
      if (audio.readyState >= 1 && isFinite(audio.duration)) return done();
      audio.addEventListener("loadedmetadata", done, { once: true });
      audio.addEventListener("canplay", done, { once: true });
      setTimeout(() => resolve(4), 1500);
    });
    return { duration, play: () => audio.play() };
  } catch (e) {
    console.error("narrate error", e);
    return null;
  }
}

// Backwards-compatible: fire-and-forget
export async function narrate(text: string): Promise<void> {
  const prep = await narratePrepare(text);
  if (prep) await prep.play();
  else speak(text);
}
