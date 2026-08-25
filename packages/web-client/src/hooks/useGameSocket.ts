import { useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const WS_URL = API_URL.replace(/^http/, 'ws');

export function useGameSocket<TState, TEvent, TAction>(
  roomId: string,
  playerId: string,
  onStateUpdate: (state: TState) => void,
  onEvents: (events: TEvent[]) => void,
  onError: (error: string) => void
) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let isActive = true;
    const ws = new WebSocket(`${WS_URL}/rooms/${roomId}/ws?playerId=${playerId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      if (!isActive) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'STATE_UPDATE') {
          onStateUpdate(data.state);
        } else if (data.type === 'EVENTS') {
          onEvents(data.events);
        } else if (data.type === 'ERROR') {
          onError(data.error);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    ws.onclose = () => {
      if (isActive) onError('Connection lost to server.');
    };
    
    ws.onerror = () => {
      if (isActive) onError('WebSocket error occurred.');
    };

    return () => {
      isActive = false;
      ws.close();
    };
  }, [roomId, playerId, onStateUpdate, onEvents, onError]);

  const sendAction = (action: TAction) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(action));
    } else {
      console.warn('Cannot send action, WebSocket is not open.');
    }
  };

  return { sendAction };
}
