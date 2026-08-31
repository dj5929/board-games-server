import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEventLog } from '../useEventLog';

describe('useEventLog', () => {
  it('starts with an empty log and the panel hidden', () => {
    const { result } = renderHook(() => useEventLog());
    expect(result.current.eventLog).toEqual([]);
    expect(result.current.showEventLog).toBe(false);
  });

  it('prepends entries and toggles the panel visibility', () => {
    const { result } = renderHook(() => useEventLog());

    act(() => result.current.addEventLog('first'));
    act(() => result.current.addEventLog('second'));

    expect(result.current.eventLog.map(e => e.msg)).toEqual(['second', 'first']);

    act(() => result.current.setShowEventLog(true));
    expect(result.current.showEventLog).toBe(true);
  });

  it('ignores falsy messages on addEventLog', () => {
    const { result } = renderHook(() => useEventLog());
    act(() => result.current.addEventLog(''));
    act(() => result.current.addEventLog(null as unknown as string));
    expect(result.current.eventLog).toHaveLength(0);

    act(() => result.current.addEventLog('  '));
    expect(result.current.eventLog).toHaveLength(1);
  });

  it('filters falsy messages in addEventLogs and prepends them in order', () => {
    const { result } = renderHook(() => useEventLog());
    act(() => result.current.addEventLogs(['a', '', null as unknown as string, 'b']));
    expect(result.current.eventLog.map(e => e.msg)).toEqual(['b', 'a']);
  });

  it('does nothing when addEventLogs receives only falsy entries', () => {
    const { result } = renderHook(() => useEventLog());
    act(() => result.current.addEventLogs([null as unknown as string, '']));
    expect(result.current.eventLog).toHaveLength(0);
  });

  it('caps the log at maxEntries', () => {
    const { result } = renderHook(() => useEventLog(3));
    act(() => {
      result.current.addEventLog('1');
      result.current.addEventLog('2');
      result.current.addEventLog('3');
      result.current.addEventLog('4');
    });
    expect(result.current.eventLog).toHaveLength(3);
    expect(result.current.eventLog[0]!.msg).toBe('4');
  });
});