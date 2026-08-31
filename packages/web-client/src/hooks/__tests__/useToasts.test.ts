import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToasts } from '../useToasts';

describe('useToasts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts with an empty toast list', () => {
    const { result } = renderHook(() => useToasts());
    expect(result.current.toasts).toEqual([]);
  });

  it('adds a toast and auto-dismisses it after the timeout', () => {
    const { result } = renderHook(() => useToasts(4000));

    act(() => result.current.addToast('hello'));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]!.msg).toBe('hello');

    act(() => vi.advanceTimersByTime(3999));
    expect(result.current.toasts).toHaveLength(1);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('honours a custom dismiss timeout', () => {
    const { result } = renderHook(() => useToasts(100));
    act(() => result.current.addToast('quick'));
    expect(result.current.toasts).toHaveLength(1);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('dismisses multiple toasts independently', () => {
    const { result } = renderHook(() => useToasts(500));
    act(() => {
      result.current.addToast('one');
      result.current.addToast('two');
    });
    expect(result.current.toasts).toHaveLength(2);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.toasts).toHaveLength(0);
  });
});