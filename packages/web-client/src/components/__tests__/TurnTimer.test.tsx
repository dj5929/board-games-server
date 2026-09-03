import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TurnTimer } from '../TurnTimer';

afterEach(() => {
  vi.useRealTimers();
});

describe('TurnTimer Component', () => {
  it('renders nothing when timer is undefined', () => {
    const { container } = render(<TurnTimer timer={undefined} isMyTurn={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the turn time limit is disabled (0)', () => {
    const { container } = render(
      <TurnTimer timer={{ turnStartedAt: Date.now(), turnTimeLimitMs: 0 }} isMyTurn={true} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the countdown and the "Your turn" label when it is my turn', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    render(
      <TurnTimer timer={{ turnStartedAt: 0, turnTimeLimitMs: 120000 }} isMyTurn={true} />
    );
    expect(screen.getByText('Your turn')).toBeInTheDocument();
    expect(screen.getByText('2:00')).toBeInTheDocument();
  });

  it('shows "Opponent turn" when it is not my turn', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    render(
      <TurnTimer timer={{ turnStartedAt: 0, turnTimeLimitMs: 60000 }} isMyTurn={false} />
    );
    expect(screen.getByText('Opponent turn')).toBeInTheDocument();
    expect(screen.getByText('1:00')).toBeInTheDocument();
  });

  it('decrements the countdown over time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    render(
      <TurnTimer timer={{ turnStartedAt: 0, turnTimeLimitMs: 60000 }} isMyTurn={true} />
    );
    expect(screen.getByText('1:00')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.getByText('0:45')).toBeInTheDocument();
  });
});
