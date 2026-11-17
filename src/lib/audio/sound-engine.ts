/**
 * MetroMeet High-Fidelity Web Audio Sound Engine
 * Synthesizes crystal-clear, zero-latency sonic branding, calling ringtones,
 * and host admission knock chimes without external MP3 dependencies.
 */

class SoundEngine {
  private audioCtx: AudioContext | null = null;
  private ringtoneInterval: any = null;
  private isRinging = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * MetroMeet Modern International Sonic Branding Signature
   * Precision-tuned 6-part acoustic & synthetic chord with deep sub-bass swell,
   * crystal glass arpeggio, spatial stereo detune, and warm silk tail.
   */
  public playIntroChime() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();

      // High-end studio master compressor
      comp.threshold.setValueAtTime(-14, now);
      comp.knee.setValueAtTime(30, now);
      comp.ratio.setValueAtTime(8, now);
      comp.attack.setValueAtTime(0.003, now);
      comp.release.setValueAtTime(0.25, now);

      master.gain.setValueAtTime(0.001, now);
      master.gain.linearRampToValueAtTime(0.3, now + 0.08);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

      // 1. Deep Cinematic Sub Fundamental Swell (D2 73.42Hz -> A2 110Hz)
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(73.42, now);
      sub.frequency.exponentialRampToValueAtTime(110.0, now + 0.28);
      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(0.35, now + 0.1);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      sub.connect(subGain);
      subGain.connect(comp);
      sub.start(now);
      sub.stop(now + 1.5);

      // 2. Crystal Glass Arpeggio (D4, F#4, A4, C#5, E5, A5, C#6 sparkle)
      const arpeggio = [
        { f: 293.66, delay: 0.00, dur: 1.8, vol: 0.22, type: 'triangle' as OscillatorType }, // D4
        { f: 369.99, delay: 0.04, dur: 1.9, vol: 0.24, type: 'sine' as OscillatorType },     // F#4
        { f: 440.00, delay: 0.08, dur: 2.1, vol: 0.25, type: 'sine' as OscillatorType },     // A4
        { f: 554.37, delay: 0.13, dur: 2.3, vol: 0.22, type: 'triangle' as OscillatorType }, // C#5
        { f: 659.25, delay: 0.18, dur: 2.5, vol: 0.20, type: 'sine' as OscillatorType },     // E5
        { f: 880.00, delay: 0.23, dur: 2.6, vol: 0.18, type: 'sine' as OscillatorType },     // A5
        { f: 1108.73, delay: 0.28, dur: 2.4, vol: 0.14, type: 'sine' as OscillatorType },    // C#6 (glass shimmer)
        { f: 1760.00, delay: 0.32, dur: 2.0, vol: 0.09, type: 'sine' as OscillatorType },    // A6 (airy sparkle)
      ];

      // Dual detuned stereo shimmer filter
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(7000, now + 0.35);
      filter.frequency.exponentialRampToValueAtTime(1200, now + 2.5);
      filter.Q.setValueAtTime(2.5, now);

      arpeggio.forEach(({ f, delay, dur, vol, type }) => {
        // Dual detuned stereo oscillators for expansive spatial depth
        [-7, 7].forEach((detune) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = type;
          osc.frequency.setValueAtTime(f, now + delay);
          osc.detune.setValueAtTime(detune, now + delay);

          gain.gain.setValueAtTime(0.0001, now + delay);
          gain.gain.linearRampToValueAtTime(vol * 0.5, now + delay + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);

          osc.connect(gain);
          gain.connect(filter);

          osc.start(now + delay);
          osc.stop(now + delay + dur + 0.1);
        });
      });

      filter.connect(comp);
      comp.connect(master);
      master.connect(ctx.destination);
    } catch (e) {
      console.warn('Audio chime note:', e);
    }
  }

  /**
   * Modern Enterprise Calling / Waiting Ringtone
   * Polyphonic marimba chime pulse (E5 -> G#5 -> B5) repeating every 2.6s.
   */
  public startCallingRingtone() {
    if (this.isRinging) return;
    this.isRinging = true;

    const playPulse = () => {
      try {
        const ctx = this.getContext();
        if (!ctx || !this.isRinging) return;

        const now = ctx.currentTime;
        const freqs = [659.25, 830.61, 987.77]; // E5, G#5, B5 melodic motif

        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.14);

          gain.gain.setValueAtTime(0.001, now + idx * 0.14);
          gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.14 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.65);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.14);
          osc.stop(now + idx * 0.14 + 0.7);
        });
      } catch (err) {
        console.warn('Ringtone note:', err);
      }
    };

    playPulse();
    this.ringtoneInterval = setInterval(playPulse, 2600);
  }

  public stopCallingRingtone() {
    this.isRinging = false;
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }

  /**
   * Host Knock Notification Sound
   * Plays a distinct gentle double chime when a participant requests admission.
   */
  public playKnockChime() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      [880, 1174.66].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.18);

        gain.gain.setValueAtTime(0.001, now + idx * 0.18);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.18 + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.18);
        osc.stop(now + idx * 0.18 + 0.55);
      });
    } catch (e) {
      console.warn('Knock sound note:', e);
    }
  }

  /**
   * Admission Approval Sound
   * Bright ascending chime when participant is accepted into call.
   */
  public playAdmittedChime() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.001, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.65);
      });
    } catch (e) {
      console.warn('Admitted sound note:', e);
    }
  }
}

export const soundEngine = new SoundEngine();
