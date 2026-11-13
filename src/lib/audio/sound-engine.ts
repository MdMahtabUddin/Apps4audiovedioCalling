/**
 * MeetFlow / MetroMeet High-Fidelity Web Audio Sound Engine
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
   * MetroMeet Intro Sonic Branding Chime (Soft Harmonic Ambient Chord)
   * Warm, lush F Major 9th chord (F3, C4, A4, E5) with soft analog filter.
   */
  public playIntroChime() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [174.61, 261.63, 440.0, 659.25, 880.0]; // F3, C4, A4, E5, A5
      const masterGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(3200, now + 0.4);
      filter.frequency.exponentialRampToValueAtTime(800, now + 2.8);

      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.linearRampToValueAtTime(0.18, now + 0.12);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);

        noteGain.gain.setValueAtTime(0.001, now + idx * 0.04);
        noteGain.gain.linearRampToValueAtTime(0.2 / (idx + 1), now + idx * 0.04 + 0.08);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

        osc.connect(noteGain);
        noteGain.connect(filter);

        osc.start(now + idx * 0.04);
        osc.stop(now + 3.2);
      });

      filter.connect(masterGain);
      masterGain.connect(ctx.destination);
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
