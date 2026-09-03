import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../../App';

const testHooks = vi.hoisted(() => {
  let gameType = 'monopoly' as 'monopoly' | 'catan' | 'scotland-yard';
  return {
    setGameType: (g: 'monopoly' | 'catan' | 'scotland-yard') => { gameType = g; },
    getGameType: () => gameType,
  };
});

vi.mock('../Lobby', () => ({
  Lobby: (props: { onJoinRoom: (roomId: string, ids: string[], type: string, token: string) => void }) => (
    <div>
      LOBBY
      <button onClick={() => props.onJoinRoom('room-1', ['p1'], testHooks.getGameType(), 'tok')}>
        JOIN
      </button>
    </div>
  ),
}));

vi.mock('../GameRoom', () => ({
  GameRoom: (props: { onLeave: () => void }) => (
    <div>
      GAME-MONOPOLY
      <button onClick={props.onLeave}>LEAVE</button>
    </div>
  ),
}));

vi.mock('../CatanRoom', () => ({
  CatanRoom: () => <div>GAME-CATAN</div>,
}));

vi.mock('../ScotlandYardRoom', () => ({
  ScotlandYardRoom: () => <div>GAME-SCOTLAND</div>,
}));

describe('App', () => {
  it('renders the audio toggle and the lobby initially', async () => {
    render(<App />);
    expect(screen.getByTestId('audio-toggle')).toBeInTheDocument();
    expect(await screen.findByText('LOBBY')).toBeInTheDocument();
    expect(screen.queryByText('GAME-MONOPOLY')).not.toBeInTheDocument();
  });

  it('routes a monopoly join into GameRoom and back on leave', async () => {
    testHooks.setGameType('monopoly');
    render(<App />);
    fireEvent.click(await screen.findByText('JOIN'));

    expect(await screen.findByText('GAME-MONOPOLY')).toBeInTheDocument();
    expect(screen.queryByText('LOBBY')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('LEAVE'));
    expect(await screen.findByText('LOBBY')).toBeInTheDocument();
  });

  it('routes a catan join into CatanRoom', async () => {
    testHooks.setGameType('catan');
    render(<App />);
    fireEvent.click(await screen.findByText('JOIN'));
    expect(await screen.findByText('GAME-CATAN')).toBeInTheDocument();
  });

  it('routes a scotland-yard join into ScotlandYardRoom', async () => {
    testHooks.setGameType('scotland-yard');
    render(<App />);
    fireEvent.click(await screen.findByText('JOIN'));
    expect(await screen.findByText('GAME-SCOTLAND')).toBeInTheDocument();
  });
});