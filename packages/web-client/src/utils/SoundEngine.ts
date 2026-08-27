class SoundEngineImpl {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  public playTurnChime() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    const t = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    
    // Notes: C5 and E5
    osc1.frequency.setValueAtTime(523.25, t);
    osc2.frequency.setValueAtTime(659.25, t + 0.15);

    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.3, t + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + 1.0);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(t);
    osc2.start(t + 0.15);
    osc1.stop(t + 1);
    osc2.stop(t + 1.15);
  }

  public playCashRegister() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    const t = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'square';
    
    // Quick high pitched sweeps
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
    
    osc.frequency.setValueAtTime(1000, t + 0.15);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.25);

    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.1, t + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, t + 0.1);
    
    gainNode.gain.setValueAtTime(0, t + 0.15);
    gainNode.gain.linearRampToValueAtTime(0.1, t + 0.17);
    gainNode.gain.linearRampToValueAtTime(0, t + 0.25);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  public playDiceRoll() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    const t = ctx.currentTime;
    
    // Create white noise
    const bufferSize = ctx.sampleRate * 0.5; // 0.5 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    // Lowpass filter to muffle it like dice on a board
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.linearRampToValueAtTime(200, t + 0.4);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.5, t);
    // Simulate dice bouncing with rapid volume changes
    for (let i = 0; i < 4; i++) {
      const time = t + i * 0.1;
      gainNode.gain.setValueAtTime(0.3, time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.08);
    }

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noise.start(t);
  }

  public playJailBars() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    const t = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sawtooth';
    
    // Low clang frequency
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.5);

    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.6, t + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + 1.0);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 1.1);
  }
  public playCatanBuild() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    const t = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'triangle';
    
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);

    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.4, t + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playVictorySound() {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    const t = ctx.currentTime;
    
    // Trumpet-like fanfare
    const notes = [
      { f: 523.25, d: 0.15 }, // C5
      { f: 523.25, d: 0.15 }, // C5
      { f: 523.25, d: 0.15 }, // C5
      { f: 659.25, d: 0.4 },  // E5
    ];
    
    let time = t;
    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(note.f, time);
      
      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(0.3, time + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, time + note.d);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(time);
      osc.stop(time + note.d);
      
      time += note.d + 0.05;
    }
  }
}

export const SoundEngine = new SoundEngineImpl();
