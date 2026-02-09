import { useCallback, useRef, useEffect } from 'react';

// Web Audio API retro sound effects — no backend needed
export function useRetroSFX() {
  const ctxRef = useRef<AudioContext | null>(null);
  const crtGainRef = useRef<GainNode | null>(null);
  const crtOscRef = useRef<OscillatorNode | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  // Short typewriter key click
  const playKeyClick = useCallback(() => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800 + Math.random() * 400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch { /* silent fail */ }
  }, [getCtx]);

  // Retro blip for voting
  const playVoteBlip = useCallback(() => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch { /* silent fail */ }
  }, [getCtx]);

  // TX confirmed chime
  const playConfirm = useCallback(() => {
    try {
      const ctx = getCtx();
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + i * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.35);
      });
    } catch { /* silent fail */ }
  }, [getCtx]);

  // CRT hum ambient loop
  const startCRTHum = useCallback(() => {
    try {
      const ctx = getCtx();
      if (crtOscRef.current) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 60;
      gain.gain.value = 0.012;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      crtOscRef.current = osc;
      crtGainRef.current = gain;
    } catch { /* silent fail */ }
  }, [getCtx]);

  const stopCRTHum = useCallback(() => {
    try {
      crtOscRef.current?.stop();
      crtOscRef.current = null;
      crtGainRef.current = null;
    } catch { /* silent fail */ }
  }, []);

  useEffect(() => {
    return () => { stopCRTHum(); };
  }, [stopCRTHum]);

  return { playKeyClick, playVoteBlip, playConfirm, startCRTHum, stopCRTHum };
}
