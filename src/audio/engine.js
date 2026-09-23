/**
 * Web Audio plumbing. Everything the game plays is synthesised here, so the
 * build ships no audio files and carries no sample licensing.
 *
 * Browsers refuse to start audio before a user gesture, so the context is
 * created lazily and `unlock()` is called on the first interaction.
 */
let ctx = null;
let master = null;
let musicBus = null;
let sfxBus = null;
let muted = false;
let musicLevel = 0.55;
let sfxLevel = 0.7;

export function audioContext() {
  if (ctx) return ctx;
  const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);

  musicBus = ctx.createGain();
  musicBus.gain.value = musicLevel;
  musicBus.connect(master);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = sfxLevel;
  sfxBus.connect(master);

  return ctx;
}

export function unlock() {
  const context = audioContext();
  if (context && context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

export const getMusicBus = () => (audioContext() ? musicBus : null);
export const getSfxBus = () => (audioContext() ? sfxBus : null);

export function setMusicVolume(percent) {
  musicLevel = Math.min(1, Math.max(0, percent / 100));
  if (musicBus) musicBus.gain.setTargetAtTime(musicLevel, ctx.currentTime, 0.05);
}

export function setSfxVolume(percent) {
  sfxLevel = Math.min(1, Math.max(0, percent / 100));
  if (sfxBus) sfxBus.gain.setTargetAtTime(sfxLevel, ctx.currentTime, 0.05);
}

export function setMuted(value) {
  muted = Boolean(value);
  if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.03);
}

export const isMuted = () => muted;

/** Shared white-noise buffer for percussive effects. */
let noiseBuffer = null;
export function noise() {
  const context = audioContext();
  if (!context) return null;
  if (!noiseBuffer) {
    const length = context.sampleRate * 0.6;
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = noiseBuffer;
  return source;
}
