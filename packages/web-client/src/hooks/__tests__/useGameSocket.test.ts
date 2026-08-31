import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameSocket } from '../useGameSocket';

class MockWebSocket {
  static OPEN = 1;
  readyState = 0;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: {}) => void) | null = null;
  onerror: ((ev: {}) => void) | null = null;
  sent: string[] = [];
  closed = false;
  url: string;

  constructor(url: string) {
    this.url = url;
    instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.({});
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
  }

  simulateMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  simulateClose() {
    this.onclose?.({});
  }

  simulateError() {
    this.onerror?.({});
  }
}

const instances: MockWebSocket[] = [];

describe('useGameSocket', () => {
  let onStateUpdate: ReturnType<typeof vi.fn<(state: any) => void>>;
  let onEvents: ReturnType<typeof vi.fn<(events: any[]) => void>>;
  let onError: ReturnType<typeof vi.fn<(error: string) => void>>;

  beforeEach(() => {
    instances.length = 0;
    vi.stubGlobal('WebSocket', class extends MockWebSocket {});
    onStateUpdate = vi.fn<(state: any) => void>();
    onEvents = vi.fn<(events: any[]) => void>();
    onError = vi.fn<(error: string) => void>();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function render() {
    const hook = renderHook(() => useGameSocket('room-1', 'p1', onStateUpdate, onEvents, onError));
    const instance = instances[instances.length - 1]!;
    return { hook, instance };
  }

  it('opens a WebSocket for the room and player, then closes it on unmount', () => {
    const { hook, instance } = render();
    expect(instance.url).toBe('ws://localhost:3000/rooms/room-1/ws?playerId=p1');

    hook.unmount();
    expect(instance.closed).toBe(true);
  });

  it('routes STATE_UPDATE, EVENTS and ERROR messages to the right callbacks', () => {
    const { instance } = render();

    act(() => instance.simulateMessage({ type: 'STATE_UPDATE', state: { turn: 1 } }));
    expect(onStateUpdate).toHaveBeenCalledWith({ turn: 1 });

    act(() => instance.simulateMessage({ type: 'EVENTS', events: [{ type: 'DICE_ROLLED' }] }));
    expect(onEvents).toHaveBeenCalledWith([{ type: 'DICE_ROLLED' }]);

    act(() => instance.simulateMessage({ type: 'ERROR', error: 'Invalid payload' }));
    expect(onError).toHaveBeenCalledWith('Invalid payload');

    expect(onStateUpdate).toHaveBeenCalledTimes(1);
    expect(onEvents).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('logs and ignores a message that cannot be parsed', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { instance } = render();

    act(() => instance.onmessage?.({ data: '{not json' }));

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(onStateUpdate).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('reports connection loss and errors only while the hook is mounted', () => {
    const { hook, instance } = render();

    act(() => instance.simulateClose());
    expect(onError).toHaveBeenCalledWith('Connection lost to server.');

    act(() => instance.simulateError());
    expect(onError).toHaveBeenCalledWith('WebSocket error occurred.');

    hook.unmount();
    const calls = onError.mock.calls.length;
    act(() => instance.simulateClose());
    act(() => instance.simulateError());
    expect(onError.mock.calls.length).toBe(calls);
  });

  it('sends actions only while the socket is open', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { hook, instance } = render();

    // Not open yet -> warning, nothing sent
    expect(instance.readyState).toBe(0);
    act(() => hook.result.current.sendAction({ type: 'ROLL_DICE', playerId: 'p1' }));
    expect(instance.sent).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();

    // Open -> real payload sent
    instance.simulateOpen();
    act(() => hook.result.current.sendAction({ type: 'ROLL_DICE', playerId: 'p1' }));
    expect(instance.sent).toEqual([JSON.stringify({ type: 'ROLL_DICE', playerId: 'p1' })]);

    // Closed again -> warning
    instance.readyState = 3;
    act(() => hook.result.current.sendAction({ type: 'END_TURN', playerId: 'p1' }));
    expect(instance.sent).toEqual([JSON.stringify({ type: 'ROLL_DICE', playerId: 'p1' })]);
    expect(warnSpy.mock.calls.length).toBe(2);

    hook.unmount();
    warnSpy.mockRestore();
  });
});