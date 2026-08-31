import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SoundEngine } from '../SoundEngine';

interface MockOscillator {
  type: string;
  frequency: Record<string, ReturnType<typeof vi.fn>>;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

interface MockGainNode {
  gain: Record<string, ReturnType<typeof vi.fn>>;
  connect: ReturnType<typeof vi.fn>;
}

class MockAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  sampleRate = 44100;
  resume = vi.fn();
  createOscillator = vi.fn((): MockOscillator => ({
    type: '',
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));
  createGain = vi.fn((): MockGainNode => ({
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  }));
  createBuffer = vi.fn(() => ({ getChannelData: vi.fn(() => new Float32Array(100)) }));
  createBufferSource = vi.fn(() => ({ buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }));
  createBiquadFilter = vi.fn(() => ({
    type: '',
    frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  }));
}

describe('SoundEngine', () => {
  let AudioContextCtor: typeof MockAudioContext;
  let audioContextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    audioContextMock = vi.fn(function (this: unknown) {
      return new MockAudioContext();
    });
    AudioContextCtor = audioContextMock as unknown as typeof MockAudioContext;
    Object.defineProperty(window, 'AudioContext', { value: AudioContextCtor, writable: true, configurable: true });
    // Ensure the fallback is not present so the primary branch is exercised
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined, writable: true, configurable: true });
  });

  afterEach(() => {
    SoundEngine.setEnabled(true);
  });

  it('does nothing (and creates no AudioContext) while audio is disabled', () => {
    SoundEngine.setEnabled(false);
    SoundEngine.playTurnChime();
    SoundEngine.playCashRegister();
    SoundEngine.playDiceRoll();
    SoundEngine.playJailBars();
    SoundEngine.playCatanBuild();
    SoundEngine.playVictorySound();
    SoundEngine.playSiren();
    SoundEngine.playTransitSound('taxi');
    expect(window.AudioContext).not.toHaveBeenCalled();
  });

  it('plays sounds through a single cached AudioContext and resumes it when suspended', () => {
    SoundEngine.setEnabled(true);
    SoundEngine.playTurnChime();
    SoundEngine.playCashRegister();
    SoundEngine.playDiceRoll();
    SoundEngine.playJailBars();
    SoundEngine.playCatanBuild();
    SoundEngine.playVictorySound();
    SoundEngine.playSiren();
    SoundEngine.playTransitSound('taxi');
    SoundEngine.playTransitSound('bus');
    SoundEngine.playTransitSound('underground');
    SoundEngine.playTransitSound('secret');
    SoundEngine.playTransitSound('double');

    expect(window.AudioContext).toHaveBeenCalledTimes(1);
    const ctx = audioContextMock.mock.results[0]!.value as unknown as MockAudioContext;
    expect(ctx.createOscillator).toHaveBeenCalled();
    expect(ctx.createGain).toHaveBeenCalled();
    expect(ctx.createBuffer).toHaveBeenCalled();
    expect(ctx.createBufferSource).toHaveBeenCalled();
    expect(ctx.createBiquadFilter).toHaveBeenCalled();
    expect(ctx.resume).not.toHaveBeenCalled();

    (ctx as unknown as { state: string }).state = 'suspended';
    SoundEngine.playCashRegister();
    expect(ctx.resume).toHaveBeenCalled();
  });
});